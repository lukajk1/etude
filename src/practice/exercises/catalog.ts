import { makeTrack } from "../../model/demo";
import { newId, PPQ, type Project, type ScaleId, type TimbreId } from "../../model/types";
import { gradeCantus, gradeFirstSpecies, gradeSecondSpecies, type GradeInput, type Result } from "./grade";

export interface Exercise {
  id: string;
  unit: string;
  number: string;
  title: string;
  /** One line for the menu. */
  summary: string;
  /** What to do. */
  brief: string;
  rules: string[];
  /** Why this matters for writing in the late-Romantic style. */
  why: string;
  key: number;
  scale: ScaleId;
  bpm: number;
  /** Index into SNAPS and the length new notes get. */
  snap: number;
  drawLength: number;
  given?: { name: string; timbre: TimbreId; pitches: number[] };
  student: { name: string; timbre: TimbreId };
  grade: (input: GradeInput) => Result;
}

const WHOLE = PPQ * 4;

// Fux's cantus firmus in D Dorian, from Gradus ad Parnassum (1725).
const FUX_DORIAN = [62, 65, 64, 62, 67, 65, 69, 67, 65, 64, 62];
// A cantus in C major written for Etude.
const C_MAJOR_CF = [48, 52, 50, 53, 52, 55, 53, 52, 50, 48];

const CANTUS_RULES = [
  "8 to 14 whole notes, one per bar.",
  "Start and end on the tonic; step into the last note (2–1 or 7–1).",
  "Mostly steps. After a leap of a 4th or more, step back the other way.",
  "No tritone, 7th or augmented leaps; nothing bigger than an octave.",
  "One clear high point, somewhere in the middle. No repeated notes.",
  "Stay in the mode and within a 10th.",
];

const FIRST_SPECIES_RULES = [
  "One whole note against each cantus note.",
  "Only consonances: unison, 3rd, 5th, 6th, octave. A 4th counts as dissonant.",
  "Start on a unison, 5th or octave (only unison or octave if you're below); end on a unison or octave.",
  "No parallel 5ths or octaves, and don't move into one by similar motion.",
  "Unisons only at the very start and end. Don't cross the cantus.",
  "Cadence: your line rises from the leading tone into the final.",
  "Prefer 3rds and 6ths, contrary motion, and a melodic line that would stand on its own.",
];

const SECOND_SPECIES_RULES = [
  "Two half notes against each cantus note; a whole note in the last bar. You may open with a half rest.",
  "Beat 1 must be consonant. Beat 3 may be dissonant only as a passing tone (step in, step out, same direction).",
  "No parallel 5ths or octaves between downbeats, or from beat 3 into the next downbeat.",
  "Start on a perfect interval and end on a unison or octave, approached from the leading tone.",
  "No repeated notes. Keep the line mostly stepwise with one high point.",
];

export const EXERCISES: Exercise[] = [
  {
    id: "cf-c-major",
    unit: "Counterpoint essentials",
    number: "1.1",
    title: "Write a cantus firmus in C major",
    summary: "A plain, singable melody that follows the classic rules.",
    brief: "Write a melody of 8 to 14 whole notes in your lane, one per bar, in C major. Aim for a smooth arc that rises to a single high point and settles home.",
    rules: CANTUS_RULES,
    why: "Every exercise after this one is written against a melody like this. Learning what makes a line feel balanced (steps, a few leaps, one climax) is the same skill as writing a good tune.",
    key: 0,
    scale: "major",
    bpm: 90,
    snap: 0,
    drawLength: WHOLE,
    student: { name: "Your cantus", timbre: "strings" },
    grade: (i) => gradeCantus(i),
  },
  {
    id: "cf-d-dorian",
    unit: "Counterpoint essentials",
    number: "1.2",
    title: "Write a cantus firmus in D Dorian",
    summary: "The same rules in a church mode: minor-sounding, with a raised 6th.",
    brief: "Write a melody of 8 to 14 whole notes in D Dorian (the white keys from D to D). It sounds minor, but the B natural gives it a brighter color than D minor.",
    rules: CANTUS_RULES,
    why: "Modes color a melody without changing its grammar. Late-Romantic composers, Rachmaninoff included, borrowed modal turns constantly, especially from Russian Orthodox chant.",
    key: 2,
    scale: "dorian",
    bpm: 90,
    snap: 0,
    drawLength: WHOLE,
    student: { name: "Your cantus", timbre: "strings" },
    grade: (i) => gradeCantus(i),
  },
  {
    id: "fs-above-c",
    unit: "Counterpoint essentials",
    number: "1.3",
    title: "First species above a C major cantus",
    summary: "Note against note: your line above a given melody.",
    brief: "The cantus is in the low lane. Write one whole note above each of its notes in your lane, so the two lines sound good together and each would stand on its own.",
    rules: FIRST_SPECIES_RULES,
    why: "This is the foundation of voice leading: two independent lines that agree. The inner voices of a Rachmaninoff texture are first-species thinking sped up and decorated.",
    key: 0,
    scale: "major",
    bpm: 90,
    snap: 0,
    drawLength: WHOLE,
    given: { name: "Cantus firmus", timbre: "strings", pitches: C_MAJOR_CF },
    student: { name: "Your line", timbre: "woodwinds" },
    grade: (i) => gradeFirstSpecies(i, true),
  },
  {
    id: "fs-above-fux",
    unit: "Counterpoint essentials",
    number: "1.4",
    title: "First species above Fux's cantus",
    summary: "The original exercise from 1725, in D Dorian.",
    brief: "This is Fux's own cantus in D Dorian. Write one whole note above each of its notes. At the end, raise C to C♯ so your line rises into D.",
    rules: FIRST_SPECIES_RULES,
    why: "Haydn, Mozart and Beethoven all worked through this exact cantus. It's the canonical first step of a composition education.",
    key: 2,
    scale: "dorian",
    bpm: 90,
    snap: 0,
    drawLength: WHOLE,
    given: { name: "Cantus firmus", timbre: "strings", pitches: FUX_DORIAN.map((p) => p - 12) },
    student: { name: "Your line", timbre: "woodwinds" },
    grade: (i) => gradeFirstSpecies(i, true),
  },
  {
    id: "fs-below-fux",
    unit: "Counterpoint essentials",
    number: "1.5",
    title: "First species below Fux's cantus",
    summary: "Now you write the bass line under the melody.",
    brief: "The cantus is now on top. Write one whole note below each of its notes. Below the cantus you must open on a unison or octave, because a 5th below would make the music sound like it's in the wrong key.",
    rules: FIRST_SPECIES_RULES,
    why: "Writing a bass under a melody is the core skill of harmony. In four-part writing and in piano music, the bass and the melody are the two lines that matter most.",
    key: 2,
    scale: "dorian",
    bpm: 90,
    snap: 0,
    drawLength: WHOLE,
    given: { name: "Cantus firmus", timbre: "woodwinds", pitches: FUX_DORIAN },
    student: { name: "Your bass", timbre: "strings" },
    grade: (i) => gradeFirstSpecies(i, false),
  },
  {
    id: "ss-above-c",
    unit: "Counterpoint essentials",
    number: "1.6",
    title: "Second species above a C major cantus",
    summary: "Two against one: passing tones enter.",
    brief: "Write two half notes against each cantus note, with a whole note in the last bar. Beat 3 can hold a passing dissonance, which is your first taste of tension and release.",
    rules: SECOND_SPECIES_RULES,
    why: "Passing tones are the first controlled dissonance. Romantic melodies are full of them: notes that rub against the harmony on the way between two chord tones.",
    key: 0,
    scale: "major",
    bpm: 90,
    snap: 1,
    drawLength: WHOLE / 2,
    given: { name: "Cantus firmus", timbre: "strings", pitches: C_MAJOR_CF },
    student: { name: "Your line", timbre: "woodwinds" },
    grade: (i) => gradeSecondSpecies(i, true),
  },
  {
    id: "ss-above-fux",
    unit: "Counterpoint essentials",
    number: "1.7",
    title: "Second species above Fux's cantus",
    summary: "Two against one in D Dorian.",
    brief: "Two half notes against each note of Fux's cantus, a whole note at the end. Use the raised C♯ only in the last approach to D.",
    rules: SECOND_SPECIES_RULES,
    why: "The same skill in a mode, where the cadence needs care. Getting second species fluent makes melodic writing over chords feel natural.",
    key: 2,
    scale: "dorian",
    bpm: 90,
    snap: 1,
    drawLength: WHOLE / 2,
    given: { name: "Cantus firmus", timbre: "strings", pitches: FUX_DORIAN.map((p) => p - 12) },
    student: { name: "Your line", timbre: "woodwinds" },
    grade: (i) => gradeSecondSpecies(i, true),
  },
];

/** Later units, shown in the menu as a roadmap. */
export const ROADMAP: { unit: string; topics: string }[] = [
  { unit: "Non-chord tones", topics: "Passing tones, neighbors, appoggiaturas and suspensions: the melody notes outside the chord." },
  { unit: "Harmonizing a melody", topics: "Choosing I, IV or V under each note of a melody, ending with a cadence." },
  { unit: "Suspensions (fourth species)", topics: "Tied notes that clash and resolve down: the Romantic ache." },
  { unit: "Four-part harmony", topics: "Chorales: I, IV, V, cadences, doubling, voice leading in four voices." },
  { unit: "Romantic harmony", topics: "Secondary dominants, borrowed chords, diminished sevenths, the Neapolitan." },
  { unit: "Piano textures", topics: "Melody over arpeggiated accompaniment; inner-voice countermelodies." },
  { unit: "Forms", topics: "The 8-bar period, and the ternary ABA' prelude." },
  { unit: "Orchestration", topics: "Spreading a chorale across strings, winds and brass." },
];

export function getExercise(id: string | undefined): Exercise | null {
  return EXERCISES.find((e) => e.id === id) ?? null;
}

/** A fresh project for an exercise: the given lane locked, an empty lane to write in. */
export function exerciseProject(ex: Exercise): Project {
  const tracks = [];
  if (ex.given) {
    const notes = ex.given.pitches.map((pitch, i) => ({ id: newId(), pitch, start: i * WHOLE, dur: WHOLE, vel: 0.7 }));
    tracks.push({ ...makeTrack(ex.given.timbre, ex.given.name, notes), locked: true });
  }
  tracks.push(makeTrack(ex.student.timbre, ex.student.name));
  const bars = ex.given ? ex.given.pitches.length : 14;
  return {
    title: `${ex.number} ${ex.title}`,
    bpm: ex.bpm,
    timeSig: [4, 4],
    key: ex.key,
    scale: ex.scale,
    loop: { on: false, start: 0, end: bars * WHOLE },
    tracks,
    exercise: { id: ex.id },
  };
}
