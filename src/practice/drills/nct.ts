import type { Drill, Question } from "./catalog";
import { nameOf, parseCode, pick, pitchOf, scaleNotes, type Spelled } from "./theory";

/**
 * Non-chord tones: melody notes outside the chord under them, named by how they move.
 * Each example is three chords with a melody on top, built from the textbook definitions
 * in scale degrees, and checked so the middle melody note really is outside its chord.
 */

export type Nct = "passing" | "neighbor" | "appoggiatura" | "suspension" | "escape" | "anticipation";
export const NCTS: Nct[] = ["passing", "neighbor", "appoggiatura", "suspension", "escape", "anticipation"];

export const NCT_INFO: Record<Nct, { label: string; how: string }> = {
  passing: { label: "Passing tone", how: "steps between two chord tones, filling the gap" },
  neighbor: { label: "Neighbor tone", how: "steps away from a chord tone and back to the same one" },
  appoggiatura: { label: "Appoggiatura", how: "leaps onto the dissonance as the chord changes, then resolves by step the other way" },
  suspension: { label: "Suspension", how: "is held over from the previous chord, clashes with the new one, then resolves down by step" },
  escape: { label: "Escape tone", how: "steps away from a chord tone, then leaps the other way to the next chord" },
  anticipation: { label: "Anticipation", how: "arrives early: it belongs to the next chord but sounds before the chord changes" },
};

type Chord = "I" | "IV" | "V";
const ROOT: Record<Chord, number> = { I: 0, IV: 3, V: 4 };
/** Keyboard voicings in scale degrees, all within a 6th: I root position, IV second inversion, V first inversion. */
const VOICING: Record<Chord, number[]> = { I: [0, 2, 4], IV: [0, 3, 5], V: [-1, 1, 4] };
/** Melody range in scale degrees above the tonic: just above the chords. */
const LOW = 6;
const HIGH = 12;
const KEYS = ["C", "G", "F", "D", "Bb"];

const isChordTone = (d: number, c: Chord) => [0, 2, 4].includes((((d - ROOT[c]) % 7) + 7) % 7);
const inRange = (...ds: number[]) => ds.every((d) => d >= LOW && d <= HIGH);
const CHORDS: Chord[] = ["I", "IV", "V"];
const range = () => Array.from({ length: HIGH - LOW + 1 }, (_, i) => LOW + i);

interface Example {
  chords: [Chord, Chord, Chord];
  melody: [number, number, number];
}

/** One example of each kind, or null if the random choices didn't fit (the caller retries). */
function attempt(kind: Nct): Example | null {
  const X = pick(CHORDS);
  const Y = pick(CHORDS.filter((c) => c !== X));
  const dir = pick([-1, 1]);
  switch (kind) {
    case "passing": {
      const c = pick(range().filter((d) => isChordTone(d, X)));
      const m: Example["melody"] = [c, c + dir, c + 2 * dir];
      return inRange(...m) && isChordTone(m[2], X) && !isChordTone(m[1], X) ? { chords: [X, X, X], melody: m } : null;
    }
    case "neighbor": {
      const c = pick(range().filter((d) => isChordTone(d, X)));
      const m: Example["melody"] = [c, c + dir, c];
      return inRange(...m) && !isChordTone(m[1], X) ? { chords: [X, X, X], melody: m } : null;
    }
    case "appoggiatura": {
      // Resolves by step in direction `dir`, after a leap in from the other side.
      const m3 = pick(range().filter((d) => isChordTone(d, Y)));
      const m2 = m3 - dir;
      const m1 = m2 - dir * -pick([2, 3, 4]);
      const m: Example["melody"] = [m1, m2, m3];
      return inRange(...m) && !isChordTone(m2, Y) && isChordTone(m1, X) && Math.sign(m2 - m1) === -dir ? { chords: [X, Y, Y], melody: m } : null;
    }
    case "suspension": {
      const s = pick(range().filter((d) => isChordTone(d, X) && !isChordTone(d, Y) && isChordTone(d - 1, Y)));
      if (s === undefined) return null;
      const m: Example["melody"] = [s, s, s - 1];
      return inRange(...m) ? { chords: [X, Y, Y], melody: m } : null;
    }
    case "escape": {
      const m1 = pick(range().filter((d) => isChordTone(d, X)));
      const m2 = m1 + dir;
      const m3 = m2 - dir * pick([2, 3]);
      const m: Example["melody"] = [m1, m2, m3];
      return inRange(...m) && !isChordTone(m2, X) && isChordTone(m3, Y) ? { chords: [X, X, Y], melody: m } : null;
    }
    case "anticipation": {
      const m3 = pick(range().filter((d) => isChordTone(d, Y) && !isChordTone(d, X)));
      if (m3 === undefined) return null;
      const m1 = m3 + pick([-1, 1]);
      const m: Example["melody"] = [m1, m3, m3];
      return inRange(...m) && isChordTone(m1, X) ? { chords: [X, X, Y], melody: m } : null;
    }
  }
}

export function makeExample(kind: Nct): Example {
  for (;;) {
    const e = attempt(kind);
    if (e) return e;
  }
}

const degreeNote = (scale: Spelled[], d: number): Spelled => {
  const i = ((d % 7) + 7) % 7;
  return { ...scale[i], octave: scale[i].octave + Math.floor(d / 7) };
};

export function nctQuestion(kind: Nct, options: Nct[]): Question {
  const key = pick(KEYS);
  const scale = scaleNotes(parseCode(key, 4), "major");
  const { chords, melody } = makeExample(kind);
  const groups = chords.map((c, i) => [...VOICING[c].map((d) => degreeNote(scale, d)), degreeNote(scale, melody[i])]);
  const mid = degreeNote(scale, melody[1]);
  return {
    prompt: "What kind of note is the second melody note (the top voice)?",
    staff: { clef: "treble", groups },
    audio: groups.map((g, i) => ({ pitches: g.map(pitchOf), at: i * 1.0, dur: 0.95 })),
    steps: [{ type: "nct", correct: kind, options }],
    explain: `In ${nameOf(parseCode(key))} major, the chords are ${chords.join("–")}. The ${nameOf(mid)} is ${/^[aeiou]/i.test(NCT_INFO[kind].label) ? "an" : "a"} ${NCT_INFO[kind].label.toLowerCase()}: it ${NCT_INFO[kind].how}.`,
  };
}

const BRIEF =
  "Three chords play with a melody on top. The second melody note isn't in the chord under it: name it by how it moves. Steps between chord tones: passing. Away and back: neighbor. Leap in, step out on a new chord: appoggiatura. Held over, then down by step: suspension. Step out, leap away: escape tone. Early arrival of the next chord's note: anticipation.";

function nctDrill(id: string, number: string, title: string, summary: string, set: Nct[], accuracy: number): Drill {
  return { id, number, title, summary, brief: BRIEF, ear: false, unit: "nct", pass: { accuracy }, generate: () => nctQuestion(pick(set), set) };
}

export const NCT_DRILLS: Drill[] = [
  nctDrill("n-nct-pn", "5.1a", "Non-chord tones: passing or neighbor", "The two that move by step on both sides.", ["passing", "neighbor"], 0.9),
  nctDrill("n-nct-as", "5.1b", "Non-chord tones: add appoggiatura and suspension", "The accented ones that lean on the beat.", ["passing", "neighbor", "appoggiatura", "suspension"], 0.85),
  nctDrill("n-nct-all", "5.1c", "Non-chord tones: all six", "Adds the escape tone and the anticipation.", [...NCTS], 0.85),
];
