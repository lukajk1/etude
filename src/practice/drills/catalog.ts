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

export type AnswerType = "letter" | "note" | "interval" | "majorKey" | "minorKey" | "accidentals" | "triadQuality" | "degree" | "earInterval" | "semitones";

export interface Step {
  type: AnswerType;
  /** What this step asks for, when a question has several. */
  label?: string;
  correct: string;
  /** Limit the choices (ear intervals). */
  options?: string[];
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
}

export interface Question {
  prompt: string;
  staff?: StaffSpec;
  audio?: AudioEvent[];
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
const TRIAD_ROOTS = ["C", "D", "E", "F", "G", "A", "B", "Bb", "Eb", "Ab", "Db", "F#", "C#", "G#"];
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

// ---- Written drills ---------------------------------------------------------------

const readNotes: Drill = {
  id: "d-notes",
  number: "0.1",
  title: "Read notes",
  summary: "Name notes on the treble and bass staff.",
  brief: "A note appears on the treble or bass staff, sometimes on ledger lines. Name it as fast as you can. Type the letter on your keyboard, or click it.",
  ear: false,
  pass: { accuracy: 0.95, medianSec: 2 },
  generate() {
    const clef = Math.random() < 0.5 ? "treble" : "bass";
    // Index = letter + 7 × octave. Treble A3–C6, bass C2–E4.
    const idx = clef === "treble" ? randInt(5 + 21, 0 + 42) : randInt(0 + 14, 2 + 28);
    const note: Spelled = { letter: idx % 7, acc: 0, octave: Math.floor(idx / 7) };
    return {
      prompt: "Name this note.",
      staff: { clef, groups: [[note]] },
      steps: [{ type: "letter", correct: LETTERS[note.letter] }],
      explain: `It's ${nameOf(note, true)}. ${MNEMONIC[clef]}`,
    };
  },
};

/** Key signature drills over the keys with at most `maxAcc` sharps or flats. */
function keySignatureDrill(id: string, number: string, title: string, summary: string, maxAcc: number): Drill {
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
    brief: "Name the major or minor key a signature belongs to, or say how many sharps or flats a key has. Remember: a minor key shares its signature with the major key a minor 3rd above it.",
    ear: false,
    pass: { accuracy: 0.95, medianSec: 3 },
    generate() {
      const i = pick(pool);
      const major = MAJOR_KEYS[i];
      const minor = MINOR_KEYS[i];
      const sig = signatureNotes(major.accidentals);
      const kind = pick(["major", "minor", "count-major", "count-minor"] as const);
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

const keySignatures = keySignatureDrill("d-keys", "0.2", "Key signatures: core keys", "The 9 major and 9 minor keys with up to 4 sharps or flats.", 4);
const keySignaturesAll = keySignatureDrill("d-keys-all", "0.12", "Key signatures: all 30 keys", "Every major and minor key, up to 7 sharps or flats. Take it once 0.2 is easy.", 7);

const scales: Drill = {
  id: "d-scales",
  number: "0.3",
  title: "Scales",
  summary: "Spell any degree of major and the three minor scales.",
  brief: "Name a degree of a major, natural minor, harmonic minor (raised 7th) or melodic minor (raised 6th and 7th, going up) scale. Spelling counts: each degree uses the next letter name.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 4 },
  generate() {
    for (;;) {
      const kind = pick<ScaleKind>(["major", "major", "natural minor", "harmonic minor", "melodic minor"]);
      const key = pick(kind === "major" ? MAJOR_KEYS : MINOR_KEYS);
      const notes = scaleNotes(parseCode(key.code), kind);
      if (!singleAccidentals(...notes)) continue;
      const degree = randInt(2, 7);
      const answer = notes[degree - 1];
      const label = `${nameOf(notes[0])} ${kind}`;
      return {
        prompt: `${label}: what is scale degree ${degree}?`,
        steps: [{ type: "note", correct: codeOf(answer) }],
        explain: `${label}: ${notes.map((n) => nameOf(n)).join(" ")}. Degree ${degree} is ${nameOf(answer)}.`,
      };
    }
  },
};

const nameIntervals: Drill = {
  id: "d-name-intervals",
  number: "0.4",
  title: "Name intervals",
  summary: "Number and quality of intervals on the staff.",
  brief: "Two notes appear, one after the other or stacked. Name the interval: count the letter names for the number, then the half steps for the quality.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 3 },
  generate() {
    for (;;) {
      const { q, num } = parseInterval(pick(WRITTEN_INTERVALS));
      const low = parseCode(pick(LOWERS), Math.random() < 0.7 ? 4 : 3);
      const high = above(low, q, num);
      if (!singleAccidentals(low, high)) continue;
      const harmonic = Math.random() < 0.4;
      return {
        prompt: "Name this interval.",
        staff: { clef: clefFor([low]), groups: harmonic ? [[low, high]] : [[low], [high]] },
        steps: [{ type: "interval", correct: intervalCode(q, num) }],
        explain: explainInterval(low, high),
      };
    }
  },
};

const buildIntervals: Drill = {
  id: "d-build-intervals",
  number: "0.5",
  title: "Build intervals",
  summary: "Spell the note a given interval above.",
  brief: "Find the note a given interval above the one shown. First count letter names to get the right letter, then adjust with a sharp or flat to get the right number of half steps.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 4 },
  generate() {
    for (;;) {
      const code = pick(WRITTEN_INTERVALS);
      const { q, num } = parseInterval(code);
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
  },
};

const nameTriads: Drill = {
  id: "d-name-triads",
  number: "0.6",
  title: "Name triads",
  summary: "Root and quality of triads in any inversion.",
  brief: "A triad appears in root position or an inversion. Find the root (stack it in 3rds; the bottom note of the stack is the root), then name its quality.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 5 },
  generate() {
    for (;;) {
      const quality = pick(TRIAD_QUALITIES);
      const notes = triad(parseCode(pick(TRIAD_ROOTS), 4), quality);
      if (!singleAccidentals(...notes)) continue;
      const inversion = randInt(0, 2);
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
  },
};

const buildTriads: Drill = {
  id: "d-build-triads",
  number: "0.7",
  title: "Build triads",
  summary: "Spell the 3rd and 5th of any triad.",
  brief: "Spell a triad from its root: pick the 3rd, then the 5th. Major is a major 3rd and perfect 5th; minor has a minor 3rd; diminished has a minor 3rd and diminished 5th; augmented has a major 3rd and augmented 5th.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 6 },
  generate() {
    for (;;) {
      const quality = pick(TRIAD_QUALITIES);
      const notes = triad(parseCode(pick(TRIAD_ROOTS), 4), quality);
      if (!singleAccidentals(...notes)) continue;
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
  },
};

// ---- Ear drills ------------------------------------------------------------------

export const EAR_INTERVALS: Record<number, { code: string; label: string }> = {
  1: { code: "m2", label: "minor 2nd" }, 2: { code: "M2", label: "major 2nd" },
  3: { code: "m3", label: "minor 3rd" }, 4: { code: "M3", label: "major 3rd" },
  5: { code: "P4", label: "perfect 4th" }, 6: { code: "TT", label: "tritone" },
  7: { code: "P5", label: "perfect 5th" }, 8: { code: "m6", label: "minor 6th" },
  9: { code: "M6", label: "major 6th" }, 10: { code: "m7", label: "minor 7th" },
  11: { code: "M7", label: "major 7th" }, 12: { code: "P8", label: "octave" },
};

function earIntervalDrill(id: string, number: string, title: string, summary: string, semis: number[], accuracy: number): Drill {
  const options = semis.map((s) => EAR_INTERVALS[s].code);
  return {
    id,
    number,
    title,
    summary,
    brief: `Listen to two notes, played one after the other or together, and name the interval. Replay as often as you like. ${semis.length < 12 ? "This round uses only the most distinct intervals: the perfect ones and the 3rds." : "All intervals within an octave."}`,
    ear: true,
    pass: { accuracy },
    generate() {
      const s = pick(semis);
      const low = randInt(50, 67);
      const harmonic = Math.random() < 0.3;
      const audio: AudioEvent[] = harmonic
        ? [{ pitches: [low, low + s], at: 0, dur: 1.8 }]
        : [{ pitches: [low], at: 0, dur: 0.9 }, { pitches: [low + s], at: 0.95, dur: 1.3 }];
      return {
        prompt: `Name the interval${harmonic ? " (played together)" : ""}.`,
        audio,
        steps: [{ type: "earInterval", correct: EAR_INTERVALS[s].code, options }],
        explain: `That was a ${EAR_INTERVALS[s].label}, ${halfSteps(s)}.`,
      };
    },
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
  number: "0.10",
  title: "Hear chord quality",
  summary: "Major, minor, diminished or augmented, by ear.",
  brief: "A triad plays as a chord, then one note at a time. Name its quality. Major sounds bright and settled, minor darker, diminished tense and narrow, augmented unsettled and wide.",
  ear: true,
  pass: { accuracy: 0.9 },
  generate() {
    const quality = pick<TriadQuality>(["major", "minor", "diminished", "augmented"]);
    const root = randInt(50, 62);
    const p = CHORD_SHAPES[quality].map((s) => root + s);
    return {
      prompt: "Name the chord's quality.",
      audio: [{ pitches: p, at: 0, dur: 1.4 }, ...p.map((x, i) => ({ pitches: [x], at: 1.6 + i * 0.45, dur: 0.5 }))],
      steps: [{ type: "triadQuality", correct: quality }],
      explain: `That was ${quality}: ${quality === "major" ? "major 3rd + minor 3rd" : quality === "minor" ? "minor 3rd + major 3rd" : quality === "diminished" ? "two minor 3rds" : "two major 3rds"}.`,
    };
  },
};

export const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "ti"];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

const hearDegrees: Drill = {
  id: "d-ear-degrees",
  number: "0.11",
  title: "Hear scale degrees",
  summary: "Which degree of the key a note is, after a cadence.",
  brief: "A cadence (I–IV–V–I) sets the key, then one note plays. Name its scale degree, 1 to 7. This is functional ear training: hearing each note's role in the key, not just its distance from the last note.",
  ear: true,
  pass: { accuracy: 0.85 },
  generate() {
    const t = randInt(55, 66);
    const degree = randInt(1, 7);
    const target = t + MAJOR_STEPS[degree - 1];
    const chords = [
      [t - 12, t, t + 4, t + 7],
      [t - 7, t, t + 5, t + 9],
      [t - 5, t - 1, t + 2, t + 7],
      [t - 12, t, t + 4, t + 7],
    ];
    return {
      prompt: "Which scale degree is the last note?",
      audio: [...chords.map((c, i) => ({ pitches: c, at: i * 0.75, dur: 0.7 })), { pitches: [target], at: 3.6, dur: 1.4 }],
      steps: [{ type: "degree", correct: String(degree) }],
      explain: `That was degree ${degree} (${SOLFEGE[degree - 1]}).`,
    };
  },
};

export const DRILLS: Drill[] = [
  readNotes,
  keySignatures,
  scales,
  nameIntervals,
  buildIntervals,
  nameTriads,
  buildTriads,
  earIntervalDrill("d-ear-intervals-basic", "0.8", "Hear intervals: the essentials", "Perfect 4th, 5th, octave and 3rds by ear.", [3, 4, 5, 7, 12], 0.9),
  earIntervalDrill("d-ear-intervals-all", "0.9", "Hear intervals: all of them", "Every interval within an octave, by ear.", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 0.8),
  hearChords,
  hearDegrees,
  keySignaturesAll,
];

export function getDrill(id: string | null): Drill | null {
  return DRILLS.find((d) => d.id === id) ?? null;
}
