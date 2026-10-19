import { MAJOR_KEYS, MINOR_KEYS, accidentalsLabel, nameOf, parseCode, prettyCode, signatureNotes, type Key } from "../drills/theory";
import type { Card, DeckDef, Shown } from "./types";

/**
 * The key-signature deck. A card is one fact (a key and a direction); the clef is chosen
 * each time it's shown, so mastery is tracked per key, not per clef.
 */

/** Core: up to four sharps or flats, which covers most music. Full: all 15 signatures. */
const inPool = (index: number, pool: string) => pool === "full" || Math.abs(MAJOR_KEYS[index].accidentals) <= 4;
const poolIndexes = (pool: string) => MAJOR_KEYS.map((_, i) => i).filter((i) => inPool(i, pool));

const keyName = (k: Key) => nameOf(parseCode(k.code));

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

type KeyCardType = "sig-major" | "sig-minor" | "key-sig";

function keyCard(type: KeyCardType, index: number, minor: boolean): Card {
  const major = MAJOR_KEYS[index];
  const rel = MINOR_KEYS[index];
  const key = minor ? rel : major;
  const acc = major.accidentals;
  const label = `${keyName(key)} ${minor ? "minor" : "major"}`;
  const id = type === "key-sig" ? `key-sig:${key.code}-${minor ? "minor" : "major"}` : `${type}:${key.code}`;
  return {
    id,
    type,
    label,
    cell: prettyCode(key.code) + (minor ? "m" : ""),
    show(pool, clef): Shown {
      const idx = poolIndexes(pool);
      if (type === "sig-major" || type === "sig-minor") {
        return {
          prompt: `Which ${minor ? "minor" : "major"} key has this signature?`,
          staff: { clef, keySig: major.code, groups: [] },
          step: minor
            ? { type: "minorKey", correct: rel.code, options: idx.map((k) => MINOR_KEYS[k].code) }
            : { type: "majorKey", correct: major.code, options: idx.map((k) => MAJOR_KEYS[k].code) },
          explain: minor
            ? `${countText(acc)}: ${keyName(major)} major, so ${keyName(rel)} minor (a minor 3rd down).${readTrick(acc, major)}`
            : `${countText(acc)}: ${keyName(major)} major.${readTrick(acc, major)}`,
        };
      }
      return {
        prompt: "How many sharps or flats?",
        display: label,
        step: { type: "accidentals", correct: String(acc), options: idx.map((k) => String(MAJOR_KEYS[k].accidentals)) },
        explain: minor
          ? `${keyName(rel)} minor is the relative minor of ${keyName(major)} major, a minor 3rd below it. They share a signature: ${countText(acc).replace(/^No/, "no")}.${buildTrick(acc, major)}`
          : `${countText(acc)}.${buildTrick(acc, major)}`,
      };
    },
  };
}

export const KEYS_DECK: DeckDef = {
  id: "keys",
  title: "Key signatures",
  summary: "Signature to key and key to signature, major and minor, treble and bass. Start with the core keys.",
  brief: "Name the key from its signature, or the signature from its key. Start with the core keys and widen the pool once most of the grid is green.",
  icon: "♯♭",
  pools: [
    { value: "core", label: "Core: up to 4 ♯ or ♭" },
    { value: "full", label: "All 15" },
  ],
  types: [
    { id: "sig-major", label: "Signature → major key", hint: "See a signature, name its major key" },
    { id: "sig-minor", label: "Signature → minor key", hint: "See a signature, name its relative minor" },
    { id: "key-sig", label: "Key → signature", hint: "See a key, say how many sharps or flats" },
  ],
  clefs: true,
  defaults: { pool: "core", types: ["sig-major"] },
  build(pool, types) {
    const cards: Card[] = [];
    for (const type of KEYS_DECK.types.map((t) => t.id as KeyCardType).filter((t) => types.includes(t))) {
      for (const i of poolIndexes(pool)) {
        if (type === "sig-major") cards.push(keyCard(type, i, false));
        if (type === "sig-minor") cards.push(keyCard(type, i, true));
        if (type === "key-sig") cards.push(keyCard(type, i, false), keyCard(type, i, true));
      }
    }
    return cards;
  },
  grid(pool, cards) {
    const rows = [
      { label: "Signature → major key", cards: cards.filter((c) => c.type === "sig-major") },
      { label: "Signature → minor key", cards: cards.filter((c) => c.type === "sig-minor") },
      { label: "Major key → signature", cards: cards.filter((c) => c.type === "key-sig" && c.id.endsWith("-major")) },
      { label: "Minor key → signature", cards: cards.filter((c) => c.type === "key-sig" && c.id.endsWith("-minor")) },
    ];
    return { cols: poolIndexes(pool).map((i) => accidentalsLabel(MAJOR_KEYS[i].accidentals)), rows: rows.filter((r) => r.cards.length) };
  },
};
