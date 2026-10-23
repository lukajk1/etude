import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playNotes, playNotesLater, preparePiano } from "../audio/live";
import { AnswerPad, answerLabel, LETTERS, RhythmStaff, Staff } from "./Answers";
import { isRight, type Step } from "./drills/catalog";
import { deckSettings, setDeckSettings, settingsFor, type DeckSettings } from "./cards/decks";
import type { Card, DeckDef, Shown } from "./cards/types";
import { cardStates, FAST_MS, MAX_BOX, pickNext, resetCards, review, stageOf, summarize, type CardState, type Session } from "./cards/srs";
import { go } from "./route";
import { useSignal } from "../model/ui";

interface Answered {
  card: Card;
  shown: Shown;
  given: string[];
  ok: boolean;
  ms: number;
}

interface Showing {
  card: Card;
  shown: Shown;
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="cards-seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? "is-on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "C major", or "Root C, quality major" for a card with several answers. */
const answerText = (steps: Step[]) =>
  steps.length === 1 ? answerLabel(steps[0].type, steps[0].correct) : steps.map((s) => `${s.label ?? ""} ${answerLabel(s.type, s.correct)}`.trim()).join(", ");

const STAGE_LABEL: Record<string, string> = { new: "New", learning: "Learning", familiar: "Familiar", strong: "Strong", mastered: "Mastered" };

function cellTitle(card: Card, s: CardState | undefined) {
  if (!s) return `${card.label}: not seen yet`;
  return `${card.label}: level ${s.box} of ${MAX_BOX}, ${s.correct} of ${s.seen} right`;
}

/** Every card in the deck, shaded by how well it's known. */
function MasteryGrid({ def, settings }: { def: DeckDef; settings: DeckSettings }) {
  const states = useSignal(cardStates);
  const { cols, rows } = useMemo(() => def.grid(settings.pool, def.build(settings.pool, settings.types)), [def, settings.pool, settings.types]);
  return (
    <div className="cards-grid-wrap">
      <table className="cards-grid">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cards.map((c) => {
                const s = states[c.id];
                return (
                  <td key={c.id} className={`cards-cell is-${stageOf(s)}`} title={cellTitle(c, s)}>
                    {c.cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cards-legend">
        {Object.entries(STAGE_LABEL).map(([k, v]) => (
          <span key={k}>
            <i className={`cards-swatch is-${k}`} /> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CardsView({ def }: { def: DeckDef }) {
  const settings = settingsFor(def, useSignal(deckSettings));
  const setCardSettings = (patch: Partial<DeckSettings>) => setDeckSettings(def, patch);
  useSignal(cardStates);
  const deck = useMemo(() => def.build(settings.pool, settings.types), [def, settings.pool, settings.types]);
  const [phase, setPhase] = useState<"setup" | "run" | "done">("setup");
  const [showing, setShowing] = useState<Showing | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  /** Answers given so far to a card with several steps. */
  const [given, setGiven] = useState<string[]>([]);
  /** Recall mode: how long it took to bring up the answer, once it's shown. */
  const [revealMs, setRevealMs] = useState<number | null>(null);
  const shownAt = useRef(0);
  const recent = useRef<string[]>([]);
  const batch = useRef<Session>({ batchOpen: true });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const summary = summarize(deck);
  const fast = def.ear ? Infinity : (def.fastMs ?? FAST_MS);

  useEffect(() => {
    if (def.ear) preparePiano();
  }, [def]);

  const deal = useCallback(() => {
    const card = pickNext(deck, recent.current, settings.order, Date.now(), Math.random, batch.current);
    recent.current = [...recent.current.slice(-4), card.id];
    const clef = settings.clef === "both" ? (Math.random() < 0.5 ? "treble" : "bass") : settings.clef;
    setShowing({ card, shown: card.show(settings.pool, clef, settings.types) });
    setChosen(null);
    setGiven([]);
    setRevealMs(null);
    shownAt.current = performance.now();
  }, [deck, settings.order, settings.pool, settings.clef]);

  const start = () => {
    if (!deck.length) return;
    recent.current = [];
    batch.current = { batchOpen: true };
    setAnswered([]);
    setPhase("run");
    deal();
  };

  const finish = useCallback(() => {
    clearTimeout(timer.current);
    setPhase("done");
  }, []);

  const next = useCallback(() => {
    clearTimeout(timer.current);
    if (settings.length && answered.length >= settings.length) finish();
    else deal();
  }, [settings.length, answered.length, deal, finish]);

  const pick = useCallback(
    (value: string) => {
      if (!showing || chosen !== null) return;
      const { steps } = showing.shown;
      const all = [...given, value];
      setGiven(all);
      if (all.length < steps.length) return;
      const ms = performance.now() - shownAt.current;
      const ok = steps.every((s, i) => isRight(s, all[i]));
      review(showing.card.id, ok, ms, Date.now(), fast);
      if (!ok && showing.shown.resolve) playNotesLater(showing.shown.resolve, 250);
      setChosen(value);
      setAnswered((a) => [...a, { card: showing.card, shown: showing.shown, given: all, ok, ms }]);
    },
    [showing, chosen, given, fast],
  );

  const reveal = useCallback(() => {
    if (!showing || revealMs !== null) return;
    setRevealMs(performance.now() - shownAt.current);
    // In recall mode, the answer's resolution plays as it's revealed.
    if (showing.shown.resolve) void playNotes(showing.shown.resolve);
  }, [showing, revealMs]);

  /** Recall mode: grade yourself once the answer is showing. Timed to when you revealed it. */
  const selfGrade = useCallback(
    (ok: boolean) => {
      if (!showing || revealMs === null) return;
      const { steps } = showing.shown;
      review(showing.card.id, ok, revealMs, Date.now(), fast);
      setAnswered((a) => [...a, { card: showing.card, shown: showing.shown, given: ok ? steps.map((s) => s.correct) : [], ok, ms: revealMs }]);
      if (settings.length && answered.length + 1 >= settings.length) finish();
      else deal();
    },
    [showing, revealMs, settings.length, answered.length, finish, deal, fast],
  );

  // Ear cards play as they appear.
  const replay = useCallback(() => {
    if (showing?.shown.audio) void playNotes(showing.shown.audio);
  }, [showing]);
  useEffect(() => {
    if (phase === "run") replay();
  }, [phase, replay]);

  // Right answers move on by themselves.
  const last = answered[answered.length - 1];
  useEffect(() => {
    if (phase !== "run" || chosen === null || !last?.ok) return;
    timer.current = setTimeout(next, 650);
    return () => clearTimeout(timer.current);
  }, [phase, chosen, last, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === "run" && (e.key === "r" || e.key === "R") && showing?.shown.audio) {
        replay();
        return;
      }
      if (phase === "run" && (e.key === "n" || e.key === "N") && showing?.shown.again) {
        void playNotes(showing.shown.again.audio);
        return;
      }
      if (phase === "run" && settings.answer === "recall") {
        if (revealMs === null && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          reveal();
        } else if (revealMs !== null && (e.key === "1" || e.key === "2")) {
          e.preventDefault();
          selfGrade(e.key === "2");
        }
        return;
      }
      // Letters answer note questions and 1–7 scale degrees, as in the drills.
      const step = showing?.shown.steps[given.length];
      if (phase === "run" && chosen === null && step) {
        const k = e.key.toUpperCase();
        if ((step.type === "letter" || step.type === "note") && LETTERS.includes(k)) pick(k);
        else if (step.type === "degree" && /^[1-7]$/.test(e.key)) pick(e.key);
      }
      if (e.key !== "Enter") return;
      if (phase === "setup" || phase === "done") {
        if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
        e.preventDefault();
        start();
      } else if (chosen !== null) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleType = (t: string) => {
    const types = settings.types.includes(t) ? settings.types.filter((x) => x !== t) : [...settings.types, t];
    if (types.length >= (def.minTypes ?? 1)) setCardSettings({ types });
  };

  const correctCount = answered.filter((a) => a.ok).length;

  return (
    <section className="drill" aria-label={`${def.title} flashcards`}>
      <div className="drill-head">
        <div>
          <div className="drill-number">Flashcards</div>
          <h2 className="drill-title">{def.title}</h2>
        </div>
        <button className="btn" onClick={() => go({ kind: "home" })}>
          Back to the Practice Room
        </button>
      </div>

      {phase === "setup" && (
        <div className="drill-card">
          <p className="drill-brief">
            {def.brief} With intelligent review on, cards you miss come back within a few cards, and the ones you know well come up less and less, so
            each session goes to what you're weakest on. New cards come in five at a time, easiest first; the next five join once those are learned.
          </p>
          <div className="cards-options">
            {def.pools.length > 1 && (
              <>
                <span className="cards-opt-label">Pool</span>
                <Segmented value={settings.pool} onChange={(pool) => setCardSettings({ pool })} options={def.pools} />
              </>
            )}
            {def.types.length > 1 && (
              <>
                <span className="cards-opt-label">Cards</span>
                <div>
                  <div className="cards-checks">
                    {def.types.map((t) => (
                      <label key={t.id} title={t.hint}>
                        <input type="checkbox" checked={settings.types.includes(t.id)} onChange={() => toggleType(t.id)} /> {t.label}
                      </label>
                    ))}
                  </div>
                  {def.presets && (
                    <div className="cards-presets">
                      {def.presets.map((p) => (
                        <button
                          key={p.label}
                          className={`btn${p.types.length === settings.types.length && p.types.every((t) => settings.types.includes(t)) ? " is-on" : ""}`}
                          onClick={() => setCardSettings({ types: p.types })}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {def.clefs && (
              <>
                <span className="cards-opt-label">Clef</span>
                <Segmented
                  value={settings.clef}
                  onChange={(clef) => setCardSettings({ clef })}
                  options={[
                    { value: "treble", label: "Treble" },
                    { value: "bass", label: "Bass" },
                    { value: "both", label: "Both, mixed" },
                  ]}
                />
              </>
            )}
            <span className="cards-opt-label">Order</span>
            <Segmented
              value={settings.order}
              onChange={(order) => setCardSettings({ order })}
              options={[
                { value: "smart", label: "Intelligent review" },
                { value: "random", label: "Random" },
              ]}
            />
            <span className="cards-opt-label">Answer</span>
            <Segmented
              value={settings.answer}
              onChange={(answer) => setCardSettings({ answer })}
              options={[
                { value: "choose", label: "Pick from choices" },
                { value: "recall", label: "Recall, then grade myself" },
              ]}
            />
            <span className="cards-opt-label">Length</span>
            <Segmented
              value={settings.length}
              onChange={(length) => setCardSettings({ length })}
              options={[
                { value: 20, label: "20 cards" },
                { value: 40, label: "40 cards" },
                { value: 0, label: "Until I stop" },
              ]}
            />
          </div>
          <p className="drill-pass">
            {summary.total} cards: {summary.fresh} new, {summary.learning + summary.familiar + summary.strong} in progress, {summary.mastered} mastered.
          </p>
          <div className="ex-actions">
            <button className="ex-check drill-start" onClick={start}>
              Start (Enter)
            </button>
            <button
              className="btn"
              disabled={summary.fresh === summary.total}
              onClick={() => {
                if (confirm(`Forget your progress on these ${summary.total} cards?`)) resetCards(deck.map((c) => c.id));
              }}
            >
              Reset progress
            </button>
          </div>
          <h3 className="drill-missed-title">How well you know each card</h3>
          <MasteryGrid def={def} settings={settings} />
        </div>
      )}

      {phase === "run" && showing && (
        <div className="drill-card">
          <div className="drill-progress">
            <span>{settings.length ? `Card ${answered.length + (chosen === null ? 1 : 0)} of ${settings.length}` : `Card ${answered.length + (chosen === null ? 1 : 0)}`}</span>
            <span>{correctCount} correct</span>
          </div>
          <div className="drill-bar">
            <div style={{ width: settings.length ? `${(answered.length / settings.length) * 100}%` : "0%" }} />
          </div>
          <p className="drill-prompt">{showing.shown.prompt}</p>
          {showing.shown.staff ? (
            <div className="drill-paper">
              <Staff spec={showing.shown.staff} />
            </div>
          ) : showing.shown.rhythm ? (
            <div className="drill-paper">
              <RhythmStaff spec={showing.shown.rhythm} />
            </div>
          ) : showing.shown.display ? (
            <div className="cards-key">{showing.shown.display}</div>
          ) : null}
          {showing.shown.audio && (
            <button className="btn drill-replay" onClick={replay}>
              Play again (R)
            </button>
          )}
          {showing.shown.again && (
            <button className="btn drill-replay" onClick={() => void playNotes(showing.shown.again!.audio)}>
              {showing.shown.again.label} (N)
            </button>
          )}
          {settings.answer === "choose" && showing.shown.steps.length > 1 && (
            <div className="drill-steps">
              {showing.shown.steps.map((s, i) => (
                <span key={i} className={i === given.length && chosen === null ? "is-current" : ""}>
                  {s.label}: {given[i] ? answerLabel(s.type, given[i]) : "…"}
                </span>
              ))}
            </div>
          )}
          {settings.answer === "recall" ? (
            revealMs === null ? (
              <div className="cards-recall">
                <button className="ex-check" onClick={reveal}>
                  Show answer (Space)
                </button>
              </div>
            ) : (
              <>
                <div className="cards-answer">
                  <div className="cards-answer-main">{answerText(showing.shown.steps)}</div>
                  <div className="cards-answer-why">{showing.shown.explain}</div>
                </div>
                <div className="cards-recall">
                  <button className="btn cards-again" onClick={() => selfGrade(false)}>
                    <kbd>1</kbd> Again
                  </button>
                  <button className="btn cards-pass" onClick={() => selfGrade(true)}>
                    <kbd>2</kbd> Pass
                  </button>
                </div>
              </>
            )
          ) : (
            <AnswerPad
              step={showing.shown.steps[Math.min(given.length, showing.shown.steps.length) - (chosen !== null ? 1 : 0)]}
              chosen={chosen}
              reveal={chosen !== null}
              onPick={pick}
            />
          )}
          {chosen !== null && last && (
            <div className={`drill-feedback ${last.ok ? "is-right" : "is-wrong"}`}>
              {last.ok ? (
                "Correct."
              ) : (
                <>
                  <strong>Not quite: {answerText(last.shown.steps)}.</strong> {last.shown.explain}
                  <div>
                    <button className="btn drill-continue" onClick={next} autoFocus>
                      Continue (Enter)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="cards-foot">
            <button className="btn" onClick={finish}>
              Finish
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <SessionSummary def={def} fast={fast} answered={answered} settings={settings} onAgain={start} onSetup={() => setPhase("setup")} />
      )}
    </section>
  );
}

function SessionSummary({ def, fast, answered, settings, onAgain, onSetup }: { def: DeckDef; fast: number; answered: Answered[]; settings: DeckSettings; onAgain: () => void; onSetup: () => void }) {
  const correct = answered.filter((a) => a.ok).length;
  // The keys missed most this session, then the slowest right answers.
  const byCard = new Map<string, { card: Card; miss: number; slow: number; explain: string }>();
  for (const a of answered) {
    const e = byCard.get(a.card.id) ?? { card: a.card, miss: 0, slow: 0, explain: a.shown.explain };
    if (!a.ok) e.miss++;
    else if (a.ms > fast) e.slow++;
    byCard.set(a.card.id, e);
  }
  const weak = [...byCard.values()].filter((e) => e.miss || e.slow).sort((x, y) => y.miss - x.miss || y.slow - x.slow);

  return (
    <div className="drill-card">
      <div className="ex-score">
        <span className="ex-score-num">{answered.length ? Math.round((100 * correct) / answered.length) : 0}%</span>
        <span className="ex-score-of">
          {correct} of {answered.length} right
        </span>
      </div>
      <p className="drill-pass">
        Short sessions spread over several days make cards stick better than one long one.
      </p>
      {weak.length > 0 && (
        <>
          <h3 className="drill-missed-title">Weakest this session</h3>
          <ul className="drill-missed">
            {weak.slice(0, 6).map((e) => (
              <li key={e.card.id}>
                <span className="drill-missed-q">{def.types.length > 1 ? `${def.types.find((t) => t.id === e.card.type)?.label}: ` : ""}{e.card.label}.</span>{" "}
                {e.miss ? `Missed ${e.miss}×. ` : `Slow ${e.slow}×. `}
                {e.explain}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="ex-actions">
        <button className="ex-check" onClick={onAgain}>
          Go again (Enter)
        </button>
        <button className="btn" onClick={onSetup}>
          Change the deck
        </button>
      </div>
      <h3 className="drill-missed-title">How well you know each card</h3>
      <MasteryGrid def={def} settings={settings} />
    </div>
  );
}
