import { Signal } from "../../model/ui";
import type { Card } from "./types";

/**
 * Spaced review, Leitner style. Each card sits in a box from 0 (new or just missed) to
 * 6 (mastered). A fast correct answer moves it up a box and pushes its next review
 * further out; a slow correct answer keeps it where it is (it isn't automatic yet); a
 * miss sends it back to box 0. A card only climbs when it's due, and box 1 is due a
 * minute later, so a new card has to be right twice, a minute apart, before it's
 * spaced out by days.
 *
 * Picking is a weighted draw that favors low boxes and cards that are due, brings new
 * cards in a few at a time, and never shows the same card twice in a row.
 */

export interface CardState {
  box: number;
  /** When it's next due for review (ms since epoch). */
  due: number;
  seen: number;
  correct: number;
  /** Last answer time, in ms. */
  lastMs: number;
}

export const MAX_BOX = 6;
const MINUTE = 60_000;
const DAY = 86_400_000;
/** How long until a card in each box is due again. */
export const INTERVALS = [0, MINUTE, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
/** Answers at or under this count as fast (automatic). */
export const FAST_MS = 3000;
/** How strongly each box is favored when due. */
const BOX_WEIGHT = [8, 6, 4, 2.5, 1.6, 1.1, 0.8];
/** Cards still being learned (box 0–1) allowed at once before new cards wait. */
const LEARNING_LIMIT = 5;

const KEY = "etude.cards.v1";

function load(): Record<string, CardState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, CardState>;
  } catch {
    return {};
  }
}

export const cardStates = new Signal<Record<string, CardState>>(load());

function save(next: Record<string, CardState>) {
  cardStates.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not saved this visit.
  }
}

export type Grade = "again" | "hard" | "good";

export function gradeFor(ok: boolean, ms: number): Grade {
  return !ok ? "again" : ms <= FAST_MS ? "good" : "hard";
}

/** Apply an answer to a card's state and save it. Returns the new state. */
export function review(cardId: string, ok: boolean, ms: number, now = Date.now()): CardState {
  const prev = cardStates.value[cardId] ?? { box: 0, due: now, seen: 0, correct: 0, lastMs: 0 };
  const grade = gradeFor(ok, ms);
  const counts = { seen: prev.seen + 1, correct: prev.correct + (ok ? 1 : 0), lastMs: ms };
  let next: CardState;
  if (grade === "again") next = { ...counts, box: 0, due: now };
  // A card seen again before it's due can drop back on a miss, but doesn't climb.
  else if (prev.due > now) next = { ...counts, box: prev.box, due: prev.due };
  else {
    const box = grade === "good" ? Math.min(MAX_BOX, prev.box + 1) : Math.max(1, prev.box);
    next = { ...counts, box, due: now + INTERVALS[box] };
  }
  save({ ...cardStates.value, [cardId]: next });
  return next;
}

export function resetCards(ids: string[]) {
  const next = { ...cardStates.value };
  for (const id of ids) delete next[id];
  save(next);
}

/**
 * Choose the next card. `recent` holds ids shown most recently (newest last), so the
 * same card doesn't come straight back.
 */
export function pickNext(deck: Card[], recent: string[], mode: "smart" | "random", now = Date.now(), rand = Math.random): Card {
  const avoid = new Set(recent.slice(-(deck.length > 4 ? 2 : deck.length > 1 ? 1 : 0)));
  const candidates = deck.filter((c) => !avoid.has(c.id));
  if (mode === "random") return candidates[Math.floor(rand() * candidates.length)];

  const states = cardStates.value;
  const learning = deck.filter((c) => states[c.id] && states[c.id].box <= 1).length;
  const allowNew = learning < LEARNING_LIMIT;
  const weights = candidates.map((c) => {
    const s = states[c.id];
    if (!s) return allowNew ? 3 : 0;
    const overdue = s.due <= now;
    // Not-yet-due cards still appear now and then, mostly to keep a session going.
    return BOX_WEIGHT[s.box] * (overdue ? 3 : 0.25);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return candidates[Math.floor(rand() * candidates.length)];
  let r = rand() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export interface DeckSummary {
  total: number;
  fresh: number;
  learning: number;
  familiar: number;
  strong: number;
  mastered: number;
  due: number;
}

export const stageOf = (s: CardState | undefined) =>
  !s ? "new" : s.box <= 1 ? "learning" : s.box <= 3 ? "familiar" : s.box <= 5 ? "strong" : "mastered";

export function summarize(deck: Card[], now = Date.now()): DeckSummary {
  const states = cardStates.value;
  const sum: DeckSummary = { total: deck.length, fresh: 0, learning: 0, familiar: 0, strong: 0, mastered: 0, due: 0 };
  for (const c of deck) {
    const s = states[c.id];
    const stage = stageOf(s);
    if (stage === "new") sum.fresh++;
    else sum[stage]++;
    if (s && s.due <= now) sum.due++;
  }
  return sum;
}
