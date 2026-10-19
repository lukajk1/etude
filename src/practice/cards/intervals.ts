import { EAR_INTERVALS } from "../drills/catalog";
import type { Card, DeckDef, Shown } from "./types";

/**
 * Intervals in semitones, both ways. Handy in a piano roll, where each row is a
 * semitone. Core: the six that come up most (3rds, 4th, tritone, 5th, octave).
 */

const CORE = [3, 4, 5, 6, 7, 12];
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const inPool = (pool: string) => (pool === "full" ? ALL : CORE);

/** An example from C, and a way to remember it. */
const INFO: Record<number, { example: string; tip: string }> = {
  1: { example: "C to D♭, or E to F", tip: "The smallest step; E–F and B–C are the half steps between white keys." },
  2: { example: "C to D", tip: "A whole step: two half steps." },
  3: { example: "C to E♭, or A to C", tip: "The bottom 3rd of a minor chord." },
  4: { example: "C to E", tip: "Two whole steps; the bottom 3rd of a major chord." },
  5: { example: "C to F", tip: "Turn it upside down and you get a perfect 5th: 5 + 7 = 12." },
  6: { example: "C to F♯, or F to B", tip: "Exactly half an octave: three whole steps, hence tri-tone." },
  7: { example: "C to G", tip: "Turn it upside down and you get a perfect 4th: 7 + 5 = 12." },
  8: { example: "C to A♭, or E to C", tip: "An octave minus a major 3rd: 12 − 4." },
  9: { example: "C to A", tip: "An octave minus a minor 3rd: 12 − 3." },
  10: { example: "C to B♭", tip: "An octave minus a whole step: 12 − 2." },
  11: { example: "C to B", tip: "One half step short of the octave." },
  12: { example: "C to the next C", tip: "Same letter, 12 half steps up." },
};

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
const semitones = (n: number) => `${n} semitone${n === 1 ? "" : "s"}`;

function intervalCard(type: "int-semis" | "int-name", n: number): Card {
  const { code, label } = EAR_INTERVALS[n];
  return {
    id: `${type}:${code}`,
    type,
    label,
    cell: code,
    show(pool): Shown {
      const explain = `A ${label} is ${semitones(n)} (${INFO[n].example}). ${INFO[n].tip}`;
      if (type === "int-semis") {
        return { prompt: "How many semitones?", display: capital(label), steps: [{ type: "semitones", correct: String(n), options: inPool(pool).map(String) }], explain };
      }
      return { prompt: "Which interval?", display: semitones(n), steps: [{ type: "earInterval", correct: code, options: inPool(pool).map((s) => EAR_INTERVALS[s].code) }], explain };
    },
  };
}

export const INTERVALS_DECK: DeckDef = {
  id: "intervals",
  title: "Intervals in semitones",
  summary: "How many semitones each interval spans, and the interval for a number of semitones.",
  brief: "Say how many semitones (half steps) an interval spans, or name the interval for a number of semitones. Useful in a piano roll, where each row is a semitone. Start with the core six.",
  icon: "½",
  pools: [
    { value: "core", label: "Core: 3rds, 4th, tritone, 5th, octave" },
    { value: "full", label: "All 12" },
  ],
  types: [
    { id: "int-semis", label: "Interval → semitones", hint: "See an interval, say how many semitones" },
    { id: "int-name", label: "Semitones → interval", hint: "See a number of semitones, name the interval" },
  ],
  clefs: false,
  defaults: { pool: "core", types: ["int-semis", "int-name"] },
  build(pool, types) {
    return INTERVALS_DECK.types
      .map((t) => t.id as "int-semis" | "int-name")
      .filter((t) => types.includes(t))
      .flatMap((t) => inPool(pool).map((n) => intervalCard(t, n)));
  },
  grid(pool, cards) {
    return {
      cols: inPool(pool).map(String),
      rows: INTERVALS_DECK.types.map((t) => ({ label: t.label, cards: cards.filter((c) => c.type === t.id) })).filter((r) => r.cards.length),
    };
  },
};
