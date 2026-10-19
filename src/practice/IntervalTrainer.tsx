import { useCallback, useEffect, useState } from "react";
import { playNotes, preparePiano } from "../audio/live";
import { Signal, useSignal } from "../model/ui";
import type { AudioEvent } from "./drills/catalog";
import { pick, randInt } from "./drills/theory";
import { go } from "./route";
import { attempts, clearAttempts, gapP, isMelodicOnly, recordAttempt, REGISTERS, registerOf, tally, type Attempt, type Mode, type Tally } from "./trainerStats";

/**
 * Free interval practice: choose the intervals and the ways they're played, answer,
 * then replay or compare as long as you like before moving on.
 */

const NAMES = ["Unison", "Minor 2nd", "Major 2nd", "Minor 3rd", "Major 3rd", "Perfect 4th", "Tritone", "Perfect 5th", "Minor 6th", "Major 6th", "Minor 7th", "Major 7th", "Octave"];

/** The answer grid: minor and tritone on the left, major and perfect on the right. */
const ROWS: [number | null, number][] = [
  [null, 0],
  [1, 2],
  [3, 4],
  [null, 5],
  [6, 7],
  [8, 9],
  [10, 11],
  [null, 12],
];

const MODES: { id: Mode; label: string }[] = [
  { id: "up", label: "Ascending" },
  { id: "down", label: "Descending" },
  { id: "together", label: "Together" },
  { id: "up-together", label: "Ascending, then together" },
  { id: "down-together", label: "Descending, then together" },
];

interface Settings {
  semis: number[];
  modes: Mode[];
}

const KEY = "etude.trainer.intervals.v1";
const DEFAULTS: Settings = { semis: [4, 7, 12], modes: ["up", "down", "together", "up-together", "down-together"] };

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
    const s = { ...DEFAULTS, ...saved };
    return s.semis.length && s.modes.length ? s : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const settings = new Signal<Settings>(load());

function save(next: Settings) {
  settings.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not saved this visit.
  }
}

interface Question {
  semis: number;
  mode: Mode;
  low: number;
}

function newQuestion(s: Settings, prev?: Question): Question {
  // Don't repeat the exact same question twice in a row when there's a choice.
  for (;;) {
    const semis = pick(s.semis);
    const mode = pick(s.modes);
    if (!prev || s.semis.length * s.modes.length === 1 || semis !== prev.semis || mode !== prev.mode) {
      return { semis, mode, low: randInt(50, 74 - semis) };
    }
  }
}

function audioFor(low: number, semis: number, mode: Mode): AudioEvent[] {
  const high = low + semis;
  const [first, second] = mode.startsWith("down") ? [high, low] : [low, high];
  const melodic: AudioEvent[] = [
    { pitches: [first], at: 0, dur: 0.9 },
    { pitches: [second], at: 0.95, dur: 1.3 },
  ];
  if (mode === "up" || mode === "down") return melodic;
  if (mode === "together") return [{ pitches: [low, high], at: 0, dur: 1.8 }];
  return [...melodic, { pitches: [low, high], at: 2.5, dur: 1.8 }];
}

export default function IntervalTrainer() {
  const s = useSignal(settings);
  const [question, setQuestion] = useState(() => newQuestion(s));
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => preparePiano(), []);

  const replay = useCallback(() => void playNotes(audioFor(question.low, question.semis, question.mode)), [question]);

  const next = useCallback(() => {
    const q = newQuestion(settings.value, question);
    setQuestion(q);
    setChosen(null);
    void playNotes(audioFor(q.low, q.semis, q.mode));
  }, [question]);

  const answer = (semis: number) => {
    if (chosen !== null) {
      // After answering, any button plays that interval from the same note, to compare.
      void playNotes(audioFor(question.low, semis, question.mode));
      return;
    }
    const ok = semis === question.semis;
    recordAttempt({ semis: question.semis, mode: question.mode, low: question.low, ok });
    setChosen(semis);
    setScore((sc) => ({ right: sc.right + (ok ? 1 : 0), total: sc.total + 1, streak: ok ? sc.streak + 1 : 0 }));
  };

  // Space or R replays; Enter moves on once you've answered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest("input")) return;
      // preventDefault also stops Space or Enter from clicking whichever button has focus.
      if (e.key === " " || e.key.toLowerCase() === "r") {
        e.preventDefault();
        replay();
      } else if (e.key === "Enter" && chosen !== null) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay, next, chosen]);

  const toggleSemis = (n: number) => {
    const semis = s.semis.includes(n) ? s.semis.filter((x) => x !== n) : [...s.semis, n].sort((a, b) => a - b);
    if (semis.length) save({ ...s, semis });
  };
  const toggleMode = (m: Mode) => {
    const modes = s.modes.includes(m) ? s.modes.filter((x) => x !== m) : MODES.map((x) => x.id).filter((x) => x === m || s.modes.includes(x));
    if (modes.length) save({ ...s, modes });
  };

  // A changed setting can rule out the current question; start a fresh one.
  useEffect(() => {
    if (!s.semis.includes(question.semis) || !s.modes.includes(question.mode)) {
      setQuestion(newQuestion(s));
      setChosen(null);
    }
  }, [s, question]);

  const ok = chosen === question.semis;
  const modeLabel = MODES.find((m) => m.id === question.mode)!.label.toLowerCase();

  return (
    <section className="drill" aria-label="Interval trainer">
      <div className="drill-head">
        <div>
          <div className="drill-number">Ear training, free practice</div>
          <h2 className="drill-title">Interval trainer</h2>
        </div>
        <div className="ex-actions">
          <button className="btn" aria-pressed={showStats} onClick={() => setShowStats(!showStats)}>
            Stats
          </button>
          <button className="btn" aria-pressed={showSettings} onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? "Done" : "Settings"}
          </button>
          <button className="btn" onClick={() => go({ kind: "home" })}>
            Back to the Practice Room
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="drill-card it-settings">
          <div className="cards-options">
            <span className="cards-opt-label">Intervals</span>
            <div className="it-grid is-settings">
              {ROWS.flatMap(([left, right]) =>
                [left, right].map((n, i) =>
                  n === null ? (
                    <span key={`gap${right}${i}`} />
                  ) : (
                    <label key={n} className="it-check">
                      <input type="checkbox" checked={s.semis.includes(n)} onChange={() => toggleSemis(n)} /> {NAMES[n]}
                    </label>
                  ),
                ),
              )}
            </div>
            <span className="cards-opt-label">Played</span>
            <div className="cards-checks">
              {MODES.map((m) => (
                <label key={m.id}>
                  <input type="checkbox" checked={s.modes.includes(m.id)} onChange={() => toggleMode(m.id)} /> {m.label}
                </label>
              ))}
            </div>
          </div>
          <p className="drill-pass">Start with a few that sound very different (major 3rd, perfect 5th, octave), then add more once those are easy.</p>
        </div>
      )}

      {showStats && <RegisterStats />}

      <div className="drill-card">
        <div className="drill-progress">
          <span>
            {score.right} of {score.total} correct
          </span>
          <span>Streak {score.streak}</span>
          {score.total > 0 && (
            <button className="it-reset" onClick={() => setScore({ right: 0, total: 0, streak: 0 })}>
              Reset
            </button>
          )}
        </div>

        <div className="it-listen">
          <button className="ex-check it-play" onClick={replay}>
            ▶ Play
          </button>
          <span className="it-hint">Space or R replays</span>
        </div>

        <div className="it-grid">
          {ROWS.flatMap(([left, right]) =>
            [left, right].map((n, i) => {
              if (n === null || !s.semis.includes(n)) return <span key={`gap${right}${i}`} className="it-slot" />;
              let cls = "drill-choice is-wide";
              if (chosen !== null && n === question.semis) cls += " is-right";
              else if (n === chosen) cls += " is-wrong";
              return (
                <button key={n} className={cls} onClick={() => answer(n)}>
                  {NAMES[n]}
                </button>
              );
            }),
          )}
        </div>

        {chosen !== null && (
          <div className={`drill-feedback ${ok ? "is-right" : "is-wrong"}`}>
            {ok ? (
              <>Correct: {NAMES[question.semis].toLowerCase()}, {modeLabel}.</>
            ) : (
              <>
                <strong>
                  Not quite: it was {question.semis === 12 ? "an" : "a"} {NAMES[question.semis].toLowerCase()}, {modeLabel}.
                </strong>{" "}
                You said {NAMES[chosen].toLowerCase()}.
              </>
            )}
            <div className="it-after">
              Click any interval to hear it from the same note.
              <button className="ex-check it-next" onClick={next} autoFocus>
                Next (Enter)
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const pct = (t: Tally) => Math.round((100 * t.ok) / t.n);

function cell(t: Tally) {
  return t.n ? (
    <>
      {pct(t)}% <span className="it-stat-n">({t.ok} of {t.n})</span>
    </>
  ) : (
    "–"
  );
}

/** One register against the middle: the gap, and whether it's likely more than chance. */
function compare(label: string, a: Tally, mid: Tally) {
  if (a.n < 10 || mid.n < 10) return null;
  const p = gapP(a, mid);
  const gap = pct(a) - pct(mid);
  const verdict = p < 0.05 ? "it's probably real" : "it could easily be chance";
  return (
    <li key={label}>
      {label}: {pct(a)}% against {pct(mid)}% in the middle ({gap > 0 ? "+" : ""}
      {gap} points). A gap this size would turn up by chance {p < 0.001 ? "less than 0.1%" : `about ${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`} of the time, so {verdict}.
    </li>
  );
}

/** Accuracy by register (where the two notes center), overall and split by how it was played. */
function RegisterStats() {
  const all = useSignal(attempts);
  const by = (list: Attempt[], reg: string) => tally(list.filter((a) => registerOf(a.low, a.semis) === reg));
  const columns = [
    { label: "All", list: all },
    { label: "One after the other", list: all.filter((a) => isMelodicOnly(a.mode)) },
    { label: "Played together", list: all.filter((a) => !isMelodicOnly(a.mode)) },
  ];
  const low = by(all, "low");
  const mid = by(all, "middle");
  const high = by(all, "high");
  const notes = [compare("Low", low, mid), compare("High", high, mid)].filter(Boolean);
  return (
    <div className="drill-card it-stats">
      <h3 className="drill-missed-title">Accuracy by register</h3>
      <p className="drill-pass">
        Every first answer is counted, by where the interval's two notes center in the trainer's range (D3 to D5). "Played together" includes the ones played
        melodically first, then together.
      </p>
      {all.length === 0 ? (
        <p className="drill-pass">No answers yet.</p>
      ) : (
        <>
          <div className="cards-grid-wrap">
            <table className="it-stat-table">
              <thead>
                <tr>
                  <th />
                  {columns.map((c) => (
                    <th key={c.label}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REGISTERS.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      {r.label} <span className="it-stat-n">{r.hint}</span>
                    </th>
                    {columns.map((c) => (
                      <td key={c.label}>{cell(by(c.list, r.id))}</td>
                    ))}
                  </tr>
                ))}
                <tr className="is-total">
                  <th scope="row">Total</th>
                  {columns.map((c) => (
                    <td key={c.label}>{cell(tally(c.list))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {notes.length ? <ul className="it-stat-notes">{notes}</ul> : <p className="drill-pass">Comparisons appear once each register has at least 10 answers.</p>}
          <p className="drill-pass">
            Big intervals can't sit at the very top or bottom of the range, so if you mostly miss small ones, the edges will look worse partly for that reason.
          </p>
        </>
      )}
      <div className="ex-actions">
        <button
          className="btn"
          disabled={all.length === 0}
          onClick={() => {
            if (confirm(`Clear all ${all.length} recorded answers?`)) clearAttempts();
          }}
        >
          Clear stats
        </button>
      </div>
    </div>
  );
}
