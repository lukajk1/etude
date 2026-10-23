import { useRef, useState } from "react";
import { exportProgress, importProgress, lastBackup } from "../lib/backup";
import { useSignal } from "../model/ui";
import { DECKS, deckSettings, settingsFor } from "./cards/decks";
import { cardStates, summarize } from "./cards/srs";
import { DRILLS, type Drill } from "./drills/catalog";
import { EXERCISES, ROADMAP } from "./exercises/catalog";
import { PASS_SCORE } from "./exercises/grade";
import { progress, type Progress } from "./exercises/state";
import { gradeName, gradeOf, levelLabel, levelRange, LEVELS } from "./levels";
import { GOAL_STAGES, PLAN_GOAL, TUCKED_DECKS, TUCKED_UNITS } from "./plan";
import { go, type Route } from "./route";
import { TR_PASS } from "./transcription/grade";
import { STAGES } from "./transcription/melodies";

/**
 * The Practice Room home: what to do today, then the course as compact topic rows with a
 * chip per checkpoint, the flashcard decks as tiles, and the roadmap and backups at the end.
 */

interface Item {
  route: Route;
  number: string;
  title: string;
  summary: string;
  /** What sets it apart within its topic ("treble clef"), for the topic row. */
  detail: string;
  /** What it takes to pass. */
  pass: string;
}

interface Topic {
  number: string;
  title: string;
  /** What the topic asks of you, shown above its stages. */
  about: string;
  items: Item[];
}

interface Unit {
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

const UNITS: Unit[] = [
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

const routeId = (r: Route) => (r.kind === "home" ? "" : r.id);
const unitItems = (u: Unit) => u.topics.flatMap((t) => t.items);

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
  "0.12a": ["0.11d"], // fragments are scale degrees in a row
  "0.13a": ["0.8a"], // intervals in a melody, after hearing them alone
  "0.14a": ["0.2b", "0.3a"], // the rarer keys, once the core ones and scales are solid
  "2.1a": ["0.11c"], // a chord's bass note is a scale degree
  "2.2a": ["2.1b"],
  "2.2b": ["2.1d"],
  "3.3a": ["3.1a"], // read the values before hearing them
  "3.4a": ["3.1a"],
  "4.1a": ["2.1b"], // a cadence is chords: I, IV and V by ear first
  "5.1a": ["0.6a"], // spotting the note outside a chord means reading the chord
  "6.1a": ["0.7a"], // choosing a chord means knowing what's in each one
  T2: ["0.11c"], // skips in the tonic chord: hear do, mi and sol first
  T3: ["0.11d", "0.3a"],
  T4: ["0.3b", "0.11e"], // minor: the natural minor scale, and every degree by ear
  T5: ["0.13a"], // wide leaps in a melody
  "1.1": ["0.4a"],
  "1.3": ["1.1"],
  "1.6": ["1.3"],
};

const ALL_ITEMS = new Map(UNITS.flatMap(unitItems).map((it) => [it.number, it]));

/** Numbers of the stages to pass before this one: listed ones, plus the one before it in its topic. */
function prereqsOf(it: Item): string[] {
  const topic = UNITS.flatMap((u) => u.topics).find((t) => t.items.includes(it))!;
  const i = topic.items.indexOf(it);
  return [...(PREREQS[it.number] ?? []), ...(i > 0 ? [topic.items[i - 1].number] : [])];
}

const gradeCache = new Map<string, number>();

/** The level a stage is listed under: its own, raised if needed so nothing comes before what it builds on. */
function stageGrade(it: Item): number {
  const hit = gradeCache.get(it.number);
  if (hit !== undefined) return hit;
  const own = LEVELS[it.number] ? gradeOf(LEVELS[it.number]) : 10;
  const before = prereqsOf(it).map((n) => ALL_ITEMS.get(n)).filter((p): p is Item => !!p);
  const g = Math.max(own, ...before.map(stageGrade));
  gradeCache.set(it.number, g);
  return g;
}

const unmetPrereqs = (it: Item, prog: Record<string, Progress>) =>
  prereqsOf(it).filter((n) => {
    const p = ALL_ITEMS.get(n);
    return p && !prog[routeId(p.route)]?.passed;
  });

const prereqText = (nums: string[]) => nums.map((n) => `${n} ${ALL_ITEMS.get(n)?.title ?? ""}`.trim()).join(", ");

function statusText(p?: Progress) {
  return !p ? "not started" : p.passed ? "passed" : `best ${p.best}%`;
}

/** A checkpoint's chip label: its letter within the topic, or its own number. */
const chipLabel = (topic: Topic, it: Item) => (/[a-z]$/.test(it.number) && it.number.startsWith(topic.number) ? it.number.slice(-1) : it.number);

const EXPANDED_KEY = "etude.home.expanded";

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

const topicKey = (t: Topic) => `${t.number} ${t.title}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function TopicRow({ topic, prog, open, onToggle }: { topic: Topic; prog: Record<string, Progress>; open: boolean; onToggle: () => void }) {
  const next = topic.items.find((it) => !prog[routeId(it.route)]?.passed);
  // Mark the next checkpoint only in topics already underway, so untouched ones stay quiet.
  const started = topic.items.some((it) => prog[routeId(it.route)]);
  const nextUnmet = next ? unmetPrereqs(next, prog) : [];
  const level = levelRange(topic.items.map((it) => it.number));
  /** A stage's status class: passed, tried, the next one up, or not ready yet. */
  const chipClass = (it: Item, markNext: boolean) => {
    const p = prog[routeId(it.route)];
    if (p?.passed) return " is-pass";
    if (p) return " is-tried";
    if (unmetPrereqs(it, prog).length) return " is-later";
    return markNext && it === next ? " is-next" : "";
  };
  return (
    <li className={`pr-topic${open ? " is-open" : ""}`}>
      <button className="pr-topic-main" onClick={onToggle} aria-expanded={open} title={open ? "Hide the stages" : "Show the stages"}>
        <span className="pr-num">{topic.number}</span>
        <span className="pr-topic-text">
          <span className="pr-row-title">
            {topic.title} <span className="pr-caret">{open ? "▾" : "▸"}</span>
            {level && <span className="pr-level">≈ {level}</span>}
          </span>
          <span className="pr-row-summary">
            {!next ? "All passed" : nextUnmet.length ? `Next: ${next.detail}, after ${nextUnmet.join(" and ")}` : `Next: ${next.detail}`}
          </span>
        </span>
      </button>
      <span className="pr-chips">
        {topic.items.map((it) => {
          const p = prog[routeId(it.route)];
          const unmet = unmetPrereqs(it, prog);
          const title = `${it.number} ${it.title}: ${statusText(p)}${!p && unmet.length ? `; first: ${unmet.join(", ")}` : ""}`;
          return (
            <button key={it.number} className={`pr-chip${chipClass(it, started)}`} title={title} onClick={() => go(it.route)}>
              {chipLabel(topic, it)}
            </button>
          );
        })}
      </span>
      {open && topic.about && <p className="pr-topic-about">{topic.about}</p>}
      {open && (
        <ol className="pr-stages">
          {topic.items.map((it) => {
            const p = prog[routeId(it.route)];
            const unmet = p ? [] : unmetPrereqs(it, prog);
            return (
              <li key={it.number}>
                <button className={`pr-stage${unmet.length ? " is-later" : ""}`} onClick={() => go(it.route)}>
                  <span className={`pr-chip${chipClass(it, true)}`}>{chipLabel(topic, it)}</span>
                  <span className="pr-stage-text">
                    <span className="pr-stage-title">{capital(it.detail)}</span>
                    <span className="pr-row-summary">{it.summary}</span>
                    <span className="pr-stage-pass">
                      To pass: {it.pass}.{LEVELS[it.number] && ` Level: about ${levelLabel(LEVELS[it.number])}.`}
                    </span>
                    {unmet.length > 0 && <span className="pr-stage-first">Best after: {prereqText(unmet)}.</span>}
                  </span>
                  <span className={`pr-stage-status${p?.passed ? " is-pass" : ""}`}>{p ? (p.passed ? "Passed" : `Best ${p.best}%`) : it === next && !unmet.length ? "Next" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

/** A stage in the course by level, with the unit it comes from as its tag. */
interface LevelRow {
  it: Item;
  tag: string;
}

const LEVELS_KEY = "etude.home.levels";

function loadOpenLevels(): Set<number> | null {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

/** One level of the course: its stages from every unit, each tagged with its unit and source scale. */
function LevelCard({ grade, rows, prog, open, onToggle }: { grade: number; rows: LevelRow[]; prog: Record<string, Progress>; open: boolean; onToggle: () => void }) {
  const done = rows.filter((r) => prog[routeId(r.it.route)]?.passed).length;
  const tags = [...new Set(rows.map((r) => r.tag))];
  return (
    <div className={`pr-level-card${open ? " is-open" : ""}`}>
      <button className="pr-level-head" onClick={onToggle} aria-expanded={open}>
        <h3>
          {gradeName(grade)} <span className="pr-caret">{open ? "▾" : "▸"}</span>
        </h3>
        <span className="pr-level-tags">{tags.join(" · ")}</span>
        <span className="pr-dim">
          {done} of {rows.length}
        </span>
      </button>
      {open && (
        <ol className="pr-stages pr-level-stages">
          {rows.map(({ it, tag }) => {
            const p = prog[routeId(it.route)];
            const unmet = p ? [] : unmetPrereqs(it, prog);
            const chip = p?.passed ? " is-pass" : p ? " is-tried" : unmet.length ? " is-later" : " is-next";
            const level = LEVELS[it.number];
            return (
              <li key={it.number}>
                <button className={`pr-stage${unmet.length ? " is-later" : ""}`} onClick={() => go(it.route)}>
                  <span className={`pr-chip${chip}`}>{it.number}</span>
                  <span className="pr-stage-text">
                    <span className="pr-stage-title">
                      {it.title}
                      <span className="pr-stage-tag">{tag}</span>
                      {level && <span className="pr-level">≈ {levelLabel(level)}</span>}
                    </span>
                    <span className="pr-row-summary">{it.summary}</span>
                    <span className="pr-stage-pass">To pass: {it.pass}.</span>
                    {unmet.length > 0 && <span className="pr-stage-first">Best after: {prereqText(unmet)}.</span>}
                  </span>
                  <span className={`pr-stage-status${p?.passed ? " is-pass" : ""}`}>{p ? (p.passed ? "Passed" : `Best ${p.best}%`) : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function Home() {
  const prog = useSignal(progress);
  const cardPrefs = useSignal(deckSettings);
  useSignal(cardStates);
  const [expanded, setExpanded] = useState(loadExpanded);
  const saveExpanded = (next: Set<string>) => {
    setExpanded(next);
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
    } catch {
      // Just not remembered.
    }
  };
  const toggle = (k: string) => {
    const next = new Set(expanded);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    saveExpanded(next);
  };

  // Progress counts the units in focus; the composition track is tucked away below.
  const focusUnits = UNITS.filter((u) => !TUCKED_UNITS.includes(u.title));
  const tuckedUnits = UNITS.filter((u) => TUCKED_UNITS.includes(u.title));
  const all = focusUnits.flatMap(unitItems);
  const passed = all.filter((it) => prog[routeId(it.route)]?.passed).length;

  // The course by level: every focus stage, in course order within its level.
  const byLevel = new Map<number, LevelRow[]>();
  for (const u of focusUnits)
    for (const it of unitItems(u)) {
      const g = stageGrade(it);
      byLevel.set(g, [...(byLevel.get(g) ?? []), { it, tag: u.kind }]);
    }
  const grades = [...byLevel.keys()].sort((a, b) => a - b);
  // Until levels are opened or closed by hand, open the first two with anything left to pass.
  const [savedLevels, setSavedLevels] = useState(loadOpenLevels);
  const openLevels =
    savedLevels ?? new Set(grades.filter((g) => byLevel.get(g)!.some((r) => !prog[routeId(r.it.route)]?.passed)).slice(0, 2));
  const saveLevels = (next: Set<number>) => {
    setSavedLevels(next);
    try {
      localStorage.setItem(LEVELS_KEY, JSON.stringify([...next]));
    } catch {
      // Just not remembered.
    }
  };
  const toggleLevel = (g: number) => {
    const next = new Set(openLevels);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    saveLevels(next);
  };
  const allLevelsOpen = grades.every((g) => openLevels.has(g));

  const decks = DECKS.map((deck) => {
    const prefs = settingsFor(deck, cardPrefs);
    return { deck, sum: summarize(deck.build(prefs.pool, prefs.types)) };
  });

  const unitCard = (u: Unit) => {
    const items = unitItems(u);
    const done = items.filter((it) => prog[routeId(it.route)]?.passed).length;
    return (
      <div key={u.title} className="pr-unit-card">
        <div className="pr-unit-head">
          <h3>{u.title}</h3>
          <span className="pr-dim">
            {done} of {items.length}
          </span>
        </div>
        <ul className="pr-topics">
          {u.topics.map((t) => (
            <TopicRow key={topicKey(t)} topic={t} prog={prog} open={expanded.has(topicKey(t))} onToggle={() => toggle(topicKey(t))} />
          ))}
        </ul>
      </div>
    );
  };
  const deckTile = ({ deck, sum }: (typeof decks)[number]) => (
    <button key={deck.id} className="pr-deck" onClick={() => go({ kind: "cards", id: deck.id })}>
      <span className="pr-deck-top">
        <span className="pr-deck-tag">{deck.tag ?? deck.icon}</span>
        <span className="pr-deck-title">{deck.title}</span>
      </span>
      <span className={`pr-deck-status${sum.mastered === sum.total ? " is-pass" : ""}`}>
        {sum.fresh === sum.total ? "Not started" : `${sum.mastered} of ${sum.total} mastered`}
      </span>
    </button>
  );

  return (
    <main className="pr-home">
      <section className="pr-hero">
        <div className="pr-hero-top">
          <h1>Practice Room</h1>
        </div>
      </section>

      <PlanSection prog={prog} />

      <section>
        <div className="pr-course-head">
          <h2 className="pr-h2">Course</h2>
          <span className="pr-dim pr-course-count">
            {passed} of {all.length} passed
          </span>
          <button className="btn pr-expand" onClick={() => saveLevels(allLevelsOpen ? new Set() : new Set(grades))}>
            {allLevelsOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <p className="pr-blurb">
          Every stage, grouped by level. Levels follow the Royal Conservatory (RCM) theory levels; ear skills are placed by first-year college
          aural-skills pacing, which suits an adult learner better than RCM's ear tests (paced for children over a decade of piano exams), and each
          shows its RCM level for reference. Faded stages build on something you haven't passed yet; you can still open them.
        </p>
        <div className="pr-levels">
          {grades.map((g) => (
            <LevelCard key={g} grade={g} rows={byLevel.get(g)!} prog={prog} open={openLevels.has(g)} onToggle={() => toggleLevel(g)} />
          ))}
        </div>
        <details className="pr-tucked">
          <summary>
            Composition track, for later: {tuckedUnits.map((u) => u.title.toLowerCase()).join(", ")}
          </summary>
          <p className="pr-blurb">These matter for writing music. They're folded away while the focus is fundamentals, pop transcription and reading; everything still works.</p>
          <div className="pr-units">{tuckedUnits.map(unitCard)}</div>
        </details>
        <div className="pr-legend pr-dim">
          <span>
            <i className="pr-chip is-pass" /> passed
          </span>
          <span>
            <i className="pr-chip is-tried" /> tried
          </span>
          <span>
            <i className="pr-chip is-next" /> ready
          </span>
          <span>
            <i className="pr-chip is-later" /> after something else
          </span>
        </div>
      </section>

      <section>
        <h2 className="pr-h2">Flashcards</h2>
        <p className="pr-blurb">A deck for each drill. Intelligent review spends each session on what you're weakest at.</p>
        <div className="pr-decks">{decks.filter((d) => !TUCKED_DECKS.includes(d.deck.id)).map(deckTile)}</div>
        <details className="pr-tucked">
          <summary>Composition-track decks: {decks.filter((d) => TUCKED_DECKS.includes(d.deck.id)).map((d) => d.deck.title.toLowerCase()).join(", ")}</summary>
          <div className="pr-decks">{decks.filter((d) => TUCKED_DECKS.includes(d.deck.id)).map(deckTile)}</div>
        </details>
      </section>

      <footer className="pr-foot">
        <details className="pr-roadmap">
          <summary>Coming next: {ROADMAP.map((r) => r.unit.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}</summary>
          <ul>
            {ROADMAP.map((r) => (
              <li key={r.unit}>
                <strong>{r.unit}</strong>: {r.topics}
              </li>
            ))}
          </ul>
        </details>
        <BackupSection />
      </footer>
    </main>
  );
}

/** Rows shown before "Show all"; the core plan fits without it. */
const PLAN_PREVIEW = 16;

/** The plan: the goal's stages not yet passed, in recommended order, ready ones first within a level. */
function PlanSection({ prog }: { prog: Record<string, Progress> }) {
  const [showAll, setShowAll] = useState(false);
  const goal = GOAL_STAGES.map((n) => ALL_ITEMS.get(n)).filter((x): x is Item => !!x);
  const order = (it: Item) => GOAL_STAGES.indexOf(it.number);
  const unmet = new Map(goal.map((it) => [it.number, prog[routeId(it.route)] ? [] : unmetPrereqs(it, prog)]));
  const left = goal
    .filter((it) => !prog[routeId(it.route)]?.passed)
    .sort((a, b) => stageGrade(a) - stageGrade(b) || unmet.get(a.number)!.length - unmet.get(b.number)!.length || order(a) - order(b));
  const shown = showAll ? left : left.slice(0, PLAN_PREVIEW);
  return (
    <section className="pr-plan">
      <div className="pr-course-head">
        <h2 className="pr-h2">Your plan</h2>
        <span className="pr-dim">
          {goal.length - left.length} of {goal.length} passed
        </span>
      </div>
      <p className="pr-blurb">{PLAN_GOAL} Still to pass, in order:</p>
      {left.length === 0 ? (
        <p className="pr-todo-done">All passed ✓</p>
      ) : (
        <ol className="pr-todo">
          {shown.map((it) => {
            const p = prog[routeId(it.route)];
            const first = unmet.get(it.number)!;
            return (
              <li key={it.number}>
                <button
                  className={`pr-todo-row${first.length ? " is-later" : ""}`}
                  onClick={() => go(it.route)}
                  title={`${it.summary} To pass: ${it.pass}.${first.length ? ` Best after: ${prereqText(first)}.` : ""}`}
                >
                  <span className="pr-todo-num">{it.number}</span>
                  <span className="pr-todo-title">{it.title}</span>
                  <span className="pr-todo-meta">
                    {gradeName(stageGrade(it))}
                    {p ? ` · best ${p.best}%` : first.length ? ` · after ${first.join(", ")}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {left.length > PLAN_PREVIEW && (
        <button className="btn pr-todo-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${left.length}`}
        </button>
      )}
    </section>
  );
}

function BackupSection() {
  const last = useSignal(lastBackup);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="pr-backup">
      <span className="pr-dim">
        Progress is saved in this browser.{" "}
        {last ? `Last backup ${new Date(last).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.` : "No backup yet."}
      </span>
      <button className="btn" onClick={exportProgress}>
        Back up to a file
      </button>
      <button className="btn" onClick={() => input.current?.click()}>
        Restore
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !confirm("Replace your saved progress with this backup?")) return;
          setError((await importProgress(file)) ?? "");
        }}
      />
      {error && <span className="pr-error">{error}</span>}
    </div>
  );
}
