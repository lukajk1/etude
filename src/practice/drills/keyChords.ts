import type { Drill, Question } from "./catalog";
import { codeOf, KEYS_IN_ORDER, nameOf, parseCode, pick, prettyCode, scaleNotes, type Spelled } from "./theory";

/**
 * Chords by key: one major key at a time, its chords on the staff with its key signature,
 * to name by letter ("Em") or by numeral (vi). The seven triads built on its scale, plus V7.
 */

const NUMERALS = ["I", "ii", "iii", "IV", "V", "vi", "vii°", "V7"];
const SUFFIX = ["", "m", "m", "", "", "m", "dim", "7"];

/** A key's chords: root position, notes spelled from the scale, the root near middle C. */
function keyChords(keyCode: string): { name: string; numeral: string; notes: Spelled[] }[] {
  // Two octaves of the scale, so every chord's notes come from it.
  const lower = scaleNotes(parseCode(keyCode, 4), "major");
  const scale = [...lower, ...lower.map((n) => ({ ...n, octave: n.octave + 1 }))];
  return NUMERALS.map((numeral, i) => {
    const root = i === 7 ? 4 : i; // V7 is built on sol
    const notes = [root, root + 2, root + 4, ...(i === 7 ? [root + 6] : [])].map((d) => scale[d]);
    return { name: codeOf(scale[root]) + SUFFIX[i], numeral, notes };
  });
}

/** "F#dim" → "F♯dim": a chord name for display. */
export const prettyChord = (name: string) => {
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(name);
  return m ? prettyCode(m[1]) + m[2] : name;
};

/** One chord of the key on the staff: name it by letter, or by numeral. */
export function keyChordQuestion(keyCode: string): Question {
  const chords = keyChords(keyCode);
  // The everyday chords (I, IV, V, vi, ii) come up a little more than iii, vii° and V7.
  const i = pick([0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 7]);
  const c = chords[i];
  const key = `${prettyCode(keyCode)} major`;
  const family = `${key}: ${chords.slice(0, 7).map((x) => `${x.numeral} ${prettyChord(x.name)}`).join(", ")}, and V7 ${prettyChord(chords[7].name)}.`;
  const notes = c.notes.map((n) => nameOf(n)).join("–");
  const byName = Math.random() < 0.5;
  return {
    prompt: byName ? `${key}: name this chord.` : `${key}: which chord of the key is this?`,
    staff: { clef: "treble", keySig: keyCode, groups: [c.notes] },
    steps: [byName ? { type: "label", correct: c.name, options: chords.map((x) => x.name) } : { type: "label", correct: c.numeral, options: NUMERALS }],
    explain: `${notes} is ${prettyChord(c.name)}, the ${c.numeral} chord. ${family}`,
  };
}

/** One small drill per key, shown on the home page as one row with a chip for each key. */
export const KEY_CHORD_DRILLS: Drill[] = KEYS_IN_ORDER.map((code, i) => ({
  id: `d-keychords-${code.toLowerCase().replace("#", "s")}`,
  number: `0.17${"abcdefghijkl"[i]}`,
  title: `Chords by key: ${prettyCode(code)} major`,
  summary: `The chords of ${prettyCode(code)} major on the staff, by name and by numeral.`,
  brief:
    "One major key at a time: a chord of the key appears on the staff, with the key signature, root position. Name it by letter (\"Em\") or by its numeral in the key (vi). Find the root (the bottom note), name it as a degree of the scale, and the numeral follows; in every major key, I, IV and V are major, ii, iii and vi minor, and vii° diminished. V7 adds fa on top of V.",
  ear: false,
  pass: { accuracy: 0.9, medianSec: 4 },
  chip: prettyCode(code),
  generate: () => keyChordQuestion(code),
}));
