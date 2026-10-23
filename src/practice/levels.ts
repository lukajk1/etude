/**
 * Rough levels for each stage, on the scales most used in the US and Canada: the Royal
 * Conservatory (RCM) theory levels and the ear tests in its practical levels, and, for what
 * RCM doesn't test (scale degrees, dictation, meter, transcription), first-year college aural
 * skills. These are approximate matches by content, not an official mapping.
 *
 * The course is grouped on one ladder, 0 to 10, set by the RCM theory levels. Ear skills are
 * placed on it by first-year college pacing instead of RCM's: RCM's ear tests are paced for
 * children over a decade of piano exams (all intervals only around Level 8), while a college
 * course, or an adult learner, covers them in the first year. Their RCM level stays as a tag.
 */

export type Scheme = "theory" | "ear" | "college";

export interface Level {
  scheme: Scheme;
  /** RCM level (0 for Preparatory), or college year. */
  n: number;
  /** Where it sits on the ladder the course is grouped by, when that isn't `n`: ear skills by college pacing, and college skills by difficulty. */
  grade?: number;
}

const t = (n: number): Level => ({ scheme: "theory", n });
/** An RCM ear test (level `n`), placed on the ladder at `grade` by first-year college pacing. */
const e = (n: number, grade: number): Level => ({ scheme: "ear", n, grade });
/** A first-year college aural skill, placed at the RCM level it fits by difficulty. */
const c = (grade: number): Level => ({ scheme: "college", n: 1, grade });

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
  // Ear tests (RCM level, then the college-paced level): intervals ascending first, then descending and harmonic.
  "0.8a": e(2, 2),
  "0.8b": e(4, 3),
  "0.8c": e(4, 3),
  "0.8d": e(4, 3),
  "0.9a": e(8, 4),
  "0.9b": e(8, 5),
  "0.9c": e(9, 5),
  "0.9d": e(9, 6),
  "0.10a": e(1, 1),
  "0.10b": e(6, 4),
  "0.11a": c(2),
  "0.11b": c(2),
  "0.11c": c(3),
  "0.11d": c(3),
  "0.11e": c(4),
  "0.11f": c(4),
  "0.11g": c(5),
  "0.12a": c(4),
  "0.12b": c(5),
  "0.12c": c(6),
  "0.13a": c(4),
  "0.13b": c(6),
  // Hearing harmony and cadences: the chord-progression ear tests.
  "2.1a": e(5, 3),
  "2.1b": e(6, 4),
  "2.1c": e(8, 4),
  "2.1d": e(9, 5),
  "2.2a": e(6, 4),
  "2.2b": e(9, 5),
  "4.1a": e(7, 4),
  "4.1b": e(8, 5),
  "4.1c": e(9, 5),
  // Rhythm: note values are theory; tapping is the clapback ear test.
  "3.1a": t(2),
  "3.1b": t(3),
  "3.1c": t(2),
  "3.2a": c(1),
  "3.2b": c(2),
  "3.2c": c(3),
  "3.2d": c(4),
  "3.2e": c(5),
  "3.3a": c(2),
  "3.3b": c(3),
  "3.3c": c(5),
  "3.4a": e(1, 2),
  "3.4b": e(2, 3),
  "3.4c": e(5, 5),
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
  // Melodic dictation: steps from do, then tonic skips, the whole scale, minor, longer with pickups.
  T1: c(2),
  T2: c(3),
  T3: c(4),
  T4: c(5),
  T5: c(6),
};

const SCHEME_NAME: Record<Scheme, string> = { theory: "RCM Theory", ear: "RCM Ear", college: "College aural yr" };
const levelNum = (l: Level) => (l.scheme !== "college" && l.n === 0 ? "Prep" : String(l.n));

/** The level a stage is grouped under, 0 (Preparatory) to 10. */
export const gradeOf = (l: Level) => l.grade ?? l.n;
export const gradeName = (g: number) => (g === 0 ? "Preparatory" : `Level ${g}`);

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
