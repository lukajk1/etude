import { TIMBRES } from "../model/timbres";
import { PPQ, songEnd, ticksPerBar, type Project, type Track } from "../model/types";
import { usesFlats } from "../theory/theory";

/**
 * Turns piano-roll lanes into something a score renderer can draw: measures, at most
 * two voices per staff, note values that exist in notation, ties where notes cross
 * beats or barlines, and triplets. Pure data; no drawing here.
 *
 * Time is counted in units of 1/24 of a quarter note, which holds both straight values
 * (16th = 6, 32nd = 3) and triplets (triplet 8th = 8, triplet 16th = 4).
 */
export const UNIT = PPQ / 24;
const BEAT = 24;

export type Clef = "treble" | "bass" | "percussion";

export interface Piece {
  /** Start within the measure, in units. */
  start: number;
  units: number;
  /** MIDI pitches; empty for rests. */
  keys: number[];
  rest: boolean;
  /** An invisible spacer (gaps in a second voice). */
  ghost: boolean;
  /** Part of a triplet group (one group per beat). */
  triplet: boolean;
  /** Tied to the next piece of the same voice. */
  tie: boolean;
  /** A whole-measure rest. */
  measureRest: boolean;
}

export interface Staff {
  trackId: string;
  name: string;
  color: string;
  clef: Clef;
  /** measures[m][voice] = pieces. Voice 1 may be empty. */
  measures: Piece[][][];
}

export interface ScoreModel {
  timeSig: [number, number];
  measureUnits: number;
  measureTicks: number;
  measureCount: number;
  /** VexFlow key signature name, such as "D" or "Bb". */
  keySig: string;
  /** Number of sharps (positive) or flats (negative) in the key signature. */
  keyAccidentals: number;
  flats: boolean;
  staves: Staff[];
}

// ---- Key signature -------------------------------------------------------

/** Offset from the tonic to the major key that shares its signature. */
const SIGNATURE_SHIFT: Record<string, number> = {
  major: 0, majorPentatonic: 0, chromatic: 0, lydian: 7, mixolydian: 5,
  dorian: 10, phrygian: 8, locrian: 1,
  minor: 3, harmonicMinor: 3, melodicMinor: 3, minorPentatonic: 3, blues: 3,
};
const MAJOR_SIGS: Record<number, [string, number]> = {
  0: ["C", 0], 7: ["G", 1], 2: ["D", 2], 9: ["A", 3], 4: ["E", 4], 11: ["B", 5],
  5: ["F", -1], 10: ["Bb", -2], 3: ["Eb", -3], 8: ["Ab", -4], 1: ["Db", -5],
};

function keySignature(p: Project): { name: string; count: number } {
  const pc = (p.key + (SIGNATURE_SHIFT[p.scale] ?? 0)) % 12;
  if (pc === 6) return usesFlats(p.key, p.scale) ? { name: "Gb", count: -6 } : { name: "F#", count: 6 };
  const [name, count] = MAJOR_SIGS[pc];
  return { name, count };
}

// ---- Grid snapping -------------------------------------------------------

const GRID = [0, 3, 4, 6, 8, 9, 12, 15, 16, 18, 20, 21, 24];

/** Nearest point on the 32nd-note or triplet-16th grid. */
function snapUnits(u: number): number {
  const beat = Math.floor(u / BEAT) * BEAT;
  const r = u - beat;
  let best = 0;
  for (const g of GRID) if (Math.abs(g - r) < Math.abs(best - r)) best = g;
  return beat + best;
}

const isTripletPoint = (u: number) => [4, 8, 16, 20].includes(((u % BEAT) + BEAT) % BEAT);

interface Event {
  start: number;
  end: number;
  keys: number[];
}

/** Snap a lane's notes and merge same-start, same-end notes into chords. */
function laneEvents(track: Track): { events: Event[]; tripletBeats: Set<number> } {
  const starts = track.notes.map((n) => snapUnits(n.start / UNIT));
  const onsets = [...new Set(starts)].sort((a, b) => a - b);
  const nextOnset = (u: number) => {
    let lo = 0;
    let hi = onsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (onsets[mid] <= u) lo = mid + 1;
      else hi = mid;
    }
    return lo < onsets.length ? onsets[lo] : Infinity;
  };
  const raw = track.notes.map((n, i) => {
    const start = starts[i];
    const rawEnd = (n.start + n.dur) / UNIT;
    const len = rawEnd - start;
    const next = nextOnset(start);
    let end: number;
    if (rawEnd < next && next - rawEnd <= Math.max(3, len * 0.3)) {
      // A short gap before the next note is articulation, not a written rest.
      end = next;
    } else {
      // Otherwise snap the end to a grid that suits the note's length.
      // Ends already on the grid (including triplets) stay where they are.
      const exact = Math.abs(snapUnits(rawEnd) - rawEnd) < 0.05;
      const grid = exact ? 0 : len >= 24 ? 12 : len >= 12 ? 6 : 0;
      end = grid ? Math.round(rawEnd / grid) * grid : snapUnits(rawEnd);
      if (end > next && rawEnd <= next) end = next;
    }
    if (end <= start) end = start + 3;
    return { start, end, pitch: n.pitch };
  });
  // A beat with any triplet boundary is written as a triplet beat.
  const tripletBeats = new Set<number>();
  for (const r of raw) {
    for (const u of [r.start, r.end]) if (isTripletPoint(u)) tripletBeats.add(Math.floor(u / BEAT) * BEAT);
  }
  const toTripletGrid = (u: number) => {
    const beat = Math.floor(u / BEAT) * BEAT;
    return tripletBeats.has(beat) ? beat + Math.round((u - beat) / 4) * 4 : u;
  };
  const chords = new Map<string, Event>();
  for (const r of raw) {
    const start = toTripletGrid(r.start);
    let end = toTripletGrid(r.end);
    if (end <= start) end = start + (tripletBeats.has(Math.floor(start / BEAT) * BEAT) ? 4 : 3);
    const k = `${start}:${end}`;
    const ev = chords.get(k);
    if (ev) {
      if (!ev.keys.includes(r.pitch)) ev.keys.push(r.pitch);
    } else chords.set(k, { start, end, keys: [r.pitch] });
  }
  const events = [...chords.values()];
  for (const e of events) e.keys.sort((a, b) => a - b);
  events.sort((a, b) => a.start - b.start || Math.max(...b.keys) - Math.max(...a.keys));
  return { events, tripletBeats };
}

/** Split events into at most two monophonic voices; voice 0 takes the upper part. */
function assignVoices(events: Event[]): [Event[], Event[]] {
  const voices: [Event[], Event[]] = [[], []];
  const endOf = (v: Event[]) => (v.length ? v[v.length - 1].end : -Infinity);
  for (const e of events) {
    const ev = { ...e };
    if (endOf(voices[0]) <= ev.start) voices[0].push(ev);
    else if (endOf(voices[1]) <= ev.start) voices[1].push(ev);
    else {
      // Three things at once: shorten whichever voice frees up first.
      const v = endOf(voices[0]) <= endOf(voices[1]) ? 0 : 1;
      const last = voices[v][voices[v].length - 1];
      if (ev.start - last.start >= 3) {
        last.end = ev.start;
        voices[v].push(ev);
      } else {
        for (const k of ev.keys) if (!last.keys.includes(k)) last.keys.push(k);
        last.keys.sort((a, b) => a - b);
      }
    }
  }
  return voices;
}

// ---- Note values -----------------------------------------------------------

const STRAIGHT = [18, 12, 9, 6, 3];
const TRIPLET = [16, 8, 4];
const WHOLE_BEATS = [96, 72, 48, 24];

/** Break a span inside one measure into writable values. Returns [start, units, triplet][]. */
function decompose(s: number, e: number, measureUnits: number, tripletBeats: Set<number>, measureOffset: number) {
  const out: [number, number, boolean][] = [];
  let pos = s;
  while (pos < e) {
    const beatStart = Math.floor(pos / BEAT) * BEAT;
    const triplet = tripletBeats.has(measureOffset + beatStart);
    if (pos === beatStart && e - pos >= BEAT && !triplet) {
      // Whole beats: the biggest value that fits, keeping big values on strong positions.
      const v = WHOLE_BEATS.find(
        (w) => w <= e - pos && pos + w <= measureUnits && (w < 48 || pos % 48 === 0) && (w < 72 || pos === 0) && !hasTripletBeat(measureOffset + pos, w, tripletBeats),
      ) ?? BEAT;
      out.push([pos, v, false]);
      pos += v;
      continue;
    }
    const chunkEnd = Math.min(e, beatStart + BEAT);
    const values = triplet ? TRIPLET : STRAIGHT;
    while (pos < chunkEnd) {
      const v = values.find((x) => x <= chunkEnd - pos) ?? chunkEnd - pos;
      out.push([pos, v, triplet]);
      pos += v;
    }
  }
  return out;
}

function hasTripletBeat(from: number, len: number, tripletBeats: Set<number>): boolean {
  for (let b = from; b < from + len; b += BEAT) if (tripletBeats.has(b)) return true;
  return false;
}

function notateVoice(events: Event[], measureUnits: number, measureCount: number, tripletBeats: Set<number>, isSecond: boolean): Piece[][] {
  const measures: Piece[][] = [];
  let i = 0;
  for (let m = 0; m < measureCount; m++) {
    const m0 = m * measureUnits;
    const m1 = m0 + measureUnits;
    const pieces: Piece[] = [];
    let pos = m0;
    while (i < events.length && events[i].end <= m0) i++;
    let j = i;
    const fill = (from: number, to: number) => {
      for (const [st, units, triplet] of decompose(from - m0, to - m0, measureUnits, tripletBeats, m0)) {
        pieces.push({ start: st, units, keys: [], rest: true, ghost: isSecond, triplet, tie: false, measureRest: false });
      }
    };
    while (j < events.length && events[j].start < m1) {
      const ev = events[j];
      const s = Math.max(ev.start, m0);
      const e = Math.min(ev.end, m1);
      if (s > pos) fill(pos, s);
      const parts = decompose(s - m0, e - m0, measureUnits, tripletBeats, m0);
      parts.forEach(([st, units, triplet], k) => {
        const last = k === parts.length - 1;
        pieces.push({ start: st, units, keys: ev.keys, rest: false, ghost: false, triplet, tie: !last || ev.end > m1, measureRest: false });
      });
      pos = Math.max(pos, e);
      j++;
    }
    const hasNotes = pieces.some((p) => !p.rest);
    if (!hasNotes) {
      if (isSecond) measures.push([]);
      else if (measureUnits === 96) measures.push([{ start: 0, units: 96, keys: [], rest: true, ghost: false, triplet: false, tie: false, measureRest: true }]);
      else {
        pieces.length = 0;
        fill(m0, m1);
        measures.push(pieces);
      }
      continue;
    }
    if (pos < m1) fill(pos, m1);
    measures.push(pieces);
  }
  return measures;
}

function clefFor(track: Track): Clef {
  if (track.timbre === "percussion") return "percussion";
  if (track.notes.length === 0) return TIMBRES[track.timbre].range[0] < 40 ? "bass" : "treble";
  const sorted = track.notes.map((n) => n.pitch).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] < 57 ? "bass" : "treble";
}

export function buildScore(p: Project): ScoreModel {
  const measureTicks = ticksPerBar(p);
  const measureUnits = Math.round(measureTicks / UNIT);
  const measureCount = Math.max(4, Math.ceil(songEnd(p) / measureTicks));
  const sig = keySignature(p);
  const staves: Staff[] = p.tracks.map((t) => {
    const { events, tripletBeats } = laneEvents(t);
    const [v0, v1] = assignVoices(events);
    const m0 = notateVoice(v0, measureUnits, measureCount, tripletBeats, false);
    const m1 = notateVoice(v1, measureUnits, measureCount, tripletBeats, true);
    return {
      trackId: t.id,
      name: t.name,
      color: TIMBRES[t.timbre].color,
      clef: clefFor(t),
      measures: m0.map((v, i) => (m1[i].length ? [v, m1[i]] : [v])),
    };
  });
  return {
    timeSig: p.timeSig,
    measureUnits,
    measureTicks,
    measureCount,
    keySig: sig.name,
    keyAccidentals: sig.count,
    flats: sig.count < 0,
    staves,
  };
}

