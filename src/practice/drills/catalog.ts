import {
  above,
  codeOf,
  intervalBetween,
  intervalCode,
  intervalLabel,
  LETTERS,
  lettersSpanned,
  MAJOR_KEYS,
  MINOR_KEYS,
  nameOf,
  numberName,
  parseCode,
  pick,
  pitchOf,
  randInt,
  scaleNotes,
  semitonesFor,
  signatureNotes,
  singleAccidentals,
  triad,
  type Quality,
  type ScaleKind,
  type Spelled,
  type TriadQuality,
} from "./theory";
import { CADENCE_DRILLS } from "./cadences";
import { resolveToDo } from "./resolve";
import { FRAGMENT_DRILLS } from "./fragments";
import { HARMONIZE_DRILLS } from "./harmonize";
import { NCT_DRILLS } from "./nct";
import { HARMONY_DRILLS } from "./harmony";
import { RHYTHM_DRILLS } from "./rhythm";

export type AnswerType = "letter" | "note" | "interval" | "majorKey" | "minorKey" | "accidentals" | "triadQuality" | "degree" | "earInterval" | "semitones" | "numeral" | "beats" | "noteValue" | "meter" | "rhythm" | "tap" | "cadence" | "nct";

export interface Step {
  type: AnswerType;
  /** What this step asks for, when a question has several. */
  label?: string;
  correct: string;
  /** Limit the choices (ear intervals). */
  options?: string[];
  /** Extra input for pads that need it (the rhythm to tap). */
  data?: string;
  /** Other answers that also count as right (a note several chords fit). Includes `correct`. */
  accept?: string[];
}

export interface StaffSpec {
  clef: "treble" | "bass";
  /** VexFlow key signature name. */
  keySig?: string;
  /** Each group is drawn as one chord (whole notes, left to right). */
  groups: Spelled[][];
}

export interface AudioEvent {
  pitches: number[];
  /** Seconds after the start. */
  at: number;
  dur: number;
  /** Loudness 0–1 (default 0.7). */
  vel?: number;
}

export interface Question {
  prompt: string;
  staff?: StaffSpec;
  /** A rhythm to show (rhythm drills), as "beats:durations". */
  rhythm?: string;
  audio?: AudioEvent[];
  /** Played after a wrong answer (or on reveal in recall mode): the note resolving to do. */
  resolve?: AudioEvent[];
  /** A shorter replay offered beside "Play again" (key N): just the note, without the cadence. */
  again?: { label: string; audio: AudioEvent[] };
  steps: Step[];
  /** Shown after a wrong answer: the reasoning, not just the answer. */
  explain: string;
}

export interface Drill {
  id: string;
  number: string;
  title: string;
  summary: string;
  brief: string;
  ear: boolean;
  /** Drills outside the foundations get their own unit on the home page. */
  unit?: "harmony" | "rhythm" | "cadences" | "nct" | "harmonize";
  /** Pass marks from the foundations checklist. */
  pass: { accuracy: number; medianSec?: number };
  generate: () => Question;
}

export const ROUND_LENGTH = 20;

// ---- Shared material ----------------------------------------------------------

const MNEMONIC = {
  treble: "Treble clef: lines from the bottom are E G B D F, spaces are F A C E.",
  bass: "Bass clef: lines from the bottom are G B D F A, spaces are A C E G.",
};

/** Lower notes for interval questions: mostly naturals, some common accidentals. */
const LOWERS = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E", "F", "G", "A", "B", "Bb", "Eb", "Ab", "F#", "C#", "Db"];
/** Written intervals, common ones listed twice so they come up more. */
const WRITTEN_INTERVALS = [
  "m2", "M2", "m3", "M3", "P4", "P5", "m6", "M6", "m7", "M7", "P8",
  "m2", "M2", "m3", "M3", "P4", "P5", "m6", "M6", "m7", "M7",
  "A4", "d5", "A2", "A5", "A6", "d7",
];
export const TRIAD_ROOTS = ["C", "D", "E", "F", "G", "A", "B", "Bb", "Eb", "Ab", "Db", "F#", "C#", "G#"];
const TRIAD_QUALITIES: TriadQuality[] = ["major", "minor", "diminished", "augmented", "major", "minor"];

const parseInterval = (code: string) => ({ q: code[0] as Quality, num: Number(code.slice(1)) });
const clefFor = (notes: Spelled[]) => (Math.min(...notes.map(pitchOf)) < 55 ? "bass" : "treble");
const halfSteps = (n: number) => `${n} half ${n === 1 ? "step" : "steps"}`;

function explainInterval(low: Spelled, high: Spelled): string {
  const { q, num } = intervalBetween(low, high);
  const semis = pitchOf(high) - pitchOf(low);
  const letters = lettersSpanned(low, num);
  const ref = num === 1 || num === 4 || num === 5 || num === 8 ? `a perfect ${numberName(num)} is ${halfSteps(semitonesFor("P", num))}` : `a major ${numberName(num)} is ${halfSteps(semitonesFor("M", num))}`;
  return `${nameOf(low)} to ${nameOf(high)} spans ${num} letter names (${letters}), so it's a ${numberName(num)}. It's ${halfSteps(semis)}, and ${ref}, so this is a ${intervalLabel(intervalCode(q, num))}.`;
}

// ---- Question builders ---------------------------------------------------------------
// Each makes a question about one fact (a note, a scale, an interval…). The drills pick
// the fact at random; the flashcards ask for the fact a card is about.

/** Staff positions as letter + 7 × octave. Treble A3–C6, bass C2–E4. */
export const READ_RANGE = { treble: [26, 42], bass: [14, 30] } as const;
/** The same, without ledger lines: treble E4–F5, bass G2–A3. */
export const ON_STAFF = { treble: [30, 38], bass: [18, 26] } as const;
export const staffNote = (idx: number): Spelled => ({ letter: idx % 7, acc: 0, octave: Math.floor(idx / 7) });

export function readNoteQuestion(clef: "treble" | "bass", idx: number): Question {
  const note = staffNote(idx);
  return {
    prompt: "Name this note.",
    staff: { clef, groups: [[note]] },
    steps: [{ type: "letter", correct: LETTERS[note.letter] }],
    explain: `It's ${nameOf(note, true)}. ${MNEMONIC[clef]}`,
  };
}

export const SCALE_KINDS: ScaleKind[] = ["major", "natural minor", "harmonic minor", "melodic minor"];
/** Keys whose scale of this kind needs no double sharps or flats. */
export const scaleKeys = (kind: ScaleKind) =>
  (kind === "major" ? MAJOR_KEYS : MINOR_KEYS).filter((k) => singleAccidentals(...scaleNotes(parseCode(k.code), kind)));

export function scaleQuestion(kind: ScaleKind, keyCode: string, degree = randInt(2, 7)): Question {
  const notes = scaleNotes(parseCode(keyCode), kind);
  const answer = notes[degree - 1];
  const label = `${nameOf(notes[0])} ${kind}`;
  return {
    prompt: `${label}: what is scale degree ${degree}?`,
    steps: [{ type: "note", correct: codeOf(answer) }],
    explain: `${label}: ${notes.map((n) => nameOf(n)).join(" ")}. Degree ${degree} is ${nameOf(answer)}.`,
  };
}

export const COMMON_INTERVALS = ["m2", "M2", "m3", "M3", "P4", "P5", "m6", "M6", "m7", "M7", "P8"];
export const RARE_INTERVALS = ["A4", "d5", "A2", "A5", "A6", "d7"];

/** An interval to name on the staff; `options` limits the answer buttons. */
export function nameIntervalQuestion(code: string, options?: string[]): Question {
  const { q, num } = parseInterval(code);
  for (;;) {
    const low = parseCode(pick(LOWERS), Math.random() < 0.7 ? 4 : 3);
    const high = above(low, q, num);
    if (!singleAccidentals(low, high)) continue;
    const harmonic = Math.random() < 0.4;
    return {
      prompt: "Name this interval.",
      staff: { clef: clefFor([low]), groups: harmonic ? [[low, high]] : [[low], [high]] },
      steps: [{ type: "interval", correct: intervalCode(q, num), options }],
      explain: explainInterval(low, high),
    };
  }
}

export function buildIntervalQuestion(code: string): Question {
  const { q, num } = parseInterval(code);
  for (;;) {
    const low = parseCode(pick(LOWERS), 4);
    const high = above(low, q, num);
    if (!singleAccidentals(low, high)) continue;
    return {
      prompt: `What note is a ${intervalLabel(code)} above ${nameOf(low)}?`,
      staff: { clef: "treble", groups: [[low]] },
      steps: [{ type: "note", correct: codeOf(high) }],
      explain: `Count ${num} letter names from ${nameOf(low)} (${lettersSpanned(low, num)}) to get ${LETTERS[high.letter]}. A ${intervalLabel(code)} is ${halfSteps(semitonesFor(q, num))}, which lands on ${nameOf(high)}.`,
    };
  }
}

export const TRIAD_KINDS: TriadQuality[] = ["major", "minor", "diminished", "augmented"];
export const INVERSIONS = ["root position", "first inversion", "second inversion"];
/** Whether a triad on this root is spelled without double sharps or flats. */
export const triadOk = (root: string, quality: TriadQuality) => singleAccidentals(...triad(parseCode(root, 4), quality));

export function nameTriadQuestion(quality: TriadQuality, inversion: number, root = pick(TRIAD_ROOTS.filter((r) => triadOk(r, quality)))): Question {
  const notes = triad(parseCode(root, 4), quality);
  const up = (n: Spelled): Spelled => ({ ...n, octave: n.octave + 1 });
  const voiced = inversion === 0 ? notes : inversion === 1 ? [notes[1], notes[2], up(notes[0])] : [notes[2], up(notes[0]), up(notes[1])];
  const invName = ["root position", "first inversion (3rd in the bass)", "second inversion (5th in the bass)"][inversion];
  return {
    prompt: "Name this triad: its root, then its quality.",
    staff: { clef: "treble", groups: [voiced] },
    steps: [
      { type: "note", label: "Root", correct: codeOf(notes[0]) },
      { type: "triadQuality", label: "Quality", correct: quality },
    ],
    explain: `Stacked in 3rds it's ${notes.map((n) => nameOf(n)).join(" ")}: ${nameOf(notes[0])} ${quality}, shown in ${invName}.`,
  };
}

export function buildTriadQuestion(quality: TriadQuality, root: string): Question {
  const notes = triad(parseCode(root, 4), quality);
  return {
    prompt: `Spell ${nameOf(notes[0])} ${quality}.`,
    staff: { clef: "treble", groups: [[notes[0]]] },
    steps: [
      { type: "note", label: "Its 3rd", correct: codeOf(notes[1]) },
      { type: "note", label: "Its 5th", correct: codeOf(notes[2]) },
    ],
    explain: `${nameOf(notes[0])} ${quality} is ${notes.map((n) => nameOf(n)).join(" ")}.`,
  };
}

// ---- Written drills ---------------------------------------------------------------
// Each drill is split into checkpoints (a, b, c…), narrow first, with the full drill last.

/** A narrower step of a drill: the same pass marks and brief, a smaller range of questions. */
const checkpoint = (base: Drill, c: Pick<Drill, "id" | "number" | "title" | "summary" | "generate"> & Partial<Drill>): Drill => ({ ...base, ...c });

const readNotes: Drill = {
  id: "d-notes",
  number: "0.1c",
  title: "Read notes: both clefs, with ledger lines",
  summary: "Treble and bass, including notes above and below the staff.",
  brief: "A note appears on the treble or bass staff, sometimes on ledger lines. Name it as fast as you can. Type the letter on your keyboard, or click it.",
  ear: false,
  pass: { accuracy: 0.95, medianSec: 2 },
  generate() {
    const clef = Math.random() < 0.5 ? "treble" : "bass";
    const [lo, hi] = READ_RANGE[clef];
    return readNoteQuestion(clef, randInt(lo, hi));
  },
};

const readTreble = checkpoint(readNotes, {
  id: "d-notes-treble",
  number: "0.1a",
  title: "Read notes: treble clef",
  summary: "Notes on the treble staff, no ledger lines.",
  generate: () => readNoteQuestion("treble", randInt(ON_STAFF.treble[0], ON_STAFF.treble[1])),
});

const readBass = checkpoint(readNotes, {
  id: "d-notes-bass",
  number: "0.1b",
  title: "Read notes: bass clef",
  summary: "Notes on the bass staff, no ledger lines.",
  generate: () => readNoteQuestion("bass", randInt(ON_STAFF.bass[0], ON_STAFF.bass[1])),
});

/** Key signature drills over the keys with at most `maxAcc` sharps or flats, for major keys, minor keys or both. */
function keySignatureDrill(id: string, number: string, title: string, summary: string, maxAcc: number, which: "major" | "both" = "both"): Drill {
  const pool = MAJOR_KEYS.map((_, i) => i).filter((i) => Math.abs(MAJOR_KEYS[i].accidentals) <= maxAcc);
  // Answer pads offer only the keys in the pool.
  const majorOptions = pool.map((i) => MAJOR_KEYS[i].code);
  const minorOptions = pool.map((i) => MINOR_KEYS[i].code);
  const countOptions = pool.map((i) => String(MAJOR_KEYS[i].accidentals));
  return {
    id,
    number,
    title,
    summary,
    brief:
      which === "major"
        ? "Name the major key a signature belongs to, or say how many sharps or flats a major key has."
        : "Name the major or minor key a signature belongs to, or say how many sharps or flats a key has. Remember: a minor key shares its signature with the major key a minor 3rd above it.",
    ear: false,
    pass: { accuracy: 0.95, medianSec: 3 },
    generate() {
      const i = pick(pool);
      const major = MAJOR_KEYS[i];
      const minor = MINOR_KEYS[i];
      const sig = signatureNotes(major.accidentals);
      const kinds: ("major" | "minor" | "count-major" | "count-minor")[] = which === "major" ? ["major", "count-major"] : ["major", "minor", "count-major", "count-minor"];
      const kind = pick(kinds);
      const n = Math.abs(major.accidentals);
      const count = n === 0 ? "No sharps or flats" : `${n} ${major.accidentals > 0 ? (n === 1 ? "sharp" : "sharps") : n === 1 ? "flat" : "flats"} (${sig})`;
      const where = `${count}: ${nameOf(parseCode(major.code))} major, and its relative minor, ${nameOf(parseCode(minor.code))} minor.`;
      if (kind === "major" || kind === "minor") {
        return {
          prompt: `Which ${kind} key has this signature?`,
          staff: { clef: "treble", keySig: major.code, groups: [] },
          steps: [kind === "major" ? { type: "majorKey", correct: major.code, options: majorOptions } : { type: "minorKey", correct: minor.code, options: minorOptions }],
          explain: where,
        };
      }
      const key = kind === "count-major" ? major : minor;
      return {
        prompt: `How many sharps or flats in ${nameOf(parseCode(key.code))} ${kind === "count-major" ? "major" : "minor"}?`,
        steps: [{ type: "accidentals", correct: String(key.accidentals), options: countOptions }],
        explain: where,
      };
    },
  };
}

const keySignaturesMajor = keySignatureDrill("d-keys-major", "0.2a", "Key signatures: major, core keys", "The 9 major keys with up to 4 sharps or flats.", 4, "major");
const keySignatures = keySignatureDrill("d-keys", "0.2b", "Key signatures: major and minor, core keys", "The 9 major and 9 minor keys with up to 4 sharps or flats.", 4);
// The rarer keys (5 to 7 sharps or flats) come after the rest of the reading foundations.
const keySignaturesAll = keySignatureDrill("d-keys-all", "0.14a", "All keys: signatures up to 7 sharps or flats", "All 30 major and minor keys, adding B, F#, C#, Db, Gb and Cb and their minors.", 7);

const scales: Drill = {
  id: "d-scales",
  number: "0.3c",
  title: "Scales: major and all three minors",
  summary: "Spell any degree of major, natural, harmonic and melodic minor, in any key.",
  brief: "Name a degree of a major, natural minor, harmonic minor (raised 7th) or melodic minor (raised 6th and 7th, going up) scale. Spelling counts: each degree uses the next letter name.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 4 },
  generate() {
    const kind = pick<ScaleKind>(["major", "major", "natural minor", "harmonic minor", "melodic minor"]);
    return scaleQuestion(kind, pick(scaleKeys(kind)).code);
  },
};

const coreScaleKeys = (kind: ScaleKind) => scaleKeys(kind).filter((k) => Math.abs(k.accidentals) <= 4);

const scalesMajor = checkpoint(scales, {
  id: "d-scales-major",
  number: "0.3a",
  title: "Scales: major",
  summary: "Spell any degree of a major scale, in the core keys.",
  generate: () => scaleQuestion("major", pick(coreScaleKeys("major")).code),
});

const scalesNatural = checkpoint(scales, {
  id: "d-scales-natural",
  number: "0.3b",
  title: "Scales: natural minor",
  summary: "Spell any degree of a natural minor scale, in the core keys.",
  generate: () => scaleQuestion("natural minor", pick(coreScaleKeys("natural minor")).code),
});

/** The written intervals without augmented and diminished, common ones still weighted up. */
const COMMON_WEIGHTED = WRITTEN_INTERVALS.filter((c) => COMMON_INTERVALS.includes(c));

const nameIntervals: Drill = {
  id: "d-name-intervals",
  number: "0.4b",
  title: "Name intervals: all, with augmented and diminished",
  summary: "Number and quality of any interval on the staff.",
  brief: "Two notes appear, one after the other or stacked. Name the interval: count the letter names for the number, then the half steps for the quality.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 3 },
  generate() {
    return nameIntervalQuestion(pick(WRITTEN_INTERVALS));
  },
};

const nameIntervalsCommon = checkpoint(nameIntervals, {
  id: "d-name-intervals-common",
  number: "0.4a",
  title: "Name intervals: major, minor and perfect",
  summary: "Number and quality of intervals on the staff, no augmented or diminished.",
  generate: () => nameIntervalQuestion(pick(COMMON_WEIGHTED), COMMON_INTERVALS),
});

const buildIntervals: Drill = {
  id: "d-build-intervals",
  number: "0.5b",
  title: "Build intervals: all, with augmented and diminished",
  summary: "Spell the note any interval above.",
  brief: "Find the note a given interval above the one shown. First count letter names to get the right letter, then adjust with a sharp or flat to get the right number of half steps.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 4 },
  generate() {
    return buildIntervalQuestion(pick(WRITTEN_INTERVALS));
  },
};

const buildIntervalsCommon = checkpoint(buildIntervals, {
  id: "d-build-intervals-common",
  number: "0.5a",
  title: "Build intervals: major, minor and perfect",
  summary: "Spell the note an interval above, no augmented or diminished.",
  generate: () => buildIntervalQuestion(pick(COMMON_WEIGHTED)),
});

const nameTriads: Drill = {
  id: "d-name-triads",
  number: "0.6b",
  title: "Name triads: all four qualities, any inversion",
  summary: "Root and quality of any triad, in root position or an inversion.",
  brief: "A triad appears in root position or an inversion. Find the root (stack it in 3rds; the bottom note of the stack is the root), then name its quality.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 5 },
  generate() {
    return nameTriadQuestion(pick(TRIAD_QUALITIES), randInt(0, 2));
  },
};

const nameTriadsBasic = checkpoint(nameTriads, {
  id: "d-name-triads-basic",
  number: "0.6a",
  title: "Name triads: major and minor, root position",
  summary: "Root and quality of major and minor triads stacked in 3rds.",
  generate: () => nameTriadQuestion(pick<TriadQuality>(["major", "minor"]), 0),
});

const buildTriads: Drill = {
  id: "d-build-triads",
  number: "0.7b",
  title: "Build triads: all four qualities",
  summary: "Spell the 3rd and 5th of any triad.",
  brief: "Spell a triad from its root: pick the 3rd, then the 5th. Major is a major 3rd and perfect 5th; minor has a minor 3rd; diminished has a minor 3rd and diminished 5th; augmented has a major 3rd and augmented 5th.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 6 },
  generate() {
    const quality = pick(TRIAD_QUALITIES);
    return buildTriadQuestion(quality, pick(TRIAD_ROOTS.filter((r) => triadOk(r, quality))));
  },
};

const buildTriadsBasic = checkpoint(buildTriads, {
  id: "d-build-triads-basic",
  number: "0.7a",
  title: "Build triads: major and minor",
  summary: "Spell the 3rd and 5th of major and minor triads.",
  generate: () => {
    const quality = pick<TriadQuality>(["major", "minor"]);
    return buildTriadQuestion(quality, pick(TRIAD_ROOTS.filter((r) => triadOk(r, quality))));
  },
});

// ---- Ear drills ------------------------------------------------------------------

export const EAR_INTERVALS: Record<number, { code: string; label: string }> = {
  1: { code: "m2", label: "minor 2nd" }, 2: { code: "M2", label: "major 2nd" },
  3: { code: "m3", label: "minor 3rd" }, 4: { code: "M3", label: "major 3rd" },
  5: { code: "P4", label: "perfect 4th" }, 6: { code: "TT", label: "tritone" },
  7: { code: "P5", label: "perfect 5th" }, 8: { code: "m6", label: "minor 6th" },
  9: { code: "M6", label: "major 6th" }, 10: { code: "m7", label: "minor 7th" },
  11: { code: "M7", label: "major 7th" }, 12: { code: "P8", label: "octave" },
};

/** How an ear interval is played: low note first, high note first, both at once, or any of those. */
export type EarMode = "up" | "down" | "together" | "mixed";

const MODE_BRIEF: Record<EarMode, string> = {
  up: "Listen to two notes, low then high, and name the interval.",
  down: "Listen to two notes, high then low, and name the interval.",
  together: "Listen to two notes played together and name the interval.",
  mixed: "Listen to two notes, played rising, falling or together, and name the interval.",
};

function earIntervalDrill(id: string, number: string, title: string, summary: string, semis: number[], accuracy: number, mode: EarMode): Drill {
  const options = semis.map((s) => EAR_INTERVALS[s].code);
  return {
    id,
    number,
    title,
    summary,
    brief: `${MODE_BRIEF[mode]} Replay as often as you like. ${semis.length < 12 ? "This uses only the most distinct intervals: the perfect ones and the 3rds." : "All intervals within an octave."}`,
    ear: true,
    pass: { accuracy },
    generate() {
      return earIntervalQuestion(pick(semis), options, mode);
    },
  };
}

/** An interval of `s` semitones, by ear, answered from `options` (interval codes). */
export function earIntervalQuestion(s: number, options: string[], mode: EarMode = "mixed"): Question {
  const low = randInt(50, 67);
  const r = Math.random();
  const how = mode !== "mixed" ? mode : r < 0.4 ? "up" : r < 0.7 ? "down" : "together";
  const [first, second] = how === "down" ? [low + s, low] : [low, low + s];
  const audio: AudioEvent[] =
    how === "together"
      ? [{ pitches: [low, low + s], at: 0, dur: 1.8 }]
      : [{ pitches: [first], at: 0, dur: 0.9 }, { pitches: [second], at: 0.95, dur: 1.3 }];
  // Say how it's played only when it varies.
  const note = mode === "mixed" ? { up: " (rising)", down: " (falling)", together: " (played together)" }[how] : "";
  return {
    prompt: `Name the interval${note}.`,
    audio,
    steps: [{ type: "earInterval", correct: EAR_INTERVALS[s].code, options }],
    explain: `That was a ${EAR_INTERVALS[s].label}, ${halfSteps(s)}.`,
  };
}

const CHORD_SHAPES: Record<TriadQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};

const hearChords: Drill = {
  id: "d-ear-chords",
  number: "0.10b",
  title: "Hear chord quality: all four",
  summary: "Major, minor, diminished or augmented, by ear.",
  brief: "A triad plays as a chord, then one note at a time. Name its quality. Major sounds bright and settled, minor darker, diminished tense and narrow, augmented unsettled and wide.",
  ear: true,
  pass: { accuracy: 0.9 },
  generate() {
    return chordQuestion(pick(TRIAD_KINDS));
  },
};

const hearMajorMinor = checkpoint(hearChords, {
  id: "d-ear-chords-mm",
  number: "0.10a",
  title: "Hear chord quality: major or minor",
  summary: "Just major against minor, by ear.",
  generate: () => chordQuestion(pick<TriadQuality>(["major", "minor"]), ["major", "minor"]),
});

/** A triad by ear; `options` limits the answer buttons. */
export function chordQuestion(quality: TriadQuality, options?: string[]): Question {
  const root = randInt(50, 62);
  const p = CHORD_SHAPES[quality].map((s) => root + s);
  return {
    prompt: "Name the chord's quality.",
    audio: [{ pitches: p, at: 0, dur: 1.4 }, ...p.map((x, i) => ({ pitches: [x], at: 1.6 + i * 0.45, dur: 0.5 }))],
    steps: [{ type: "triadQuality", correct: quality, options }],
    explain: `That was ${quality}: ${quality === "major" ? "major 3rd + minor 3rd" : quality === "minor" ? "minor 3rd + major 3rd" : quality === "diminished" ? "two minor 3rds" : "two major 3rds"}.`,
  };
}

export const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "ti"];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

const hearDegrees: Drill = {
  id: "d-ear-degrees",
  number: "0.11e",
  title: "Hear scale degrees: all seven",
  summary: "Which degree of the key a note is, after a cadence.",
  brief: "A cadence (I–IV–V–I) sets the key, then one note plays. Name its scale degree, 1 to 7. This is functional ear training: hearing each note's role in the key, not just its distance from the last note.",
  ear: true,
  pass: { accuracy: 0.85 },
  generate() {
    return degreeQuestion(randInt(1, 7));
  },
};

// The first steps stay in C, so do settles in memory, and the first of all holds do
// underneath as a drone, which makes each note's color plainest.
const hearDoMiSolDrone = checkpoint(hearDegrees, {
  id: "d-ear-degrees-135-drone",
  number: "0.11a",
  title: "Hear scale degrees: do, mi, sol in C, over a drone",
  summary: "Degrees 1, 3 and 5 in C, with do held underneath.",
  brief:
    "A cadence sets C major, then low C holds as a drone while one note plays: do, mi or sol. Against the drone, do sounds at rest, mi sweet and bright, sol open and hollow. Every question is in C, so do stays in your ear.",
  generate: () => degreeQuestion(pick([1, 3, 5]), ["1", "3", "5"], { inC: true, drone: true }),
});

const hearDoMiSolC = checkpoint(hearDegrees, {
  id: "d-ear-degrees-135-c",
  number: "0.11b",
  title: "Hear scale degrees: do, mi, sol in C",
  summary: "Degrees 1, 3 and 5, always in C, without the drone.",
  brief: "The same three notes, still always in C, but with no drone: hold do in your ear from the cadence. Sing the note down to do if you're unsure.",
  generate: () => degreeQuestion(pick([1, 3, 5]), ["1", "3", "5"], { inC: true }),
});

const hearDoMiSol = checkpoint(hearDegrees, {
  id: "d-ear-degrees-135",
  number: "0.11c",
  title: "Hear scale degrees: do, mi, sol",
  summary: "Degrees 1, 3 and 5, the notes of the home chord, in any key.",
  generate: () => degreeQuestion(pick([1, 3, 5]), ["1", "3", "5"]),
});

const hearDoToSol = checkpoint(hearDegrees, {
  id: "d-ear-degrees-15",
  number: "0.11d",
  title: "Hear scale degrees: do to sol",
  summary: "Degrees 1 to 5.",
  generate: () => degreeQuestion(randInt(1, 5), ["1", "2", "3", "4", "5"]),
});

/**
 * A scale degree after a cadence; `options` limits the answer buttons. `inC` keeps the key
 * at C instead of a random one; `drone` holds low do under the note (and its replays).
 */
export function degreeQuestion(degree: number, options?: string[], { inC = false, drone = false } = {}): Question {
  const t = inC ? 60 : randInt(55, 66);
  const target = t + MAJOR_STEPS[degree - 1];
  const chords = [
    [t - 12, t, t + 4, t + 7],
    [t - 7, t, t + 5, t + 9],
    [t - 5, t - 1, t + 2, t + 7],
    [t - 12, t, t + 4, t + 7],
  ];
  // Two octaves of do, quietly, from just before the note to past its end.
  const droneUnder = (at: number, dur: number) => (drone ? [{ pitches: [t - 24, t - 12], at, dur, vel: 0.32 }] : []);
  const resolve = resolveToDo(target, degree);
  const resolveEnd = Math.max(...resolve.map((e) => e.at + e.dur));
  return {
    prompt: drone ? "Which scale degree is the note over the drone?" : "Which scale degree is the last note?",
    audio: [...chords.map((c, i) => ({ pitches: c, at: i * 0.75, dur: 0.7 })), ...droneUnder(3.3, 2), { pitches: [target], at: 3.6, dur: 1.4 }],
    resolve: [...droneUnder(0, resolveEnd), ...resolve],
    again: { label: "Play note again", audio: [...droneUnder(0, 1.7), { pitches: [target], at: drone ? 0.25 : 0, dur: 1.4 }] },
    steps: [{ type: "degree", correct: String(degree), options }],
    explain: `That was degree ${degree} (${SOLFEGE[degree - 1]}). Listen to it walk home to do.`,
  };
}

const ESSENTIALS = [3, 4, 5, 7, 12];
const ALL_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Checkpoints in order. Ids of the full drills are unchanged, so earlier passes still count. */
export const DRILLS: Drill[] = [
  readTreble,
  readBass,
  readNotes,
  keySignaturesMajor,
  keySignatures,
  scalesMajor,
  scalesNatural,
  scales,
  nameIntervalsCommon,
  nameIntervals,
  buildIntervalsCommon,
  buildIntervals,
  nameTriadsBasic,
  nameTriads,
  buildTriadsBasic,
  buildTriads,
  keySignaturesAll,
  earIntervalDrill("d-ear-ess-up", "0.8a", "Hear the essentials: ascending", "Minor and major 3rd, perfect 4th and 5th, octave; low note first.", ESSENTIALS, 0.9, "up"),
  earIntervalDrill("d-ear-ess-down", "0.8b", "Hear the essentials: descending", "The same five, high note first.", ESSENTIALS, 0.9, "down"),
  earIntervalDrill("d-ear-ess-together", "0.8c", "Hear the essentials: together", "The same five, played as a chord.", ESSENTIALS, 0.9, "together"),
  earIntervalDrill("d-ear-intervals-basic", "0.8d", "Hear the essentials: mixed", "The same five, rising, falling or together.", ESSENTIALS, 0.9, "mixed"),
  earIntervalDrill("d-ear-all-up", "0.9a", "Hear all intervals: ascending", "Every interval within an octave, low note first.", ALL_12, 0.8, "up"),
  earIntervalDrill("d-ear-all-down", "0.9b", "Hear all intervals: descending", "Every interval within an octave, high note first.", ALL_12, 0.8, "down"),
  earIntervalDrill("d-ear-all-together", "0.9c", "Hear all intervals: together", "Every interval within an octave, played as a chord.", ALL_12, 0.8, "together"),
  earIntervalDrill("d-ear-intervals-all", "0.9d", "Hear all intervals: mixed", "Every interval within an octave, rising, falling or together.", ALL_12, 0.8, "mixed"),
  hearMajorMinor,
  hearChords,
  hearDoMiSolDrone,
  hearDoMiSolC,
  hearDoMiSol,
  hearDoToSol,
  hearDegrees,
  ...FRAGMENT_DRILLS,
  ...HARMONY_DRILLS,
  ...RHYTHM_DRILLS,
  ...CADENCE_DRILLS,
  ...NCT_DRILLS,
  ...HARMONIZE_DRILLS,
];

export function getDrill(id: string | null): Drill | null {
  return DRILLS.find((d) => d.id === id) ?? null;
}

/** Whether an answer is right for a step: its answer, or one of the others it accepts. */
export const isRight = (step: Step, value: string | undefined) => value === step.correct || (!!value && !!step.accept?.includes(value));
