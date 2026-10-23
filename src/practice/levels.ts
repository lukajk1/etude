/**
 * Rough levels for each stage, on the scales most used in the US and Canada: the Royal
 * Conservatory (RCM) theory levels and the ear tests in its practical levels, and, for what
 * RCM doesn't test (scale degrees, dictation, meter, transcription), first-year college aural
 * skills. These are approximate matches by content, not an official mapping.
 */

export type Scheme = "theory" | "ear" | "college";

export interface Level {
  scheme: Scheme;
  /** RCM level (0 for Preparatory), or college year. */
  n: number;
}

const t = (n: number): Level => ({ scheme: "theory", n });
const e = (n: number): Level => ({ scheme: "ear", n });
const c = (n: number): Level => ({ scheme: "college", n });

export const LEVELS: Record<string, Level> = {
  // Reading and theory: keys, scales, intervals and triads grow by level.
  "0.1a": t(0),
  "0.1b": t(0),
  "0.1c": t(1),
  "0.2a": t(4),
  "0.2b": t(4),
  "0.3a": t(4),
  "0.3b": t(4),
  "0.3c": t(7),
  "0.4a": t(3),
  "0.4b": t(5),
  "0.5a": t(3),
  "0.5b": t(5),
  "0.6a": t(3),
  "0.6b": t(6),
  "0.7a": t(3),
  "0.7b": t(6),
  "0.14a": t(7),
  // Ear tests: intervals ascending first, then descending and harmonic.
  "0.8a": e(2),
  "0.8b": e(4),
  "0.8c": e(4),
  "0.8d": e(4),
  "0.9a": e(8),
  "0.9b": e(8),
  "0.9c": e(9),
  "0.9d": e(9),
  "0.10a": e(1),
  "0.10b": e(6),
  "0.11a": c(1),
  "0.11b": c(1),
  "0.11c": c(1),
  "0.12a": c(1),
  "0.12b": c(1),
  "0.12c": c(1),
  "0.13a": c(1),
  "0.13b": c(1),
  // Hearing harmony and cadences: the chord-progression ear tests.
  "2.1a": e(5),
  "2.1b": e(6),
  "2.1c": e(8),
  "2.1d": e(9),
  "2.2a": e(6),
  "2.2b": e(9),
  "4.1a": e(7),
  "4.1b": e(8),
  "4.1c": e(9),
  // Rhythm: note values are theory; tapping is the clapback ear test.
  "3.1a": t(2),
  "3.1b": t(3),
  "3.1c": t(2),
  "3.2a": c(1),
  "3.2b": c(1),
  "3.2c": c(1),
  "3.2d": c(1),
  "3.2e": c(1),
  "3.3a": c(1),
  "3.3b": c(1),
  "3.3c": c(1),
  "3.4a": e(1),
  "3.4b": e(2),
  "3.4c": e(5),
  // Composition: harmony (Levels 8 to 9) and counterpoint (Level 10).
  "5.1a": t(8),
  "5.1b": t(9),
  "5.1c": t(9),
  "6.1a": t(8),
  "6.1b": t(9),
  "6.1c": t(9),
  "1.1": t(10),
  "1.2": t(10),
  "1.3": t(10),
  "1.4": t(10),
  "1.5": t(10),
  "1.6": t(10),
  "1.7": t(10),
  T1: c(1),
  T2: c(1),
  T3: c(1),
  T4: c(1),
  T5: c(1),
  T6: c(1),
  T7: c(1),
};

const SCHEME_NAME: Record<Scheme, string> = { theory: "RCM Theory", ear: "RCM Ear", college: "College aural yr" };
const levelNum = (l: Level) => (l.scheme !== "college" && l.n === 0 ? "Prep" : String(l.n));

/** "RCM Theory 3", "RCM Ear Prep", "College aural yr 1". */
export const levelLabel = (l: Level) => `${SCHEME_NAME[l.scheme]} ${levelNum(l)}`;

/** A range for several stages: "RCM Theory 3–5", or one label per scheme if they mix. */
export function levelRange(numbers: string[]): string {
  const levels = numbers.map((n) => LEVELS[n]).filter(Boolean);
  const schemes = [...new Set(levels.map((l) => l.scheme))];
  return schemes
    .map((s) => {
      const ns = levels.filter((l) => l.scheme === s);
      const lo = ns.reduce((a, b) => (b.n < a.n ? b : a));
      const hi = ns.reduce((a, b) => (b.n > a.n ? b : a));
      return lo.n === hi.n ? levelLabel(lo) : `${SCHEME_NAME[s]} ${levelNum(lo)}–${levelNum(hi)}`;
    })
    .join(", ");
}
