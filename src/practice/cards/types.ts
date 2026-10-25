import type { TimbreId } from "../../model/types";
import type { AudioEvent, StaffSpec, Step } from "../drills/catalog";

/**
 * A flashcard deck: a set of facts, the card types (directions) to study them in, and
 * pools to start small. The scheduler only sees card ids, so a deck can show its cards
 * however it likes.
 */

export type Clef = "treble" | "bass";

export interface Shown {
  prompt: string;
  /** A staff to read, or else `display`, a big line of text. */
  staff?: StaffSpec;
  /** A rhythm to show, as "beats:durations". */
  rhythm?: string;
  display?: string;
  /** Notes to play when the card appears (ear cards). */
  audio?: AudioEvent[];
  /** Played after a wrong answer, or on reveal in recall mode: the note resolving to do. */
  resolve?: AudioEvent[];
  /** A shorter replay (key N): just the note, without the cadence. */
  again?: { label: string; audio: AudioEvent[] };
  /** The instrument its audio plays on (piano when unset). */
  timbre?: TimbreId;
  /** One answer, or several in order (a triad's root, then its quality). */
  steps: Step[];
  explain: string;
}

export interface Card {
  /** Stable id; progress is saved under it. */
  id: string;
  type: string;
  /** What the card is about, e.g. "E♭ major" or "perfect 5th". */
  label: string;
  /** Short text for the mastery grid. */
  cell: string;
  /** Introduction order for new cards, lowest first (default: deck order). */
  rank?: number;
  /** `types` is what's selected in the deck, for decks whose answer choices follow it. */
  show(pool: string, clef: Clef, types: string[]): Shown;
}

export interface DeckDef {
  id: string;
  title: string;
  /** One line for the home page. */
  summary: string;
  /** What to do, for the setup screen. */
  brief: string;
  /** A glyph or two for the home page row. */
  icon: string;
  pools: { value: string; label: string }[];
  types: { id: string; label: string; hint: string }[];
  /** Whether the cards are read on a staff, so the clef can be chosen. */
  clefs: boolean;
  /** Ear cards: the piano is loaded up front, and speed doesn't count. */
  ear?: boolean;
  /** Instruments besides piano its cards may use, loaded up front. */
  sounds?: TimbreId[];
  /** Answers at or under this many ms count as fast. Defaults to the scheduler's. */
  fastMs?: number;
  /** The drills this deck practices (ids), and their numbers for the home page. */
  drills?: string[];
  tag?: string;
  defaults: { pool: string; types: string[] };
  /** One-click selections of card types, e.g. "3rds only". */
  presets?: { label: string; types: string[] }[];
  /** The fewest card types that can be selected (default 1). */
  minTypes?: number;
  /** Card types that were split or renamed, so saved choices map onto the new ones. */
  renamedTypes?: Record<string, string[]>;
  build(pool: string, types: string[]): Card[];
  /** The mastery grid: column headings, then a row of cards per direction. */
  grid(pool: string, cards: Card[]): { cols: string[]; rows: { label: string; cards: Card[] }[] };
}
