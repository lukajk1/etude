import * as Tone from "tone";
import type { TimbreId } from "../model/types";
import { DrumKit } from "./drums";
import { PianoVoice } from "./piano";
import type { Voice } from "./sources/types";

/** The synth source's instruments: oscillators, filters and envelopes, one per timbre. */

const hz = (pitch: number) => Tone.mtof(pitch as Tone.Unit.MidiNote);

/** Wraps a PolySynth and the effect chain after it. */
class PolyVoice implements Voice {
  readonly output: Tone.Gain;
  constructor(
    private synth: Tone.PolySynth,
    private chain: Tone.ToneAudioNode[],
    gainDb: number,
  ) {
    this.output = new Tone.Gain(Tone.dbToGain(gainDb));
    synth.maxPolyphony = 64;
    synth.chain(...chain, this.output);
  }
  play(pitch: number, time: number, dur: number, vel: number) {
    this.synth.triggerAttackRelease(hz(pitch), Math.max(0.02, dur), time, vel);
  }
  releaseAll() {
    this.synth.releaseAll();
  }
  dispose() {
    this.synth.dispose();
    for (const n of this.chain) n.dispose();
    this.output.dispose();
  }
}

class DrumVoice implements Voice {
  private kit = new DrumKit();
  readonly output = this.kit.output;
  play(pitch: number, time: number, _dur: number, vel: number) {
    this.kit.play(pitch, time, vel);
  }
  releaseAll() {}
  dispose() {
    this.kit.dispose();
  }
}

/**
 * Voices singing "ah": an ensemble of detuned saws (several singers per note) through
 * three band-pass filters at the formants of an open "ah" vowel.
 */
class ChoirVoice implements Voice {
  readonly output = new Tone.Gain(Tone.dbToGain(2.5));
  private synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 4, spread: 26 },
    envelope: { attack: 0.22, decay: 0.3, sustain: 0.9, release: 0.6 },
  });
  private vibrato = new Tone.Vibrato({ frequency: 5, depth: 0.07 });
  private nodes: Tone.ToneAudioNode[] = [];

  constructor() {
    this.synth.maxPolyphony = 64;
    this.synth.connect(this.vibrato);
    const formants: [number, number, number][] = [
      // [Hz, Q, gain]
      [760, 5, 1],
      [1180, 7, 0.55],
      [2650, 9, 0.22],
    ];
    for (const [hz, q, gain] of formants) {
      const f = new Tone.Filter({ type: "bandpass", frequency: hz, Q: q });
      const g = new Tone.Gain(gain);
      this.vibrato.chain(f, g, this.output);
      this.nodes.push(f, g);
    }
    // Some of the plain tone underneath, for the body of low voices.
    const body = new Tone.Filter({ type: "lowpass", frequency: 700 });
    const bodyGain = new Tone.Gain(0.25);
    this.vibrato.chain(body, bodyGain, this.output);
    this.nodes.push(body, bodyGain);
  }
  play(pitch: number, time: number, dur: number, vel: number) {
    this.synth.triggerAttackRelease(hz(pitch), Math.max(0.05, dur), time, vel);
  }
  releaseAll() {
    this.synth.releaseAll();
  }
  dispose() {
    this.synth.dispose();
    this.vibrato.dispose();
    for (const n of this.nodes) n.dispose();
    this.output.dispose();
  }
}

export function createVoice(timbre: TimbreId): Voice {
  switch (timbre) {
    case "strings": {
      // Detuned saws, softened by a low-pass, with a soft bow-like attack and vibrato.
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 22 },
        envelope: { attack: 0.07, decay: 0.3, sustain: 0.85, release: 0.4 },
      });
      const filter = new Tone.Filter({ type: "lowpass", frequency: 2600, rolloff: -24, Q: 0.4 });
      const vibrato = new Tone.Vibrato({ frequency: 5.2, depth: 0.06 });
      return new PolyVoice(synth, [filter, vibrato], -7.5);
    }
    case "woodwinds": {
      // Mostly odd harmonics, like a clarinet, rounded off toward a flute.
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "custom", partials: [1, 0.08, 0.42, 0.04, 0.2, 0.02, 0.09, 0.01, 0.04] },
        envelope: { attack: 0.05, decay: 0.12, sustain: 0.9, release: 0.14 },
      });
      const filter = new Tone.Filter({ type: "lowpass", frequency: 3800, rolloff: -12 });
      const vibrato = new Tone.Vibrato({ frequency: 5.6, depth: 0.05 });
      return new PolyVoice(synth, [filter, vibrato], -14.5);
    }
    case "brass": {
      // A saw behind a filter that opens on each attack, which gives brass its "blat".
      const synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.045, decay: 0.25, sustain: 0.8, release: 0.22 },
        filter: { type: "lowpass", rolloff: -24, Q: 1.2 },
        filterEnvelope: { attack: 0.07, decay: 0.35, sustain: 0.55, release: 0.25, baseFrequency: 260, octaves: 3.4, exponent: 2 },
      });
      return new PolyVoice(synth, [], -11.5);
    }
    case "harp": {
      // Plucked: instant attack, no sustain, a long natural decay.
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "custom", partials: [1, 0.45, 0.18, 0.1, 0.04, 0.02] },
        envelope: { attack: 0.002, decay: 1.9, sustain: 0, release: 1.6 },
      });
      const filter = new Tone.Filter({ type: "lowpass", frequency: 5000, rolloff: -12 });
      return new PolyVoice(synth, [filter], -3.5);
    }
    case "pure": {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.18 },
      });
      return new PolyVoice(synth, [], -12.5);
    }
    case "supersaw": {
      // Seven detuned saws, the trance and EDM chord sound, trimmed of mud and fizz and widened by a chorus.
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 7, spread: 38 },
        envelope: { attack: 0.012, decay: 0.2, sustain: 0.85, release: 0.35 },
      });
      const highpass = new Tone.Filter({ type: "highpass", frequency: 140 });
      const lowpass = new Tone.Filter({ type: "lowpass", frequency: 7000, rolloff: -12 });
      const chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.6, wet: 0.45 }).start();
      return new PolyVoice(synth, [highpass, lowpass, chorus], -8.5);
    }
    case "pluck": {
      // A saw pair whose filter snaps shut, so each note is a bright click that dies fast, then echoes.
      const synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "fatsawtooth", count: 2, spread: 14 },
        envelope: { attack: 0.003, decay: 0.32, sustain: 0.08, release: 0.25 },
        filter: { type: "lowpass", rolloff: -24, Q: 2 },
        filterEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2, baseFrequency: 300, octaves: 4.4, exponent: 2 },
      });
      const delay = new Tone.FeedbackDelay({ delayTime: 0.28, feedback: 0.28, wet: 0.22 });
      return new PolyVoice(synth, [delay], -4);
    }
    case "percussion":
      return new DrumVoice();
    case "piano":
      return new PianoVoice();
    case "choir":
      return new ChoirVoice();
  }
}
