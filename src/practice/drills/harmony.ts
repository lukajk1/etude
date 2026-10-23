import type { Drill, Question } from "./catalog";
import { keyContext } from "./keyContext";
import { pick, randInt } from "./theory";

/**
 * Hearing harmony: naming chords by their role in a major key (I, ii, IV, V, vi), alone
 * after a cadence and then in short progressions. Chords are voiced the way a pianist
 * would: the root in the bass, the other notes kept close together around the tonic.
 */

export type Numeral = "I" | "ii" | "IV" | "V" | "vi";
/** In the order they appear on the answer buttons. */
export const NUMERALS: Numeral[] = ["I", "ii", "IV", "V", "vi"];

const ROOT: Record<Numeral, number> = { I: 0, ii: 2, IV: 5, V: 7, vi: 9 };
const MINOR = new Set<Numeral>(["ii", "vi"]);

export const NUMERAL_NAME: Record<Numeral, string> = {
  I: "tonic",
  ii: "supertonic",
  IV: "subdominant",
  V: "dominant",
  vi: "relative minor",
};

/** How each chord sounds in the key, and which note to listen for in the bass. */
const ROLE: Record<Numeral, string> = {
  I: "I, the tonic: home and at rest, with do in the bass.",
  ii: "ii, a minor chord on re. It usually leads on to V.",
  IV: "IV, the subdominant: a lift away from home (the \"amen\" chord), with fa in the bass.",
  V: "V, the dominant: tense, it pulls back to I. Sol is in the bass.",
  vi: "vi, the relative minor: like home, but darker. La is in the bass.",
};

/** A chord in the key of tonic `t` (MIDI): the root in the bass, the rest close above. */
export function chordPitches(t: number, n: Numeral): number[] {
  const r = ROOT[n];
  const pcs = [r, r + (MINOR.has(n) ? 3 : 4), r + 7];
  const upper = pcs
    .map((pc) => {
      let p = t + (pc % 12);
      while (p > t + 8) p -= 12;
      while (p < t - 3) p += 12;
      return p;
    })
    .sort((a, b) => a - b);
  const bass = t - 12 + (r > 5 ? r - 12 : r);
  return [bass, ...upper];
}

export function chordInKeyQuestion(n: Numeral, options: Numeral[]): Question {
  const t = randInt(57, 64);
  // The key is set a different way each time (see keyContext.ts), then the chord plays.
  const context = keyContext(t);
  return {
    prompt: "The key is set, then one chord plays. Which chord is it?",
    audio: [...context.events, { pitches: chordPitches(t, n), at: context.end + 0.75, dur: 1.8 }],
    steps: [{ type: "numeral", correct: n, options }],
    explain: `That was ${ROLE[n]} (The key was set by ${context.label}.) Tip: sing the bass note and find it as a scale degree; the bass tells you the chord.`,
  };
}

// ---- Progressions ----------------------------------------------------------------

/** Four-chord progressions starting on I, with the names they're known by. */
export const PROGRESSIONS: { chords: Numeral[]; name: string }[] = [
  { chords: ["I", "IV", "V", "I"], name: "the basic cadence: away, tension, home" },
  { chords: ["I", "V", "IV", "I"], name: "a rock and folk staple" },
  { chords: ["I", "IV", "I", "V"], name: "a half cadence: it stops on V, unresolved" },
  { chords: ["I", "V", "I", "IV"], name: "back and forth, ending away from home" },
  { chords: ["I", "IV", "V", "V"], name: "it ends on V, waiting to go home" },
  { chords: ["I", "I", "IV", "V"], name: "a slow start, then away and up to V" },
  { chords: ["I", "vi", "IV", "V"], name: "the '50s (doo-wop) progression" },
  { chords: ["I", "V", "vi", "IV"], name: "the pop progression behind countless songs" },
  { chords: ["I", "vi", "ii", "V"], name: "a turnaround, falling through the circle of fifths" },
  { chords: ["I", "ii", "V", "I"], name: "the ii–V–I, a classical and jazz staple" },
  { chords: ["I", "IV", "ii", "V"], name: "IV and ii both lead into V" },
  { chords: ["I", "vi", "IV", "I"], name: "a gentle, hymn-like loop" },
  { chords: ["I", "IV", "vi", "V"], name: "away, darker, then tension" },
  { chords: ["I", "ii", "IV", "V"], name: "climbing from home up to V" },
];

const usesOnly = (chords: Numeral[], allowed: Numeral[]) => chords.every((c) => allowed.includes(c));
export const progressionsUsing = (allowed: Numeral[]) => PROGRESSIONS.filter((p) => usesOnly(p.chords, allowed));
export const progressionLabel = (chords: Numeral[]) => chords.join("–");

export function progressionQuestion(chords: Numeral[], options: Numeral[]): Question {
  const t = randInt(57, 64);
  const name = PROGRESSIONS.find((p) => progressionLabel(p.chords) === progressionLabel(chords))?.name;
  return {
    prompt: "Four chords play, starting on I. Name chords 2, 3 and 4.",
    audio: chords.map((n, i) => ({ pitches: chordPitches(t, n), at: i * 1.0, dur: i === 3 ? 1.6 : 0.95 })),
    steps: chords.slice(1).map((c, i) => ({ type: "numeral" as const, label: `Chord ${i + 2}`, correct: c, options })),
    explain: `It was ${progressionLabel(chords)}${name ? `, ${name}` : ""}. Follow the bass: ${chords.map((c) => ({ I: "do", ii: "re", IV: "fa", V: "sol", vi: "la" })[c]).join(", ")}.`,
  };
}

// ---- Checkpoints ----------------------------------------------------------------------

const BRIEF_CHORDS =
  "The key is set, a different way each time (a cadence, a scale, the tonic chord broken up, or a short melody), then one chord plays. Name it by its role in the key. Listen to the bass: do means I, fa IV, sol V, la vi, re ii. I sounds settled, V tense and leaning home, IV lifted, vi like a darker home, ii minor and on the way to V.";

function chordsDrill(id: string, number: string, title: string, summary: string, set: Numeral[], accuracy: number): Drill {
  return {
    id,
    number,
    title,
    summary,
    brief: BRIEF_CHORDS,
    ear: true,
    unit: "harmony",
    pass: { accuracy },
    generate: () => chordInKeyQuestion(pick(set), set),
  };
}

function progressionDrill(id: string, number: string, title: string, summary: string, set: Numeral[], accuracy: number): Drill {
  const pool = progressionsUsing(set);
  return {
    id,
    number,
    title,
    summary,
    brief: "Four chords play, starting on I. Name the other three. Most music moves through a handful of patterns like these, so they become recognizable as shapes. Follow the bass line.",
    ear: true,
    unit: "harmony",
    pass: { accuracy },
    generate: () => progressionQuestion(pick(pool).chords, set),
  };
}

export const HARMONY_DRILLS: Drill[] = [
  chordsDrill("h-chords-1-5", "2.1a", "Chords in a key: I or V", "Home or the dominant, after a cadence.", ["I", "V"], 0.9),
  chordsDrill("h-chords-1-4-5", "2.1b", "Chords in a key: I, IV or V", "The three chords that carry most tonal music.", ["I", "IV", "V"], 0.9),
  chordsDrill("h-chords-vi", "2.1c", "Chords in a key: add vi", "I, IV, V and the relative minor.", ["I", "IV", "V", "vi"], 0.85),
  chordsDrill("h-chords-all", "2.1d", "Chords in a key: add ii", "I, ii, IV, V and vi.", ["I", "ii", "IV", "V", "vi"], 0.85),
  progressionDrill("h-prog-basic", "2.2a", "Progressions: I, IV and V", "Four-chord progressions using I, IV and V.", ["I", "IV", "V"], 0.8),
  progressionDrill("h-prog-all", "2.2b", "Progressions: with vi and ii", "The '50s progression, the pop progression, ii–V–I and more.", ["I", "ii", "IV", "V", "vi"], 0.8),
];
