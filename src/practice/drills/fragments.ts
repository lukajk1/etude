import type { AudioEvent, Drill, Question } from "./catalog";
import { chordPitches, type Numeral } from "./harmony";
import { keyContext } from "./keyContext";
import { resolveToDo } from "./resolve";
import { pick, randInt } from "./theory";

/**
 * Hearing melodies in context, the way musicians actually do: as scale degrees once the
 * key is set (fragments), and picking out one interval inside a running melody. Degrees here
 * are scale steps from do (0), so -1 is the ti below and 7 the do above.
 */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "ti"];
const pitchAt = (t: number, d: number) => t + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7];
/** 1–7 for a degree in any octave. */
const sd = (d: number) => (((d % 7) + 7) % 7) + 1;
export const solfa = (pattern: number[]) => pattern.map((d) => SOLFEGE[sd(d) - 1]).join(" ");

/** Common three-note patterns within do to sol. */
export const PATTERNS_3: number[][] = [
  [0, 1, 2], [2, 1, 0], [2, 3, 4], [4, 3, 2], [0, 2, 4], [4, 2, 0], [0, 1, 0], [1, 2, 3], [3, 2, 1], [4, 3, 4],
];
/** Common four-note patterns, with la and ti. */
export const PATTERNS_4: number[][] = [
  [4, 5, 6, 7], [7, 6, 5, 4], [0, 1, 2, 3], [3, 2, 1, 0], [2, 1, 0, -1], [-1, 0, 1, 2], [4, 2, 1, 0], [0, 2, 4, 7], [5, 4, 3, 2], [1, 2, 3, 4], [4, 5, 4, 3], [2, 3, 2, 1],
];
export const patternId = (p: number[]) => p.join("_");
export const patternFromId = (id: string) => id.split("_").map(Number);

/** Name each note of a fragment by scale degree, after the key is set (a different way each time; see keyContext.ts). */
export function fragmentQuestion(pattern: number[], noteSec: number, options = ["1", "2", "3", "4", "5", "6", "7"]): Question {
  const t = randInt(57, 64);
  const context = keyContext(t);
  const start = context.end + 0.65;
  return {
    prompt: `The key is set, then ${pattern.length} notes play. Name each one's scale degree (keys 1–7 work).`,
    audio: [...context.events, ...pattern.map((d, i) => ({ pitches: [pitchAt(t, d)], at: start + i * noteSec, dur: noteSec * 0.92 }))],
    resolve: resolveToDo(pitchAt(t, pattern[pattern.length - 1]), sd(pattern[pattern.length - 1])),
    again: { label: "Play notes again", audio: pattern.map((d, i) => ({ pitches: [pitchAt(t, d)], at: i * noteSec, dur: noteSec * 0.92 })) },
    steps: pattern.map((d, i) => ({ type: "degree" as const, label: `Note ${i + 1}`, correct: String(sd(d)), options })),
    explain: `That was ${solfa(pattern)} (${pattern.map(sd).join(" ")}); the key was set by ${context.label}. Sing it back, then keep going to do: the way it resolves tells you where each note sits.`,
  };
}

/** The common chords that contain each degree from do to sol (0–4), so a melody note always sits in its chord. */
const CHORDS_FOR: Numeral[][] = [
  ["I", "IV", "vi"], // do
  ["V", "ii"], // re
  ["I", "vi"], // mi
  ["IV", "ii"], // fa
  ["I", "V"], // sol
];

/**
 * A chord under each note of a fragment: home (I) on the first note when it fits and on
 * the last when it fits, otherwise a chord containing the note, so it sounds like a
 * harmonized tune rather than notes over random chords.
 */
function harmonize(pattern: number[]): Numeral[] {
  return pattern.map((d, i) => {
    const fits = CHORDS_FOR[d];
    if ((i === 0 || i === pattern.length - 1) && fits.includes("I")) return "I";
    if (i === pattern.length - 1 && fits.includes("V")) return "V";
    return pick(fits);
  });
}

/**
 * Name each note of a three-note fragment in C, played over a chord per note, after the
 * same I–IV–V–I cadence every time. The melody sits an octave above the chords.
 */
export function chordedFragmentQuestion(pattern: number[]): Question {
  const t = 60;
  const cadence: AudioEvent[] = (["I", "IV", "V", "I"] as Numeral[]).map((n, i) => ({ pitches: chordPitches(t, n), at: i * 0.75, dur: 0.7 }));
  const start = 3 * 0.75 + 0.7 + 0.8;
  const noteSec = 0.8;
  const chords = harmonize(pattern);
  const melody = pattern.map((d, i) => ({ pitches: [pitchAt(t + 12, d)], at: i * noteSec, dur: noteSec * 0.94, vel: 0.85 }));
  const under = chords.map((n, i) => ({ pitches: chordPitches(t, n), at: i * noteSec, dur: noteSec * 0.94, vel: 0.42 }));
  const shift = (es: AudioEvent[], by: number) => es.map((e) => ({ ...e, at: e.at + by }));
  return {
    prompt: "The key is C. A short melody plays over chords. Name each melody note's scale degree (keys 1–5 work).",
    audio: [...cadence, ...shift(melody, start), ...shift(under, start)],
    resolve: resolveToDo(pitchAt(t + 12, pattern[pattern.length - 1]), sd(pattern[pattern.length - 1]), { down: true }),
    again: { label: "Play melody again", audio: [...melody, ...under] },
    replays: [{ label: "Melody alone", audio: melody }],
    steps: pattern.map((d, i) => ({ type: "degree" as const, label: `Note ${i + 1}`, correct: String(sd(d)), options: ["1", "2", "3", "4", "5"] })),
    explain: `That was ${solfa(pattern)} (${pattern.map(sd).join(" ")}) over ${chords.join("–")}. The melody is the top line; each note belongs to the chord under it, so the chord's color hints at the degree.`,
  };
}

/** A random fragment: starts on a home-chord note, moves mostly by step. */
export function randomFragment(length: number): number[] {
  for (;;) {
    const f = [pick([0, 2, 4, 7])];
    while (f.length < length) f.push(f[f.length - 1] + pick([-1, 1, -1, 1, -2, 2, 3, -3]));
    if (f.every((d) => d >= -2 && d <= 9)) return f;
  }
}

// ---- Intervals in context -------------------------------------------------------------

export const INTERVAL_CODES: Record<number, string> = { 1: "m2", 2: "M2", 3: "m3", 4: "M3", 5: "P4", 6: "TT", 7: "P5", 8: "m6", 9: "M6", 10: "m7", 11: "M7", 12: "P8" };
const INTERVAL_NAMES: Record<number, string> = { 1: "minor 2nd", 2: "major 2nd", 3: "minor 3rd", 4: "major 3rd", 5: "perfect 4th", 6: "tritone", 7: "perfect 5th", 8: "minor 6th", 9: "major 6th", 10: "minor 7th", 11: "major 7th", 12: "octave" };
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

/**
 * A six-note melody in a major key, stepwise apart from one leap of `semis` semitones
 * (up or down) between notes k and k+1; asks for that interval.
 */
export function contextIntervalQuestion(semis: number, options: number[]): Question {
  const t = randInt(57, 64);
  for (;;) {
    const up = Math.random() < 0.5;
    const k = randInt(2, 4); // the leap is from note k to note k+1 (1-based)
    // Find a pair of scale steps exactly `semis` apart, in a comfortable range.
    const pairs: [number, number][] = [];
    for (let a = -2; a <= 9; a++) for (let b = -2; b <= 12; b++) if (pitchAt(t, b) - pitchAt(t, a) === (up ? semis : -semis)) pairs.push([a, b]);
    if (!pairs.length) continue;
    const [a, b] = pick(pairs);
    const mel: number[] = [a];
    while (mel.length < k) mel.unshift(mel[0] + pick([-1, 1]));
    mel.push(b);
    while (mel.length < 6) mel.push(mel[mel.length - 1] + pick([-1, 1]));
    // Every other move is a step, so the asked-for interval is the melody's one leap (for 2nds, it's one step among others).
    const fine = mel.every((d, i) => i === 0 || i === k || Math.abs(d - mel[i - 1]) === 1) && mel.every((d) => d >= -3 && d <= 13);
    if (!fine) continue;
    const pitches = mel.map((d) => pitchAt(t, d));
    return {
      prompt: `A melody plays. What's the interval from the ${ORDINAL[k - 1]} note to the ${ORDINAL[k]}?`,
      audio: pitches.map((p, i) => ({ pitches: [p], at: i * 0.55, dur: 0.5 })),
      steps: [{ type: "earInterval", correct: INTERVAL_CODES[semis], options: options.map((s) => INTERVAL_CODES[s]) }],
      explain: `It was a ${INTERVAL_NAMES[semis]} ${up ? "up" : "down"}, ${solfa([a])} to ${solfa([b])}. In context, notice the leap's color and where it lands in the key.`,
    };
  }
}

// ---- Stages ------------------------------------------------------------------------------

const FRAG_BRIEF =
  "A chord progression sets the key, a different one each time (I–IV–V–I, I–V7–I, ii–V–I and others), then a short fragment plays. Name each note's scale degree, by number (keys 1–7) or solfège. Don't measure intervals note to note: hear each note's place in the key, and if unsure, sing the fragment and carry on to do.";
const CTX_BRIEF =
  "A short melody plays, mostly by step with one leap. Name the leap between the two notes asked about. Replay as often as you like; this is the skill of picking intervals out of real music.";

const ESSENTIALS = [3, 4, 5, 7, 12];
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const FRAGMENT_DRILLS: Drill[] = [
  // The gentlest start: always in C, after the same cadence, with chords that fit the tune.
  {
    id: "d-frag-3-chords",
    number: "0.12d",
    title: "Hear melodic fragments: three notes in C, with chords",
    summary: "Three-note patterns from do to sol, harmonized, always in C.",
    brief:
      "An I–IV–V–I cadence sets C major, then a three-note melody plays on top of a chord per note, the way a tune sounds with its accompaniment. Name each melody note's scale degree, 1 to 5. Listen to the top line; each note belongs to the chord under it (do over I, IV or vi, re over V or ii, and so on), so the chords help place it. \"Melody alone\" plays it without them.",
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => chordedFragmentQuestion(pick(PATTERNS_3)),
  },
  {
    id: "d-frag-3",
    number: "0.12a",
    title: "Hear melodic fragments: three notes, do to sol",
    summary: "Common three-note patterns: do-re-mi, sol-fa-mi, do-mi-sol…",
    brief: FRAG_BRIEF,
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => fragmentQuestion(pick(PATTERNS_3), 0.6, ["1", "2", "3", "4", "5"]),
  },
  {
    id: "d-frag-4",
    number: "0.12b",
    title: "Hear melodic fragments: four notes, with la and ti",
    summary: "Common four-note patterns: sol-la-ti-do, mi-re-do-ti…",
    brief: FRAG_BRIEF,
    ear: true,
    pass: { accuracy: 0.8 },
    generate: () => fragmentQuestion(pick(PATTERNS_4), 0.5),
  },
  {
    id: "d-frag-5",
    number: "0.12c",
    title: "Hear melodic fragments: five notes, faster",
    summary: "Random fragments at a quicker tempo.",
    brief: FRAG_BRIEF,
    ear: true,
    pass: { accuracy: 0.75 },
    generate: () => fragmentQuestion(randomFragment(5), 0.38),
  },
  {
    id: "d-ctx-ess",
    number: "0.13a",
    title: "Intervals in context: the essentials",
    summary: "A 3rd, 4th, 5th or octave leap inside a melody.",
    brief: CTX_BRIEF,
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => contextIntervalQuestion(pick(ESSENTIALS), ESSENTIALS),
  },
  {
    id: "d-ctx-all",
    number: "0.13b",
    title: "Intervals in context: all intervals",
    summary: "Any interval within an octave, inside a melody.",
    brief: CTX_BRIEF,
    ear: true,
    pass: { accuracy: 0.75 },
    generate: () => contextIntervalQuestion(pick(ALL), ALL),
  },
];
