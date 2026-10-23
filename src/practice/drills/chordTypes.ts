import type { Drill, Question } from "./catalog";
import { pick, randInt } from "./theory";

/**
 * Hearing chord types beyond major and minor: the 7ths, sus and add9 chords, and the
 * diminished and augmented sounds, in the order you're likely to meet them in Western and
 * Japanese pop. They're one group of drills, each adding a type to the ones before; the
 * chord plays struck together, then broken upward, from a random root.
 */

export type ChordType = "maj" | "min" | "7" | "maj7" | "m7" | "sus4" | "sus2" | "add9" | "dim7" | "aug" | "m7b5";

export const CHORD_TYPES: Record<ChordType, { label: string; steps: number[]; sound: string }> = {
  maj: { label: "Major", steps: [0, 4, 7], sound: "a major triad: bright and settled" },
  min: { label: "Minor", steps: [0, 3, 7], sound: "a minor triad: darker, still settled" },
  "7": { label: "7 (dominant)", steps: [0, 4, 7, 10], sound: "major with a minor 7th on top: bluesy, leaning to resolve (V7)" },
  maj7: { label: "maj7", steps: [0, 4, 7, 11], sound: "major with a major 7th, a half step under the octave: soft and dreamy" },
  m7: { label: "m7", steps: [0, 3, 7, 10], sound: "minor with a minor 7th: mellow, smooth, unhurried" },
  sus4: { label: "sus4", steps: [0, 5, 7], sound: "the 3rd raised to a 4th: hovering, wants to fall back to major" },
  sus2: { label: "sus2", steps: [0, 2, 7], sound: "the 3rd lowered to a 2nd: open and airy, neither major nor minor" },
  add9: { label: "add9", steps: [0, 4, 7, 14], sound: "major with a 9th on top: shimmering, bright" },
  dim7: { label: "dim7", steps: [0, 3, 6, 9], sound: "stacked minor 3rds: tense and spooky, a passing chord" },
  aug: { label: "aug", steps: [0, 4, 8], sound: "two major 3rds, a raised 5th: dreamy and unsettled, as if rising" },
  m7b5: { label: "m7♭5", steps: [0, 3, 6, 10], sound: "half-diminished, a diminished triad with a minor 7th: dark and yearning" },
};

/** One chord, struck then broken upward; name its type. `options` are the answer buttons. */
export function chordTypeQuestion(type: ChordType, options: ChordType[]): Question {
  const root = randInt(48, 57);
  const p = CHORD_TYPES[type].steps.map((s) => root + s);
  return {
    prompt: "What type of chord is this?",
    audio: [{ pitches: p, at: 0, dur: 1.5 }, ...p.map((x, i) => ({ pitches: [x], at: 1.75 + i * 0.42, dur: 0.5 }))],
    steps: [{ type: "chordType", correct: type, options }],
    explain: `That was ${CHORD_TYPES[type].label}: ${CHORD_TYPES[type].sound}.`,
  };
}

/** Each chip adds its types to everything before it, by how often pop uses them. */
const STEPS: { chip: string; adds: ChordType[] }[] = [
  { chip: "7", adds: ["maj", "min", "7"] },
  { chip: "maj7", adds: ["maj7"] },
  { chip: "m7", adds: ["m7"] },
  { chip: "sus", adds: ["sus4", "sus2"] },
  { chip: "add9", adds: ["add9"] },
  { chip: "dim7", adds: ["dim7"] },
  { chip: "aug", adds: ["aug"] },
  { chip: "m7♭5", adds: ["m7b5"] },
];

export const CHORD_TYPE_DRILLS: Drill[] = STEPS.map((step, i) => {
  const set = STEPS.slice(0, i + 1).flatMap((s) => s.adds);
  const fresh = i === 0 ? ["7" as ChordType] : step.adds;
  const names = step.adds.map((t) => CHORD_TYPES[t].label).join(" and ");
  return {
    id: `d-chordtype-${step.chip.replace("♭", "b").toLowerCase()}`,
    number: `0.16${"abcdefgh"[i]}`,
    title: `Hear chord types: ${i === 0 ? "major, minor or 7" : `plus ${names}`}`,
    summary: i === 0 ? "Major, minor, and the dominant 7th." : `Everything before, plus ${names}.`,
    brief:
      "A chord plays, struck together and then broken upward, from a different root each time. Name its type. Each step adds a type in the order pop uses them most: the dominant 7th, maj7, m7, sus chords, add9, then the diminished and augmented sounds. Listen to the top of the chord: a 7th sits just under the octave (a whole step for 7 and m7, a half step for maj7).",
    ear: true,
    pass: { accuracy: 0.85 },
    chip: step.chip,
    // Favor the newest types, so each step drills what it adds.
    generate: () => chordTypeQuestion(Math.random() < 0.45 ? pick(fresh) : pick(set), set),
  };
});
