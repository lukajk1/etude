import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playNotes, preparePiano } from "../audio/live";
import { AnswerPad, answerLabel, LETTERS, RhythmStaff, Staff } from "./Answers";
import { deckForDrill } from "./cards/decks";
import { DRILLS, isRight, ROUND_LENGTH, type Drill, type Question } from "./drills/catalog";
import { go } from "./route";
import { progress, recordProgress } from "./exercises/state";
import { useSignal } from "../model/ui";

// ---- The drill -----------------------------------------------------------------------

interface Answered {
  question: Question;
  given: string[];
  ok: boolean;
  ms: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function passMarks(d: Drill) {
  return `${Math.round(d.pass.accuracy * 100)}% correct${d.pass.medianSec ? `, answering in ${d.pass.medianSec} s or less (median)` : ""}`;
}

const UNIT_NAMES: Record<string, string> = {
  harmony: "Hearing harmony",
  rhythm: "Rhythm and meter",
  cadences: "Cadences",
  nct: "Non-chord tones",
  harmonize: "Harmonizing a melody",
};

export default function DrillView({ id }: { id: string }) {
  const drill = DRILLS.find((d) => d.id === id)!;
  const best = useSignal(progress)[drill.id];
  const deck = deckForDrill(drill.id);
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [given, setGiven] = useState<string[]>([]);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [reveal, setReveal] = useState(false);
  const [now, setNow] = useState(0);
  const shownAt = useRef(0);

  // Reset whenever a different drill is opened.
  useEffect(() => {
    setPhase("intro");
    setAnswered([]);
    if (drill.ear) preparePiano();
  }, [drill]);

  const question = questions[index];
  const step = question?.steps[stepIndex];

  const start = () => {
    setQuestions(Array.from({ length: ROUND_LENGTH }, () => drill.generate()));
    setIndex(0);
    setStepIndex(0);
    setGiven([]);
    setAnswered([]);
    setReveal(false);
    setPhase("run");
    shownAt.current = performance.now();
  };

  // Play ear questions as they appear.
  useEffect(() => {
    if (phase === "run" && question?.audio && !reveal) void playNotes(question.audio);
  }, [phase, question, reveal]);

  // A running clock for the current question.
  useEffect(() => {
    if (phase !== "run" || reveal) return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [phase, reveal, index]);

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase("done");
      return;
    }
    setIndex(index + 1);
    setStepIndex(0);
    setGiven([]);
    setReveal(false);
    shownAt.current = performance.now();
    setNow(performance.now());
  }, [index, questions.length]);

  const pickAnswer = useCallback(
    (value: string) => {
      if (!question || reveal) return;
      const all = [...given, value];
      if (stepIndex + 1 < question.steps.length) {
        setGiven(all);
        setStepIndex(stepIndex + 1);
        return;
      }
      const ok = question.steps.every((s, i) => isRight(s, all[i]));
      setGiven(all);
      setAnswered((a) => [...a, { question, given: all, ok, ms: performance.now() - shownAt.current }]);
      setReveal(true);
      if (ok) setTimeout(next, 650);
      // After a wrong scale-degree answer, hear the note walk home to do.
      else if (question.resolve) setTimeout(() => void playNotes(question.resolve!), 250);
    },
    [question, reveal, given, stepIndex, next],
  );

  // Keyboard: letters and digits answer, Enter continues, R replays audio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === "intro" && e.key === "Enter") {
        e.preventDefault();
        start();
        return;
      }
      if (phase !== "run" || !step) return;
      const k = e.key.toUpperCase();
      if (reveal) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          next();
        }
        return;
      }
      if (k === "R" && question.audio) {
        void playNotes(question.audio);
      } else if ((step.type === "letter" || step.type === "note") && LETTERS.includes(k)) {
        pickAnswer(k);
      } else if (step.type === "degree" && /^[1-7]$/.test(e.key)) {
        pickAnswer(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const results = useMemo(() => {
    if (phase !== "done") return null;
    const correct = answered.filter((a) => a.ok).length;
    const accuracy = correct / Math.max(1, answered.length);
    const med = median(answered.map((a) => a.ms)) / 1000;
    const accOk = accuracy >= drill.pass.accuracy;
    const timeOk = !drill.pass.medianSec || med <= drill.pass.medianSec;
    return { correct, accuracy, med, accOk, timeOk, passed: accOk && timeOk };
  }, [phase, answered, drill]);

  // Save the result once per finished round.
  const saved = useRef<Answered[] | null>(null);
  useEffect(() => {
    if (results && saved.current !== answered) {
      saved.current = answered;
      recordProgress(drill.id, Math.round(results.accuracy * 100), results.passed);
    }
  }, [results, answered, drill.id]);

  const elapsed = phase === "run" && !reveal ? Math.max(0, (now - shownAt.current) / 1000) : null;
  const last = answered[answered.length - 1];

  return (
    <section className="drill" aria-label={`Drill ${drill.number}: ${drill.title}`}>
      <div className="drill-head">
        <div>
          <div className="drill-number">
            {UNIT_NAMES[drill.unit ?? ""] ?? "Foundations"}, drill {drill.number}
          </div>
          <h2 className="drill-title">{drill.title}</h2>
        </div>
        <button className="btn" onClick={() => go({ kind: "home" })}>
          Back to the Practice Room
        </button>
      </div>

      {phase === "intro" && (
        <div className="drill-card">
          <p className="drill-brief">{drill.brief}</p>
          <p className="drill-pass">
            To pass: {passMarks(drill)}, over {ROUND_LENGTH} questions.
            {drill.ear ? " Headphones help." : ""}
          </p>
          {best && (
            <p className="drill-pass">
              Your best: {best.best}% {best.passed ? "(passed)" : ""}
            </p>
          )}
          <div className="ex-actions">
            <button className="ex-check drill-start" onClick={start}>
              Start
            </button>
            {deck && (
              <button className="btn" onClick={() => go({ kind: "cards", id: deck.id })}>
                Practice as flashcards
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "run" && question && step && (
        <div className="drill-card">
          <div className="drill-progress">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>{answered.filter((a) => a.ok).length} correct</span>
            <span className="drill-clock">{elapsed !== null ? `${elapsed.toFixed(1)} s` : ""}</span>
          </div>
          <div className="drill-bar">
            <div style={{ width: `${(index / questions.length) * 100}%` }} />
          </div>
          <p className="drill-prompt">{question.prompt}</p>
          {question.staff && (
            <div className="drill-paper">
              <Staff spec={question.staff} />
            </div>
          )}
          {question.rhythm && (
            <div className="drill-paper">
              <RhythmStaff spec={question.rhythm} />
            </div>
          )}
          {question.audio && (
            <button className="btn drill-replay" onClick={() => void playNotes(question.audio!)}>
              Play again (R)
            </button>
          )}
          {question.steps.length > 1 && (
            <div className="drill-steps">
              {question.steps.map((s, i) => (
                <span key={i} className={i === stepIndex && !reveal ? "is-current" : ""}>
                  {s.label}: {given[i] ? answerLabel(s.type, given[i]) : "…"}
                </span>
              ))}
            </div>
          )}
          <AnswerPad step={reveal ? question.steps[question.steps.length - 1] : step} chosen={reveal ? given[given.length - 1] : null} reveal={reveal} onPick={pickAnswer} />
          {reveal && last && (
            <div className={`drill-feedback ${last.ok ? "is-right" : "is-wrong"}`}>
              {last.ok ? (
                "Correct."
              ) : (
                <>
                  <strong>
                    Not quite: {question.steps.map((s) => answerLabel(s.type, s.correct)).join(", ")}.
                  </strong>{" "}
                  {question.explain}
                  <div>
                    <button className="btn drill-continue" onClick={next} autoFocus>
                      Continue (Enter)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "done" && results && (
        <div className="drill-card">
          <div className="ex-score">
            <span className="ex-score-num">{Math.round(results.accuracy * 100)}%</span>
            <span className="ex-score-of">
              {results.correct} of {answered.length}
            </span>
            <span className={`ex-badge ${results.passed ? "is-pass" : "is-fail"}`}>{results.passed ? "Passed" : "Not yet"}</span>
          </div>
          <ul className="drill-criteria">
            <li className={results.accOk ? "is-met" : "is-unmet"}>
              Accuracy {Math.round(results.accuracy * 100)}% (need {Math.round(drill.pass.accuracy * 100)}%)
            </li>
            {drill.pass.medianSec ? (
              <li className={results.timeOk ? "is-met" : "is-unmet"}>
                Median answer time {results.med.toFixed(1)} s (need {drill.pass.medianSec} s or less)
              </li>
            ) : (
              <li className="is-met">Median answer time {results.med.toFixed(1)} s (not graded for ear drills)</li>
            )}
          </ul>
          {answered.some((a) => !a.ok) && (
            <>
              <h3 className="drill-missed-title">To review</h3>
              <ul className="drill-missed">
                {answered
                  .filter((a) => !a.ok)
                  .map((a, i) => (
                    <li key={i}>
                      <span className="drill-missed-q">{a.question.prompt}</span> You said{" "}
                      {a.given.map((g, j) => answerLabel(a.question.steps[j].type, g)).join(", ")}; it's{" "}
                      {a.question.steps.map((s) => answerLabel(s.type, s.correct)).join(", ")}. {a.question.explain}
                    </li>
                  ))}
              </ul>
            </>
          )}
          <div className="ex-actions">
            <button className="ex-check" onClick={start}>
              Go again
            </button>
            {results.passed && DRILLS[DRILLS.indexOf(drill) + 1] && (
              <button className="btn" onClick={() => go({ kind: "drill", id: DRILLS[DRILLS.indexOf(drill) + 1].id })}>
                Next drill
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
