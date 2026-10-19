import { Signal } from "../model/ui";

/**
 * A log of the interval trainer's answers, for seeing where the misses are: low, middle
 * or high in the range, and played melodically or together.
 */

export type Mode = "up" | "down" | "together" | "up-together" | "down-together";

export interface Attempt {
  semis: number;
  mode: Mode;
  /** The lower note (MIDI). */
  low: number;
  ok: boolean;
  /** When (ms since epoch). */
  at: number;
}

const KEY = "etude.trainer.intervals.log.v1";
/** Enough for months of practice; the oldest answers drop off after this. */
const MAX = 5000;

function load(): Attempt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Attempt[];
  } catch {
    return [];
  }
}

export const attempts = new Signal<Attempt[]>(load());

function save(next: Attempt[]) {
  attempts.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not saved this visit.
  }
}

export function recordAttempt(a: Omit<Attempt, "at">) {
  save([...attempts.value, { ...a, at: Date.now() }].slice(-MAX));
}

export function clearAttempts() {
  save([]);
}

// ---- Registers -----------------------------------------------------------------------

/**
 * The trainer's notes run D3 (50) to D5 (74). An interval's register is where its two
 * notes center, in thirds of that range.
 */
export const REGISTERS = [
  { id: "low", label: "Low", hint: "centered around D3–A3" },
  { id: "middle", label: "Middle", hint: "centered around B♭3–F4" },
  { id: "high", label: "High", hint: "centered around F♯4–D5" },
] as const;
export type Register = (typeof REGISTERS)[number]["id"];

export function registerOf(low: number, semis: number): Register {
  const mid = low + semis / 2;
  return mid < 58 ? "low" : mid >= 66 ? "high" : "middle";
}

export const isMelodicOnly = (m: Mode) => m === "up" || m === "down";

export interface Tally {
  ok: number;
  n: number;
}

export function tally(list: Attempt[]): Tally {
  return { ok: list.filter((a) => a.ok).length, n: list.length };
}

// ---- Comparing two registers ------------------------------------------------------

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error under 1.5e-7). */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * How often a gap in accuracy at least this big would turn up by chance if the two
 * registers were really the same (two-proportion z test, two-sided).
 */
export function gapP(a: Tally, b: Tally): number {
  const pool = (a.ok + b.ok) / (a.n + b.n);
  const se = Math.sqrt(pool * (1 - pool) * (1 / a.n + 1 / b.n));
  if (se === 0) return 1;
  const z = (a.ok / a.n - b.ok / b.n) / se;
  return 2 * (1 - phi(Math.abs(z)));
}
