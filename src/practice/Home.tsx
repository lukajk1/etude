import { useRef, useState } from "react";
import { exportProgress, importProgress, lastBackup } from "../lib/backup";
import { useSignal } from "../model/ui";
import { DECKS, deckForDrill, deckSettings, settingsFor } from "./cards/decks";
import { cardStates, summarize } from "./cards/srs";
import { ALL_ITEMS, COURSE, displayNumber, prereqText, routeId, skillClass, stageById, stageGrade, unmetPrereqs, type Item } from "./course";
import { ROADMAP } from "./exercises/catalog";
import { progress, type Progress } from "./exercises/state";
import { gradeName, levelLabel, LEVELS } from "./levels";
import { GOAL_STAGES, PLAN_GOAL, TUCKED_DECKS, TUCKED_UNITS } from "./plan";
import { go } from "./route";

/**
 * The Practice Room home: your plan, then the course by level (each stage numbered by level
 * and place, "3.4", and tagged with its skill), the flashcard decks as tiles, and the
 * roadmap and backups at the end. The course itself is in course.ts.
 */

/** A stage in the course by level, tagged with the skill it exercises (its unit). */
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
        <span className="pr-level-tags">
          {tags.map((t) => (
            <span key={t} className={`pr-stage-tag ${skillClass(t)}`}>
              {t}
            </span>
          ))}
        </span>
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
            const deck = it.route.kind === "drill" ? deckForDrill(it.route.id) : undefined;
            return (
              <li key={it.number} className="pr-stage-row">
                <button className={`pr-stage${unmet.length ? " is-later" : ""}`} onClick={() => go(it.route)}>
                  <span className={`pr-chip${chip}`}>{displayNumber(it.number)}</span>
                  <span className="pr-stage-text">
                    <span className="pr-stage-title">
                      {it.title}
                      <span className={`pr-stage-tag ${skillClass(tag)}`}>{tag}</span>
                      {level && <span className="pr-level">≈ {levelLabel(level)}</span>}
                    </span>
                    <span className="pr-row-summary">{it.summary}</span>
                    <span className="pr-stage-pass">To pass: {it.pass}.</span>
                    {unmet.length > 0 && <span className="pr-stage-first">Best after: {prereqText(unmet)}.</span>}
                  </span>
                  <span className={`pr-stage-status${p?.passed ? " is-pass" : ""}`}>{p ? (p.passed ? "Passed" : `Best ${p.best}%`) : ""}</span>
                </button>
                {deck && (
                  <button className="btn pr-stage-cards" onClick={() => go({ kind: "cards", id: deck.id })} title={`Practise as flashcards: ${deck.title}`}>
                    Flashcards
                  </button>
                )}
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
  // Progress counts the units in focus; the composition track is tucked away below.
  const tucked = (row: (typeof COURSE)[number]) => TUCKED_UNITS.includes(row.unit.title);
  const all = COURSE.filter((row) => !tucked(row)).map((row) => row.it);
  const passed = all.filter((it) => prog[routeId(it.route)]?.passed).length;

  // The course by level, in course order within each level; the composition track separately.
  const byLevel = new Map<number, LevelRow[]>();
  const tuckedByLevel = new Map<number, LevelRow[]>();
  for (const row of COURSE) {
    const map = tucked(row) ? tuckedByLevel : byLevel;
    map.set(row.grade, [...(map.get(row.grade) ?? []), { it: row.it, tag: row.unit.kind }]);
  }
  const grades = [...byLevel.keys()].sort((a, b) => a - b);
  const tuckedGrades = [...tuckedByLevel.keys()].sort((a, b) => a - b);
  const tuckedTitles = [...new Set(COURSE.filter(tucked).map((row) => row.unit.title.toLowerCase()))];
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

  const deckTile = ({ deck, sum }: (typeof decks)[number]) => (
    <button key={deck.id} className="pr-deck" onClick={() => go({ kind: "cards", id: deck.id })}>
      <span className="pr-deck-top">
        <span className={`pr-deck-tag ${skillClass(deckTag(deck))}`}>{deckTag(deck)}</span>
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
          <h2 className="pr-h2">Exercises</h2>
          <span className="pr-dim pr-course-count">
            {passed} of {all.length} passed
          </span>
          <button className="btn pr-expand" onClick={() => go({ kind: "skills", id: "reading" })}>
            Skill trees
          </button>
          <button className="btn pr-expand" onClick={() => saveLevels(allLevelsOpen ? new Set() : new Set(grades))}>
            {allLevelsOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <p className="pr-blurb">
          Every stage, grouped by level and numbered by level and place ("3.4" is the fourth stage of Level 3), with a tag for the skill it
          exercises. Levels follow the Royal Conservatory (RCM) theory levels; ear skills are placed by first-year college
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
            Composition track, for later: {tuckedTitles.join(", ")}
          </summary>
          <p className="pr-blurb">These matter for writing music. They're folded away while the focus is fundamentals, pop transcription and reading; everything still works.</p>
          <div className="pr-levels">
            {tuckedGrades.map((g) => (
              <LevelCard key={g} grade={g} rows={tuckedByLevel.get(g)!} prog={prog} open={openLevels.has(g)} onToggle={() => toggleLevel(g)} />
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
                  <span className="pr-todo-num">{displayNumber(it.number)}</span>
                  <span className="pr-todo-title">{it.title}</span>
                  <span className="pr-todo-meta">
                    {gradeName(stageGrade(it))}
                    {p ? ` · best ${p.best}%` : first.length ? ` · after ${first.map(displayNumber).join(", ")}` : ""}
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

/** A deck tile's tag: the skill its drills exercise, or the deck's own tag if it has no drills. */
function deckTag(deck: (typeof DECKS)[number]): string {
  const row = deck.drills?.map(stageById).find((r) => r);
  return row ? row.unit.kind : (deck.tag ?? deck.icon);
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
