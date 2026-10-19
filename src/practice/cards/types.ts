import type { StaffSpec, Step } from "../drills/catalog";

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
  display?: string;
  step: Step;
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
  show(pool: string, clef: Clef): Shown;
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
  defaults: { pool: string; types: string[] };
  build(pool: string, types: string[]): Card[];
  /** The mastery grid: column headings, then a row of cards per direction. */
  grid(pool: string, cards: Card[]): { cols: string[]; rows: { label: string; cards: Card[] }[] };
}
