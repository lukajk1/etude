import { useRef, useState } from "react";
import { exportProgress, importProgress, lastBackup } from "../lib/backup";
import { useSignal } from "../model/ui";
import { DECKS, deckSettings, settingsFor } from "./cards/decks";
import { cardStates, summarize } from "./cards/srs";
import { DRILLS, type Drill } from "./drills/catalog";
import { EXERCISES, ROADMAP } from "./exercises/catalog";
import { progress, type Progress } from "./exercises/state";
import { go, type Route } from "./route";
import { intervalShort, MELODIES } from "./transcription/melodies";
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
}

interface Topic {
  number: string;
  title: string;
  items: Item[];
}

interface Unit {
  title: string;
  /** Shown on its Up next card. */
  kind: string;
  topics: Topic[];
}

/** Drills by topic: "0.1a Read notes: treble clef" is topic 0.1, "Read notes", checkpoint a. */
function drillTopics(filter: (d: Drill) => boolean): Topic[] {
  const topics: Topic[] = [];
  for (const d of DRILLS.filter(filter)) {
    const number = d.number.replace(/[a-z]$/, "");
    const [title, detail = d.summary] = d.title.split(": ");
    let t = topics.find((x) => x.number === number);
    if (!t) topics.push((t = { number, title, items: [] }));
    t.items.push({ route: { kind: "drill", id: d.id }, number: d.number, title: d.title, summary: d.summary, detail });
  }
  return topics;
}

function counterpointTopics(): Topic[] {
  const kind = (title: string) => (/cantus firmus/i.test(title) ? "Cantus firmus" : /first species/i.test(title) ? "First species" : /second species/i.test(title) ? "Second species" : "Exercises");
  const topics: Topic[] = [];
  for (const e of EXERCISES) {
    const title = kind(e.title);
    let t = topics.find((x) => x.title === title);
    if (!t) topics.push((t = { number: e.number, title, items: [] }));
    t.items.push({ route: { kind: "exercise", id: e.id }, number: e.number, title: e.title, summary: e.summary, detail: e.title });
  }
  return topics;
}

const UNITS: Unit[] = [
  { title: "Foundations: reading and theory", kind: "Reading drill", topics: drillTopics((d) => !d.ear && !d.unit) },
  { title: "Foundations: ear training", kind: "Ear drill", topics: drillTopics((d) => d.ear && !d.unit) },
  {
    title: "Transcription",
    kind: "Transcription",
    topics: [
      {
        number: "T",
        title: "Melodies by ear",
        items: MELODIES.map((m) => ({ route: { kind: "transcribe", id: m.id }, number: m.number, title: m.title, summary: m.summary, detail: m.title })),
      },
    ],
  },
  { title: "Hearing harmony", kind: "Harmony by ear", topics: drillTopics((d) => d.unit === "harmony") },
  { title: "Counterpoint essentials", kind: "Counterpoint", topics: counterpointTopics() },
];

const routeId = (r: Route) => (r.kind === "home" ? "" : r.id);
const unitItems = (u: Unit) => u.topics.flatMap((t) => t.items);

function statusText(p?: Progress) {
  return !p ? "not started" : p.passed ? "passed" : `best ${p.best}%`;
}

/** A checkpoint's chip label: its letter within the topic, or its own number. */
const chipLabel = (topic: Topic, it: Item) => (/[a-z]$/.test(it.number) && it.number.startsWith(topic.number) ? it.number.slice(-1) : it.number);

function TopicRow({ topic, prog }: { topic: Topic; prog: Record<string, Progress> }) {
  const next = topic.items.find((it) => !prog[routeId(it.route)]?.passed);
  // Mark the next checkpoint only in topics already underway, so untouched ones stay quiet.
  const started = topic.items.some((it) => prog[routeId(it.route)]);
  return (
    <li className="pr-topic">
      <button className="pr-topic-main" onClick={() => go((next ?? topic.items[0]).route)} title={next ? `Open ${next.number} ${next.title}` : undefined}>
        <span className="pr-num">{topic.number}</span>
        <span className="pr-topic-text">
          <span className="pr-row-title">{topic.title}</span>
          <span className="pr-row-summary">{next ? `Next: ${next.detail}` : "All passed"}</span>
        </span>
      </button>
      <span className="pr-chips">
        {topic.items.map((it) => {
          const p = prog[routeId(it.route)];
          const cls = p?.passed ? " is-pass" : p ? " is-tried" : started && it === next ? " is-next" : "";
          return (
            <button key={it.number} className={`pr-chip${cls}`} title={`${it.number} ${it.title}: ${statusText(p)}`} onClick={() => go(it.route)}>
              {chipLabel(topic, it)}
            </button>
          );
        })}
      </span>
    </li>
  );
}

export function Home() {
  const prog = useSignal(progress);
  const stats = useSignal(intervalStats);
  const weak = weakestIntervals(stats);
  const cardPrefs = useSignal(deckSettings);
  useSignal(cardStates);

  // Up next: the first unpassed item in each of the first four units.
  const upNext = UNITS.slice(0, 4)
    .map((u) => {
      const it = unitItems(u).find((x) => !prog[routeId(x.route)]?.passed);
      return it && { ...it, kind: u.kind };
    })
    .filter((x): x is Item & { kind: string } => !!x);

  const all = UNITS.flatMap(unitItems);
  const passed = all.filter((it) => prog[routeId(it.route)]?.passed).length;

  const decks = DECKS.map((deck) => {
    const prefs = settingsFor(deck, cardPrefs);
    return { deck, sum: summarize(deck.build(prefs.pool, prefs.types)) };
  });
  const due = decks.filter((d) => d.sum.due > 0);

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
          {due.length ? (
            due.map(({ deck, sum }) => (
              <button key={deck.id} className="pr-due" onClick={() => go({ kind: "cards", id: deck.id })}>
                {deck.title} <strong>{sum.due} due</strong>
              </button>
            ))
          ) : (
            <span className="pr-dim">Nothing due right now.</span>
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
        <h2 className="pr-h2">Course</h2>
        <p className="pr-blurb">Each topic is split into checkpoints, narrow first. Click a topic to open its next checkpoint, or a chip to open that one.</p>
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
                    <TopicRow key={t.number + t.title} topic={t} prog={prog} />
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
              <span className={`pr-deck-status${sum.due ? " is-due" : sum.mastered === sum.total ? " is-pass" : ""}`}>
                {sum.fresh === sum.total ? "Not started" : sum.due ? `${sum.due} due` : `${sum.mastered} of ${sum.total} mastered`}
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
