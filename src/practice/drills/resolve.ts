import type { AudioEvent } from "./catalog";

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

/**
 * A note walking home by step to do, the shorter way (ti, la and sol go up; the rest go
 * down) unless `down` keeps it to the do below, ending on do with the home chord under it.
 * Played after a wrong scale-degree answer, so you hear where the note sits and how it
 * resolves.
 */
export function resolveToDo(pitch: number, degree: number, { down = false } = {}): AudioEvent[] {
  const base = pitch - MAJOR_STEPS[degree - 1]; // do in the note's octave
  // The shorter way to a do, unless `down` keeps it to the do below (the cadence's).
  const up = !down && 8 - degree < degree - 1;
  const path: number[] = [];
  if (up) {
    for (let d = degree; d <= 7; d++) path.push(base + MAJOR_STEPS[d - 1]);
    path.push(base + 12);
  } else {
    for (let d = degree; d >= 1; d--) path.push(base + MAJOR_STEPS[d - 1]);
  }
  const step = 0.42;
  const events: AudioEvent[] = path.map((p, i) => ({ pitches: [p], at: i * step, dur: i === path.length - 1 ? 1.3 : step * 0.92, vel: 0.72 }));
  const doPitch = path[path.length - 1];
  events.push({ pitches: [doPitch - 12, doPitch - 8, doPitch - 5], at: (path.length - 1) * step, dur: 1.3, vel: 0.45 });
  return events;
}
