import { createVoice } from "../instruments";
import type { SoundSource } from "./types";

/** The original oscillator-and-filter instruments. Plays every timbre, needs no loading. */
export const synthSource: SoundSource = {
  id: "synth",
  name: "Synth",
  description: "Built from oscillators and filters. Instant, light, and clearly electronic.",
  supports: () => true,
  load: async () => {},
  isReady: () => true,
  createVoice,
};
