import type { ScaleId } from "../model/types";

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
export const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export interface ScaleInfo {
  name: string;
  steps: number[];
  /** True for scales whose third is minor; decides sharps vs flats and chord numerals. */
  minorish: boolean;
}

export const SCALES: Record<ScaleId, ScaleInfo> = {
  chromatic: { name: "None (chromatic)", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], minorish: false },
  major: { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11], minorish: false },
  minor: { name: "Natural minor", steps: [0, 2, 3, 5, 7, 8, 10], minorish: true },
  harmonicMinor: { name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11], minorish: true },
  melodicMinor: { name: "Melodic minor", steps: [0, 2, 3, 5, 7, 9, 11], minorish: true },
  dorian: { name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10], minorish: true },
  phrygian: { name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10], minorish: true },
  lydian: { name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11], minorish: false },
  mixolydian: { name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], minorish: false },
  locrian: { name: "Locrian", steps: [0, 1, 3, 5, 6, 8, 10], minorish: true },
  majorPentatonic: { name: "Major pentatonic", steps: [0, 2, 4, 7, 9], minorish: false },
  minorPentatonic: { name: "Minor pentatonic", steps: [0, 3, 5, 7, 10], minorish: true },
  blues: { name: "Blues", steps: [0, 3, 5, 6, 7, 10], minorish: true },
};

export const SCALE_ORDER: ScaleId[] = [
  "chromatic", "major", "minor", "harmonicMinor", "melodicMinor",
  "dorian", "phrygian", "lydian", "mixolydian", "locrian",
  "majorPentatonic", "minorPentatonic", "blues",
];

/** Whether a key spells accidentals with flats. */
export function usesFlats(key: number, scale: ScaleId): boolean {
  const major = SCALES[scale].minorish ? (key + 3) % 12 : key;
  return [5, 10, 3, 8, 1, 6].includes(major); // F B♭ E♭ A♭ D♭ G♭
}

export function pcName(pc: number, flats = false): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
}

export function noteName(pitch: number, flats = false): string {
  return `${pcName(pitch, flats)}${Math.floor(pitch / 12) - 1}`;
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

/** 1-based scale degree of a pitch, or 0 if it is outside the scale. */
export function scaleDegree(pitch: number, key: number, scale: ScaleId): number {
  const rel = (((pitch - key) % 12) + 12) % 12;
  return SCALES[scale].steps.indexOf(rel) + 1;
}

const DEGREE_NAMES = ["tonic", "supertonic", "mediant", "subdominant", "dominant", "submediant", "leading tone"];
export function degreeName(degree: number, scale: ScaleId): string {
  if (SCALES[scale].steps.length !== 7) return `degree ${degree}`;
  if (degree === 7 && SCALES[scale].steps[6] === 10) return "subtonic";
  return DEGREE_NAMES[degree - 1];
}

const INTERVAL_NAMES = [
  "unison", "minor 2nd", "major 2nd", "minor 3rd", "major 3rd", "perfect 4th",
  "tritone", "perfect 5th", "minor 6th", "major 6th", "minor 7th", "major 7th",
];

export function intervalName(semitones: number): string {
  const s = Math.abs(semitones);
  if (s === 0) return "unison";
  if (s === 12) return "octave";
  const octaves = Math.floor(s / 12);
  const base = INTERVAL_NAMES[s % 12];
  if (s % 12 === 0) return `${octaves} octaves`;
  return octaves > 0 ? `${base} + ${octaves} oct` : base;
}

interface ChordShape {
  intervals: number[];
  symbol: string;
  minor: boolean;
  /** Roman-numeral suffix. */
  numeral: string;
}

const CHORDS: ChordShape[] = [
  { intervals: [0, 4, 7], symbol: "", minor: false, numeral: "" },
  { intervals: [0, 3, 7], symbol: "m", minor: true, numeral: "" },
  { intervals: [0, 3, 6], symbol: "dim", minor: true, numeral: "°" },
  { intervals: [0, 4, 8], symbol: "aug", minor: false, numeral: "+" },
  { intervals: [0, 2, 7], symbol: "sus2", minor: false, numeral: "sus2" },
  { intervals: [0, 5, 7], symbol: "sus4", minor: false, numeral: "sus4" },
  { intervals: [0, 4, 7, 11], symbol: "maj7", minor: false, numeral: "maj7" },
  { intervals: [0, 4, 7, 10], symbol: "7", minor: false, numeral: "7" },
  { intervals: [0, 3, 7, 10], symbol: "m7", minor: true, numeral: "7" },
  { intervals: [0, 3, 6, 10], symbol: "m7♭5", minor: true, numeral: "ø7" },
  { intervals: [0, 3, 6, 9], symbol: "dim7", minor: true, numeral: "°7" },
  { intervals: [0, 3, 7, 11], symbol: "m(maj7)", minor: true, numeral: "(maj7)" },
  { intervals: [0, 4, 7, 9], symbol: "6", minor: false, numeral: "6" },
  { intervals: [0, 3, 7, 9], symbol: "m6", minor: true, numeral: "6" },
  { intervals: [0, 2, 4, 7], symbol: "add9", minor: false, numeral: "add9" },
  { intervals: [0, 2, 3, 7], symbol: "m(add9)", minor: true, numeral: "add9" },
  { intervals: [0, 2, 4, 7, 10], symbol: "9", minor: false, numeral: "9" },
  { intervals: [0, 2, 4, 7, 11], symbol: "maj9", minor: false, numeral: "maj9" },
  { intervals: [0, 2, 3, 7, 10], symbol: "m9", minor: true, numeral: "9" },
  // Fifth left out, as is common in real voicings.
  { intervals: [0, 4, 11], symbol: "maj7", minor: false, numeral: "maj7" },
  { intervals: [0, 4, 10], symbol: "7", minor: false, numeral: "7" },
  { intervals: [0, 3, 10], symbol: "m7", minor: true, numeral: "7" },
  { intervals: [0, 7], symbol: "5", minor: false, numeral: "5" },
];

const NUMERALS = ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"];

export interface ChordReading {
  /** Display text, such as "Am7" or "C/E". */
  name: string;
  /** Roman numeral relative to the key, such as "vi7". */
  numeral: string | null;
  /** Explanation for one or two pitch classes. */
  detail: string | null;
}

/** Name the chord (or interval) formed by a set of sounding pitches. */
export function readChord(pitches: number[], key: number, scale: ScaleId): ChordReading | null {
  if (pitches.length === 0) return null;
  const flats = usesFlats(key, scale);
  const sorted = [...pitches].sort((a, b) => a - b);
  const bass = sorted[0] % 12;
  const pcs = [...new Set(sorted.map((p) => p % 12))];

  if (pcs.length === 1) {
    return { name: pcName(pcs[0], flats), numeral: null, detail: sorted.length > 1 ? "octaves" : "single note" };
  }
  if (pcs.length === 2 && sorted.length === 2) {
    const iv = sorted[1] - sorted[0];
    return {
      name: `${pcName(sorted[0], flats)} + ${pcName(sorted[1], flats)}`,
      numeral: null,
      detail: intervalName(iv),
    };
  }

  let best: { root: number; shape: ChordShape; score: number } | null = null;
  for (const root of pcs) {
    const rel = pcs.map((pc) => (pc - root + 12) % 12).sort((a, b) => a - b);
    for (const shape of CHORDS) {
      if (shape.intervals.length !== rel.length) continue;
      if (!shape.intervals.every((iv, i) => iv === rel[i])) continue;
      // Prefer root position, then fuller shapes listed earlier.
      const score = (root === bass ? 10 : 0) - CHORDS.indexOf(shape) * 0.01;
      if (!best || score > best.score) best = { root, shape, score };
    }
  }

  if (!best) {
    if (pcs.length === 2) {
      const iv = (pcs[1] - pcs[0] + 12) % 12;
      return { name: `${pcName(pcs[0], flats)} + ${pcName(pcs[1], flats)}`, numeral: null, detail: intervalName(iv) };
    }
    return { name: pcs.map((pc) => pcName(pc, flats)).join(" "), numeral: null, detail: "no common chord name" };
  }

  const rootName = pcName(best.root, flats);
  const slash = best.root !== bass ? `/${pcName(bass, flats)}` : "";
  let numeral: string | null = null;
  if (scale !== "chromatic") {
    const deg = (best.root - key + 12) % 12;
    const base = NUMERALS[deg];
    numeral = (best.shape.minor ? base.toLowerCase() : base) + best.shape.numeral;
  }
  return { name: `${rootName}${best.shape.symbol}${slash}`, numeral, detail: null };
}

/** General MIDI drum names for the percussion lane. */
export const DRUM_NAMES: Record<number, string> = {
  35: "Kick 2", 36: "Kick", 37: "Side stick", 38: "Snare", 39: "Clap", 40: "Snare 2",
  41: "Floor tom 2", 42: "Hi-hat closed", 43: "Floor tom", 44: "Hi-hat pedal", 45: "Low tom",
  46: "Hi-hat open", 47: "Low-mid tom", 48: "High-mid tom", 49: "Crash", 50: "High tom",
  51: "Ride", 52: "China", 53: "Ride bell", 54: "Tambourine", 55: "Splash", 56: "Cowbell",
  57: "Crash 2", 59: "Ride 2",
};
