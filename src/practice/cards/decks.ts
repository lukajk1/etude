import { Signal } from "../../model/ui";
import {
  BUILD_INTERVALS_DECK,
  BUILD_TRIADS_DECK,
  CHORDS_IN_KEY_DECK,
  HEAR_CHORDS_DECK,
  HEAR_DEGREES_DECK,
  HEAR_INTERVALS_DECK,
  NAME_INTERVALS_DECK,
  NAME_TRIADS_DECK,
  NOTES_DECK,
  PROGRESSIONS_DECK,
  SCALES_DECK,
} from "./drillDecks";
import { INTERVALS_DECK } from "./intervals";
import { KEYS_DECK } from "./keys";
import type { DeckDef } from "./types";

/** In drill order, with the semitones deck beside the interval drills. */
export const DECKS: DeckDef[] = [
  NOTES_DECK,
  KEYS_DECK,
  SCALES_DECK,
  NAME_INTERVALS_DECK,
  BUILD_INTERVALS_DECK,
  INTERVALS_DECK,
  NAME_TRIADS_DECK,
  BUILD_TRIADS_DECK,
  HEAR_INTERVALS_DECK,
  HEAR_CHORDS_DECK,
  HEAR_DEGREES_DECK,
  CHORDS_IN_KEY_DECK,
  PROGRESSIONS_DECK,
];
/** The deck that practices a drill, if any. */
export const deckForDrill = (drillId: string) => DECKS.find((d) => d.drills?.includes(drillId));
export const getDeck = (id: string) => DECKS.find((d) => d.id === id);

// ---- Settings, per deck ---------------------------------------------------------

export interface DeckSettings {
  pool: string;
  types: string[];
  clef: "treble" | "bass" | "both";
  order: "smart" | "random";
  /** Pick from answer buttons, or recall the answer, reveal it and grade yourself. */
  answer: "choose" | "recall";
  /** Cards per session; 0 for no limit. */
  length: number;
}

const KEY = "etude.cards.settings.v2";
/** Before there were several decks, the key-signature settings lived here. */
const OLD_KEY = "etude.cards.settings.v1";

function load(): Record<string, Partial<DeckSettings>> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<string, Partial<DeckSettings>> | null;
    if (saved) return saved;
    const old = localStorage.getItem(OLD_KEY);
    return old ? { keys: JSON.parse(old) as Partial<DeckSettings> } : {};
  } catch {
    return {};
  }
}

const saved = new Signal<Record<string, Partial<DeckSettings>>>(load());

export function settingsFor(deck: DeckDef, all = saved.value): DeckSettings {
  const s: DeckSettings = { clef: "treble", order: "smart", answer: "choose", length: 20, ...deck.defaults, ...all[deck.id] };
  // Saved choices from an older version of a deck may no longer exist.
  if (!deck.pools.some((p) => p.value === s.pool)) s.pool = deck.defaults.pool;
  const types = [...new Set(s.types.flatMap((t) => deck.renamedTypes?.[t] ?? [t]))].filter((t) => deck.types.some((d) => d.id === t));
  s.types = types.length >= (deck.minTypes ?? 1) ? types : deck.defaults.types;
  return s;
}

export function setDeckSettings(deck: DeckDef, patch: Partial<DeckSettings>) {
  const next = { ...saved.value, [deck.id]: { ...settingsFor(deck), ...patch } };
  saved.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not saved this visit.
  }
}

export { saved as deckSettings };
