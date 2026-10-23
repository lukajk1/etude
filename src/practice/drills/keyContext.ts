import type { AudioEvent } from "./catalog";
import { chordPitches, type Numeral } from "./harmony";
import { pick } from "./theory";

/**
 * Ways to set a major key in the ear before a scale-degree or chord question: a different
 * chord progression each time, in one of three textures, so the ear learns to find home
 * after any cadence rather than one fixed I–IV–V–I. Every progression ends on I. `t` is do,
 * as MIDI. (Scales, the broken tonic chord and melodies over chords are shelved for now; see
 * the git history.)
 */

export interface KeyContext {
  events: AudioEvent[];
  /** When the last note ends, in seconds. */
  end: number;
  /** What was played, for explanations: "a ii–V–I". */
  label: string;
}

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

/** A random chord progression setting the major key whose do is `t`. */
export function keyContext(t: number): KeyContext {
  const { chords, label } = pick(CADENCES);
  const texture = pick<Texture>(["block", "block", "broken", "arpeggio"]);
  const events = chordEvents(t, chords, texture);
  return { events, end: Math.max(...events.map((e) => e.at + e.dur)), label };
}
