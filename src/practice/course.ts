import { DRILLS, type Drill } from "./drills/catalog";
import { EXERCISES } from "./exercises/catalog";
import { PASS_SCORE } from "./exercises/grade";
import type { Progress } from "./exercises/state";
import { gradeOf, LEVELS } from "./levels";
import type { Route } from "./route";
import { TR_PASS } from "./transcription/grade";
import { STAGES } from "./transcription/melodies";

/**
 * The course: every stage (drills, melodic dictation, counterpoint exercises) by unit and
 * topic, the recommended order between them, the level each is listed under, and the
 * number it's shown with. Stages keep their internal numbers ("0.11c", "T2") as ids; what
 * you see is level and position, "3.4" or "P.1", from `displayNumber`.
 */

export interface Item {
  route: Route;
  number: string;
  title: string;
  summary: string;
  /** What sets it apart within its topic ("treble clef"), for the topic row. */
  detail: string;
  /** What it takes to pass. */
  pass: string;
}

export interface Topic {
  number: string;
  title: string;
  /** What the topic asks of you, shown above its stages. */
  about: string;
  items: Item[];
}

export interface Unit {
  title: string;
  /** Its category tag on stages in the course, which is grouped by level. */
  kind: string;
  topics: Topic[];
}

/** Drills by topic: "0.1a Read notes: treble clef" is topic 0.1, "Read notes", checkpoint a. */
const drillPass = (d: Drill) => `${Math.round(d.pass.accuracy * 100)}% correct${d.pass.medianSec ? `, answering in ${d.pass.medianSec} s or less` : ""}`;

function drillTopics(filter: (d: Drill) => boolean): Topic[] {
  const topics: Topic[] = [];
  for (const d of DRILLS.filter(filter)) {
    const number = d.number.replace(/[a-z]$/, "");
    const [title, detail = d.summary] = d.title.split(": ");
    let t = topics.find((x) => x.number === number);
    if (!t) topics.push((t = { number, title, about: "", items: [] }));
    // The full drill (the last stage) has the most complete instructions.
    t.about = d.brief;
    t.items.push({ route: { kind: "drill", id: d.id }, number: d.number, title: d.title, summary: d.summary, detail, pass: drillPass(d) });
  }
  return topics;
}

const SPECIES_ABOUT: Record<string, string> = {
  "Cantus firmus": "Write a plain melody in whole notes: mostly stepwise, one high point, starting and ending on the tonic. Later exercises build lines against melodies like this.",
  "First species": "Note against note: one note of yours for each note of the given melody. Every pair must be consonant, with mostly contrary motion and no parallel 5ths or octaves.",
  "Second species": "Two notes of yours for each given note. Downbeats must be consonant; the notes in between can be passing tones that fill a 3rd by step.",
  Exercises: "",
};

function counterpointTopics(): Topic[] {
  const kind = (title: string) => (/cantus firmus/i.test(title) ? "Cantus firmus" : /first species/i.test(title) ? "First species" : /second species/i.test(title) ? "Second species" : "Exercises");
  const topics: Topic[] = [];
  for (const e of EXERCISES) {
    const title = kind(e.title);
    let t = topics.find((x) => x.title === title);
    if (!t) topics.push((t = { number: e.number, title, about: SPECIES_ABOUT[title], items: [] }));
    t.items.push({ route: { kind: "exercise", id: e.id }, number: e.number, title: e.title, summary: e.summary, detail: e.title, pass: `no errors, and a score of ${PASS_SCORE} or more` });
  }
  return topics;
}

export const UNITS: Unit[] = [
  { title: "Foundations: reading and theory", kind: "Reading", topics: drillTopics((d) => !d.ear && !d.unit) },
  { title: "Foundations: ear training", kind: "Ear", topics: drillTopics((d) => d.ear && !d.unit) },
  { title: "Rhythm and meter", kind: "Rhythm", topics: drillTopics((d) => d.unit === "rhythm") },
  {
    title: "Transcription",
    kind: "Transcription",
    topics: [
      {
        number: "T",
        title: "Melodic dictation",
        about:
          "A new, unfamiliar melody plays and you write it down in a piano roll, with the key, meter and first note given. Each stage widens the range, leaps, keys and rhythms, and later stages limit the plays as a dictation exam does. Checking explains each wrong note and shows the melody in notation.",
        items: STAGES.map((st) => ({
          route: { kind: "transcribe", id: st.id },
          number: st.number,
          title: st.title,
          summary: st.summary,
          detail: st.title.replace(/^Melodic dictation: /, ""),
          pass: `a score of ${TR_PASS} or more${Number.isFinite(st.plays) ? `, in ${st.plays} plays or fewer` : ""}`,
        })),
      },
    ],
  },
  { title: "Hearing harmony", kind: "Harmony", topics: drillTopics((d) => d.unit === "harmony") },
  { title: "Cadences", kind: "Cadences", topics: drillTopics((d) => d.unit === "cadences") },
  { title: "Non-chord tones", kind: "Non-chord tones", topics: drillTopics((d) => d.unit === "nct") },
  { title: "Harmonizing a melody", kind: "Harmonizing", topics: drillTopics((d) => d.unit === "harmonize") },
  { title: "Counterpoint essentials", kind: "Counterpoint", topics: counterpointTopics() },
];

export const routeId = (r: Route) => (r.kind === "home" ? "" : r.id);
export const unitItems = (u: Unit) => u.topics.flatMap((t) => t.items);

/**
 * The recommended order: what's worth passing before a stage, by number. Stages within a
 * topic also go in order (a before b). Nothing is locked; stages that aren't ready yet are
 * just dimmed and say what comes first.
 */
const PREREQS: Record<string, string[]> = {
  "0.3a": ["0.2a"], // a scale is its key signature, written out
  "0.3b": ["0.2b"],
  "0.4a": ["0.1c", "0.3a"], // read the notes; the major scale gives each interval's quality
  "0.5a": ["0.4a"],
  "0.6a": ["0.4a"], // triads are stacked 3rds
  "0.7a": ["0.5a", "0.6a"],
  "0.9a": ["0.8a"],
  "0.9b": ["0.8b"],
  "0.9c": ["0.8c"],
  "0.9d": ["0.8d"],
  "0.10a": ["0.8a"], // major and minor chords differ by their 3rd
  "0.12a": ["0.11f"], // fragments are scale degrees in a row
  "0.13a": ["0.8a"], // intervals in a melody, after hearing them alone
  "0.14a": ["0.2b", "0.3a"], // the rarer keys, once the core ones and scales are solid
  "2.1a": ["0.11d"], // a chord's bass note is a scale degree
  "2.2a": ["2.1b"],
  "2.2b": ["2.1d"],
  "3.3a": ["3.1a"], // read the values before hearing them
  "3.4a": ["3.1a"],
  "4.1a": ["2.1b"], // a cadence is chords: I, IV and V by ear first
  "5.1a": ["0.6a"], // spotting the note outside a chord means reading the chord
  "6.1a": ["0.7a"], // choosing a chord means knowing what's in each one
  T2: ["0.11d"], // skips in the tonic chord: hear do, mi and sol first
  T3: ["0.11f", "0.3a"],
  T4: ["0.3b", "0.11g"], // minor: the natural minor scale, and every degree by ear
  T5: ["0.13a"], // wide leaps in a melody
  "1.1": ["0.4a"],
  "1.3": ["1.1"],
  "1.6": ["1.3"],
};

export const ALL_ITEMS = new Map(UNITS.flatMap(unitItems).map((it) => [it.number, it]));

/** Numbers of the stages to pass before this one: listed ones, plus the one before it in its topic. */
export function prereqsOf(it: Item): string[] {
  const topic = UNITS.flatMap((u) => u.topics).find((t) => t.items.includes(it))!;
  const i = topic.items.indexOf(it);
  return [...(PREREQS[it.number] ?? []), ...(i > 0 ? [topic.items[i - 1].number] : [])];
}

const gradeCache = new Map<string, number>();

/** The level a stage is listed under: its own, raised if needed so nothing comes before what it builds on. */
export function stageGrade(it: Item): number {
  const hit = gradeCache.get(it.number);
  if (hit !== undefined) return hit;
  const own = LEVELS[it.number] ? gradeOf(LEVELS[it.number]) : 10;
  const before = prereqsOf(it).map((n) => ALL_ITEMS.get(n)).filter((p): p is Item => !!p);
  const g = Math.max(own, ...before.map(stageGrade));
  gradeCache.set(it.number, g);
  return g;
}

export const unmetPrereqs = (it: Item, prog: Record<string, Progress>) =>
  prereqsOf(it).filter((n) => {
    const p = ALL_ITEMS.get(n);
    return p && !prog[routeId(p.route)]?.passed;
  });

/** "3.2 Hear scale degrees: do, mi, sol in C, 3.5 …": prerequisites by their shown numbers. */
export const prereqText = (nums: string[]) => nums.map((n) => `${displayNumber(n)} ${ALL_ITEMS.get(n)?.title ?? ""}`.trim()).join(", ");

// ---- Display numbers ----------------------------------------------------------------------

/** Every stage in course order: by level, then unit order, then order within the unit. */
export const COURSE: { it: Item; unit: Unit; grade: number }[] = UNITS.flatMap((u) => unitItems(u).map((it) => ({ it, unit: u, grade: stageGrade(it) })))
  .map((row, i) => ({ row, i }))
  .sort((x, y) => x.row.grade - y.row.grade || x.i - y.i)
  .map(({ row }) => row);

const DISPLAY = new Map<string, string>();
{
  const count = new Map<number, number>();
  for (const { it, grade } of COURSE) {
    const k = (count.get(grade) ?? 0) + 1;
    count.set(grade, k);
    DISPLAY.set(it.number, `${grade === 0 ? "P" : grade}.${k}`);
  }
}

/** The number a stage is shown with: its level, then its place in that level ("3.4", "P.1"). */
export const displayNumber = (internal: string) => DISPLAY.get(internal) ?? internal;

// ---- Permanent codes ----------------------------------------------------------------------

/** No 0/O or 1/I, so a code reads back unambiguously. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A stage's permanent short code ("K7Q"): a hash of its id, so it looks random, never
 * changes when stages are renumbered, and new stages get one without a list to keep.
 */
export function stageCode(id: string): string {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return [0, 5, 10].map((shift) => CODE_CHARS[(h >>> shift) & 31]).join("");
}

const BY_ID = new Map(COURSE.map((row) => [routeId(row.it.route), row]));

/** A skill's slug, for classes and routes: "Non-chord tones" → "non-chord-tones". */
export const skillSlug = (skill: string) => skill.toLowerCase().replace(/\s+/g, "-");

/** The CSS class that colors a skill tag: "Non-chord tones" → "skill-non-chord-tones". */
export const skillClass = (skill: string) => `skill-${skillSlug(skill)}`;

/** Every skill (a unit's tag), in course order. */
export const SKILLS = UNITS.map((u) => u.kind);

/** A stage by its drill, melody-stage or exercise id. */
export const stageById = (id: string) => BY_ID.get(id);

/** The next stage in course order after this one, if any. */
export function nextStage(id: string): Item | undefined {
  const row = BY_ID.get(id);
  return row ? COURSE[COURSE.indexOf(row) + 1]?.it : undefined;
}
