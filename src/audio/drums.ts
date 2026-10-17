import * as Tone from "tone";

type Ctx = BaseAudioContext;

const noiseBuffers = new WeakMap<object, AudioBuffer>();

export function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

const TOM_HZ: Record<number, number> = { 41: 68, 43: 82, 45: 98, 47: 118, 48: 140, 50: 165 };

/**
 * A synthesized drum kit laid out on the General MIDI drum map. Each hit builds its own
 * short-lived Web Audio nodes, so any number of hits can overlap.
 */
export class DrumKit {
  readonly output = new Tone.Gain(1);
  private ctx: Ctx;

  constructor() {
    this.ctx = this.output.context.rawContext as unknown as Ctx;
  }

  play(pitch: number, time: number, vel: number) {
    const v = Math.max(0.05, vel);
    switch (pitch) {
      case 35:
      case 36:
        return this.kick(time, v);
      case 37:
        this.noise(time, v * 0.5, 0.03, "bandpass", 2600, 1.5);
        this.tone(time, 820, 0.02, v * 0.4, "square");
        return;
      case 38:
      case 40:
        return this.snare(time, v);
      case 39:
        return this.clap(time, v);
      case 42:
        return this.noise(time, v * 0.45, 0.05, "highpass", 7500);
      case 44:
        return this.noise(time, v * 0.35, 0.09, "highpass", 6500);
      case 46:
        return this.noise(time, v * 0.4, 0.4, "highpass", 7000);
      case 49:
      case 52:
      case 55:
      case 57:
        return this.noise(time, v * 0.45, pitch === 55 ? 0.6 : 1.8, "highpass", 4200);
      case 51:
      case 53:
      case 59:
        this.noise(time, v * 0.22, 1.0, "bandpass", 6200, 0.8);
        this.tone(time, 3400, 0.5, v * 0.05, "sine");
        return;
      case 54:
        return this.noise(time, v * 0.35, 0.2, "bandpass", 9000, 1.2);
      case 56:
        this.tone(time, 545, 0.3, v * 0.2, "square");
        this.tone(time, 815, 0.3, v * 0.2, "square");
        return;
      default: {
        const hz = TOM_HZ[pitch] ?? Tone.mtof(pitch as Tone.Unit.MidiNote);
        return this.tom(time, hz, v);
      }
    }
  }

  private env(time: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    Tone.connect(g, this.output);
    return g;
  }

  private tone(time: number, hz: number, decay: number, peak: number, type: OscillatorType) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.connect(this.env(time, peak, decay));
    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  private noise(time: number, peak: number, decay: number, type: BiquadFilterType, hz: number, q = 0.7) {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    src.connect(f).connect(this.env(time, peak, decay));
    src.start(time, Math.random());
    src.stop(time + decay + 0.05);
  }

  private kick(time: number, v: number) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
    osc.connect(this.env(time, v * 1.1, 0.45));
    osc.start(time);
    osc.stop(time + 0.5);
  }

  private tom(time: number, hz: number, v: number) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(hz * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(hz, time + 0.08);
    osc.connect(this.env(time, v * 0.8, 0.5));
    osc.start(time);
    osc.stop(time + 0.55);
    this.noise(time, v * 0.08, 0.06, "lowpass", 2000);
  }

  private snare(time: number, v: number) {
    this.noise(time, v * 0.55, 0.2, "highpass", 1400);
    this.tone(time, 190, 0.11, v * 0.45, "triangle");
  }

  private clap(time: number, v: number) {
    for (const dt of [0, 0.011, 0.022]) this.noise(time + dt, v * 0.4, 0.03, "bandpass", 1300, 1.2);
    this.noise(time + 0.03, v * 0.35, 0.2, "bandpass", 1300, 1.2);
  }

  dispose() {
    this.output.dispose();
  }
}
