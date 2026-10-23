/**
 * The study plan on the Practice Room home page, built around the current goals: strong
 * fundamentals, transcribing pop by ear, and reading (pop) sheet music. Each daily block
 * is an ordered list of stages; the page shows the first one not yet passed. Stages are
 * drill, melody and exercise ids.
 */

export interface PlanBlock {
  id: string;
  title: string;
  minutes: number;
  why: string;
  tip?: string;
  stages: string[];
  /** Flashcard decks that go with this block. */
  decks?: string[];
}

export const PLAN_GOAL = "Strong fundamentals, then transcribing pop by ear and reading pop sheet music well.";

export const DAILY: PlanBlock[] = [
  {
    id: "rhythm",
    title: "Rhythm",
    minutes: 8,
    why: "The biggest gap, and the core of reading and transcribing pop.",
    tip: "Count out loud: \"1 e & a\".",
    stages: ["r-values-basic", "r-values-dotted", "r-dictation-1", "r-tap-1", "r-dictation-2", "r-tap-2", "r-values-bar", "r-dictation-3", "r-tap-3"],
    decks: ["note-values"],
  },
  {
    id: "ear",
    title: "Ear: scale degrees and chords",
    minutes: 8,
    why: "Hearing notes and chords by their role in the key: how you'll hear melodies and bass lines.",
    tip: "Sing each note home to do.",
    stages: ["d-ear-degrees-135", "d-ear-degrees-15", "d-frag-3", "d-ear-degrees", "d-frag-4", "h-chords-1-5", "h-chords-1-4-5", "h-chords-vi", "h-prog-basic"],
    decks: ["hear-degrees", "fragments", "chords-in-key"],
  },
  {
    id: "theory",
    title: "Theory on paper",
    minutes: 8,
    why: "Scales, intervals and triads: the base for chords and chord symbols.",
    tip: "Count letters, then apply the key signature.",
    stages: ["d-scales-major", "d-name-intervals-common", "d-build-intervals-common", "d-name-triads-basic", "d-build-triads-basic", "d-scales-natural"],
    decks: ["scales", "name-intervals", "name-triads"],
  },
  {
    id: "intervals",
    title: "Intervals by ear",
    minutes: 4,
    why: "Keeps interval hearing growing: played together, then in context.",
    tip: "The interval trainer's \"…then together\" mode bridges melodic to harmonic.",
    stages: ["d-ear-ess-together", "d-ear-intervals-basic", "d-ctx-ess", "d-ear-all-up"],
    decks: ["hear-intervals"],
  },
  {
    id: "cards",
    title: "Flashcards",
    minutes: 4,
    why: "Keeps facts automatic. 0.2b needs answers in 3 s or less: speed comes from here.",
    tip: "Key signatures: the Both keys preset, then All.",
    stages: ["d-keys"],
    decks: ["keys"],
  },
];

export interface WeeklyItem {
  title: string;
  minutes: string;
  text: string;
  stages?: string[];
}

export const WEEKLY: WeeklyItem[] = [
  {
    title: "Transcription",
    minutes: "20–30 min",
    text: "Work through the melodies here, then try a simple pop song: find the tonic, then the bass line by scale degree, then the chords, then the melody. Slow the recording down if you need to.",
    stages: ["tr-hot-cross-buns", "tr-mary", "tr-ode", "tr-twinkle", "tr-jingle", "tr-frere-jacques", "tr-amazing-grace"],
  },
  {
    title: "Sight-reading",
    minutes: "10 min, twice",
    text: "Simple melodies from a beginner pop or hymn songbook: tap the rhythm first, then name or play the notes. Easy material, a lot of it.",
  },
];

/** The next couple of weeks' goals, checked off as they're passed. */
export const MILESTONES = ["d-keys", "d-ear-ess-down", "r-values-basic", "r-values-dotted", "r-dictation-1", "d-ear-degrees-135", "d-ear-degrees-15", "d-scales-major", "d-ear-ess-together"];

/** Units and decks folded away while the focus is fundamentals, pop transcription and reading. */
export const TUCKED_UNITS = ["Counterpoint essentials", "Non-chord tones", "Harmonizing a melody"];
export const TUCKED_DECKS = ["nct", "chord-fit"];
