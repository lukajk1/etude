/** Ticks per quarter note. Matches the MIDI files we write. */
export const PPQ = 480;

export type TimbreId = "strings" | "woodwinds" | "brass" | "choir" | "piano" | "harp" | "percussion" | "pure" | "supersaw" | "pluck";

export interface Note {
  id: string;
  /** MIDI note number, 0–127 (60 = middle C). */
  pitch: number;
  /** Start, in ticks. */
  start: number;
  /** Length, in ticks. */
  dur: number;
  /** Velocity, 0–1. */
  vel: number;
}

export interface Track {
  id: string;
  name: string;
  timbre: TimbreId;
  /** Gain in dB. */
  volume: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** Given material in an exercise: visible and playable, but not editable. */
  locked?: boolean;
  notes: Note[];
}

export type ScaleId =
  | "chromatic"
  | "major"
  | "minor"
  | "harmonicMinor"
  | "melodicMinor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "majorPentatonic"
  | "minorPentatonic"
  | "blues";

export interface TempoChange {
  tick: number;
  bpm: number;
}

export interface Project {
  title: string;
  /** Tempo at the start. */
  bpm: number;
  /** Later tempo changes, if any (from imported MIDI). */
  tempos?: TempoChange[];
  /** [beats per bar, beat unit]. */
  timeSig: [number, number];
  /** Pitch class of the key's tonic, 0 = C. */
  key: number;
  scale: ScaleId;
  loop: { on: boolean; start: number; end: number };
  tracks: Track[];
  /** Set when the project is an exercise (see src/exercises). */
  exercise?: { id: string };
}

let idCounter = 0;
export function newId(prefix = "n"): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function ticksPerBar(p: Pick<Project, "timeSig">): number {
  const [num, den] = p.timeSig;
  return Math.round(num * (4 / den) * PPQ);
}

export function ticksPerBeat(p: Pick<Project, "timeSig">): number {
  return Math.round((4 / p.timeSig[1]) * PPQ);
}

/** Every tempo in force, starting with the opening one at tick 0. */
export function tempoMap(p: Pick<Project, "bpm" | "tempos">): TempoChange[] {
  const later = (p.tempos ?? []).filter((t) => t.tick > 0).sort((a, b) => a.tick - b.tick);
  return [{ tick: 0, bpm: p.bpm }, ...later];
}

export function tempoAt(map: TempoChange[], tick: number): number {
  let bpm = map[0].bpm;
  for (const t of map) {
    if (t.tick > tick) break;
    bpm = t.bpm;
  }
  return bpm;
}

/** Seconds between two ticks, following tempo changes. */
export function secondsBetween(map: TempoChange[], from: number, to: number): number {
  let secs = 0;
  for (let i = 0; i < map.length; i++) {
    const segStart = Math.max(from, map[i].tick);
    const segEnd = Math.min(to, i + 1 < map.length ? map[i + 1].tick : Infinity);
    if (segEnd > segStart) secs += ((segEnd - segStart) / PPQ) * (60 / map[i].bpm);
  }
  return secs;
}

/** End of the last note across all tracks, in ticks. */
export function songEnd(p: Project): number {
  let end = 0;
  for (const t of p.tracks) for (const n of t.notes) end = Math.max(end, n.start + n.dur);
  return end;
}
