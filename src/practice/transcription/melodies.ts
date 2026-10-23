/**
 * Melodic dictation: each stage generates fresh, unfamiliar melodies to its own rules
 * (keys, range, leaps, rhythms), graded by level the way aural-skills courses build up:
 * steps from do first, then skips in the tonic chord, the whole scale, minor keys, and
 * finally longer melodies with pickups and wider leaps. See generate.ts.
 */

export interface TargetNote {
  pitch: number;
  start: number;
  dur: number;
  /** Spelled in the melody's key, as a VexFlow key: "f#/4". */
  vf: string;
}

export type Mode = "major" | "minor";

/** The rules a stage's melodies are generated to. */
export interface GenParams {
  bars: number;
  /** Beats per bar to choose from (quarter-note beat). */
  meters: (3 | 4)[];
  modes: Mode[];
  /** Tonics as codes ("G", "Bb", "F#"), for major and for minor. */
  majorKeys: string[];
  minorKeys: string[];
  /** Lowest and highest scale degree, counted in steps from do = 0 (low sol = -3, high do = 7). */
  range: [number, number];
  /** Largest move in scale steps: 1 steps only, 2 thirds, 4 fifths, 5 sixths, 7 octaves. */
  maxLeap: number;
  /** Rhythm cells, in sixteenths, each filling whole beats: [4] quarter, [8] half, [2, 2] two eighths, [6, 2] dotted quarter and eighth. */
  cells: number[][];
  /** Degrees the first note may be on. */
  startDegrees: number[];
  /** Whether the melody may start with a pickup into bar 1. */
  pickup: boolean;
  bpm: [number, number];
}

export interface DictationStage {
  id: string;
  number: string;
  title: string;
  summary: string;
  /** Plays allowed per melody (Infinity: no limit), unless in practice mode. */
  plays: number;
  gen: GenParams;
}

/** One generated melody. */
export interface Melody {
  stageId: string;
  timeSig: [number, number];
  bpm: number;
  notes: TargetNote[];
  /** Tonic as a code: "G", "Bb", "F#". */
  keyCode: string;
  mode: Mode;
  /** Tonic pitch class, 0–11. */
  tonic: number;
  /** Key signature: sharps positive, flats negative. */
  accidentals: number;
}

const QUARTERS_HALVES = [[4], [8]];
const WITH_EIGHTHS = [[4], [8], [2, 2], [12]];
const WITH_DOTTED = [[4], [8], [2, 2], [6, 2], [12]];

export const STAGES: DictationStage[] = [
  {
    id: "tr-dict-1",
    number: "T1",
    title: "Melodic dictation: do to sol, by step",
    summary: "Two bars in C major, moving by step between do and sol, in quarters and halves.",
    plays: Infinity,
    gen: { bars: 2, meters: [4], modes: ["major"], majorKeys: ["C"], minorKeys: [], range: [0, 4], maxLeap: 1, cells: QUARTERS_HALVES, startDegrees: [0, 2, 4], pickup: false, bpm: [84, 92] },
  },
  {
    id: "tr-dict-2",
    number: "T2",
    title: "Melodic dictation: skips in the tonic chord",
    summary: "Four bars in C, G or F major: steps, plus skips between do, mi and sol, with eighth notes.",
    plays: 8,
    gen: { bars: 4, meters: [4, 3], modes: ["major"], majorKeys: ["C", "G", "F"], minorKeys: [], range: [0, 5], maxLeap: 4, cells: WITH_EIGHTHS, startDegrees: [0, 2, 4], pickup: false, bpm: [84, 96] },
  },
  {
    id: "tr-dict-3",
    number: "T3",
    title: "Melodic dictation: the whole major scale",
    summary: "Four bars in major keys up to 2 sharps or flats, low sol to high do, with leaps in the I and V chords and dotted rhythms.",
    plays: 6,
    gen: { bars: 4, meters: [4, 3], modes: ["major"], majorKeys: ["C", "G", "D", "F", "Bb"], minorKeys: [], range: [-3, 7], maxLeap: 4, cells: WITH_DOTTED, startDegrees: [0, 2, 4], pickup: false, bpm: [84, 96] },
  },
  {
    id: "tr-dict-4",
    number: "T4",
    title: "Melodic dictation: minor keys",
    summary: "Four bars in A, E, D, G or B minor, with the raised 7th leading home.",
    plays: 5,
    gen: { bars: 4, meters: [4, 3], modes: ["minor"], majorKeys: [], minorKeys: ["A", "E", "D", "G", "B"], range: [-3, 7], maxLeap: 4, cells: WITH_DOTTED, startDegrees: [0, 2, 4], pickup: false, bpm: [80, 92] },
  },
  {
    id: "tr-dict-5",
    number: "T5",
    title: "Melodic dictation: longer, with pickups and wide leaps",
    summary: "Six bars, major or minor up to 4 sharps or flats, with leaps up to an octave, pickups and syncopation.",
    plays: 4,
    gen: {
      bars: 6,
      meters: [4, 3],
      modes: ["major", "minor"],
      majorKeys: ["C", "G", "D", "A", "E", "F", "Bb", "Eb", "Ab"],
      minorKeys: ["A", "E", "B", "F#", "C#", "D", "G", "C", "F"],
      range: [-3, 9],
      maxLeap: 7,
      cells: [...WITH_DOTTED, [2, 4, 2]],
      startDegrees: [0, 2, 4],
      pickup: true,
      bpm: [88, 100],
    },
  },
];

export function getStage(id: string | undefined): DictationStage | null {
  return STAGES.find((s) => s.id === id) ?? null;
}

export const melodyEnd = (m: Melody) => Math.max(...m.notes.map((n) => n.start + n.dur));

const SHORT: Record<number, string> = { 1: "m2", 2: "M2", 3: "m3", 4: "M3", 5: "P4", 6: "TT", 7: "P5", 8: "m6", 9: "M6", 10: "m7", 11: "M7", 12: "P8" };

export const intervalShort = (semitones: number) => SHORT[Math.abs(semitones)] ?? (semitones === 0 ? "unison" : `${Math.abs(semitones)} st`);
