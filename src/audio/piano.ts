import * as Tone from "tone";
import { noiseBuffer } from "./drums";

type Ctx = BaseAudioContext;

/** Relative strength of each partial at the hammer strike. */
const PARTIALS = [1, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05];

/**
 * A struck-string piano. Each note is a handful of slightly stretched sine partials
 * (piano strings are a little inharmonic), the higher ones dying away faster, behind a
 * low-pass that closes as the note decays. Harder notes start brighter. Releasing the
 * key drops the damper.
 */
export class PianoVoice {
  readonly output = new Tone.Gain(1);
  private ctx: Ctx;
  private sounding = new Set<{ gain: GainNode; end: number }>();

  constructor() {
    this.ctx = this.output.context.rawContext as unknown as Ctx;
  }

  play(pitch: number, time: number, dur: number, vel: number) {
    const ctx = this.ctx;
    const v = Math.max(0.05, Math.min(1, vel));
    const f0 = Tone.mtof(pitch as Tone.Unit.MidiNote);
    // Low strings ring for seconds; the top of the keyboard dies almost at once.
    const ring = Math.max(0.6, Math.min(6, 6 - (pitch - 21) * 0.062));
    const off = time + Math.max(0.04, dur);
    const end = Math.min(time + ring, off + 0.5);

    const master = ctx.createGain();
    const peak = 0.27 * Math.pow(v, 1.4);
    master.gain.setValueAtTime(peak, time);
    master.gain.setTargetAtTime(0, off, 0.07);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.5;
    const bright = Math.min(14000, f0 * (2.5 + 10 * v));
    lp.frequency.setValueAtTime(bright, time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(250, f0 * 1.6), time + ring * 0.7);
    lp.connect(master);
    Tone.connect(master, this.output);

    const inharmonicity = 0.00015 + Math.max(0, pitch - 60) * 0.00001;
    PARTIALS.forEach((amp, i) => {
      const n = i + 1;
      const freq = n * f0 * Math.sqrt(1 + inharmonicity * n * n);
      if (freq > 12000) return;
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const decay = ring / (1 + 0.7 * i);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(amp, time + 0.003);
      g.gain.setTargetAtTime(0, time + 0.003, decay / 4.6);
      osc.connect(g).connect(lp);
      osc.start(time);
      osc.stop(end + 0.3);
    });

    // The felt hammer hitting the string: a tiny filtered click.
    const hammer = ctx.createBufferSource();
    hammer.buffer = noiseBuffer(ctx);
    const hf = ctx.createBiquadFilter();
    hf.type = "bandpass";
    hf.frequency.value = Math.min(6000, f0 * 5);
    hf.Q.value = 1.2;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.18 * v, time);
    hg.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    hammer.connect(hf).connect(hg).connect(lp);
    hammer.start(time, Math.random());
    hammer.stop(time + 0.05);

    const entry = { gain: master, end: end + 0.3 };
    this.sounding.add(entry);
    for (const e of this.sounding) if (e.end < ctx.currentTime) this.sounding.delete(e);
  }

  /** Lift every key now (used when playback stops). */
  releaseAll() {
    const now = this.ctx.currentTime;
    for (const e of this.sounding) {
      e.gain.gain.cancelScheduledValues(now);
      e.gain.gain.setTargetAtTime(0, now, 0.04);
    }
    this.sounding.clear();
  }

  dispose() {
    this.releaseAll();
    this.output.dispose();
  }
}
