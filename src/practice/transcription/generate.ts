import { PPQ } from "../../model/types";
import { MAJOR_KEYS, MINOR_KEYS, parseCode, pitchOf, vfKey, type Spelled } from "../drills/theory";
import type { DictationStage, GenParams, Melody, Mode, TargetNote } from "./melodies";

/**
 * Melodies for dictation, generated fresh each time so none can be known by heart. A
 * melody is built in scale degrees (do = 0, re = 1, …, low sol = -3, high do = 7) over an
 * implied I–V harmony, one chord a bar: it starts on a tonic-chord note, moves mostly by
 * step, skips and leaps only to notes of the bar's chord (recovering by step after a
 * leap of a 4th or more), puts a chord note on every downbeat, and ends re–do or ti–do
 * on a long note. In minor, ti is raised (the leading tone) where it goes to do, never
 * straight after le. Rhythms are the stage's cells, a bar at a time. Do's octave is chosen
 * last, to keep the notes in A3–C6 and as far as possible on the treble staff. Anything
 * that paints itself into a corner is thrown away and tried again.
 */

const SIXTEENTH = PPQ / 4;
const SCALE: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
/** Semitones each diatonic interval (in steps, within an octave) may span: major, minor or perfect only. */
const PLAIN_INTERVALS = [[0], [1, 2], [3, 4], [5], [7], [8, 9], [10, 11]];

type Chord = "I" | "V";
const CHORD_TONES: Record<Chord, number[]> = { I: [0, 2, 4], V: [4, 6, 1] };

const LOWEST = 57; // A3
const HIGHEST = 84; // C6
const ATTEMPTS = 300;

const mod = (n: number, m: number) => ((n % m) + m) % m;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const pickOf = <T,>(arr: readonly T[], rng: () => number): T => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  let r = rng() * sum(weights);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** How often each rhythm cell comes up; plain quarters and eighths most, a bar-long note rarely. */
const CELL_WEIGHT: Record<string, number> = { "4": 3, "8": 2, "2,2": 3, "6,2": 1.5, "12": 0.5, "2,4,2": 1 };
const cellWeight = (c: number[]) => CELL_WEIGHT[c.join()] ?? 1;

/** One note's place in time: its start and length in ticks, which bar (-1: the pickup) and whether it's on the downbeat. */
interface Slot {
  start: number;
  dur: number;
  bar: number;
  downbeat: boolean;
}

/** One octave do may sit in, and the stretch of the stage's range that fits A3–C6 from there. */
interface Placement {
  /** MIDI pitch of do. */
  doPitch: number;
  /** Do, spelled, in that octave. */
  tonic: Spelled;
  lo: number;
  hi: number;
}

/** The key and range a melody is written in. */
interface Ctx {
  mode: Mode;
  /** The octaves do may sit in; the melody goes in whichever suits it best once written. */
  places: Placement[];
  /** Lowest and highest degree usable in some placement. */
  lo: number;
  hi: number;
  maxLeap: number;
  startDegrees: number[];
}

const degreePitch = (mode: Mode, doPitch: number, d: number, raised = false) => doPitch + 12 * Math.floor(d / 7) + SCALE[mode][mod(d, 7)] + (raised ? 1 : 0);

/** A degree spelled from do's letter (re is the next letter, and so on), as a VexFlow key. */
function spell(mode: Mode, place: Placement, d: number, raised: boolean): string {
  const steps = place.tonic.letter + d;
  const letter = mod(steps, 7);
  const octave = place.tonic.octave + Math.floor(steps / 7);
  return vfKey({ letter, acc: degreePitch(mode, place.doPitch, d, raised) - pitchOf({ letter, acc: 0, octave }), octave });
}

/** Whether a melodic interval is augmented or diminished (an augmented 2nd, a tritone…). */
function oddInterval(mode: Mode, a: number, aRaised: boolean, b: number, bRaised: boolean): boolean {
  const steps = Math.abs(b - a);
  const semis = Math.abs(degreePitch(mode, 0, b, bRaised) - degreePitch(mode, 0, a, aRaised)) - 12 * Math.floor(steps / 7);
  return !PLAIN_INTERVALS[steps % 7].includes(semis);
}

/** Each octave do may sit in, from A3 up to C5, with the degrees of `range` that then fit A3–C6. */
function placements(code: string, mode: Mode, range: [number, number]): Placement[] {
  const spelled = parseCode(code, 0);
  const pc = mod(pitchOf(spelled), 12);
  const out: Placement[] = [];
  for (let doPitch = LOWEST; doPitch <= 72; doPitch++) {
    if (doPitch % 12 !== pc) continue;
    // A raised ti sits a semitone higher, so check it against the top.
    const fits = (d: number) => degreePitch(mode, doPitch, d) >= LOWEST && degreePitch(mode, doPitch, d, mode === "minor" && mod(d, 7) === 6) <= HIGHEST;
    let lo = 0;
    let hi = 0;
    while (lo - 1 >= range[0] && fits(lo - 1)) lo--;
    while (hi + 1 <= range[1] && fits(hi + 1)) hi++;
    // The tonic's octave by its letter, so Cb and B# land in the right octave.
    out.push({ doPitch, tonic: { ...spelled, octave: (doPitch - pitchOf(spelled)) / 12 }, lo, hi });
  }
  return out;
}

/** The placement for a finished melody: the fewest notes off C4–A5, then do nearest C4–G4. */
function choosePlace(ctx: Ctx, degs: number[]): Placement {
  const lo = Math.min(...degs);
  const hi = Math.max(...degs);
  const fitting = ctx.places.filter((p) => p.lo <= lo && hi <= p.hi);
  const cost = (p: Placement) => {
    const outside = degs.filter((d) => degreePitch(ctx.mode, p.doPitch, d) < 60 || degreePitch(ctx.mode, p.doPitch, d) > 81).length;
    const off = p.doPitch < 60 ? 60 - p.doPitch : p.doPitch > 67 ? p.doPitch - 67 : 0;
    return outside * 10 + off;
  };
  return (fitting.length ? fitting : ctx.places).reduce((best, p) => (cost(p) < cost(best) ? p : best));
}

// ---- Rhythm ------------------------------------------------------------------------------

/** Cells that add up to `len` sixteenths, or null if none fit. */
function fillBar(len: number, cells: number[][], rng: () => number): number[] | null {
  const out: number[] = [];
  let left = len;
  while (left > 0) {
    const fits = cells.filter((c) => sum(c) <= left);
    if (!fits.length) return null;
    const c = pickWeighted(fits, fits.map(cellWeight), rng);
    out.push(...c);
    left -= sum(c);
  }
  return out;
}

/** The rhythm: `bars` full bars, the last ending on a long note, after an optional one-beat pickup. */
function buildRhythm(g: GenParams, beats: number, pickup: boolean, rng: () => number): Slot[] | null {
  const barLen = beats * 4;
  const bars: number[][] = [];
  for (let b = 0; b < g.bars - 1; b++) {
    const bar = fillBar(barLen, g.cells, rng);
    if (!bar) return null;
    bars.push(bar);
  }
  // The last note: a half or whole note in 4/4, a dotted half (the whole bar) in 3/4.
  const final = beats === 4 ? (rng() < 0.75 ? 8 : 16) : barLen;
  const pre = fillBar(barLen - final, g.cells, rng);
  if (!pre) return null;
  bars.push([...pre, final]);
  if (bars.length > 1 && new Set(bars.map((b) => b.join())).size === 1) return null;

  const slots: Slot[] = [];
  if (pickup) {
    const cell = g.cells.some((c) => c.join() === "2,2") && rng() < 0.4 ? [2, 2] : [4];
    let at = (beats - 1) * PPQ;
    for (const d of cell) {
      slots.push({ start: at, dur: d * SIXTEENTH, bar: -1, downbeat: false });
      at += d * SIXTEENTH;
    }
  }
  const offset = pickup ? beats * PPQ : 0;
  bars.forEach((bar, b) => {
    let at = offset + b * beats * PPQ;
    bar.forEach((d, j) => {
      slots.push({ start: at, dur: d * SIXTEENTH, bar: b, downbeat: j === 0 });
      at += d * SIXTEENTH;
    });
  });
  // Enough notes to be a tune, not a few long ones.
  return slots.length >= g.bars * 2 + 1 ? slots : null;
}

/** One chord a bar: I first and last, V before the last, I and V mixed between. */
function planHarmony(bars: number, rng: () => number): Chord[] {
  const plan: Chord[] = [];
  for (let b = 0; b < bars; b++) {
    if (b === 0 || b === bars - 1) plan.push("I");
    else if (b === bars - 2) plan.push("V");
    else plan.push(rng() < 0.65 ? (plan[b - 1] === "I" ? "V" : "I") : plan[b - 1]);
  }
  return plan;
}

// ---- Pitches -----------------------------------------------------------------------------

/** Pickups into a downbeat do: the notes, then that do. Sol–do and ti–do most. */
const PICKUPS: { degs: number[]; to: number; weight: number }[] = [
  { degs: [-3], to: 0, weight: 2 },
  { degs: [4], to: 7, weight: 1 },
  { degs: [-1], to: 0, weight: 1.5 },
  { degs: [6], to: 7, weight: 1 },
  { degs: [-3, -1], to: 0, weight: 2 },
  { degs: [2, 1], to: 0, weight: 1 },
  { degs: [4, 6], to: 7, weight: 1.5 },
  { degs: [-2, -1], to: 0, weight: 1 },
];

/** Where the last two notes may be: re or ti, then the do a step away. */
const CADENCES: { penult: number; final: number }[] = [
  { penult: 1, final: 0 },
  { penult: -1, final: 0 },
  { penult: 6, final: 7 },
];

const moveWeight = (move: number) => {
  const m = Math.abs(move);
  return m === 0 ? 1 : m === 1 ? 5 : m === 2 ? 2 : 1;
};

/** The degrees for each slot, or null if the walk dead-ends. */
function buildDegrees(ctx: Ctx, slots: Slot[], plan: Chord[], rng: () => number): number[] | null {
  const N = slots.length;
  const minor = ctx.mode === "minor";
  const inRange = (d: number) => d >= ctx.lo && d <= ctx.hi;
  // Whether a stretch of degrees fits the register with do in some octave.
  const fits = (lo: number, hi: number) => ctx.places.some((p) => p.lo <= lo && hi <= p.hi);
  const chordAt = (i: number): Chord => (slots[i].bar < 0 ? "V" : plan[slots[i].bar]);
  const isChordTone = (d: number, chord: Chord) => CHORD_TONES[chord].includes(mod(d, 7));
  const cadences = CADENCES.filter((c) => inRange(c.penult) && inRange(c.final));

  // Whether `c` may follow `degs` as note i.
  const legal = (degs: number[], c: number, i: number): boolean => {
    if (!fits(Math.min(c, ...degs), Math.max(c, ...degs))) return false;
    const chord = chordAt(i);
    if (slots[i].downbeat && !isChordTone(c, chord)) return false;
    if (i === 0) return true;
    const p = degs[i - 1];
    const move = c - p;
    const size = Math.abs(move);
    if (size > ctx.maxLeap) return false;
    // At most two of a pitch in a row; no repeated ti in minor (it would change between te and ti).
    if (size === 0 && ((i >= 2 && degs[i - 2] === p) || (minor && mod(c, 7) === 6))) return false;
    // Skips and leaps land on the bar's chord; no 7ths, and a 5th or wider leaves from a chord note too.
    if (size >= 2 && !isChordTone(c, chord)) return false;
    if (size === 6) return false;
    if (size >= 4 && !isChordTone(p, chord) && !isChordTone(p, chordAt(i - 1))) return false;
    if (i >= 2) {
      const prev = p - degs[i - 2];
      // After a leap of a 4th or more, a step back.
      if (Math.abs(prev) >= 3 && !(size === 1 && Math.sign(move) === -Math.sign(prev))) return false;
      // No trilling back and forth: a b a b.
      if (i >= 3 && c === degs[i - 2] && p === degs[i - 3]) return false;
      // Two skips running the same way only as thirds, outlining a triad.
      if (size >= 2 && Math.abs(prev) >= 2 && Math.sign(prev) === Math.sign(move) && (size > 2 || Math.abs(prev) > 2)) return false;
    }
    // In minor, ti is raised (the leading tone) when it goes to do.
    const pRaised = minor && mod(p, 7) === 6 && mod(c, 7) === 0;
    if (minor && mod(p, 7) === 6 && !pRaised) {
      // A natural te is only a passing note over i: not over V (it clashes with ti), not on a downbeat, by step in and out.
      if (slots[i - 1].downbeat || chordAt(i - 1) !== "I" || size !== 1) return false;
      if (i >= 2 && Math.abs(p - degs[i - 2]) >= 2) return false;
    }
    // Raising ti changes the interval into it: le to ti would be an augmented 2nd.
    if (pRaised && i >= 2 && oddInterval(ctx.mode, degs[i - 2], false, p, true)) return false;
    return !oddInterval(ctx.mode, p, pRaised, c, false);
  };

  const degs: number[] = [];
  const pickupLen = slots.filter((s) => s.bar < 0).length;
  if (pickupLen) {
    const options = PICKUPS.filter((pu) => pu.degs.length === pickupLen && pu.degs.every(inRange) && inRange(pu.to));
    if (!options.length) return null;
    const pu = pickWeighted(options, options.map((o) => o.weight), rng);
    for (const d of [...pu.degs, pu.to]) {
      if (!legal(degs, d, degs.length)) return null;
      degs.push(d);
    }
  }

  // Steps per note the walk can count on to reach the cadence.
  const reach = ctx.maxLeap >= 2 ? 2 : 1;
  for (let i = degs.length; i < N; i++) {
    let options: number[];
    if (i === N - 1) {
      const c = cadences.find((c) => c.penult === degs[i - 1]);
      options = c ? [c.final] : [];
    } else if (i === N - 2) {
      options = cadences.filter((c) => legal(degs, c.penult, i) && legal([...degs, c.penult], c.final, i + 1)).map((c) => c.penult);
    } else if (i === 0) {
      options = ctx.startDegrees.filter((d) => legal(degs, d, 0));
    } else {
      const left = N - 2 - i;
      options = [];
      for (let c = ctx.lo; c <= ctx.hi; c++) {
        if (!legal(degs, c, i)) continue;
        if (Math.min(...cadences.map((t) => Math.abs(t.penult - c))) > left * reach) continue;
        options.push(c);
      }
    }
    options = options.filter((c) => legal(degs, c, i));
    if (!options.length) return null;
    const p = degs[i - 1];
    degs.push(i === 0 || i >= N - 2 ? pickOf(options, rng) : pickWeighted(options, options.map((c) => moveWeight(c - p)), rng));
  }
  return degs;
}

/** A plain melody for when every attempt fails (it shouldn't): do re mi re a bar, ending mi re do. */
function fallback(g: GenParams, beats: number): { slots: Slot[]; degs: number[] } {
  const slots: Slot[] = [];
  const degs: number[] = [];
  const bars = beats === 4 ? { mid: [0, 1, 2, 1], midDur: [4, 4, 4, 4], last: [2, 1, 0], lastDur: [4, 4, 8] } : { mid: [0, 1], midDur: [8, 4], last: [0], lastDur: [12] };
  for (let b = 0; b < g.bars; b++) {
    const last = b === g.bars - 1;
    let at = b * beats * PPQ;
    (last ? bars.lastDur : bars.midDur).forEach((d, j) => {
      slots.push({ start: at, dur: d * SIXTEENTH, bar: b, downbeat: j === 0 });
      degs.push((last ? bars.last : bars.mid)[j]);
      at += d * SIXTEENTH;
    });
  }
  return { slots, degs };
}

/**
 * A fresh melody to a stage's rules: its meter, mode, key, range, leaps, rhythm cells and
 * pickup. Notes are back to back from the first (or the pickup's) to the long last do,
 * each spelled in the key. `rng` returns [0, 1) like Math.random, for repeatable tests.
 */
export function generateMelody(stage: DictationStage, rng: () => number = Math.random): Melody {
  const g = stage.gen;
  const beats = pickOf(g.meters.length ? g.meters : [4], rng);
  const modes = g.modes.filter((m) => (m === "major" ? g.majorKeys : g.minorKeys).length);
  const mode = modes.length ? pickOf(modes, rng) : "major";
  const keys = mode === "major" ? g.majorKeys : g.minorKeys;
  const keyCode = keys.length ? pickOf(keys, rng) : mode === "major" ? "C" : "A";
  const bpm = g.bpm[0] + Math.floor(rng() * (g.bpm[1] - g.bpm[0] + 1));
  const signature = (mode === "major" ? MAJOR_KEYS : MINOR_KEYS).find((k) => k.code === keyCode);

  const places = placements(keyCode, mode, g.range);
  const ctx: Ctx = { mode, places, lo: Math.min(...places.map((p) => p.lo)), hi: Math.max(...places.map((p) => p.hi)), maxLeap: g.maxLeap, startDegrees: g.startDegrees };

  let result: { slots: Slot[]; degs: number[] } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS && !result; attempt++) {
    // A pickup about half the time, where the stage allows one.
    const slots = buildRhythm(g, beats, g.pickup && rng() < 0.5, rng);
    if (!slots) continue;
    const degs = buildDegrees(ctx, slots, planHarmony(g.bars, rng), rng);
    if (degs) result = { slots, degs };
  }
  const { slots, degs } = result ?? fallback(g, beats);

  const place = choosePlace(ctx, degs);
  const notes: TargetNote[] = slots.map((s, i) => {
    const raised = mode === "minor" && mod(degs[i], 7) === 6 && i + 1 < degs.length && mod(degs[i + 1], 7) === 0;
    return { pitch: degreePitch(mode, place.doPitch, degs[i], raised), start: s.start, dur: s.dur, vf: spell(mode, place, degs[i], raised) };
  });
  return { stageId: stage.id, timeSig: [beats, 4], bpm, notes, keyCode, mode, tonic: mod(place.doPitch, 12), accidentals: signature?.accidentals ?? 0 };
}
