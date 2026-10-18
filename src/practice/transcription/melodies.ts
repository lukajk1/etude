import { PPQ } from "../../model/types";

/**
 * Melodies for transcription (melodic dictation), all public domain and all written
 * in C major. They're ordered the way Kodály-style courses introduce intervals: a few
 * at a time, steps first, then 3rds, then 4ths and 5ths.
 */

export interface TargetNote {
  pitch: number;
  start: number;
  dur: number;
}

export interface Melody {
  id: string;
  number: string;
  title: string;
  summary: string;
  timeSig: [number, number];
  bpm: number;
  notes: TargetNote[];
}

const NAT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "E4" → MIDI 64. */
function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name ${name}`);
  return 12 * (Number(m[3]) + 1) + NAT[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

/** Notes as "E4:1" (name and beats), separated by spaces; bars marked with "|" for readability. */
function parse(spec: string, startBeat = 0): TargetNote[] {
  const out: TargetNote[] = [];
  let beat = startBeat;
  for (const token of spec.split(/\s+/)) {
    if (!token || token === "|") continue;
    const [name, len] = token.split(":");
    const beats = Number(len);
    if (name !== "r") out.push({ pitch: midi(name), start: Math.round(beat * PPQ), dur: Math.round(beats * PPQ) });
    beat += beats;
  }
  return out;
}

export const MELODIES: Melody[] = [
  {
    id: "tr-hot-cross-buns",
    number: "T1",
    title: "Hot Cross Buns",
    summary: "Three notes, all steps.",
    timeSig: [4, 4],
    bpm: 100,
    notes: parse(`E4:1 D4:1 C4:2 | E4:1 D4:1 C4:2 | C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 | E4:1 D4:1 C4:2`),
  },
  {
    id: "tr-mary",
    number: "T2",
    title: "Mary Had a Little Lamb",
    summary: "Steps plus one minor 3rd.",
    timeSig: [4, 4],
    bpm: 110,
    notes: parse(
      `E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:2 | D4:1 D4:1 D4:2 | E4:1 G4:1 G4:2 |
       E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:1 E4:1 | D4:1 D4:1 E4:1 D4:1 | C4:4`,
    ),
  },
  {
    id: "tr-ode",
    number: "T3",
    title: "Ode to Joy",
    summary: "Major and minor 2nds, with a dotted rhythm.",
    timeSig: [4, 4],
    bpm: 100,
    notes: parse(
      `E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | E4:1.5 D4:.5 D4:2 |
       E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | D4:1.5 C4:.5 C4:2`,
    ),
  },
  {
    id: "tr-twinkle",
    number: "T4",
    title: "Twinkle, Twinkle, Little Star",
    summary: "Steps, a perfect 5th and a perfect 4th.",
    timeSig: [4, 4],
    bpm: 100,
    notes: parse(
      `C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2 |
       G4:1 G4:1 F4:1 F4:1 | E4:1 E4:1 D4:2 | G4:1 G4:1 F4:1 F4:1 | E4:1 E4:1 D4:2 |
       C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2`,
    ),
  },
  {
    id: "tr-jingle",
    number: "T5",
    title: "Jingle Bells (chorus)",
    summary: "Repeated notes, a minor 3rd, a 4th and a 5th.",
    timeSig: [4, 4],
    bpm: 120,
    notes: parse(
      `E4:1 E4:1 E4:2 | E4:1 E4:1 E4:2 | E4:1 G4:1 C4:1.5 D4:.5 | E4:4 |
       F4:1 F4:1 F4:1.5 F4:.5 | F4:1 E4:1 E4:1 E4:.5 E4:.5 | E4:1 D4:1 D4:1 E4:1 | D4:2 G4:2 |
       E4:1 E4:1 E4:2 | E4:1 E4:1 E4:2 | E4:1 G4:1 C4:1.5 D4:.5 | E4:4 |
       F4:1 F4:1 F4:1 F4:1 | F4:1 E4:1 E4:1 E4:.5 E4:.5 | G4:1 G4:1 F4:1 D4:1 | C4:4`,
    ),
  },
  {
    id: "tr-frere-jacques",
    number: "T6",
    title: "Frère Jacques",
    summary: "Major and minor 3rds, and a 4th below the tonic.",
    timeSig: [4, 4],
    bpm: 110,
    notes: parse(
      `C4:1 D4:1 E4:1 C4:1 | C4:1 D4:1 E4:1 C4:1 | E4:1 F4:1 G4:2 | E4:1 F4:1 G4:2 |
       G4:.5 A4:.5 G4:.5 F4:.5 E4:1 C4:1 | G4:.5 A4:.5 G4:.5 F4:.5 E4:1 C4:1 | C4:1 G3:1 C4:2 | C4:1 G3:1 C4:2`,
    ),
  },
  {
    id: "tr-amazing-grace",
    number: "T7",
    title: "Amazing Grace (first two lines)",
    summary: "Pentatonic, in 3/4, starting on a pickup.",
    timeSig: [3, 4],
    bpm: 80,
    // The pickup "A-" falls on beat 3 of an incomplete first bar.
    notes: parse(`G3:1 | C4:2 E4:.5 C4:.5 | E4:2 D4:1 | C4:2 A3:1 | G3:2 G3:1 | C4:2 E4:.5 C4:.5 | E4:2 D4:1 | G4:3`, 2),
  },
];

export function getMelody(id: string | undefined): Melody | null {
  return MELODIES.find((m) => m.id === id) ?? null;
}

export const melodyEnd = (m: Melody) => Math.max(...m.notes.map((n) => n.start + n.dur));

const SHORT: Record<number, string> = { 1: "m2", 2: "M2", 3: "m3", 4: "M3", 5: "P4", 6: "TT", 7: "P5", 8: "m6", 9: "M6", 10: "m7", 11: "M7", 12: "P8" };

/** The distinct intervals a melody moves by, smallest first ("M2", "m3"…). */
export function intervalsUsed(m: Melody): string[] {
  const set = new Set<number>();
  for (let i = 1; i < m.notes.length; i++) {
    const s = Math.abs(m.notes[i].pitch - m.notes[i - 1].pitch);
    if (s > 0) set.add(s);
  }
  return [...set].sort((a, b) => a - b).map((s) => SHORT[s] ?? `${s}`);
}

export const intervalShort = (semitones: number) => SHORT[Math.abs(semitones)] ?? (semitones === 0 ? "unison" : `${Math.abs(semitones)} st`);
