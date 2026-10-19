import type { Step } from "../drills/catalog";
import { MAJOR_KEYS, MINOR_KEYS, nameOf, parseCode, signatureNotes, type Key } from "../drills/theory";
import { Signal } from "../../model/ui";

/**
 * The key-signature flashcard deck. A card is one fact (a key and a direction); the
 * clef is chosen each time it's shown, so mastery is tracked per key, not per clef.
 */

export type CardType = "sig-major" | "sig-minor" | "key-sig";
export type Pool = "core" | "full";

export interface Card {
  id: string;
  type: CardType;
  /** Index into MAJOR_KEYS / MINOR_KEYS (the two lists line up by signature). */
  index: number;
  /** Whether the card is about the minor key of the signature. */
  minor: boolean;
}

export const CARD_TYPES: { id: CardType; label: string; hint: string }[] = [
  { id: "sig-major", label: "Signature → major key", hint: "See a signature, name its major key" },
  { id: "sig-minor", label: "Signature → minor key", hint: "See a signature, name its relative minor" },
  { id: "key-sig", label: "Key → signature", hint: "See a key, say how many sharps or flats" },
];

/** Core: up to four sharps or flats, which covers most music. Full: all 15 signatures. */
export const inPool = (index: number, pool: Pool) => pool === "full" || Math.abs(MAJOR_KEYS[index].accidentals) <= 4;
export const poolIndexes = (pool: Pool) => MAJOR_KEYS.map((_, i) => i).filter((i) => inPool(i, pool));

export function buildDeck(pool: Pool, types: CardType[]): Card[] {
  const cards: Card[] = [];
  for (const type of CARD_TYPES.map((t) => t.id).filter((t) => types.includes(t))) {
    for (const index of poolIndexes(pool)) {
      const major = MAJOR_KEYS[index].code;
      const minor = MINOR_KEYS[index].code;
      if (type === "sig-major") cards.push({ id: `sig-major:${major}`, type, index, minor: false });
      if (type === "sig-minor") cards.push({ id: `sig-minor:${minor}`, type, index, minor: true });
      if (type === "key-sig") {
        cards.push({ id: `key-sig:${major}-major`, type, index, minor: false });
        cards.push({ id: `key-sig:${minor}-minor`, type, index, minor: true });
      }
    }
  }
  return cards;
}

const keyName = (k: Key) => nameOf(parseCode(k.code));

/** "Eb major", "C minor": what the card is about. */
export const cardKey = (c: Card) => `${keyName(c.minor ? MINOR_KEYS[c.index] : MAJOR_KEYS[c.index])} ${c.minor ? "minor" : "major"}`;

function countText(acc: number): string {
  const n = Math.abs(acc);
  if (n === 0) return "No sharps or flats";
  return `${n} ${acc > 0 ? (n === 1 ? "sharp" : "sharps") : n === 1 ? "flat" : "flats"} (${signatureNotes(acc)})`;
}

/** The quick rule that finds the major key from a signature. */
function readTrick(acc: number, major: Key): string {
  if (acc === 0) return "";
  if (acc > 0) {
    const last = signatureNotes(acc).split(", ").pop();
    return ` Trick: a half step above the last sharp (${last}) is ${keyName(major)}.`;
  }
  if (acc === -1) return " One flat is F major, the one to just memorize.";
  const flats = signatureNotes(acc).split(", ");
  return ` Trick: the second-to-last flat (${flats[flats.length - 2]}) names the key.`;
}

/** The same rules run backwards, to build a signature from a key. */
function buildTrick(acc: number, major: Key): string {
  if (acc === 0) return "";
  if (acc > 0) return ` Trick: the last sharp is a half step below ${keyName(major)}, so add sharps (F C G D A E B) until you reach it.`;
  if (acc === -1) return " F major is the one-flat key to memorize.";
  return ` Trick: add flats (B E A D G C F) until you've written ${keyName(major)}, then add one more.`;
}

export interface Shown {
  prompt: string;
  /** Key signature to draw (a major-key code), or none for "key → signature" cards. */
  keySig?: string;
  step: Step;
  explain: string;
}

/** What to show for a card, with answer choices limited to the pool. */
export function showCard(card: Card, pool: Pool): Shown {
  const major = MAJOR_KEYS[card.index];
  const minor = MINOR_KEYS[card.index];
  const acc = major.accidentals;
  const idx = poolIndexes(pool);
  const relative = `${keyName(minor)} minor is the relative minor of ${keyName(major)} major, a minor 3rd below it.`;

  if (card.type === "sig-major") {
    return {
      prompt: "Which major key has this signature?",
      keySig: major.code,
      step: { type: "majorKey", correct: major.code, options: idx.map((k) => MAJOR_KEYS[k].code) },
      explain: `${countText(acc)}: ${keyName(major)} major.${readTrick(acc, major)}`,
    };
  }
  if (card.type === "sig-minor") {
    return {
      prompt: "Which minor key has this signature?",
      keySig: major.code,
      step: { type: "minorKey", correct: minor.code, options: idx.map((k) => MINOR_KEYS[k].code) },
      explain: `${countText(acc)}: ${keyName(major)} major, so ${keyName(minor)} minor (a minor 3rd down).${readTrick(acc, major)}`,
    };
  }
  return {
    prompt: "How many sharps or flats?",
    step: { type: "accidentals", correct: String(acc), options: idx.map((k) => String(MAJOR_KEYS[k].accidentals)) },
    explain: card.minor
      ? `${relative} They share a signature: ${countText(acc).replace(/^No/, "no")}.${buildTrick(acc, major)}`
      : `${countText(acc)}.${buildTrick(acc, major)}`,
  };
}

// ---- Settings ---------------------------------------------------------------------

export interface CardSettings {
  pool: Pool;
  types: CardType[];
  clef: "treble" | "bass" | "both";
  order: "smart" | "random";
  /** Pick from answer buttons, or recall the answer, reveal it and grade yourself. */
  answer: "choose" | "recall";
  /** Cards per session; 0 for no limit. */
  length: number;
}

const SETTINGS_KEY = "etude.cards.settings.v1";
const DEFAULT_SETTINGS: CardSettings = { pool: "core", types: ["sig-major"], clef: "treble", order: "smart", answer: "choose", length: 20 };

function loadSettings(): CardSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<CardSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const cardSettings = new Signal<CardSettings>(loadSettings());

export function setCardSettings(patch: Partial<CardSettings>) {
  const next = { ...cardSettings.value, ...patch };
  cardSettings.set(next);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Not saved this visit.
  }
}
