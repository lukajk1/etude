import { useRef, useState } from "react";
import { exportProgress, importProgress, lastBackup } from "../lib/backup";
import { useSignal } from "../model/ui";
import { DECKS, deckSettings, settingsFor } from "./cards/decks";
import { cardStates, summarize } from "./cards/srs";
import { DRILLS, type Drill } from "./drills/catalog";
import { EXERCISES, ROADMAP } from "./exercises/catalog";
import { PASS_SCORE } from "./exercises/grade";
import { progress, type Progress } from "./exercises/state";
import { go, type Route } from "./route";
import { TR_PASS } from "./transcription/grade";
import { intervalShort, intervalsUsed, MELODIES } from "./transcription/melodies";
import { intervalStats, weakestIntervals } from "./transcription/state";

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
  /** Shown on its Up next card. */
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
  { title: "Foundations: reading and theory", kind: "Reading drill", topics: drillTopics((d) => !d.ear && !d.unit) },
  { title: "Foundations: ear training", kind: "Ear drill", topics: drillTopics((d) => d.ear && !d.unit) },
  { title: "Rhythm and meter", kind: "Rhythm", topics: drillTopics((d) => d.unit === "rhythm") },
  {
    title: "Transcription",
    kind: "Transcription",
    topics: [
      {
        number: "T",
        title: "Melodies by ear",
        about:
          "A melody plays and you write it down in a piano roll, in C major with the first note given. Replay it as often as you like. Each melody adds only an interval or two over the last; checking accepts a version in another key and explains each wrong note.",
        items: MELODIES.map((m) => ({
          route: { kind: "transcribe", id: m.id },
          number: m.number,
          title: m.title,
          summary: `${m.summary} Intervals: ${intervalsUsed(m).join(", ")}.`,
          detail: m.title,
          pass: `a score of ${TR_PASS} or more`,
        })),
      },
    ],
  },
  { title: "Hearing harmony", kind: "Harmony by ear", topics: drillTopics((d) => d.unit === "harmony") },
  { title: "Cadences", kind: "Cadences by ear", topics: drillTopics((d) => d.unit === "cadences") },
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
  "0.12a": ["0.11b"], // fragments are scale degrees in a row
  "0.13a": ["0.8a"], // intervals in a melody, after hearing them alone
  "2.1a": ["0.11a"], // a chord's bass note is a scale degree
  "2.2a": ["2.1b"],
  "2.2b": ["2.1d"],
  "3.3a": ["3.1a"], // read the values before hearing them
  "3.4a": ["3.1a"],
  "4.1a": ["2.1b"], // a cadence is chords: I, IV and V by ear first
  "5.1a": ["0.6a"], // spotting the note outside a chord means reading the chord
  "6.1a": ["0.7a"], // choosing a chord means knowing what's in each one
  T1: ["0.8a"],
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
                    <span className="pr-stage-pass">To pass: {it.pass}.</span>
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

export function Home() {
  const prog = useSignal(progress);
  const stats = useSignal(intervalStats);
  const weak = weakestIntervals(stats);
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
  const allTopics = UNITS.flatMap((u) => u.topics.map(topicKey));
  const allOpen = allTopics.every((k) => expanded.has(k));
  const toggle = (k: string) => {
    const next = new Set(expanded);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    saveExpanded(next);
  };

  // Up next: stages that are ready (prerequisites passed). The first in each unit, then
  // ones from other topics, up to four.
  const ready = (it: Item) => !prog[routeId(it.route)]?.passed && unmetPrereqs(it, prog).length === 0;
  const upNext: (Item & { kind: string })[] = [];
  const pickedTopics = new Set<Topic>();
  for (const u of UNITS) {
    const t = u.topics.find((t) => t.items.some(ready));
    if (t && upNext.length < 4) {
      upNext.push({ ...t.items.find(ready)!, kind: u.kind });
      pickedTopics.add(t);
    }
  }
  for (const u of UNITS) {
    for (const t of u.topics) {
      if (upNext.length >= 4 || pickedTopics.has(t)) continue;
      const it = t.items.find(ready);
      if (it) {
        upNext.push({ ...it, kind: u.kind });
        pickedTopics.add(t);
      }
    }
  }

  const all = UNITS.flatMap(unitItems);
  const passed = all.filter((it) => prog[routeId(it.route)]?.passed).length;

  const decks = DECKS.map((deck) => {
    const prefs = settingsFor(deck, cardPrefs);
    return { deck, sum: summarize(deck.build(prefs.pool, prefs.types)) };
  });
  // Decks you've started, to jump back into on your own schedule.
  const started = decks.filter((d) => d.sum.fresh < d.sum.total);

  return (
    <main className="pr-home">
      <section className="pr-hero">
        <div className="pr-hero-top">
          <h1>Practice Room</h1>
          <div className="pr-overall" aria-label="Overall progress">
            <div className="pr-overall-bar">
              <div style={{ width: `${(passed / all.length) * 100}%` }} />
            </div>
            <span>
              {passed} of {all.length} passed
            </span>
          </div>
        </div>
        <p>Drills, ear training, transcription and graded exercises for the foundations of tonal music. Ten to twenty minutes a day goes a long way.</p>
      </section>

      <section className="pr-today">
        <h2 className="pr-h2">Today</h2>
        {upNext.length > 0 && (
          <div className="pr-next">
            {upNext.map((it) => (
              <button key={routeId(it.route)} className="pr-next-card" onClick={() => go(it.route)}>
                <span className="pr-kind">{it.kind}</span>
                <span className="pr-next-title">
                  {it.number} {it.title}
                </span>
                <span className="pr-next-summary">{it.summary}</span>
              </button>
            ))}
          </div>
        )}
        <div className="pr-today-row">
          <span className="pr-today-label">Flashcards</span>
          {started.length ? (
            started.map(({ deck }) => (
              <button key={deck.id} className="pr-due" onClick={() => go({ kind: "cards", id: deck.id })}>
                {deck.title}
              </button>
            ))
          ) : (
            <span className="pr-dim">Pick a deck below to start.</span>
          )}
          <button className="btn pr-trainer" onClick={() => go({ kind: "train", id: "intervals" })}>
            ♪ Interval trainer
          </button>
        </div>
        {weak.length > 0 && (
          <p className="pr-dim pr-weak-line">
            Missed most when transcribing:{" "}
            {weak.map((w) => `${w.semitones > 0 ? "up" : "down"} ${intervalShort(w.semitones)} (${Math.round(w.rate * 100)}%)`).join(", ")}.
          </p>
        )}
      </section>

      <section>
        <div className="pr-course-head">
          <h2 className="pr-h2">Course</h2>
          <button className="btn pr-expand" onClick={() => saveExpanded(allOpen ? new Set() : new Set(allTopics))}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <p className="pr-blurb">
          Each topic is split into stages, narrow first. Click a topic to see its stages and what each one asks, or a chip to go straight to one. Faded stages
          build on something you haven't passed yet; you can still open them.
        </p>
        <div className="pr-units">
          {UNITS.map((u) => {
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
          })}
        </div>
        <div className="pr-legend pr-dim">
          <span>
            <i className="pr-chip is-pass" /> passed
          </span>
          <span>
            <i className="pr-chip is-tried" /> tried
          </span>
          <span>
            <i className="pr-chip is-next" /> next
          </span>
          <span>
            <i className="pr-chip is-later" /> after something else
          </span>
        </div>
      </section>

      <section>
        <h2 className="pr-h2">Flashcards</h2>
        <p className="pr-blurb">A deck for each drill, with spaced review: missed cards come back sooner, known ones days or weeks later.</p>
        <div className="pr-decks">
          {decks.map(({ deck, sum }) => (
            <button key={deck.id} className="pr-deck" onClick={() => go({ kind: "cards", id: deck.id })}>
              <span className="pr-deck-top">
                <span className="pr-deck-tag">{deck.tag ?? deck.icon}</span>
                <span className="pr-deck-title">{deck.title}</span>
              </span>
              <span className={`pr-deck-status${sum.mastered === sum.total ? " is-pass" : ""}`}>
                {sum.fresh === sum.total ? "Not started" : `${sum.mastered} of ${sum.total} mastered`}
              </span>
            </button>
          ))}
        </div>
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
