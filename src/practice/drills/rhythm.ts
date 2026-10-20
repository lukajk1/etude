import type { AudioEvent, Drill, Question } from "./catalog";
import { pick, randInt } from "./theory";

/**
 * Rhythm and meter. Durations are counted in sixteenths (a quarter-note beat is 4), in
 * simple meters with a quarter-note beat. Bars are built from the standard rhythm cells,
 * a few at a time by level, and counted the usual way: "1 e & a 2 e & a…".
 */

export interface RNote {
  /** Length in sixteenths. */
  dur: number;
  rest?: boolean;
}

/** A rhythm as text, "beats:durations", e.g. "3:4,4r,2,2" (r for a rest). Beats 0: no time signature. */
export type RhythmSpec = string;

export const toSpec = (beats: number, notes: RNote[]): RhythmSpec => `${beats}:${notes.map((n) => `${n.dur}${n.rest ? "r" : ""}`).join(",")}`;

export function fromSpec(spec: RhythmSpec): { beats: number; notes: RNote[] } {
  const [b, body] = spec.split(":");
  return { beats: Number(b), notes: body.split(",").map((t) => ({ dur: parseInt(t, 10), rest: t.endsWith("r") })) };
}

// ---- Cells and bars ------------------------------------------------------------------

interface Cell {
  notes: RNote[];
  name: string;
}

const n = (...durs: (number | string)[]): RNote[] => durs.map((d) => (typeof d === "string" ? { dur: parseInt(d, 10), rest: true } : { dur: d }));

/** The rhythm cells for each level, cumulative. Level 1: whole beats; 2: eighths; 3: dotted and sixteenths. */
const CELLS: Cell[][] = [
  [
    { notes: n(4), name: "quarter" },
    { notes: n(4), name: "quarter" },
    { notes: n("4r"), name: "quarter rest" },
    { notes: n(8), name: "half" },
    { notes: n(12), name: "dotted half" },
  ],
  [
    { notes: n(2, 2), name: "two eighths" },
    { notes: n(2, 2), name: "two eighths" },
    { notes: n("2r", 2), name: "eighth rest, eighth" },
  ],
  [
    { notes: n(6, 2), name: "dotted quarter, eighth" },
    { notes: n(1, 1, 1, 1), name: "four sixteenths" },
    { notes: n(2, 1, 1), name: "eighth, two sixteenths" },
    { notes: n(1, 1, 2), name: "two sixteenths, eighth" },
    { notes: n(2, 4, 2), name: "syncopation: eighth, quarter, eighth" },
  ],
];

const cellsUpTo = (level: number) => CELLS.slice(0, level).flat();
const span = (c: Cell) => c.notes.reduce((s, x) => s + x.dur, 0) / 4;

/** A bar of `beats` beats from the cells of `level`, with at least two sounding notes. */
export function randomBar(beats: number, level: number): RNote[] {
  for (;;) {
    const notes: RNote[] = [];
    let left = beats;
    while (left > 0) {
      const fits = cellsUpTo(level).filter((c) => span(c) <= left);
      // Favor the newest cells of the level so they get practiced.
      const newest = fits.filter((c) => CELLS[level - 1].includes(c));
      const c = newest.length && Math.random() < 0.45 ? pick(newest) : pick(fits);
      notes.push(...c.notes.map((x) => ({ ...x })));
      left -= span(c);
    }
    if (notes.filter((x) => !x.rest).length >= 2 && notes.length >= 3) return notes;
  }
}

/** Swap one cell for another of the same length, for a near-miss answer choice. */
function mutate(beats: number, notes: RNote[], level: number): RNote[] {
  // Rebuild the bar as cells by walking beat by beat.
  const groups: RNote[][] = [];
  let cur: RNote[] = [];
  let pos = 0;
  for (const x of notes) {
    cur.push(x);
    pos += x.dur;
    if (pos % 4 === 0) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const i = randInt(0, groups.length - 1);
  const len = groups[i].reduce((s, x) => s + x.dur, 0) / 4;
  const alternatives = cellsUpTo(level).filter((c) => span(c) === len && toSpec(0, c.notes) !== toSpec(0, groups[i]));
  if (!alternatives.length) return randomBar(beats, level);
  groups[i] = pick(alternatives).notes.map((x) => ({ ...x }));
  return groups.flat();
}

// ---- Counting and sound -------------------------------------------------------------------

/**
 * Counting for a rhythm: each note's start ("1", "&", "e", "a"), with rests and beats
 * held through in brackets, e.g. "1 2 & 3 (4) &".
 */
export function countText(notes: RNote[]): string {
  const word = (pos: number) => {
    const sub = pos % 4;
    return sub === 0 ? String(Math.floor(pos / 4) + 1) : sub === 2 ? "&" : sub === 1 ? "e" : "a";
  };
  const tokens = new Map<number, string>();
  let pos = 0;
  for (const x of notes) {
    tokens.set(pos, x.rest ? `(${word(pos)})` : word(pos));
    pos += x.dur;
  }
  for (let beat = 0; beat * 4 < pos; beat++) if (!tokens.has(beat * 4)) tokens.set(beat * 4, `(${word(beat * 4)})`);
  return [...tokens.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t).join(" ");
}

export const BPM = 80;
const beatSec = () => 60 / BPM;
const CLICK = 88;
const NOTE = 72;

/** A bar of clicks to count in, then the rhythm on one pitch, with soft clicks on the beat if asked. */
export function rhythmAudio(beats: number, notes: RNote[], clicksThrough = false): AudioEvent[] {
  const b = beatSec();
  const events: AudioEvent[] = [];
  for (let i = 0; i < beats; i++) events.push({ pitches: [CLICK + (i === 0 ? 2 : 0)], at: i * b, dur: 0.06, vel: i === 0 ? 0.55 : 0.4 });
  let pos = 0;
  for (const x of notes) {
    if (!x.rest) events.push({ pitches: [NOTE], at: beats * b + (pos / 4) * b, dur: Math.min(0.9 * (x.dur / 4) * b, 0.45), vel: 0.8 });
    pos += x.dur;
  }
  if (clicksThrough) for (let i = 0; i < beats; i++) events.push({ pitches: [CLICK], at: (beats + i) * b, dur: 0.05, vel: 0.22 });
  return events;
}

/** When each note starts, in seconds after the count-in begins. */
export function onsets(beats: number, notes: RNote[]): number[] {
  const b = beatSec();
  const out: number[] = [];
  let pos = 0;
  for (const x of notes) {
    if (!x.rest) out.push(beats * b + (pos / 4) * b);
    pos += x.dur;
  }
  return out;
}

// ---- Questions ---------------------------------------------------------------------------

/** Note values and how long each lasts, in beats (quarter-note beat). */
export const VALUES: { id: string; dur: number; rest?: boolean; name: string }[] = [
  { id: "whole", dur: 16, name: "whole note" },
  { id: "half", dur: 8, name: "half note" },
  { id: "quarter", dur: 4, name: "quarter note" },
  { id: "eighth", dur: 2, name: "eighth note" },
  { id: "sixteenth", dur: 1, name: "sixteenth note" },
  { id: "dotted-half", dur: 12, name: "dotted half note" },
  { id: "dotted-quarter", dur: 6, name: "dotted quarter note" },
  { id: "dotted-eighth", dur: 3, name: "dotted eighth note" },
  { id: "quarter-rest", dur: 4, rest: true, name: "quarter rest" },
  { id: "half-rest", dur: 8, rest: true, name: "half rest" },
  { id: "eighth-rest", dur: 2, rest: true, name: "eighth rest" },
];
export const BASIC_VALUES = ["whole", "half", "quarter", "eighth", "sixteenth"];
export const DOTTED_AND_RESTS = ["dotted-half", "dotted-quarter", "dotted-eighth", "quarter-rest", "half-rest", "eighth-rest"];
export const BEAT_OPTIONS = ["0.25", "0.5", "0.75", "1", "1.5", "2", "3", "4"];
export const beatsLabel = (v: string) => ({ "0.25": "¼", "0.5": "½", "0.75": "¾", "1.5": "1½" })[v] ?? v;

export function noteValueQuestion(id: string): Question {
  const v = VALUES.find((x) => x.id === id)!;
  const beats = v.dur / 4;
  const dot = v.id.startsWith("dotted")
    ? ` A dot adds half the note's own length: ${beatsLabel(String((v.dur * 2) / 3 / 4))} + ${beatsLabel(String(v.dur / 3 / 4))}.`
    : "";
  return {
    prompt: "How many beats does this last, with a quarter-note beat?",
    rhythm: toSpec(0, [{ dur: v.dur, rest: v.rest }]),
    steps: [{ type: "beats", correct: String(beats), options: BEAT_OPTIONS }],
    explain: `A ${v.name} lasts ${beatsLabel(String(beats))} beat${beats === 1 ? "" : "s"}.${dot}`,
  };
}

/** A bar with its last note missing: which single value completes it? */
export function completeBarQuestion(): Question {
  const beats = pick([2, 3, 4]);
  const options = ["half", "quarter", "eighth", "dotted-half", "dotted-quarter"];
  const missing = pick(VALUES.filter((v) => options.includes(v.id) && v.dur <= (beats - 1) * 4));
  // Fill all but the missing length with simple values, leaving the gap at the end.
  let left = beats * 4 - missing.dur;
  const notes: RNote[] = [];
  while (left > 0) {
    const options = [4, 8, 2, 12].filter((d) => d <= left && (left - d) % 2 === 0);
    const d = pick(options);
    notes.push({ dur: d });
    left -= d;
  }
  return {
    prompt: `This bar of ${beats}/4 is missing its last note. Which single note completes it?`,
    rhythm: toSpec(beats, notes),
    steps: [{ type: "noteValue", correct: missing.id, options }],
    explain: `${beats}/4 has ${beats} beats; the notes shown take ${notes.reduce((s, x) => s + x.dur, 0) / 4}, so ${missing.dur / 4} ${missing.dur === 4 ? "beat is" : "beats are"} left: a ${missing.name}.`,
  };
}

/** Meters by ear: "2", "3", "4" (simple, quarter-note beat) and "6/8" (two beats, each split in three). */
export type MeterId = "2" | "3" | "4" | "6/8";
export type MeterStyle = "oompah" | "bass" | "melody";

export const METER_LABEL: Record<MeterId, string> = { "2": "2/4", "3": "3/4", "4": "4/4", "6/8": "6/8" };

/**
 * Each meter in eighth notes: where its strong and medium accents fall, and bar rhythms
 * (in eighths) that group the way the meter does. The eighth note is the same speed in
 * every meter, so 3/4 and 6/8 differ only in how the six eighths are grouped.
 */
const METERS: Record<MeterId, { eighths: number; strong: number[]; medium: number[]; patterns: number[][]; name: string }> = {
  "2": { eighths: 4, strong: [0], medium: [2], patterns: [[2, 2], [1, 1, 2], [2, 1, 1], [1, 1, 1, 1], [4], [3, 1]], name: "2/4, two beats: a march" },
  "3": { eighths: 6, strong: [0], medium: [], patterns: [[2, 2, 2], [1, 1, 2, 2], [2, 1, 1, 2], [4, 2], [2, 4], [1, 1, 1, 1, 2], [6]], name: "3/4, three beats: a waltz or minuet" },
  "4": { eighths: 8, strong: [0], medium: [4], patterns: [[2, 2, 2, 2], [4, 2, 2], [2, 2, 4], [4, 4], [1, 1, 2, 4], [2, 1, 1, 2, 2], [6, 2], [8]], name: "4/4, four beats, with beat three a little stronger" },
  "6/8": { eighths: 6, strong: [0], medium: [3], patterns: [[3, 3], [1, 1, 1, 3], [2, 1, 3], [3, 1, 1, 1], [1, 1, 1, 1, 1, 1], [2, 1, 2, 1], [3, 2, 1]], name: "6/8, two beats each split in three: ONE-two-three FOUR-five-six" },
};

const EIGHTH = 0.3125; // seconds: a quarter at 96 bpm, a dotted quarter at 64
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const deg = (t: number, d: number) => t + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7];
const HARMONY = [0, 3, 4, 0]; // I IV V I, one chord a bar

/**
 * Meter by ear. "oompah": a bass note on the strong beat, chords on the rest. "bass": a
 * melody with one bass note per bar. "melody": the melody alone, with only gentle accents.
 */
export function meterQuestion(meter: MeterId, options: MeterId[], style: MeterStyle = "oompah"): Question {
  const m = METERS[meter];
  const t = pick([60, 62, 65, 67]);
  const events: AudioEvent[] = [];
  for (let bar = 0; bar < 4; bar++) {
    const barStart = bar * m.eighths * EIGHTH;
    const rootDeg = HARMONY[bar];
    const chordDegs = [rootDeg, rootDeg + 2, rootDeg + 4];
    if (style === "oompah") {
      // Bass on the strong beats (and the medium one in 6/8), chords on the rest of the beats.
      const beatUnit = meter === "6/8" ? 1 : 2;
      for (let e = 0; e < m.eighths; e += beatUnit) {
        const at = barStart + e * EIGHTH;
        if (m.strong.includes(e) || (meter === "6/8" && m.medium.includes(e))) {
          events.push({ pitches: [deg(t - 24, rootDeg)], at, dur: EIGHTH * beatUnit * 0.95, vel: m.strong.includes(e) ? 0.95 : 0.7 });
        } else {
          events.push({ pitches: chordDegs.map((d) => deg(t - 12, d)), at, dur: EIGHTH * beatUnit * 0.5, vel: m.medium.includes(e) ? 0.55 : 0.42 });
        }
      }
      continue;
    }
    if (style === "bass") events.push({ pitches: [deg(t - 24, rootDeg)], at: barStart, dur: m.eighths * EIGHTH * 0.92, vel: 0.62 });
    // Melody: a rhythm that groups like the meter, stepwise, with a chord tone on each strong or medium beat.
    const accentStrong = style === "melody" ? 0.72 : 0.8;
    const accentMedium = style === "melody" ? 0.67 : 0.7;
    const plain = style === "melody" ? 0.62 : 0.6;
    let pos = 0;
    let d = chordDegs[randInt(0, 2)] + 7;
    for (const len of pick(m.patterns)) {
      const accented = m.strong.includes(pos) || m.medium.includes(pos);
      if (accented && !chordDegs.some((c) => (((d - c) % 7) + 7) % 7 === 0)) d = chordDegs.reduce((best, c) => (Math.abs(c + 7 - d) < Math.abs(best + 7 - d) ? c : best)) + 7;
      events.push({ pitches: [deg(t, d)], at: barStart + pos * EIGHTH, dur: len * EIGHTH * 0.9, vel: m.strong.includes(pos) ? accentStrong : m.medium.includes(pos) ? accentMedium : plain });
      pos += len;
      d = Math.max(4, Math.min(11, d + pick([-1, 1, -1, 1, 2, -2])));
    }
  }
  const hint =
    style === "oompah"
      ? "Find the strong beat (the low bass note) and count until it comes back."
      : meter === "6/8" || (meter === "3" && options.includes("6/8"))
        ? "3/4 and 6/8 both have six eighths in a bar: 3/4 groups them in twos (three beats), 6/8 in threes (two beats)."
        : style === "bass"
          ? "Count from one bass note to the next; the chord changes there too."
          : "Feel where the melody leans: longer notes and slight accents fall on beat one.";
  return {
    prompt: meter === "6/8" || options.includes("6/8") ? "Which meter is this in?" : "How many beats are in each bar?",
    audio: events,
    steps: [{ type: "meter", correct: meter, options }],
    explain: `That was ${m.name}. ${hint}`,
  };
}

/** Rhythmic dictation: hear a bar, pick its notation from three. */
export function dictationQuestion(beats: number, level: number): Question {
  const notes = randomBar(beats, level);
  const correct = toSpec(beats, notes);
  const choices = new Set([correct]);
  for (let tries = 0; choices.size < 3 && tries < 40; tries++) choices.add(toSpec(beats, mutate(beats, notes, level)));
  const options = [...choices].sort(() => Math.random() - 0.5);
  return {
    prompt: "After one bar of clicks, a rhythm plays. Which one was it?",
    audio: rhythmAudio(beats, notes),
    steps: [{ type: "rhythm", correct, options }],
    explain: `It was counted ${countText(notes)}.`,
  };
}

/** Tap a rhythm in time: read it, then tap after the count-in. */
export function tapQuestion(beats: number, level: number): Question {
  const notes = randomBar(beats, level);
  return {
    prompt: "Read the rhythm. Press Start, listen to the bar of clicks, then tap each note (Space or the pad) in time.",
    rhythm: toSpec(beats, notes),
    steps: [{ type: "tap", correct: "ok", data: `${toSpec(beats, notes)}#${Math.random().toString(36).slice(2, 7)}` }],
    explain: `Counted: ${countText(notes)}. Say the counts aloud while you tap.`,
  };
}

// ---- Checkpoints ----------------------------------------------------------------------------

const drill = (d: Omit<Drill, "unit" | "brief"> & { brief: string }): Drill => ({ ...d, unit: "rhythm" });

export const RHYTHM_DRILLS: Drill[] = [
  drill({
    id: "r-values-basic",
    number: "3.1a",
    title: "Note values: whole to sixteenth",
    summary: "How many beats each basic note lasts.",
    brief: "Each note lasts a set number of beats: with a quarter-note beat, a whole note is 4, a half 2, a quarter 1, an eighth ½, a sixteenth ¼. Each step down halves it.",
    ear: false,
    pass: { accuracy: 0.95, medianSec: 3 },
    generate: () => noteValueQuestion(pick(BASIC_VALUES)),
  }),
  drill({
    id: "r-values-dotted",
    number: "3.1b",
    title: "Note values: dots and rests",
    summary: "Dotted notes and rests.",
    brief: "A dot adds half the note's own length: a dotted half is 2 + 1 = 3 beats, a dotted quarter 1 + ½ = 1½. Each rest lasts as long as the note of the same name.",
    ear: false,
    pass: { accuracy: 0.95, medianSec: 3 },
    generate: () => noteValueQuestion(pick(DOTTED_AND_RESTS)),
  }),
  drill({
    id: "r-values-bar",
    number: "3.1c",
    title: "Note values: complete the bar",
    summary: "Which note fills the rest of a bar.",
    brief: "The time signature's top number is the beats in a bar. Add up the notes shown and pick the single note that fills what's left.",
    ear: false,
    pass: { accuracy: 0.9, medianSec: 6 },
    generate: completeBarQuestion,
  }),
  drill({
    id: "r-meter-23",
    number: "3.2a",
    title: "Hear the meter: 2 or 3",
    summary: "March or waltz, by ear.",
    brief: "An accompaniment plays: a low bass note on the strong first beat, chords on the others. Count from one bass note to the next: two beats is a march, three a waltz or minuet.",
    ear: true,
    pass: { accuracy: 0.9 },
    generate: () => meterQuestion(pick<MeterId>(["2", "3"]), ["2", "3"]),
  }),
  drill({
    id: "r-meter-234",
    number: "3.2b",
    title: "Hear the meter: 2, 3 or 4",
    summary: "Adds common time, four beats.",
    brief: "The same, with 4/4 added. In four, beat three is a little stronger than two and four, which helps tell it from two.",
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => meterQuestion(pick<MeterId>(["2", "3", "4"]), ["2", "3", "4"]),
  }),
  drill({
    id: "r-meter-bass",
    number: "3.2c",
    title: "Hear the meter: melody and bass",
    summary: "A melody over one bass note per bar.",
    brief: "Now a melody plays over a single bass note per bar, with only mild accents. Count from one bass note to the next; the harmony changes there too.",
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => meterQuestion(pick<MeterId>(["2", "3", "4"]), ["2", "3", "4"], "bass"),
  }),
  drill({
    id: "r-meter-melody",
    number: "3.2d",
    title: "Hear the meter: melody alone",
    summary: "No accompaniment, only the melody.",
    brief: "Just a melody, with gentle accents. Feel where it leans: longer notes and slightly stronger notes fall on beat one. Tap along and count until beat one comes back.",
    ear: true,
    pass: { accuracy: 0.8 },
    generate: () => meterQuestion(pick<MeterId>(["2", "3", "4"]), ["2", "3", "4"], "melody"),
  }),
  drill({
    id: "r-meter-compound",
    number: "3.2e",
    title: "Simple or compound: 2/4, 3/4 or 6/8",
    summary: "Is the beat split in two or in three?",
    brief: "The eighth notes run at the same speed in all three. 2/4 has two beats split in two; 3/4 three beats split in two; 6/8 two beats split in three (ONE-two-three FOUR-five-six). 3/4 against 6/8 is the classic hard pair: same six eighths, grouped differently.",
    ear: true,
    pass: { accuracy: 0.8 },
    generate: () => meterQuestion(pick<MeterId>(["2", "3", "6/8"]), ["2", "3", "6/8"], "bass"),
  }),
  drill({
    id: "r-dictation-1",
    number: "3.3a",
    title: "Rhythmic dictation: quarters, halves, rests",
    summary: "Hear one bar, pick its notation.",
    brief: "After a bar of clicks to set the beat, one bar of rhythm plays on one note. Pick the matching notation. Count the beats along with the clicks and keep counting through the rhythm.",
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => dictationQuestion(pick([3, 4]), 1),
  }),
  drill({
    id: "r-dictation-2",
    number: "3.3b",
    title: "Rhythmic dictation: eighths",
    summary: "Adds eighth notes, counted 1 & 2 &.",
    brief: "Eighths split the beat in two, counted \"1 &\". Listen for which beats are split.",
    ear: true,
    pass: { accuracy: 0.85 },
    generate: () => dictationQuestion(pick([3, 4]), 2),
  }),
  drill({
    id: "r-dictation-3",
    number: "3.3c",
    title: "Rhythmic dictation: dotted and sixteenths",
    summary: "Adds dotted quarters, sixteenths and syncopation.",
    brief: "Sixteenths split the beat in four (\"1 e & a\"); a dotted quarter holds through the next beat's start; syncopation puts the accent off the beat.",
    ear: true,
    pass: { accuracy: 0.8 },
    generate: () => dictationQuestion(pick([2, 3, 4]), 3),
  }),
  drill({
    id: "r-tap-1",
    number: "3.4a",
    title: "Tap a rhythm: quarters, halves, rests",
    summary: "Read a bar and tap it in time.",
    brief: "Read the bar, press Start, and tap each note after the bar of clicks, saying the counts aloud. Timing is graded against the beat, allowing for a steady delay from your speakers.",
    ear: true,
    pass: { accuracy: 0.8 },
    generate: () => tapQuestion(pick([3, 4]), 1),
  }),
  drill({
    id: "r-tap-2",
    number: "3.4b",
    title: "Tap a rhythm: eighths",
    summary: "Adds eighth notes.",
    brief: "The same, with eighths: tap on the \"&\" as well as the beat where the beat is split.",
    ear: true,
    pass: { accuracy: 0.8 },
    generate: () => tapQuestion(pick([3, 4]), 2),
  }),
  drill({
    id: "r-tap-3",
    number: "3.4c",
    title: "Tap a rhythm: dotted and sixteenths",
    summary: "Adds dotted quarters, sixteenths and syncopation.",
    brief: "The same, with the full set of cells. Keep counting through held notes so the next tap lands in time.",
    ear: true,
    pass: { accuracy: 0.75 },
    generate: () => tapQuestion(pick([3, 4]), 3),
  }),
];
