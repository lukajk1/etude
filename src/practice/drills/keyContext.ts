import type { AudioEvent } from "./catalog";
import { chordPitches, type Numeral } from "./harmony";
import { pick } from "./theory";

/**
 * Ways to set a major key in the ear before a scale-degree or chord question, so the ear
 * learns to find home in any music rather than after one fixed cadence: cadences of
 * several kinds and textures, a scale, the tonic chord broken up, and a short melody over
 * chords. Every context ends on the tonic. `t` is do, as MIDI.
 */

export interface KeyContext {
  events: AudioEvent[];
  /** When the last note ends, in seconds. */
  end: number;
  /** What was played, for explanations: "a ii–V–I", "a scale". */
  label: string;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** Do + a scale degree counted from do = 0 (7 is do an octave up). */
const deg = (t: number, d: number) => t + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7];

/** Chord progressions that end home, with or without a dominant 7th. */
const CADENCES: { chords: (Numeral | "V7")[]; label: string }[] = [
  { chords: ["I", "IV", "V", "I"], label: "a I–IV–V–I cadence" },
  { chords: ["I", "V", "I"], label: "a I–V–I cadence" },
  { chords: ["I", "V7", "I"], label: "a I–V7–I cadence" },
  { chords: ["I", "vi", "IV", "V", "I"], label: "a I–vi–IV–V–I progression" },
  { chords: ["I", "ii", "V7", "I"], label: "a ii–V–I" },
  { chords: ["I", "IV", "I", "V7", "I"], label: "a I–IV–I–V7–I progression" },
];

/** A chord's notes: the bass, then the upper voices. V7 adds fa to V. */
function voicing(t: number, n: Numeral | "V7"): number[] {
  if (n !== "V7") return chordPitches(t, n);
  const v = chordPitches(t, "V");
  const fa = t + 5 > t + 8 ? t - 7 : t + 5;
  return [v[0], ...[...v.slice(1), fa].sort((a, b) => a - b)];
}

type Texture = "block" | "broken" | "arpeggio";

/** Chords in one of three textures: struck together, bass then chord, or rolled upward. */
function chordEvents(t: number, chords: (Numeral | "V7")[], texture: Texture): AudioEvent[] {
  const beat = texture === "block" ? 0.72 : 0.9;
  const out: AudioEvent[] = [];
  chords.forEach((n, i) => {
    const [bass, ...upper] = voicing(t, n);
    const at = i * beat;
    const last = i === chords.length - 1;
    const dur = last ? 1.1 : beat * 0.95;
    if (texture === "block") out.push({ pitches: [bass, ...upper], at, dur });
    else if (texture === "broken") {
      out.push({ pitches: [bass], at, dur, vel: 0.75 });
      out.push({ pitches: upper, at: at + beat / 2, dur: last ? 0.9 : beat / 2 - 0.03, vel: 0.55 });
    } else {
      out.push({ pitches: [bass], at, dur, vel: 0.75 });
      upper.forEach((p, k) => out.push({ pitches: [p], at: at + 0.14 * (k + 1), dur: dur - 0.14 * (k + 1), vel: 0.55 }));
    }
  });
  return out;
}

/** The scale up an octave and back to do, or up to sol and back, over a low do. */
function scaleRun(t: number): AudioEvent[] {
  const path = pick([
    [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0],
    [0, 1, 2, 3, 4, 3, 2, 1, 0],
    [7, 6, 5, 4, 3, 2, 1, 0],
  ]);
  const step = 0.26;
  return [
    { pitches: [t - 12], at: 0, dur: step * path.length + 0.6, vel: 0.4 },
    ...path.map((d, i) => ({ pitches: [deg(t, d)], at: i * step, dur: i === path.length - 1 ? 0.9 : step * 0.9, vel: 0.7 })),
  ];
}

/** The tonic chord broken up, over a held low do. */
function brokenTonic(t: number): AudioEvent[] {
  const path = pick([
    [0, 2, 4, 7, 4, 2, 0],
    [0, 4, 2, 4, 7, 4, 0],
    [4, 2, 0, 2, 4, 7, 0],
  ]);
  const step = 0.3;
  return [
    { pitches: [t - 12, t - 5], at: 0, dur: step * path.length + 0.6, vel: 0.4 },
    ...path.map((d, i) => ({ pitches: [deg(t, d)], at: i * step, dur: i === path.length - 1 ? 0.9 : step * 0.9, vel: 0.7 })),
  ];
}

/** Chord tones of each numeral, as degrees from do. */
const TONES: Record<Numeral | "V7", number[]> = { I: [0, 2, 4], ii: [1, 3, 5], IV: [3, 5, 0], V: [4, 6, 1], V7: [4, 6, 1, 3], vi: [5, 0, 2] };

/**
 * A short melody over block chords: a chord tone on each chord, near the last one, with a
 * passing note where it skips a third, ending on do.
 */
function melodyOverChords(t: number): { events: AudioEvent[]; label: string } {
  const { chords, label } = pick(CADENCES.filter((c) => c.chords.length >= 4));
  const beat = 0.8;
  const events: AudioEvent[] = [];
  let prev = pick([2, 4, 7]); // mi, sol or high do
  chords.forEach((n, i) => {
    const at = i * beat;
    const last = i === chords.length - 1;
    const [bass, ...upper] = voicing(t, n);
    // Chords sit below the melody: drop any upper voice that would reach it.
    events.push({ pitches: [bass, ...upper.filter((p) => p < deg(t, 2) - 1)], at, dur: last ? 1.2 : beat * 0.95, vel: 0.5 });
    // The melody, mi up to high re, above the chords: do on the last chord; otherwise the chord tone nearest the previous note.
    const options = last ? [7] : TONES[n].flatMap((d) => [d, d + 7]).filter((d) => d >= 2 && d <= 8);
    const note = options.reduce((best, d) => (Math.abs(d - prev) < Math.abs(best - prev) ? d : best), options[0]);
    if (i > 0 && Math.abs(note - prev) === 2) {
      events.push({ pitches: [deg(t, note > prev ? prev + 1 : prev - 1)], at: at - beat / 2, dur: beat / 2 - 0.03, vel: 0.7 });
    }
    events.push({ pitches: [deg(t, note)], at, dur: (last ? 1.2 : beat / 2) - 0.03, vel: 0.75 });
    prev = note;
  });
  return { events, label: `a short melody over ${label.replace(/^an? /, "")}` };
}

const endOf = (events: AudioEvent[]) => Math.max(...events.map((e) => e.at + e.dur));

/** A random way to set the major key whose do is `t`. */
export function keyContext(t: number): KeyContext {
  const kind = pick(["cadence", "cadence", "melody", "scale", "tonic"] as const);
  if (kind === "scale") {
    const events = scaleRun(t);
    return { events, end: endOf(events), label: "a scale" };
  }
  if (kind === "tonic") {
    const events = brokenTonic(t);
    return { events, end: endOf(events), label: "the tonic chord, broken up" };
  }
  if (kind === "melody") {
    const { events, label } = melodyOverChords(t);
    return { events, end: endOf(events), label };
  }
  const { chords, label } = pick(CADENCES);
  const texture = pick<Texture>(["block", "block", "broken", "arpeggio"]);
  const events = chordEvents(t, chords, texture);
  return { events, end: endOf(events), label };
}
