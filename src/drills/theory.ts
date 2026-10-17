/**
 * Spelled notes for the foundation drills. Pitch alone can't tell C♯ from D♭, but
 * theory answers depend on spelling, so notes here are a letter plus an accidental.
 */

export interface Spelled {
  /** 0–6 for C D E F G A B. */
  letter: number;
  /** -2 double flat … +2 double sharp. */
  acc: number;
  octave: number;
}

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

export const pitchOf = (n: Spelled) => 12 * (n.octave + 1) + NATURAL[n.letter] + n.acc;

const ACC_SYMBOL: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" };
const ACC_CODE: Record<number, string> = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" };

/** Display name, such as "B♭" or "F♯4". */
export const nameOf = (n: Spelled, withOctave = false) => LETTERS[n.letter] + ACC_SYMBOL[n.acc] + (withOctave ? n.octave : "");

/** Answer code, such as "Bb" or "F#". Octave-free. */
export const codeOf = (n: Pick<Spelled, "letter" | "acc">) => LETTERS[n.letter] + ACC_CODE[n.acc];

/** Pretty-print an answer code: "Bb" → "B♭". */
export const prettyCode = (code: string) =>
  code.replace(/^([A-Ga-g])##/, "$1𝄪").replace(/^([A-Ga-g])bb/, "$1𝄫").replace(/^([A-Ga-g])#/, "$1♯").replace(/^([A-Ga-g])b/, "$1♭");

/** VexFlow key, such as "bb/4". */
export const vfKey = (n: Spelled) => `${LETTERS[n.letter].toLowerCase()}${ACC_CODE[n.acc]}/${n.octave}`;

export function parseCode(code: string, octave = 4): Spelled {
  const letter = LETTERS.indexOf(code[0].toUpperCase());
  const rest = code.slice(1);
  const acc = rest === "##" ? 2 : rest === "#" ? 1 : rest === "bb" ? -2 : rest === "b" ? -1 : 0;
  return { letter, acc, octave };
}

/** Same letter and accidental, ignoring octave. */
export const sameSpelling = (a: Pick<Spelled, "letter" | "acc">, b: Pick<Spelled, "letter" | "acc">) => a.letter === b.letter && a.acc === b.acc;

// ---- Intervals ------------------------------------------------------------------

export type Quality = "P" | "M" | "m" | "A" | "d";
const BASE: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 };
const isPerfectNumber = (num: number) => num === 1 || num === 4 || num === 5 || num === 8;

export function semitonesFor(q: Quality, num: number): number {
  const base = BASE[num];
  if (isPerfectNumber(num)) return q === "P" ? base : q === "A" ? base + 1 : base - 1;
  return q === "M" ? base : q === "m" ? base - 1 : q === "A" ? base + 1 : base - 2;
}

/** The note a given interval above `n`. */
export function above(n: Spelled, q: Quality, num: number): Spelled {
  const steps = n.letter + num - 1;
  const letter = steps % 7;
  const octave = n.octave + Math.floor(steps / 7);
  const natural = pitchOf({ letter, acc: 0, octave });
  return { letter, acc: pitchOf(n) + semitonesFor(q, num) - natural, octave };
}

/** Name the interval from `low` up to `high` (within an octave). */
export function intervalBetween(low: Spelled, high: Spelled): { q: Quality; num: number } {
  const num = high.letter + 7 * high.octave - (low.letter + 7 * low.octave) + 1;
  const diff = pitchOf(high) - pitchOf(low) - BASE[num];
  let q: Quality;
  if (isPerfectNumber(num)) q = diff === 0 ? "P" : diff > 0 ? "A" : "d";
  else q = diff === 0 ? "M" : diff === -1 ? "m" : diff > 0 ? "A" : "d";
  return { q, num };
}

const Q_NAME: Record<Quality, string> = { P: "perfect", M: "major", m: "minor", A: "augmented", d: "diminished" };
const NUM_NAME: Record<number, string> = { 1: "unison", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "octave" };

export const intervalCode = (q: Quality, num: number) => `${q}${num}`;
export function intervalLabel(code: string): string {
  const q = code[0] as Quality;
  const num = Number(code.slice(1));
  return `${Q_NAME[q]} ${NUM_NAME[num]}`;
}
export const numberName = (num: number) => NUM_NAME[num];

/** Letter names spanned from one note to another, inclusive (for explanations). */
export function lettersSpanned(low: Spelled, num: number): string {
  return Array.from({ length: num }, (_, i) => LETTERS[(low.letter + i) % 7]).join(" ");
}

// ---- Keys and scales ----------------------------------------------------------------

export interface Key {
  code: string;
  /** Sharps (positive) or flats (negative) in the signature. */
  accidentals: number;
}

export const MAJOR_KEYS: Key[] = [
  { code: "Cb", accidentals: -7 }, { code: "Gb", accidentals: -6 }, { code: "Db", accidentals: -5 },
  { code: "Ab", accidentals: -4 }, { code: "Eb", accidentals: -3 }, { code: "Bb", accidentals: -2 },
  { code: "F", accidentals: -1 }, { code: "C", accidentals: 0 }, { code: "G", accidentals: 1 },
  { code: "D", accidentals: 2 }, { code: "A", accidentals: 3 }, { code: "E", accidentals: 4 },
  { code: "B", accidentals: 5 }, { code: "F#", accidentals: 6 }, { code: "C#", accidentals: 7 },
];

export const MINOR_KEYS: Key[] = [
  { code: "Ab", accidentals: -7 }, { code: "Eb", accidentals: -6 }, { code: "Bb", accidentals: -5 },
  { code: "F", accidentals: -4 }, { code: "C", accidentals: -3 }, { code: "G", accidentals: -2 },
  { code: "D", accidentals: -1 }, { code: "A", accidentals: 0 }, { code: "E", accidentals: 1 },
  { code: "B", accidentals: 2 }, { code: "F#", accidentals: 3 }, { code: "C#", accidentals: 4 },
  { code: "G#", accidentals: 5 }, { code: "D#", accidentals: 6 }, { code: "A#", accidentals: 7 },
];

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

/** The accidentals of a signature, in order: "F♯, C♯, G♯". */
export function signatureNotes(accidentals: number): string {
  if (accidentals === 0) return "no sharps or flats";
  const names = accidentals > 0 ? SHARP_ORDER.slice(0, accidentals).map((l) => l + "♯") : FLAT_ORDER.slice(0, -accidentals).map((l) => l + "♭");
  return names.join(", ");
}

export const accidentalsLabel = (n: number) => (n === 0 ? "None" : n > 0 ? `${n} ♯` : `${-n} ♭`);

export type ScaleKind = "major" | "natural minor" | "harmonic minor" | "melodic minor";
export const SCALE_STEPS: Record<ScaleKind, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  "natural minor": [0, 2, 3, 5, 7, 8, 10],
  "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
  "melodic minor": [0, 2, 3, 5, 7, 9, 11],
};

/** The seven spelled degrees of a scale on `tonic`. */
export function scaleNotes(tonic: Spelled, kind: ScaleKind): Spelled[] {
  return SCALE_STEPS[kind].map((semis, i) => {
    const steps = tonic.letter + i;
    const letter = steps % 7;
    const octave = tonic.octave + Math.floor(steps / 7);
    return { letter, acc: pitchOf(tonic) + semis - pitchOf({ letter, acc: 0, octave }), octave };
  });
}

// ---- Triads -----------------------------------------------------------------------

export type TriadQuality = "major" | "minor" | "diminished" | "augmented";
const TRIAD_SHAPE: Record<TriadQuality, [Quality, Quality]> = {
  major: ["M", "P"],
  minor: ["m", "P"],
  diminished: ["m", "d"],
  augmented: ["M", "A"],
};

/** Root, third and fifth. */
export function triad(root: Spelled, quality: TriadQuality): [Spelled, Spelled, Spelled] {
  const [third, fifth] = TRIAD_SHAPE[quality];
  return [root, above(root, third, 3), above(root, fifth, 5)];
}

// ---- Randomness -----------------------------------------------------------------------

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const singleAccidentals = (...notes: Spelled[]) => notes.every((n) => Math.abs(n.acc) <= 1);
