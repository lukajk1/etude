import * as Tone from "tone";
import { PPQ, secondsBetween, tempoAt, tempoMap, type Note, type Project, type TempoChange, type TimbreId } from "../model/types";
import { sourceFor, type Voice } from "./sources";

interface Lane {
  timbre: TimbreId;
  /** Which sound source built the voice. */
  source: string;
  voice: Voice;
  channel: Tone.Channel;
  notes: Note[] | null;
  part: Tone.Part | null;
}

/** A stereo room impulse response: decaying noise, darker as it fades. */
function makeImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const coeff = 0.25 + 0.7 * t; // more smoothing over time = darker tail
      lp = lp * coeff + (Math.random() * 2 - 1) * (1 - coeff);
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

/**
 * The last safety net on the output: straight through below -2 dBFS, then a smooth
 * curve that approaches but never reaches full scale, so peaks round off instead of
 * clipping.
 */
function softClip(x: number): number {
  const knee = 0.8;
  const a = Math.abs(x);
  return a <= knee ? x : Math.sign(x) * (knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee)));
}

/**
 * Turns a Project into sound. Works in the live context or inside Tone.Offline
 * (every node is created in whichever context is current when it is constructed).
 */
export class Engine {
  readonly ctx = Tone.getContext();
  private lanes = new Map<string, Lane>();
  private bus = new Tone.Gain(1);
  /** Room above one note's level: chords and full scores add up to much more. */
  private headroom = new Tone.Gain(Tone.dbToGain(-4));
  private limiter = new Tone.Compressor({ threshold: -6, ratio: 12, knee: 4, attack: 0.002, release: 0.12 });
  private master = new Tone.Gain(1);
  private clipper = new Tone.WaveShaper(softClip, 4096);
  private tempos: TempoChange[] = [{ tick: 0, bpm: 120 }];
  private tempoKey = "";
  private tempoEvents: number[] = [];
  private loopStart = 0;
  /** Voices playing notes outside the project (ear training), each behind its own gate. */
  private previews: { voice: Voice; gate: Tone.Gain }[] = [];

  /** @param sourceId the sound source to play with (see audio/sources). */
  constructor(private sourceId: string) {
    const raw = this.ctx.rawContext as unknown as BaseAudioContext;
    const reverb = new Tone.Convolver(makeImpulse(raw, 2.6));
    const reverbReturn = new Tone.Gain(0.28);
    this.clipper.oversample = "4x";
    this.bus.connect(this.headroom);
    this.bus.chain(reverb, reverbReturn, this.headroom);
    this.headroom.chain(this.limiter, this.master, this.clipper, this.ctx.destination);
    this.ctx.transport.PPQ = PPQ;
    // Coming back round a loop, restore the tempo in force at the loop's start.
    this.ctx.transport.on("loop", (time) => {
      this.transport.bpm.setValueAtTime(tempoAt(this.tempos, this.loopStart), time);
    });
  }

  get transport() {
    return this.ctx.transport;
  }

  /** Bring lanes, mixer settings, tempo and scheduled notes in line with the project. */
  sync(project: Project) {
    const t = this.transport;
    const map = tempoMap(project);
    const key = JSON.stringify(map);
    if (key !== this.tempoKey) {
      this.tempoKey = key;
      this.tempos = map;
      for (const id of this.tempoEvents) t.clear(id);
      this.tempoEvents = map.slice(1).map((c) => t.schedule((time) => t.bpm.setValueAtTime(c.bpm, time), `${c.tick}i`));
      t.bpm.value = tempoAt(map, t.state === "started" ? t.ticks : 0);
    }
    this.loopStart = project.loop.start;
    t.timeSignature = project.timeSig[0] * (4 / project.timeSig[1]);
    t.loop = project.loop.on;
    if (project.loop.end > project.loop.start) {
      t.setLoopPoints(`${project.loop.start}i`, `${project.loop.end}i`);
    }

    const live = new Set(project.tracks.map((tr) => tr.id));
    for (const [id, lane] of this.lanes) {
      if (!live.has(id)) {
        this.disposeLane(lane);
        this.lanes.delete(id);
      }
    }

    for (const track of project.tracks) {
      let lane = this.lanes.get(track.id);
      const source = sourceFor(this.sourceId, track.timbre);
      if (lane && (lane.timbre !== track.timbre || lane.source !== source.id)) {
        lane.part?.dispose();
        lane.voice.releaseAll();
        lane.voice.dispose();
        lane.voice = source.createVoice(track.timbre);
        lane.voice.output.connect(lane.channel);
        lane.timbre = track.timbre;
        lane.source = source.id;
        lane.notes = null;
        lane.part = null;
      }
      if (!lane) {
        const channel = new Tone.Channel().connect(this.bus);
        const voice = source.createVoice(track.timbre);
        voice.output.connect(channel);
        lane = { timbre: track.timbre, source: source.id, voice, channel, notes: null, part: null };
        this.lanes.set(track.id, lane);
      }
      lane.channel.volume.value = track.volume;
      lane.channel.pan.value = track.pan;
      lane.channel.mute = track.mute;
      lane.channel.solo = track.solo;

      // Immer keeps unchanged arrays identical, so this only rebuilds edited lanes.
      if (lane.notes !== track.notes) {
        lane.part?.dispose();
        lane.part = this.buildPart(lane, track.notes);
        lane.notes = track.notes;
      }
    }
  }

  private buildPart(lane: Lane, notes: Note[]): Tone.Part | null {
    if (notes.length === 0) return null;
    const events = notes.map((n) => ({ time: `${n.start}i`, note: n }));
    const part = new Tone.Part<{ time: string; note: Note }>((time, { note: n }) => {
      lane.voice.play(n.pitch, time, secondsBetween(this.tempos, n.start, n.start + n.dur), n.vel);
    }, events);
    part.start(0);
    return part;
  }

  /**
   * Play notes outside the project, such as ear-training questions. `events` times are
   * seconds from now.
   */
  preview(timbre: TimbreId, events: { pitches: number[]; at: number; dur: number; vel?: number }[]) {
    // A new preview replaces the last one, including notes it hasn't reached yet.
    this.stopPreview();
    const voice = sourceFor(this.sourceId, timbre).createVoice(timbre);
    const gate = new Tone.Gain(1).connect(this.bus);
    voice.output.connect(gate);
    this.previews.push({ voice, gate });
    const t0 = this.ctx.currentTime + 0.05;
    for (const e of events) for (const pitch of e.pitches) voice.play(pitch, t0 + e.at, e.dur, e.vel ?? 0.7);
  }

  /** Fade out and discard any preview, cancelling its scheduled notes. */
  stopPreview() {
    for (const { voice, gate } of this.previews.splice(0)) {
      gate.gain.rampTo(0, 0.04);
      setTimeout(() => {
        voice.dispose();
        gate.dispose();
      }, 150);
    }
  }

  /** Switch sound source. Takes effect on the next `sync`. */
  setSource(id: string) {
    this.sourceId = id;
  }

  /** Master volume, 0–1 on a perceptual (squared) curve. */
  setMasterVolume(v: number) {
    this.master.gain.rampTo(v * v, 0.03);
  }

  play(fromTick: number) {
    const t = this.transport;
    t.stop();
    for (const lane of this.lanes.values()) lane.voice.releaseAll();
    t.bpm.value = tempoAt(this.tempos, fromTick);
    t.start("+0.06", `${fromTick}i`);
  }

  stop() {
    this.transport.stop();
    for (const lane of this.lanes.values()) lane.voice.releaseAll();
  }

  get ticks(): number {
    return this.transport.ticks;
  }

  /** Sound one note now, for clicking keys or placing notes. */
  audition(trackId: string, pitch: number, vel = 0.75, seconds = 0.45) {
    const lane = this.lanes.get(trackId);
    if (!lane || this.ctx.state !== "running") return;
    lane.voice.play(pitch, this.ctx.currentTime + 0.01, seconds, vel);
  }

  private disposeLane(lane: Lane) {
    lane.part?.dispose();
    lane.voice.dispose();
    lane.channel.dispose();
  }

  dispose() {
    for (const lane of this.lanes.values()) this.disposeLane(lane);
    this.lanes.clear();
    this.bus.dispose();
    this.limiter.dispose();
    this.master.dispose();
  }
}
