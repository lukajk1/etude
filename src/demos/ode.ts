import { makeTrack } from "../model/demo";
import { newId, PPQ, type Note, type Project } from "../model/types";

/**
 * A short arrangement of the "Ode to Joy" theme from the finale of Beethoven's Ninth,
 * in D major. Like the symphony, it builds up over three statements of the tune:
 * low strings alone, then woodwinds over the strings, then everyone with the choir.
 * The tune is simplified (no syncopation in bar 12); the arrangement is original.
 */

// The 16-bar theme as [pitch, beats].
const F = 66, G = 67, A = 69, E = 64, D = 62, A3 = 57;
const PHRASE_A: [number, number][] = [
  [F, 1], [F, 1], [G, 1], [A, 1],
  [A, 1], [G, 1], [F, 1], [E, 1],
  [D, 1], [D, 1], [E, 1], [F, 1],
];
const THEME: [number, number][] = [
  ...PHRASE_A, [F, 1.5], [E, 0.5], [E, 2],
  ...PHRASE_A, [E, 1.5], [D, 0.5], [D, 2],
  [E, 1], [E, 1], [F, 1], [D, 1],
  [E, 1], [F, 0.5], [G, 0.5], [F, 1], [D, 1],
  [E, 1], [F, 0.5], [G, 0.5], [F, 1], [E, 1],
  [D, 1], [E, 1], [A3, 2],
  ...PHRASE_A, [E, 1.5], [D, 0.5], [D, 2],
];

// One chord per half bar, 32 per statement.
type Chord = "D" | "A" | "Bm" | "E";
const HARMONY: Chord[] = [
  "D", "D", "D", "A", "D", "D", "D", "A",
  "D", "D", "D", "A", "D", "D", "A", "D",
  "A", "D", "A", "D", "A", "Bm", "E", "A",
  "D", "D", "D", "A", "D", "D", "A", "D",
];

const BASS: Record<Chord, number> = { D: 38, A: 45, Bm: 47, E: 40 };
const LOW_VOICING: Record<Chord, number[]> = { D: [57, 62, 66], A: [57, 61, 64], Bm: [59, 62, 66], E: [56, 59, 64] };
const HIGH_VOICING: Record<Chord, number[]> = { D: [66, 69, 74], A: [64, 69, 73], Bm: [66, 71, 74], E: [64, 68, 71] };
const BRASS_VOICING: Record<Chord, number[]> = { D: [50, 54, 57], A: [49, 52, 57], Bm: [50, 54, 59], E: [52, 56, 59] };
const TIMPANI: Record<Chord, number> = { D: 41, A: 45, Bm: 43, E: 43 };

const BAR = 4;
const STATEMENT = 16 * BAR;

function n(pitch: number, beat: number, beats: number, vel: number): Note {
  return { id: newId(), pitch, start: Math.round(beat * PPQ), dur: Math.round(beats * PPQ), vel };
}

function melody(offsetBeats: number, transpose: number, vel: number): Note[] {
  const out: Note[] = [];
  let beat = offsetBeats;
  for (const [p, len] of THEME) {
    // A hair short of full length, so repeated notes re-articulate.
    out.push(n(p + transpose, beat, len * 0.95, vel));
    beat += len;
  }
  return out;
}

export function odeToJoy(): Project {
  const choir: Note[] = [];
  const winds: Note[] = [];
  const brass: Note[] = [];
  const upper: Note[] = [];
  const low: Note[] = [];
  const timp: Note[] = [];

  // 1. Cellos and basses alone, an octave down.
  low.push(...melody(0, -12, 0.6));

  // 2. Woodwinds take the tune an octave up; strings hold the harmony; basses walk the roots.
  const s2 = STATEMENT;
  winds.push(...melody(s2, 12, 0.72));
  HARMONY.forEach((c, i) => {
    const beat = s2 + i * 2;
    for (const p of LOW_VOICING[c]) upper.push(n(p, beat, 1.95, 0.45));
    low.push(n(BASS[c] + 12, beat, 1.9, 0.6));
  });

  // 3. Everyone: choir on the tune, winds doubling above, brass chords, driving strings, timpani.
  const s3 = STATEMENT * 2;
  choir.push(...melody(s3, 0, 0.8));
  winds.push(...melody(s3, 12, 0.55));
  HARMONY.forEach((c, i) => {
    const beat = s3 + i * 2;
    for (const p of BRASS_VOICING[c]) brass.push(n(p, beat, 1.9, 0.6));
    for (let k = 0; k < 2; k++) {
      for (const p of HIGH_VOICING[c]) upper.push(n(p, beat + k, 0.9, 0.5));
      low.push(n(BASS[c], beat + k, 0.9, 0.7), n(BASS[c] + 12, beat + k, 0.9, 0.55));
    }
    if (i % 2 === 0) timp.push(n(TIMPANI[c], beat, 0.5, i % 8 === 0 ? 0.85 : 0.6));
  });

  // Final chord, held.
  const end = STATEMENT * 3;
  choir.push(n(62, end, BAR * 2, 0.8), n(66, end, BAR * 2, 0.7));
  winds.push(n(74, end, BAR * 2, 0.6), n(78, end, BAR * 2, 0.55));
  for (const p of [...BRASS_VOICING.D, 62]) brass.push(n(p, end, BAR * 2, 0.55));
  for (const p of HIGH_VOICING.D) upper.push(n(p, end, BAR * 2, 0.5));
  low.push(n(38, end, BAR * 2, 0.75), n(50, end, BAR * 2, 0.6));
  for (let k = 0; k < 8; k++) timp.push(n(41, end + k * 0.25, 0.25, 0.4 + k * 0.05));
  timp.push(n(41, end + 2, 0.5, 0.7), n(49, end + 2, 2, 0.45));

  return {
    title: "Ode to Joy (Beethoven 9)",
    bpm: 116,
    timeSig: [4, 4],
    key: 2,
    scale: "major",
    loop: { on: false, start: 0, end: (end + BAR * 2) * PPQ },
    tracks: [
      makeTrack("choir", "Choir", choir),
      makeTrack("woodwinds", "Flutes & clarinets", winds),
      makeTrack("brass", "Horns & trumpets", brass),
      makeTrack("strings", "Violins & violas", upper),
      makeTrack("strings", "Cellos & basses", low),
      makeTrack("percussion", "Timpani", timp),
    ],
  };
}
