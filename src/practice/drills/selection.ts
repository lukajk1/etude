import type { Drill, Question } from "./catalog";

/**
 * Choosing a round's questions: favor ones not seen yet. Each drill keeps a count of how
 * often you've answered each distinct question; a round draws several candidates for each
 * slot and takes the least-seen one (never one already in the round), so over a few rounds
 * you meet every note, key or pattern rather than the same few again.
 */

const SEEN_KEY = "etude.seen.v1";
/** Candidates drawn per question slot. */
const CANDIDATES = 12;
/** Distinct questions remembered per drill; the least-seen are dropped beyond this. */
const MAX_PER_DRILL = 400;

type Seen = Record<string, Record<string, number>>;

function load(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Seen;
  } catch {
    return {};
  }
}

let seen: Seen = load();

function save() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Not remembered this visit.
  }
}

/**
 * What makes two questions the same: what's shown and what's asked, not the key or register
 * the audio happens to use, nor the order of the answer buttons.
 */
export const questionKey = (q: Question) => JSON.stringify([q.prompt, q.staff ?? null, q.rhythm ?? null, q.steps.map((s) => [s.type, s.correct])]);

/** `n` questions for a round, least-seen first, with no repeats within the round where avoidable. */
export function buildRound(drill: Drill, n: number): Question[] {
  seen = load(); // another tab may have added to it
  const counts = seen[drill.id] ?? {};
  const inRound = new Map<string, number>();
  const round: Question[] = [];
  for (let i = 0; i < n; i++) {
    let best: Question | null = null;
    let bestScore = Infinity;
    for (let c = 0; c < CANDIDATES; c++) {
      const q = drill.generate();
      const key = questionKey(q);
      // Repeats within the round count far more than past sightings; a little noise breaks ties.
      const score = (counts[key] ?? 0) + 100 * (inRound.get(key) ?? 0) + Math.random() * 0.5;
      if (score < bestScore) [best, bestScore] = [q, score];
    }
    const key = questionKey(best!);
    inRound.set(key, (inRound.get(key) ?? 0) + 1);
    round.push(best!);
  }
  return round;
}

/** Count a question as seen, once it's been answered. */
export function markSeen(drillId: string, q: Question) {
  const counts = { ...(seen[drillId] ?? {}) };
  const key = questionKey(q);
  counts[key] = (counts[key] ?? 0) + 1;
  const keys = Object.keys(counts);
  if (keys.length > MAX_PER_DRILL) {
    keys.sort((a, b) => counts[a] - counts[b]);
    for (const k of keys.slice(0, keys.length - MAX_PER_DRILL)) delete counts[k];
  }
  seen = { ...seen, [drillId]: counts };
  save();
}
