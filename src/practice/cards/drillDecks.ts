import type { TimbreId } from "../../model/types";
import {
  buildIntervalQuestion,
  buildTriadQuestion,
  chordQuestion,
  COMMON_INTERVALS,
  degreeQuestion,
  EAR_INTERVALS,
  earIntervalQuestion,
  INVERSIONS,
  nameIntervalQuestion,
  nameTriadQuestion,
  ON_STAFF,
  RARE_INTERVALS,
  READ_RANGE,
  readNoteQuestion,
  scaleKeys,
  scaleQuestion,
  SOLFEGE,
  staffNote,
  TRIAD_KINDS,
  TRIAD_ROOTS,
  triadOk,
  type EarMode,
  type Question,
} from "../drills/catalog";
import { chordInKeyQuestion, NUMERAL_NAME, NUMERALS, PROGRESSIONS, progressionLabel, progressionQuestion, progressionsUsing, type Numeral } from "../drills/harmony";
import { CADENCE_INFO, CADENCES, cadenceQuestion, type Cadence } from "../drills/cadences";
import { fragmentQuestion, PATTERNS_3, PATTERNS_4, patternFromId, patternId, solfa } from "../drills/fragments";
import { FITS, fitQuestion, HARM_CHORDS } from "../drills/harmonize";
import { NCT_INFO, nctQuestion, NCTS, type Nct } from "../drills/nct";
import { BASIC_VALUES, DOTTED_AND_RESTS, METER_LABEL, meterQuestion, noteValueQuestion, VALUES, type MeterId, type MeterStyle } from "../drills/rhythm";
import { intervalLabel, nameOf, prettyCode, randInt, type ScaleKind, type TriadQuality } from "../drills/theory";
import type { Card, DeckDef } from "./types";

/**
 * Flashcard decks for the drills. Each card is one fact (a staff position, a scale, an
 * interval, a triad), and each showing is a fresh question about it from the drill's
 * own question builder, so a weak fact comes back without the question repeating.
 */

interface FactDeck {
  id: string;
  title: string;
  summary: string;
  brief: string;
  tag: string;
  drills: string[];
  ear?: boolean;
  sounds?: TimbreId[];
  fastMs?: number;
  pools: { value: string; label: string }[];
  /** Directions or groups, each a row of the mastery grid. One means no choice. */
  types: { id: string; label: string; hint: string }[];
  defaults: { pool: string; types: string[] };
  presets?: { label: string; types: string[] }[];
  minTypes?: number;
  /** A card's saved id, if not the default. */
  cardId?(type: string, fact: string): string;
  /** One grid row for all cards, instead of a row per type. */
  oneRow?: string;
  /** Order new cards are introduced in, lowest first (default: list order). */
  rank?(type: string, fact: string): number;
  facts(type: string, pool: string): string[];
  label(type: string, fact: string): string;
  cell(type: string, fact: string): string;
  question(type: string, fact: string, pool: string, types: string[]): Question & { display?: string };
}

function factDeck(o: FactDeck): DeckDef {
  const card = (type: string, fact: string): Card => ({
    id: o.cardId?.(type, fact) ?? (o.types.length > 1 ? `${o.id}:${type}:${fact}` : `${o.id}:${fact}`),
    type,
    label: o.label(type, fact),
    cell: o.cell(type, fact),
    rank: o.rank?.(type, fact),
    show: (pool, _clef, types) => o.question(type, fact, pool, types),
  });
  return {
    id: o.id,
    title: o.title,
    summary: o.summary,
    brief: o.brief,
    icon: o.tag,
    tag: o.tag,
    drills: o.drills,
    ear: o.ear,
    sounds: o.sounds,
    fastMs: o.fastMs,
    pools: o.pools,
    types: o.types,
    clefs: false,
    defaults: o.defaults,
    presets: o.presets,
    minTypes: o.minTypes,
    build: (pool, types) => o.types.filter((t) => types.includes(t.id)).flatMap((t) => o.facts(t.id, pool).map((f) => card(t.id, f))),
    grid: (_pool, cards) => ({
      cols: [],
      rows: o.oneRow
        ? [{ label: o.oneRow, cards }]
        : o.types.map((t) => ({ label: t.label, cards: cards.filter((c) => c.type === t.id) })).filter((r) => r.cards.length),
    }),
  };
}

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
const one = (label: string) => [{ id: "all", label, hint: "" }];
const corePool = (core: string, full: string) => [
  { value: "core", label: core },
  { value: "full", label: full },
];

export const NOTES_DECK = factDeck({
  id: "notes",
  title: "Read notes",
  summary: "Every note on the treble and bass staff, each its own card.",
  brief: "Name the note on the staff. Each line and space is a card, so the ones you hesitate on come back more. Start on the staff, then add ledger lines.",
  tag: "0.1",
  drills: ["d-notes-treble", "d-notes-bass", "d-notes"],
  fastMs: 2000,
  pools: corePool("On the staff", "With ledger lines"),
  types: [
    { id: "treble", label: "Treble clef", hint: "Notes on the treble staff" },
    { id: "bass", label: "Bass clef", hint: "Notes on the bass staff" },
  ],
  defaults: { pool: "core", types: ["treble", "bass"] },
  facts: (clef, pool) => {
    const [lo, hi] = (pool === "full" ? READ_RANGE : ON_STAFF)[clef as "treble" | "bass"];
    return range(lo, hi);
  },
  label: (clef, f) => `${nameOf(staffNote(Number(f)), true)}, ${clef} clef`,
  cell: (_clef, f) => nameOf(staffNote(Number(f)), true),
  question: (clef, f) => readNoteQuestion(clef as "treble" | "bass", Number(f)),
});

const SCALE_TYPES: { id: string; kind: ScaleKind }[] = [
  { id: "major", kind: "major" },
  { id: "natural", kind: "natural minor" },
  { id: "harmonic", kind: "harmonic minor" },
  { id: "melodic", kind: "melodic minor" },
];
const kindOf = (type: string) => SCALE_TYPES.find((t) => t.id === type)!.kind;

export const SCALES_DECK = factDeck({
  id: "scales",
  title: "Scales",
  summary: "Spell a degree of each major and minor scale; each scale is a card.",
  brief: "Name a degree of a scale. Each scale is a card, asked about a different degree each time. Start with major in the core keys, then add the minor forms.",
  tag: "0.3",
  drills: ["d-scales-major", "d-scales-natural", "d-scales"],
  fastMs: 4000,
  pools: corePool("Core keys: up to 4 ♯ or ♭", "All keys"),
  types: SCALE_TYPES.map((t) => ({ id: t.id, label: t.kind[0].toUpperCase() + t.kind.slice(1), hint: `${t.kind} scales` })),
  defaults: { pool: "core", types: ["major"] },
  facts: (type, pool) =>
    scaleKeys(kindOf(type))
      .filter((k) => pool === "full" || Math.abs(k.accidentals) <= 4)
      .map((k) => k.code),
  rank: (type, code) => {
    // Fewest accidentals first, sharps before flats, as in the key-signature deck.
    const acc = scaleKeys(kindOf(type)).find((k) => k.code === code)?.accidentals ?? 7;
    return SCALE_TYPES.findIndex((t) => t.id === type) * 100 + Math.abs(acc) * 2 + (acc < 0 ? 1 : 0);
  },
  label: (type, code) => `${prettyCode(code)} ${kindOf(type)}`,
  cell: (type, code) => prettyCode(code) + (type === "major" ? "" : "m"),
  question: (type, code) => {
    const degree = randInt(2, 7);
    return { ...scaleQuestion(kindOf(type), code, degree), prompt: "Spell this scale degree.", display: `${prettyCode(code)} ${kindOf(type)}: degree ${degree}` };
  },
});

const intervalFacts = (pool: string) => (pool === "full" ? [...COMMON_INTERVALS, ...RARE_INTERVALS] : COMMON_INTERVALS);
const intervalPools = corePool("Major, minor and perfect", "Plus augmented and diminished");

export const NAME_INTERVALS_DECK = factDeck({
  id: "name-intervals",
  title: "Name intervals",
  summary: "Name intervals on the staff; each interval is a card.",
  brief: "Name the interval on the staff. Each interval is a card, shown from a different note each time, so the ones you find hard come back more.",
  tag: "0.4",
  drills: ["d-name-intervals-common", "d-name-intervals"],
  fastMs: 3000,
  pools: intervalPools,
  types: one("Intervals"),
  defaults: { pool: "core", types: ["all"] },
  facts: (_t, pool) => intervalFacts(pool),
  label: (_t, code) => intervalLabel(code),
  cell: (_t, code) => code,
  question: (_t, code, pool) => nameIntervalQuestion(code, pool === "full" ? undefined : COMMON_INTERVALS),
});

export const BUILD_INTERVALS_DECK = factDeck({
  id: "build-intervals",
  title: "Build intervals",
  summary: "Spell the note an interval above; each interval is a card.",
  brief: "Spell the note a given interval above the one shown. Each interval is a card, built from a different note each time.",
  tag: "0.5",
  drills: ["d-build-intervals-common", "d-build-intervals"],
  fastMs: 4000,
  pools: intervalPools,
  types: one("Intervals"),
  defaults: { pool: "core", types: ["all"] },
  facts: (_t, pool) => intervalFacts(pool),
  label: (_t, code) => intervalLabel(code),
  cell: (_t, code) => code,
  question: (_t, code) => buildIntervalQuestion(code),
});

const qualityTypes = TRIAD_KINDS.map((q) => ({ id: q, label: q[0].toUpperCase() + q.slice(1), hint: `${q} triads` }));

export const NAME_TRIADS_DECK = factDeck({
  id: "name-triads",
  title: "Name triads",
  summary: "Root and quality of triads; each quality and inversion is a card.",
  brief: "Name a triad's root and quality. Each quality in each position is a card, on a different root each time. Start in root position, then add inversions.",
  tag: "0.6",
  drills: ["d-name-triads-basic", "d-name-triads-keyinv", "d-name-triads"],
  fastMs: 5000,
  pools: corePool("Root position", "All inversions"),
  types: qualityTypes,
  defaults: { pool: "core", types: [...TRIAD_KINDS] },
  facts: (_q, pool) => (pool === "full" ? ["0", "1", "2"] : ["0"]),
  label: (q, inv) => `${q}, ${INVERSIONS[Number(inv)]}`,
  cell: (_q, inv) => ["root", "1st inv", "2nd inv"][Number(inv)],
  question: (q, inv) => nameTriadQuestion(q as TriadQuality, Number(inv)),
});

const NATURAL_ROOTS = ["C", "D", "E", "F", "G", "A", "B"];

export const BUILD_TRIADS_DECK = factDeck({
  id: "build-triads",
  title: "Build triads",
  summary: "Spell the 3rd and 5th of a triad; each root and quality is a card.",
  brief: "Spell a triad from its root: the 3rd, then the 5th. Each root and quality is a card. Start on the natural roots, then add the sharp and flat ones.",
  tag: "0.7",
  drills: ["d-build-triads-basic", "d-build-triads"],
  fastMs: 6000,
  pools: corePool("Natural roots", "All roots"),
  types: qualityTypes,
  defaults: { pool: "core", types: [...TRIAD_KINDS] },
  facts: (q, pool) => (pool === "full" ? TRIAD_ROOTS : NATURAL_ROOTS).filter((r) => triadOk(r, q as TriadQuality)),
  label: (q, root) => `${prettyCode(root)} ${q}`,
  cell: (_q, root) => prettyCode(root),
  question: (q, root) => buildTriadQuestion(q as TriadQuality, root),
});

const ALL_SEMIS = range(1, 12);

/** Each interval is its own type, so any set can be checked, and the answer buttons are just those. */
export const HEAR_INTERVALS_DECK = factDeck({
  id: "hear-intervals",
  title: "Hear intervals",
  summary: "Intervals by ear; pick any set to drill, like just the two 3rds.",
  brief: "Listen to two notes and name the interval. Choose how they're played (rising, falling, together as a chord, or mixed) and check the intervals to drill: the answer buttons are just those, so checking two (say, the minor and major 3rd) drills that pair. Each interval is a card, played from a different note each time.",
  tag: "0.8",
  drills: ["d-ear-ess-up", "d-ear-ess-down", "d-ear-ess-together", "d-ear-intervals-basic", "d-ear-all-up", "d-ear-all-down", "d-ear-all-together", "d-ear-intervals-all"],
  ear: true,
  // How the two notes are played; the pool value is the drills' EarMode.
  pools: [
    { value: "mixed", label: "Mixed" },
    { value: "up", label: "Rising" },
    { value: "down", label: "Falling" },
    { value: "together", label: "Together" },
  ],
  types: ALL_SEMIS.map((s) => ({ id: s, label: EAR_INTERVALS[Number(s)].label, hint: `${s} semitones` })),
  defaults: { pool: "mixed", types: ["3", "4", "5", "7", "12"] },
  presets: [
    { label: "3rds", types: ["3", "4"] },
    { label: "4th and 5th", types: ["5", "7"] },
    { label: "Essentials", types: ["3", "4", "5", "7", "12"] },
    { label: "All 12", types: ALL_SEMIS },
  ],
  minTypes: 2,
  cardId: (s) => `hear-intervals:${s}`,
  oneRow: "Intervals",
  facts: (s) => [s],
  label: (s) => EAR_INTERVALS[Number(s)].label,
  cell: (s) => EAR_INTERVALS[Number(s)].code,
  question: (s, _f, pool, types) =>
    earIntervalQuestion(
      Number(s),
      ALL_SEMIS.filter((x) => types.includes(x)).map((x) => EAR_INTERVALS[Number(x)].code),
      pool as EarMode,
    ),
});

export const HEAR_CHORDS_DECK = factDeck({
  id: "hear-chords",
  title: "Hear chord quality",
  summary: "Major, minor, diminished and augmented by ear.",
  brief: "A triad plays as a chord, then one note at a time. Name its quality. Each quality is a card.",
  tag: "0.10",
  drills: ["d-ear-chords-mm", "d-ear-chords"],
  ear: true,
  pools: [{ value: "full", label: "All four" }],
  types: one("Qualities"),
  defaults: { pool: "full", types: ["all"] },
  facts: () => [...TRIAD_KINDS],
  label: (_t, q) => q,
  cell: (_t, q) => q,
  question: (_t, q) => chordQuestion(q as TriadQuality),
});

export const HEAR_DEGREES_DECK = factDeck({
  id: "hear-degrees",
  title: "Hear scale degrees",
  summary: "Which degree of the key a note is, after a cadence; each degree is a card.",
  brief: "The key is set, then one note plays. Name its scale degree. Each degree is a card. In any key with any opening, a different chord progression sets the key each time; otherwise it's one I–IV–V–I cadence.",
  tag: "0.11",
  drills: ["d-ear-degrees-135-drone", "d-ear-degrees-135-c", "d-ear-degrees-135-keys", "d-ear-degrees-135", "d-ear-degrees-pent", "d-ear-degrees-15", "d-ear-degrees"],
  ear: true,
  pools: [
    { value: "full", label: "Any key, any opening" },
    { value: "keys", label: "Any key, after I–IV–V–I" },
    { value: "c", label: "In C" },
    { value: "drone", label: "In C, over a drone" },
  ],
  types: one("Degrees"),
  defaults: { pool: "full", types: ["all"] },
  facts: () => range(1, 7),
  rank: (_t, d) => [1, 5, 3, 4, 2, 6, 7].indexOf(Number(d)),
  label: (_t, d) => `degree ${d} (${SOLFEGE[Number(d) - 1]})`,
  cell: (_t, d) => `${d} ${SOLFEGE[Number(d) - 1]}`,
  question: (_t, d, pool) => degreeQuestion(Number(d), undefined, { inC: pool === "c" || pool === "drone", drone: pool === "drone", varied: pool === "full" }),
});

/** Each chord is its own type, so any set can be checked, like the interval deck. */
export const CHORDS_IN_KEY_DECK = factDeck({
  id: "chords-in-key",
  title: "Chords in a key",
  summary: "I, ii, iii, IV, V and vi by ear once the key is set; pick any set to drill.",
  brief: "The key is set (a different way each time), then one chord plays: name it by its role. Check the chords to drill; the answer buttons are just those. Listen to the bass note.",
  tag: "2.1",
  drills: ["h-chords-1-5", "h-chords-1-4-5", "h-chords-vi", "h-chords-all", "h-chords-iii", "h-chords-sound"],
  ear: true,
  sounds: ["strings", "brass", "woodwinds", "harp"],
  // "Any sound": a random instrument, held, clipped or rolled, as in 2.1f.
  pools: [
    { value: "full", label: "Piano" },
    { value: "any", label: "Any sound" },
  ],
  types: NUMERALS.map((n) => ({ id: n, label: `${n} (${NUMERAL_NAME[n]})`, hint: NUMERAL_NAME[n] })),
  defaults: { pool: "full", types: ["I", "V"] },
  presets: [
    { label: "I and V", types: ["I", "V"] },
    { label: "I, IV, V", types: ["I", "IV", "V"] },
    { label: "Add vi", types: ["I", "IV", "V", "vi"] },
    // The minor chords on their own: the ones that aren't I, IV or V.
    { label: "ii, iii, vi", types: ["ii", "iii", "vi"] },
    { label: "All six", types: [...NUMERALS] },
  ],
  minTypes: 2,
  cardId: (n) => `chords-in-key:${n}`,
  rank: (n) => ["I", "V", "IV", "vi", "ii", "iii"].indexOf(n),
  oneRow: "Chords",
  facts: (n) => [n],
  label: (n) => `${n} (${NUMERAL_NAME[n as Numeral]})`,
  cell: (n) => n,
  question: (n, _f, pool, types) => chordInKeyQuestion(n as Numeral, NUMERALS.filter((x) => types.includes(x)), { anySound: pool === "any" }),
});

const progressionSet = (pool: string): Numeral[] => (pool === "full" ? ["I", "ii", "IV", "V", "vi"] : ["I", "IV", "V"]);

export const PROGRESSIONS_DECK = factDeck({
  id: "progressions",
  title: "Progressions",
  summary: "Common four-chord progressions by ear; each progression is a card.",
  brief: "Four chords play, starting on I: name the other three. Each common progression is a card, in a different key each time. Start with I, IV and V.",
  tag: "2.2",
  drills: ["h-prog-basic", "h-prog-all"],
  ear: true,
  pools: corePool("I, IV and V", "With vi and ii"),
  types: one("Progressions"),
  defaults: { pool: "core", types: ["all"] },
  facts: (_t, pool) => progressionsUsing(progressionSet(pool)).map((p) => progressionLabel(p.chords)),
  label: (_t, f) => f,
  cell: (_t, f) => f,
  question: (_t, f, pool) => progressionQuestion(PROGRESSIONS.find((p) => progressionLabel(p.chords) === f)!.chords, progressionSet(pool)),
});

export const NOTE_VALUES_DECK = factDeck({
  id: "note-values",
  title: "Note values",
  summary: "How many beats each note and rest lasts; each value is a card.",
  brief: "Say how many beats a note or rest lasts, with a quarter-note beat. Start with the plain values, then add dots and rests.",
  tag: "3.1",
  drills: ["r-values-basic", "r-values-dotted"],
  fastMs: 3000,
  pools: [{ value: "full", label: "All" }],
  types: [
    { id: "basic", label: "Whole to sixteenth", hint: "Plain note values" },
    { id: "dotted", label: "Dots and rests", hint: "Dotted notes and rests" },
  ],
  defaults: { pool: "full", types: ["basic"] },
  facts: (type) => (type === "basic" ? BASIC_VALUES : DOTTED_AND_RESTS),
  label: (_t, id) => VALUES.find((v) => v.id === id)!.name,
  cell: (_t, id) => VALUES.find((v) => v.id === id)!.name.replace(/ note$/, "").replace("dotted ", "dot. "),
  question: (_t, id) => noteValueQuestion(id),
});

const METER_IDS: MeterId[] = ["2", "3", "4", "6/8"];

export const METER_DECK = factDeck({
  id: "meter",
  title: "Hear the meter",
  summary: "2/4, 3/4, 4/4 or 6/8 by ear, from an accompaniment, a melody with bass, or a melody alone.",
  brief: "Count the beats from one strong beat to the next. Check the meters to drill; the answer buttons are just those. The pool sets how much help the music gives.",
  tag: "3.2",
  drills: ["r-meter-23", "r-meter-234", "r-meter-bass", "r-meter-melody", "r-meter-compound"],
  ear: true,
  pools: [
    { value: "oompah", label: "With accompaniment" },
    { value: "bass", label: "Melody and bass" },
    { value: "melody", label: "Melody alone" },
  ],
  types: METER_IDS.map((m) => ({ id: m, label: m === "6/8" ? "6/8" : `${m} beats (${METER_LABEL[m]})`, hint: METER_LABEL[m] })),
  defaults: { pool: "oompah", types: ["2", "3"] },
  presets: [
    { label: "2 or 3", types: ["2", "3"] },
    { label: "2, 3 or 4", types: ["2", "3", "4"] },
    { label: "3/4 or 6/8", types: ["3", "6/8"] },
    { label: "All four", types: [...METER_IDS] },
  ],
  minTypes: 2,
  cardId: (m) => `meter:${m}`,
  oneRow: "Meters",
  facts: (m) => [m],
  label: (m) => METER_LABEL[m as MeterId],
  cell: (m) => METER_LABEL[m as MeterId],
  question: (m, _f, pool, types) => meterQuestion(m as MeterId, METER_IDS.filter((x) => types.includes(x)), pool as MeterStyle),
});

export const CADENCES_DECK = factDeck({
  id: "cadences",
  title: "Cadences",
  summary: "Authentic, half, plagal and deceptive by ear; pick any set.",
  brief: "Four chords play, starting on I: name how the phrase ends. Check the cadences to drill; the answer buttons are just those.",
  tag: "4.1",
  drills: ["c-cad-ah", "c-cad-ahp", "c-cad-all"],
  ear: true,
  pools: [{ value: "full", label: "Chosen cadences" }],
  types: CADENCES.map((c) => ({ id: c, label: `${CADENCE_INFO[c].label} (${CADENCE_INFO[c].chords})`, hint: CADENCE_INFO[c].sound })),
  defaults: { pool: "full", types: ["authentic", "half"] },
  presets: [
    { label: "Authentic or half", types: ["authentic", "half"] },
    { label: "Add plagal", types: ["authentic", "half", "plagal"] },
    { label: "All four", types: [...CADENCES] },
  ],
  minTypes: 2,
  cardId: (c) => `cadence:${c}`,
  oneRow: "Cadences",
  facts: (c) => [c],
  label: (c) => `${CADENCE_INFO[c as Cadence].label} cadence`,
  cell: (c) => CADENCE_INFO[c as Cadence].label,
  question: (c, _f, _pool, types) => cadenceQuestion(c as Cadence, CADENCES.filter((x) => types.includes(x))),
});

export const NCT_DECK = factDeck({
  id: "nct",
  title: "Non-chord tones",
  summary: "Passing, neighbor, appoggiatura, suspension, escape, anticipation; pick any set.",
  brief: "Three chords with a melody on top: name the second melody note by how it moves. Check the kinds to drill; the answer buttons are just those.",
  tag: "5.1",
  drills: ["n-nct-pn", "n-nct-as", "n-nct-all"],
  fastMs: 6000,
  pools: [{ value: "full", label: "Chosen kinds" }],
  types: NCTS.map((k) => ({ id: k, label: NCT_INFO[k].label, hint: NCT_INFO[k].how })),
  defaults: { pool: "full", types: ["passing", "neighbor"] },
  presets: [
    { label: "Passing or neighbor", types: ["passing", "neighbor"] },
    { label: "Add appoggiatura, suspension", types: ["passing", "neighbor", "appoggiatura", "suspension"] },
    { label: "All six", types: [...NCTS] },
  ],
  minTypes: 2,
  cardId: (k) => `nct:${k}`,
  oneRow: "Non-chord tones",
  facts: (k) => [k],
  label: (k) => NCT_INFO[k as Nct].label,
  cell: (k) => NCT_INFO[k as Nct].label.replace(" tone", ""),
  question: (k, _f, _pool, types) => nctQuestion(k as Nct, NCTS.filter((x) => types.includes(x))),
});

const SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
const fitChords = (pool: string) => (pool === "full" ? HARM_CHORDS : HARM_CHORDS.filter((c) => c !== "IV"));

export const CHORD_FIT_DECK = factDeck({
  id: "chord-fit",
  title: "Which chord fits?",
  summary: "Which of I, IV and V contain each scale degree; each degree is a card.",
  brief: "A note appears in a major key: say which chord contains it. I has do, mi, sol; IV has fa, la, do; V has sol, ti, re. Where two fit, either is right. This is the fact behind harmonizing a melody.",
  tag: "6.1",
  drills: ["m-harm-iv", "m-harm-ivv", "m-harm-long"],
  fastMs: 4000,
  pools: corePool("I and V", "I, IV and V"),
  types: one("Scale degrees"),
  defaults: { pool: "core", types: ["all"] },
  facts: (_t, pool) => ["1", "2", "3", "4", "5", "6", "7"].filter((d) => FITS[Number(d)].some((c) => fitChords(pool).includes(c))),
  label: (_t, d) => `${SOLF[Number(d) - 1]} (degree ${d})`,
  cell: (_t, d) => `${d} ${SOLF[Number(d) - 1]}`,
  rank: (_t, d) => [1, 5, 3, 2, 7, 4, 6].indexOf(Number(d)),
  question: (_t, d, pool) => fitQuestion(Number(d), fitChords(pool)),
});

export const FRAGMENTS_DECK = factDeck({
  id: "fragments",
  title: "Melodic fragments",
  summary: "Common three- and four-note patterns by scale degree, once the key is set.",
  brief: "The key is set (a different way each time), then a short fragment plays: name each note's scale degree (keys 1–7). Each common pattern is a card, in a different key each time.",
  tag: "0.12",
  drills: ["d-frag-3", "d-frag-4", "d-frag-5"],
  ear: true,
  pools: [{ value: "full", label: "All" }],
  types: [
    { id: "three", label: "Three notes, do to sol", hint: "do-re-mi, sol-fa-mi, do-mi-sol…" },
    { id: "four", label: "Four notes, with la and ti", hint: "sol-la-ti-do, mi-re-do-ti…" },
  ],
  defaults: { pool: "full", types: ["three"] },
  facts: (type) => (type === "three" ? PATTERNS_3 : PATTERNS_4).map(patternId),
  label: (_t, id) => solfa(patternFromId(id)),
  cell: (_t, id) => solfa(patternFromId(id)).replace(/ /g, "-"),
  question: (type, id) => fragmentQuestion(patternFromId(id), type === "three" ? 0.6 : 0.5, type === "three" ? ["1", "2", "3", "4", "5"] : undefined),
});
