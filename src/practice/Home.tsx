import { useRef, useState } from "react";
import { exportProgress, importProgress, lastBackup } from "../lib/backup";
import { useSignal } from "../model/ui";
import { deckForDrill, getDeck } from "./cards/decks";
import { ALL_ITEMS, chipName, COURSE, prereqText, routeId, skillClass, stageCode, stageGrade, UNITS, unmetPrereqs, type Item, type Topic, type Unit } from "./course";
import { ROADMAP } from "./exercises/catalog";
import { progress, type Progress } from "./exercises/state";
import { gradeName, levelLabel, LEVELS } from "./levels";
import { GOAL_STAGES, PLAN_GOAL, TUCKED_UNITS } from "./plan";
import { go } from "./route";

/**
 * The Practice Room home: your plan; then the exercises, with your level overall and per
 * skill, a card per skill and a row of stage chips per type of exercise, each with its practice
 * (flashcard) mode; and the roadmap and backups at the end. The course itself is in course.ts.
 */

type Prog = Record<string, Progress>;
type CourseRow = (typeof COURSE)[number];

const passedIn = (items: Item[], prog: Prog) => items.filter((it) => prog[routeId(it.route)]?.passed).length;

/** The level being worked on: the lowest level with a stage not yet passed (none when all are). */
function workingLevel(rows: CourseRow[], prog: Prog): number | undefined {
  const open = rows.filter((r) => !prog[routeId(r.it.route)]?.passed).map((r) => r.grade);
  return open.length ? Math.min(...open) : undefined;
}

/** A stage's chip state: passed, tried, ready, or after something else. */
function chipState(it: Item, prog: Prog) {
  const p = prog[routeId(it.route)];
  return p?.passed ? " is-pass" : p ? " is-tried" : unmetPrereqs(it, prog).length ? " is-later" : " is-next";
}

/** Practice decks that belong to no drill, offered on the row of the exercise they go with. */
const EXTRA_PRACTICE: Record<string, string[]> = { "Name intervals": ["intervals"] };

/** One type of exercise (a topic) as a row: its name, a chip per stage in order, where it sits and how far along. */
function ExerciseRow({ topic, prog }: { topic: Topic; prog: Prog }) {
  const items = topic.items;
  const done = passedIn(items, prog);
  const next = items.find((it) => !prog[routeId(it.route)]?.passed);
  const first = items[0];
  const deck = first.route.kind === "drill" ? deckForDrill(first.route.id) : undefined;
  const extra = (EXTRA_PRACTICE[topic.title] ?? []).map(getDeck).filter((d) => !!d);
  const grades = items.map(stageGrade);
  const lo = Math.min(...grades);
  const hi = Math.max(...grades);
  return (
    <li className="pr-ex">
      <button className="pr-ex-title" onClick={() => go((next ?? first).route)} title={next ? `Next: ${next.title}` : "All passed"}>
        {topic.title}
      </button>
      <span className="pr-ex-chips">
        {items.map((it) => {
          const p = prog[routeId(it.route)];
          const unmet = p ? [] : unmetPrereqs(it, prog);
          const level = LEVELS[it.number];
          return (
            <button
              key={it.number}
              className={`pr-chip pr-ex-chip${chipState(it, prog)}`}
              onClick={() => go(it.route)}
              title={[
                `${it.title} (${stageCode(routeId(it.route))})`,
                `${gradeName(stageGrade(it))}${level ? `, about ${levelLabel(level)}` : ""}`,
                it.summary,
                `To pass: ${it.pass}.`,
                p ? (p.passed ? "Passed." : `Best so far: ${p.best}%.`) : unmet.length ? `Best after: ${prereqText(unmet)}.` : "Ready.",
              ].join("\n")}
            >
              {chipName(it)}
            </button>
          );
        })}
      </span>
      <span className="pr-ex-meta">
        {lo === hi ? gradeName(lo) : `${gradeName(lo)}–${hi}`} · {done} of {items.length}
      </span>
      {deck && (
        <button className="btn pr-stage-cards" onClick={() => go({ kind: "cards", id: deck.id })} title={`Practice: ${deck.title}`}>
          Practice
        </button>
      )}
      {extra.map((d) => (
        <button key={d!.id} className="btn pr-stage-cards" onClick={() => go({ kind: "cards", id: d!.id })} title={`Practice: ${d!.title}`}>
          {d!.title.replace(/^Intervals in /, "").replace(/^./, (c) => c.toUpperCase())}
        </button>
      ))}
    </li>
  );
}

/** A skill as a card: the level you're working on in it, and its exercise types in order. */
function SkillCard({ unit, prog }: { unit: Unit; prog: Prog }) {
  const rows = COURSE.filter((r) => r.unit === unit);
  const level = workingLevel(rows, prog);
  return (
    <div className={`pr-skill-card ${skillClass(unit.kind)}`}>
      <div className="pr-skill-head">
        <h3>{unit.kind}</h3>
        <span className="pr-skill-level">{level === undefined ? "All passed" : `Working on ${gradeName(level)}`}</span>
        <span className="pr-dim">
          {passedIn(rows.map((r) => r.it), prog)} of {rows.length}
        </span>
      </div>
      <ul className="pr-ex-list">
        {unit.topics.map((t) => (
          <ExerciseRow key={t.title} topic={t} prog={prog} />
        ))}
      </ul>
    </div>
  );
}

export function Home() {
  const prog = useSignal(progress);
  // Progress counts the units in focus; the composition track is tucked away below.
  const tucked = (row: (typeof COURSE)[number]) => TUCKED_UNITS.includes(row.unit.title);
  const all = COURSE.filter((row) => !tucked(row)).map((row) => row.it);
  const passed = all.filter((it) => prog[routeId(it.route)]?.passed).length;

  // Each skill as a card; the composition track's skills folded away below.
  const focusUnits = UNITS.filter((u) => !TUCKED_UNITS.includes(u.title));
  const tuckedUnits = UNITS.filter((u) => TUCKED_UNITS.includes(u.title));
  const overall = workingLevel(COURSE.filter((row) => !tucked(row)), prog);

  return (
    <main className="pr-home">
      <PlanSection prog={prog} />

      <section>
        <div className="pr-course-head">
          <h2 className="pr-h2">Exercises</h2>
          <span className="pr-dim pr-course-count">
            {passed} of {all.length} passed
          </span>
          <button className="btn pr-expand" onClick={() => go({ kind: "skills", id: "reading" })}>
            Skill trees
          </button>
        </div>
        <div className="pr-levels-summary">
          <span className="pr-overall-level">Overall level: {overall === undefined ? "all passed" : overall === 0 ? "P" : overall}</span>
          {focusUnits.map((u) => {
            const l = workingLevel(
              COURSE.filter((r) => r.unit === u),
              prog,
            );
            return (
              <span key={u.kind} className={`pr-stage-tag ${skillClass(u.kind)}`}>
                {u.kind} {l === undefined ? "✓" : l === 0 ? "P" : l}
              </span>
            );
          })}
        </div>
        <p className="pr-blurb">
          Each skill's exercises in order: a row per type, a chip per stage. Your level is the lowest level with something left to pass. Levels follow
          the Royal Conservatory (RCM) theory levels, with ear skills placed by first-year college aural-skills pacing; hover over a chip for its
          level, code and what it takes to pass. Faded chips build on something you haven't passed yet; you can still open them.
        </p>
        <div className="pr-skill-cards">
          {focusUnits.map((u) => (
            <SkillCard key={u.kind} unit={u} prog={prog} />
          ))}
        </div>
        <details className="pr-tucked">
          <summary>Composition track, for later: {tuckedUnits.map((u) => u.title.toLowerCase()).join(", ")}</summary>
          <p className="pr-blurb">These matter for writing music. They're folded away while the focus is fundamentals, pop transcription and reading; everything still works.</p>
          <div className="pr-skill-cards">
            {tuckedUnits.map((u) => (
              <SkillCard key={u.kind} unit={u} prog={prog} />
            ))}
          </div>
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
const PLAN_PREVIEW = GOAL_STAGES.length;

/** The plan: the goal's stages not yet passed, in course order (so their numbers run in order). */
function PlanSection({ prog }: { prog: Record<string, Progress> }) {
  const [showAll, setShowAll] = useState(false);
  const goal = GOAL_STAGES.map((n) => ALL_ITEMS.get(n)).filter((x): x is Item => !!x);
  const order = (it: Item) => COURSE.findIndex((row) => row.it === it);
  const unmet = new Map(goal.map((it) => [it.number, prog[routeId(it.route)] ? [] : unmetPrereqs(it, prog)]));
  const left = goal.filter((it) => !prog[routeId(it.route)]?.passed).sort((a, b) => order(a) - order(b));
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
                  <span className="pr-todo-num">{stageCode(routeId(it.route))}</span>
                  <span className="pr-todo-title">{it.title}</span>
                  <span className="pr-todo-meta">
                    {gradeName(stageGrade(it))}
                    {p ? ` · best ${p.best}%` : first.length ? ` · after ${first.map((n) => stageCode(routeId(ALL_ITEMS.get(n)!.route))).join(", ")}` : ""}
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
