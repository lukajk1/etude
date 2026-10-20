import type { Drill, Question } from "./catalog";
import { chordPitches, type Numeral } from "./harmony";
import { pick, randInt } from "./theory";

/**
 * Cadences by ear: how a phrase ends. Four chords play, starting on I; the last two are
 * the cadence. Voiced like the harmony drills, root in the bass.
 */

export type Cadence = "authentic" | "half" | "plagal" | "deceptive";
export const CADENCES: Cadence[] = ["authentic", "half", "plagal", "deceptive"];

export const CADENCE_INFO: Record<Cadence, { label: string; chords: string; sound: string }> = {
  authentic: { label: "Authentic", chords: "V → I", sound: "a full stop: tension, then home" },
  half: { label: "Half", chords: "ends on V", sound: "a comma: it stops on the tense chord, unresolved" },
  plagal: { label: "Plagal", chords: "IV → I", sound: "a softer close, the \"amen\" at the end of a hymn" },
  deceptive: { label: "Deceptive", chords: "V → vi", sound: "a surprise: V sets up home, and the minor vi arrives instead" },
};

/** Phrases that end in each cadence, starting on I. */
const PHRASES: Record<Cadence, Numeral[][]> = {
  authentic: [
    ["I", "IV", "V", "I"],
    ["I", "ii", "V", "I"],
    ["I", "vi", "V", "I"],
  ],
  half: [
    ["I", "IV", "I", "V"],
    ["I", "vi", "ii", "V"],
    ["I", "ii", "IV", "V"],
  ],
  plagal: [
    ["I", "V", "IV", "I"],
    ["I", "vi", "IV", "I"],
    ["I", "ii", "IV", "I"],
  ],
  deceptive: [
    ["I", "IV", "V", "vi"],
    ["I", "ii", "V", "vi"],
    ["I", "vi", "V", "vi"],
  ],
};

export function cadenceQuestion(cadence: Cadence, options: Cadence[]): Question {
  const t = randInt(57, 64);
  const chords = pick(PHRASES[cadence]);
  const info = CADENCE_INFO[cadence];
  return {
    prompt: "Four chords play, starting on I. How does the phrase end?",
    audio: chords.map((n, i) => ({ pitches: chordPitches(t, n), at: i * 0.95, dur: i === 3 ? 1.8 : 0.9 })),
    steps: [{ type: "cadence", correct: cadence, options }],
    explain: `That was ${chords.join("–")}: a ${info.label.toLowerCase()} cadence (${info.chords}), ${info.sound}.`,
  };
}

const BRIEF =
  "Listen to how the phrase ends. Ending on I sounds finished: strongly after V (authentic), softly after IV (plagal). Ending on V sounds unfinished (half). V going to the minor vi sounds like a surprise (deceptive).";

function cadenceDrill(id: string, number: string, title: string, summary: string, set: Cadence[], accuracy: number): Drill {
  return { id, number, title, summary, brief: BRIEF, ear: true, unit: "cadences", pass: { accuracy }, generate: () => cadenceQuestion(pick(set), set) };
}

export const CADENCE_DRILLS: Drill[] = [
  cadenceDrill("c-cad-ah", "4.1a", "Cadences: authentic or half", "Finished or unfinished.", ["authentic", "half"], 0.9),
  cadenceDrill("c-cad-ahp", "4.1b", "Cadences: add plagal", "Authentic, half or plagal.", ["authentic", "half", "plagal"], 0.85),
  cadenceDrill("c-cad-all", "4.1c", "Cadences: add deceptive", "All four.", ["authentic", "half", "plagal", "deceptive"], 0.85),
];
