import type { AudioEvent, Drill, Question, Step } from "./catalog";
import { randomFragment, PATTERNS_3, PATTERNS_4 } from "./fragments";
import { chordPitches, type Numeral } from "./harmony";
import { keyContext } from "./keyContext";
import { pick, randInt } from "./theory";

/**
 * Singing: the microphone listens and checks the pitch. Matching a note, singing a scale
 * degree once the key is set, singing back a melody, singing a chord's bass, and singing a
 * harmony a 3rd above. Any octave counts, so every voice fits. Degrees are scale steps from
 * do (0), as in fragments.ts.
 */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "ti"];
const pitchAt = (t: number, d: number) => t + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7];
const solfa = (ds: number[]) => ds.map((d) => SOLFEGE[((d % 7) + 7) % 7]).join(" ");
export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

/** What the sing pad needs: do (or -1 with no key), the notes to sing, the tolerance in cents, and whether to show a live tuner. */
export interface SingSpec {
  tonic: number;
  targets: number[];
  cents: number;
  tuner: boolean;
}
export const singData = (s: SingSpec) => [s.tonic, s.targets.join(","), s.cents, s.tuner ? 1 : 0].join("|");
export function parseSing(data: string): SingSpec {
  const [tonic, targets, cents, tuner] = data.split("|");
  return { tonic: Number(tonic), targets: targets.split(",").map(Number), cents: Number(cents), tuner: tuner === "1" };
}

/** A sing step: `correct` names the notes ("sol la"), which the pad gives back when they're sung in tune. */
const singStep = (correct: string, spec: SingSpec): Step => ({ type: "sing", correct, data: singData(spec) });

const notes = (ps: number[], at: number, sec: number): AudioEvent[] => ps.map((p, i) => ({ pitches: [p], at: at + i * sec, dur: sec * 0.92 }));

// ---- Questions ----------------------------------------------------------------------------

/** A note plays; sing it back. */
export function matchQuestion(cents: number, tuner: boolean): Question {
  const p = randInt(55, 72);
  const name = NOTE_NAMES[p % 12];
  return {
    prompt: tuner ? "A note plays. Sing it back and hold it until it's caught; the tuner shows how close you are." : "A note plays. Sing it back and hold it.",
    audio: [{ pitches: [p], at: 0, dur: 1.6 }],
    resolve: [{ pitches: [p], at: 0, dur: 1.6 }],
    steps: [singStep(name, { tonic: -1, targets: [p], cents, tuner })],
    explain: `The note was ${name}. Hum it quietly first, then slide until it stops beating against the piano: the pitch locks in when you match.`,
  };
}

/** The key is set; sing one degree, named. */
export function singDegreeQuestion(degree: number): Question {
  const t = randInt(57, 64);
  const context = keyContext(t);
  const name = SOLFEGE[degree];
  return {
    prompt: `The key is set. Sing ${name}.`,
    audio: context.events,
    // On a miss, hear the way there: up the scale from do, or down from the do above for la and ti.
    resolve: notes(degree > 4 ? [t, t + 12, ...(degree === 5 ? [t + 11] : []), pitchAt(t, degree)] : MAJOR.slice(0, degree + 1).map((s) => t + s), 0, 0.4),
    steps: [singStep(name, { tonic: t, targets: [pitchAt(t, degree)], cents: 50, tuner: false })],
    explain: `Find do first: it's where the progression ended. ${degree > 4 ? `Then sing up to the do above and step down to ${name}.` : `Then step up the scale to ${name}, singing each note quietly.`}`,
  };
}

/** The key is set and a short melody plays; sing it back. */
export function singBackQuestion(pattern: number[]): Question {
  const t = randInt(57, 64);
  const context = keyContext(t);
  const start = context.end + 0.65;
  const ps = pattern.map((d) => pitchAt(t, d));
  return {
    prompt: `The key is set, then ${pattern.length} notes play. Sing them back, each one separately.`,
    audio: [...context.events, ...notes(ps, start, 0.6)],
    again: { label: "Play notes again", audio: notes(ps, 0, 0.6) },
    resolve: notes(ps, 0, 0.6),
    steps: [singStep(solfa(pattern), { tonic: t, targets: ps, cents: 50, tuner: false })],
    explain: `That was ${solfa(pattern)}. Sing it in solfège as you hear it; naming each note keeps its place in the key.`,
  };
}

/** The key is set and a chord plays; sing its root, the bass note. */
export function singBassQuestion(n: Numeral): Question {
  const t = randInt(57, 64);
  const context = keyContext(t);
  const chord = chordPitches(t, n);
  const root = SOLFEGE[ALL.indexOf(n)];
  return {
    prompt: "The key is set, then a chord plays. Sing its bass note.",
    audio: [...context.events, { pitches: chord, at: context.end + 0.75, dur: 1.8 }],
    again: { label: "Play chord again", audio: [{ pitches: chord, at: 0, dur: 1.8 }] },
    resolve: [{ pitches: chord, at: 0, dur: 1.2 }, { pitches: [chord[0]], at: 1.3, dur: 1.2 }],
    steps: [singStep(`${root} (${n})`, { tonic: t, targets: [chord[0]], cents: 50, tuner: false })],
    explain: `That was ${n}, with ${root} in the bass. Listen down to the lowest note and hum it; it's the chord's root, and it names the chord.`,
  };
}

/** The key is set and a melody plays; sing a 3rd above each note, in the key. */
export function singHarmonyQuestion(pattern: number[]): Question {
  const t = randInt(55, 60);
  const context = keyContext(t);
  const start = context.end + 0.65;
  const ps = pattern.map((d) => pitchAt(t, d));
  const upper = pattern.map((d) => d + 2);
  const hs = upper.map((d) => pitchAt(t, d));
  const one = pattern.length === 1;
  return {
    prompt: one ? "The key is set, then a note plays. Sing a 3rd above it, in the key." : `The key is set, then ${pattern.length} notes play. Sing a 3rd above each one, in the key.`,
    audio: [...context.events, ...notes(ps, start, 0.75)],
    again: { label: one ? "Play note again" : "Play notes again", audio: notes(ps, 0, 0.75) },
    resolve: ps.map((p, i) => ({ pitches: [p, hs[i]], at: i * 0.75, dur: 0.7 })),
    steps: [singStep(solfa(upper), { tonic: t, targets: hs, cents: 50, tuner: false })],
    explain: `The melody was ${solfa(pattern)}, so a 3rd above is ${solfa(upper)}: two scale steps up from each note (skip one). In the key, some of those 3rds are major and some minor.`,
  };
}

// ---- Stages -------------------------------------------------------------------------------

const BRIEF =
  "These stages listen through your microphone, so allow it when asked. Sing in any octave: only the note counts. Hold each note steadily for a moment until it's caught, and leave a little gap between notes. With speakers, Etude ignores the mic while it plays. Headphones avoid the bleed entirely.";

function singDrill(id: string, number: string, title: string, summary: string, brief: string, accuracy: number, generate: () => Question): Drill {
  return { id, number, title, summary, brief: `${brief} ${BRIEF}`, ear: true, unit: "singing", pass: { accuracy }, generate };
}

const ALL: Numeral[] = ["I", "ii", "iii", "IV", "V", "vi"];

export const SINGING_DRILLS: Drill[] = [
  singDrill("s-match-tuner", "7.1a", "Match a pitch: with a tuner", "A note plays; sing it, with a live tuner.", "A note plays; sing it back. The tuner shows how far sharp or flat you are while you sing, within half a semitone to pass.", 0.85, () => matchQuestion(50, true)),
  singDrill("s-match", "7.1b", "Match a pitch: by ear", "No tuner, and closer: within 30 cents.", "A note plays; sing it back, with no tuner this time, within 30 cents (a third of a semitone).", 0.85, () => matchQuestion(30, false)),
  singDrill("s-degree-dms", "7.2a", "Sing scale degrees: do, mi, sol", "The key is set; sing do, mi or sol.", "A chord progression sets the key, then you're asked for a degree. Find do (where the progression ended) and sing from there.", 0.85, () => singDegreeQuestion(pick([0, 2, 4]))),
  singDrill("s-degree-all", "7.2b", "Sing scale degrees: all seven", "Any degree, do to ti.", "A chord progression sets the key, then you're asked for any degree, do to ti. Step up the scale from do, or down from the do above, until you reach it.", 0.8, () => singDegreeQuestion(randInt(0, 6))),
  singDrill("s-back-3", "7.3a", "Sing back a melody: 3 notes", "The key is set, three notes play; sing them back.", "A chord progression sets the key, then a short melody plays. Sing it back, a note at a time.", 0.8, () => singBackQuestion(pick(PATTERNS_3))),
  singDrill("s-back-4", "7.3b", "Sing back a melody: 4 or 5 notes", "Longer melodies, with la and ti.", "A chord progression sets the key, then a melody of four or five notes plays. Sing it back, a note at a time.", 0.8, () => singBackQuestion(Math.random() < 0.5 ? pick(PATTERNS_4) : randomFragment(5))),
  singDrill("s-bass-145", "7.4a", "Sing the bass: I, IV or V", "A chord plays; sing its bass note.", "A chord progression sets the key, then one chord plays. Sing its lowest note, the root. Singing the bass is how you find chords by ear.", 0.85, () => singBassQuestion(pick<Numeral>(["I", "IV", "V"]))),
  singDrill("s-bass-all", "7.4b", "Sing the bass: all six chords", "I, ii, iii, IV, V or vi.", "A chord progression sets the key, then one of the six common chords plays. Sing its root.", 0.8, () => singBassQuestion(pick(ALL))),
  singDrill("s-harmony-1", "7.5a", "Sing a harmony: a 3rd above a note", "One note plays; sing a 3rd above it.", "A chord progression sets the key, then one note plays. Sing the note a 3rd above it in the key: two scale steps up. This is the most common harmony part.", 0.8, () => singHarmonyQuestion([pick([0, 1, 2, 3, 4, 5])])),
  singDrill("s-harmony-3", "7.5b", "Sing a harmony: a 3rd above a melody", "Three notes; sing the line a 3rd above.", "A chord progression sets the key, then three notes play. Sing a line a 3rd above them, note by note, the way a harmony singer follows the melody.", 0.8, () => singHarmonyQuestion(pick(PATTERNS_3))),
];
