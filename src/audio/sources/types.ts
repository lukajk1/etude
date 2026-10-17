import type * as Tone from "tone";
import type { TimbreId } from "../../model/types";

/**
 * One lane's sound generator. Whatever makes the sound (oscillators, recorded samples,
 * a physical model), the engine only ever talks to it through this.
 * Times are AudioContext seconds.
 */
export interface Voice {
  readonly output: Tone.ToneAudioNode;
  play(pitch: number, time: number, dur: number, vel: number): void;
  /** Silence everything now (playback stopped). */
  releaseAll(): void;
  dispose(): void;
}

/**
 * A way of making instrument sounds. Add a new approach by implementing this and
 * registering it in `sources/index.ts`; nothing else in the app needs to change.
 * Timbres a source doesn't support (or hasn't loaded yet) fall back to the synth.
 */
export interface SoundSource {
  id: string;
  /** Short label for the Sound menu. */
  name: string;
  /** One line on what it is. */
  description: string;
  supports(timbre: TimbreId): boolean;
  /** Fetch and prepare whatever the timbres need. Safe to call repeatedly. */
  load(timbres: TimbreId[], onProgress?: (fraction: number) => void): Promise<void>;
  isReady(timbre: TimbreId): boolean;
  /** Build a voice in the current Tone context. Only called when `isReady` is true. */
  createVoice(timbre: TimbreId): Voice;
  /** Attribution for the sound of a timbre, if any is owed. */
  credit?(timbre: TimbreId): string | null;
}
