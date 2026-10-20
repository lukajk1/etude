import type { Drill, Question } from "./catalog";
import type { Numeral } from "./harmony";
import { nameOf, parseCode, pick, pitchOf, scaleNotes, type Spelled } from "./theory";

const SOLFEGE_NAMES = ["do", "re", "mi", "fa", "sol", "la", "ti"];

/**
 * Harmonizing a melody with I, IV and V: each chord has to contain its melody note, the
 * first chord is I, and the phrase ends with an authentic cadence, V then I. Any chord
 * that fits is accepted; the explanation lists them.
 */

type Chord = Extract<Numeral, "I" | "IV" | "V">;
export const HARM_CHORDS: Chord[] = ["I", "IV", "V"];

/** Which of I, IV and V contain each scale degree (1–7), in order of preference. */
export const FITS: Record<number, Chord[]> = { 1: ["I", "IV"], 2: ["V"], 3: ["I"], 4: ["IV"], 5: ["I", "V"], 6: ["IV"], 7: ["V"] };

const KEYS = ["C", "G", "F", "D", "Bb"];
const sdOf = (d: number) => (((d % 7) + 7) % 7) + 1;

/** A melody in scale degrees (0 = tonic in octave 4), mostly stepwise, ending on do or mi over a V–I cadence. */
export function makeMelody(length: number, chords: Chord[]): number[] {
  const usable = (d: number) => FITS[sdOf(d)].some((c) => chords.includes(c));
  for (;;) {
    const last = pick([7, 9]); // do or mi, upper octave
    const penult = pick([last - 1, last + 1, last - 3].filter((d) => FITS[sdOf(d)].includes("V")));
    const first = pick([7, 9, 11, 4].filter((d) => FITS[sdOf(d)].includes("I")));
    const mel = [first];
    while (mel.length < length - 2) {
      const prev = mel[mel.length - 1];
      const next = prev + pick([-2, -1, -1, 1, 1, 2, 3, -3]);
      if (next >= 4 && next <= 12 && usable(next)) mel.push(next);
    }
    mel.push(penult, last);
    // Keep the approach to the cadence singable: no leap bigger than a 4th.
    if (mel.every((d, i) => i === 0 || Math.abs(d - mel[i - 1]) <= 3)) return mel;
  }
}

/** The chords that fit each note under the rules: I first, V–I to end, otherwise any chord containing it. */
export function validChords(mel: number[], chords: Chord[]): Chord[][] {
  return mel.map((d, i) => {
    const fit = FITS[sdOf(d)].filter((c) => chords.includes(c));
    if (i === 0 || i === mel.length - 1) return fit.filter((c) => c === "I");
    if (i === mel.length - 2) return fit.filter((c) => c === "V");
    return fit;
  });
}

const degreeNote = (scale: Spelled[], d: number): Spelled => {
  const i = ((d % 7) + 7) % 7;
  return { ...scale[i], octave: scale[i].octave + Math.floor(d / 7) };
};

export function harmonizeQuestion(length: number, chords: Chord[]): Question {
  const key = pick(KEYS);
  const scale = scaleNotes(parseCode(key, 4), "major");
  const mel = makeMelody(length, chords);
  const valid = validChords(mel, chords);
  const notes = mel.map((d) => degreeNote(scale, d));
  const keyName = nameOf(parseCode(key));
  return {
    prompt: `Harmonize this melody in ${keyName} major: choose ${chords.join(", ").replace(/, (?=[^,]*$)/, " or ")} for each note. Each chord must contain its note; start on I and end V–I.`,
    staff: { clef: "treble", groups: notes.map((n) => [n]) },
    audio: notes.map((n, i) => ({ pitches: [pitchOf(n)], at: i * 0.8, dur: 0.75 })),
    steps: valid.map((v, i) => ({ type: "numeral" as const, label: `Note ${i + 1}`, correct: v[0], accept: v, options: chords })),
    explain: notes
      .map((n, i) => `${nameOf(n)} (${SOLFEGE_NAMES[sdOf(mel[i]) - 1]}): ${valid[i].join(" or ")}`)
      .join("; ")
      .concat(". A chord fits if the note is one of its three notes; the first is I, and the last two make the V–I cadence."),
  };
}

const BRIEF =
  "Choose a chord for each melody note. In a major key, I has do, mi and sol; IV has fa, la and do; V has sol, ti and re. Start on I and end with V then I, the authentic cadence. Where two chords fit, either is right.";

function harmDrill(id: string, number: string, title: string, summary: string, length: number, chords: Chord[], accuracy: number): Drill {
  return { id, number, title, summary, brief: BRIEF, ear: false, unit: "harmonize", pass: { accuracy }, generate: () => harmonizeQuestion(length, chords) };
}

export const HARMONIZE_DRILLS: Drill[] = [
  harmDrill("m-harm-iv", "6.1a", "Harmonize: I and V", "Four-note melodies with just I and V.", 4, ["I", "V"], 0.85),
  harmDrill("m-harm-ivv", "6.1b", "Harmonize: I, IV and V", "Four-note melodies with all three.", 4, ["I", "IV", "V"], 0.85),
  harmDrill("m-harm-long", "6.1c", "Harmonize: six-note melodies", "Longer melodies with I, IV and V.", 6, ["I", "IV", "V"], 0.8),
];

/** "Which chord fits?": the chords containing a scale degree, shown as a note in a random key. */
export function fitQuestion(sd: number, chords: Chord[]): Question {
  const key = pick(KEYS);
  const scale = scaleNotes(parseCode(key, 4), "major");
  const n = degreeNote(scale, sd - 1 + 7);
  const fit = FITS[sd].filter((c) => chords.includes(c));
  return {
    prompt: `In ${nameOf(parseCode(key))} major, which chord contains this note?`,
    staff: { clef: "treble", groups: [[n]] },
    steps: [{ type: "numeral", correct: fit[0], accept: fit, options: chords }],
    explain: `${nameOf(n)} is ${SOLFEGE_NAMES[sd - 1]}, scale degree ${sd}. It's in ${FITS[sd].join(" and ")}${FITS[sd].length > 1 ? "; either fits" : ""}.`,
  };
}
