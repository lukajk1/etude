import type { TimbreId } from "./types";

export interface TimbreInfo {
  id: TimbreId;
  name: string;
  /** What it stands in for in an orchestra. */
  role: string;
  /** Lane color, taken from the instruments' materials. */
  color: string;
  /** General MIDI program used on export (0-based). */
  gmProgram: number;
  /** Comfortable written range, for the lane's default scroll position. */
  range: [number, number];
}

export const TIMBRES: Record<TimbreId, TimbreInfo> = {
  strings: {
    id: "strings",
    name: "Strings",
    role: "Violins to basses: sustained, bowed, slow to speak",
    color: "#d0894a", // varnished spruce
    gmProgram: 48,
    range: [36, 88],
  },
  woodwinds: {
    id: "woodwinds",
    name: "Woodwinds",
    role: "Flute and clarinet: hollow, breathy, agile",
    color: "#93ad62", // boxwood
    gmProgram: 71,
    range: [50, 96],
  },
  brass: {
    id: "brass",
    name: "Brass",
    role: "Horns, trumpets, trombones: bright attack that opens up",
    color: "#c4922a", // brass
    gmProgram: 61,
    range: [34, 82],
  },
  choir: {
    id: "choir",
    name: "Choir",
    role: "Voices singing “ah”: soprano to bass, slow to bloom",
    color: "#c06a8a", // breath, warmth
    gmProgram: 52,
    range: [40, 81],
  },
  piano: {
    id: "piano",
    name: "Piano",
    role: "Struck strings: bright attack, long ring, damped when you let go",
    color: "#a3895a", // ivory keys, aged
    gmProgram: 0,
    range: [21, 108],
  },
  harp: {
    id: "harp",
    name: "Harp",
    role: "Harp, guitar, celesta: plucked, then rings out",
    color: "#5a84bd", // steel string
    gmProgram: 46,
    range: [24, 100],
  },
  percussion: {
    id: "percussion",
    name: "Percussion",
    role: "Drum kit on the General MIDI drum map (kick 36, snare 38, hats 42)",
    color: "#c9604f", // calfskin and copper
    gmProgram: 0,
    range: [35, 59],
  },
  pure: {
    id: "pure",
    name: "Pure tone",
    role: "A plain sine wave, so you hear the pitch and nothing else",
    color: "#8479b4", // tuning fork
    gmProgram: 79,
    range: [36, 96],
  },
};

export const TIMBRE_ORDER: TimbreId[] = ["strings", "woodwinds", "brass", "choir", "piano", "harp", "percussion", "pure"];

/** Map a General MIDI program (0-based) to the nearest timbre. */
export function timbreForProgram(program: number, percussion: boolean): TimbreId {
  if (percussion) return "percussion";
  if (program <= 7) return "piano";
  if (program <= 15) return "harp"; // chromatic percussion
  if (program <= 23) return "woodwinds"; // organs
  if (program <= 39) return "harp"; // guitars, basses
  if (program <= 45) return "strings";
  if (program <= 47) return "harp"; // harp, timpani
  if (program >= 52 && program <= 54) return "choir"; // choir aahs, voice oohs, synth voice
  if (program <= 55) return "strings"; // ensembles
  if (program <= 63) return "brass";
  if (program <= 79) return "woodwinds"; // reeds, pipes
  if (program <= 87) return "pure"; // synth leads
  if (program <= 95) return "strings"; // pads
  if (program <= 103) return "pure";
  if (program <= 119) return "harp"; // ethnic, pitched percussion
  return "pure";
}
