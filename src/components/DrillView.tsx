import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { playNotes, preparePiano } from "../audio/live";
import { DRILLS, EAR_INTERVALS, ROUND_LENGTH, SOLFEGE, type AnswerType, type Drill, type Question, type StaffSpec, type Step } from "../drills/catalog";
import { activeDrill } from "../drills/state";
import { MAJOR_KEYS, MINOR_KEYS, accidentalsLabel, intervalLabel, prettyCode, vfKey } from "../drills/theory";
import { progress, recordProgress } from "../exercises/state";
import { useSignal } from "../model/ui";

// ---- Staff --------------------------------------------------------------------

const SCALE = 1.5;

function Staff({ spec }: { spec: StaffSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const sigWidth = spec.keySig ? 14 * (MAJOR_KEYS.find((k) => k.code === spec.keySig)?.accidentals ?? 0) : 0;
    const width = 120 + Math.abs(sigWidth) + spec.groups.length * 70;
    const height = 140;
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width * SCALE, height * SCALE);
    const ctx = renderer.getContext();
    ctx.scale(SCALE, SCALE);
    const stave = new Stave(8, 20, width - 16);
    stave.addClef(spec.clef);
    if (spec.keySig && spec.keySig !== "C") stave.addKeySignature(spec.keySig);
    stave.setContext(ctx).draw();
    if (spec.groups.length) {
      const notes = spec.groups.map((group) => {
        const sorted = [...group];
        const note = new StaveNote({ keys: sorted.map(vfKey), duration: "w", clef: spec.clef });
        sorted.forEach((n, i) => {
          if (n.acc !== 0) note.addModifier(new Accidental(n.acc === 1 ? "#" : n.acc === -1 ? "b" : n.acc === 2 ? "##" : "bb"), i);
        });
        return note;
      });
      const voice = new Voice({ num_beats: 4 * notes.length, beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], width - stave.getNoteStartX() - 30);
      voice.draw(ctx, stave);
    }
  }, [spec]);
  return <div className="drill-staff" ref={ref} />;
}

// ---- Answer pads -------------------------------------------------------------------

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const INTERVAL_ROWS: { label: string; cells: (string | null)[] }[] = [
  { label: "Augmented", cells: ["A2", null, "A4", "A5", "A6", null, null] },
  { label: "Major / perfect", cells: ["M2", "M3", "P4", "P5", "M6", "M7", "P8"] },
  { label: "Minor", cells: ["m2", "m3", null, null, "m6", "m7", null] },
  { label: "Diminished", cells: [null, null, null, "d5", null, "d7", null] },
];
const INTERVAL_COLS = ["2nd", "3rd", "4th", "5th", "6th", "7th", "8ve"];

export function answerLabel(type: AnswerType, value: string): string {
  switch (type) {
    case "letter":
    case "note":
      return prettyCode(value);
    case "interval":
      return intervalLabel(value);
    case "majorKey":
      return `${prettyCode(value)} major`;
    case "minorKey":
      return `${prettyCode(value)} minor`;
    case "accidentals":
      return accidentalsLabel(Number(value));
    case "triadQuality":
      return value;
    case "degree":
      return `${value} (${SOLFEGE[Number(value) - 1]})`;
    case "earInterval":
      return Object.values(EAR_INTERVALS).find((e) => e.code === value)?.label ?? value;
  }
}

interface PadProps {
  step: Step;
  chosen: string | null;
  reveal: boolean;
  onPick: (value: string) => void;
}

function Choice({ value, label, step, chosen, reveal, onPick, wide }: PadProps & { value: string; label: string; wide?: boolean }) {
  let cls = "drill-choice";
  if (wide) cls += " is-wide";
  if (reveal && value === step.correct) cls += " is-right";
  else if (reveal && value === chosen) cls += " is-wrong";
  return (
    <button className={cls} disabled={reveal} onClick={() => onPick(value)} title={answerLabel(step.type, value)}>
      {label}
    </button>
  );
}

function AnswerPad(props: PadProps) {
  const { step } = props;
  switch (step.type) {
    case "letter":
      return (
        <div className="drill-row">
          {LETTERS.map((l) => (
            <Choice key={l} {...props} value={l} label={l} />
          ))}
        </div>
      );
    case "note":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {["b", "", "#"].flatMap((acc) => LETTERS.map((l) => <Choice key={l + acc} {...props} value={l + acc} label={prettyCode(l + acc)} />))}
        </div>
      );
    case "interval":
      return (
        <div className="drill-intervals">
          <span />
          {INTERVAL_COLS.map((c) => (
            <span key={c} className="drill-axis">
              {c}
            </span>
          ))}
          {INTERVAL_ROWS.map((row) => [
            <span key={row.label} className="drill-axis is-row">
              {row.label}
            </span>,
            ...row.cells.map((cell, i) => (cell ? <Choice key={cell} {...props} value={cell} label={cell} /> : <span key={row.label + i} />)),
          ])}
        </div>
      );
    case "majorKey":
    case "minorKey": {
      const keys = step.type === "majorKey" ? MAJOR_KEYS : MINOR_KEYS;
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {keys.map((k) => (
            <Choice key={k.code} {...props} value={k.code} label={prettyCode(k.code)} />
          ))}
        </div>
      );
    }
    case "accidentals":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {Array.from({ length: 15 }, (_, i) => i - 7).map((n) => (
            <Choice key={n} {...props} value={String(n)} label={accidentalsLabel(n)} />
          ))}
        </div>
      );
    case "triadQuality":
      return (
        <div className="drill-row">
          {["major", "minor", "diminished", "augmented"].map((q) => (
            <Choice key={q} {...props} value={q} label={q[0].toUpperCase() + q.slice(1)} wide />
          ))}
        </div>
      );
    case "degree":
      return (
        <div className="drill-row">
          {SOLFEGE.map((s, i) => (
            <Choice key={s} {...props} value={String(i + 1)} label={`${i + 1} ${s}`} />
          ))}
        </div>
      );
    case "earInterval":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: `repeat(${Math.min(6, step.options?.length ?? 6)}, minmax(0, 1fr))` }}>
          {(step.options ?? []).map((code) => (
            <Choice key={code} {...props} value={code} label={answerLabel("earInterval", code)} wide />
          ))}
        </div>
      );
  }
}

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

export default function DrillView() {
  const id = useSignal(activeDrill);
  const drill = DRILLS.find((d) => d.id === id)!;
  const best = useSignal(progress)[drill.id];
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
      const ok = question.steps.every((s, i) => s.correct === all[i]);
      setGiven(all);
      setAnswered((a) => [...a, { question, given: all, ok, ms: performance.now() - shownAt.current }]);
      setReveal(true);
      if (ok) setTimeout(next, 650);
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
          <div className="drill-number">Foundations, drill {drill.number}</div>
          <h2 className="drill-title">{drill.title}</h2>
        </div>
        <button className="btn" onClick={() => activeDrill.set(null)}>
          Back to the editor
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
          <button className="ex-check drill-start" onClick={start}>
            Start
          </button>
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
              <button className="btn" onClick={() => activeDrill.set(DRILLS[DRILLS.indexOf(drill) + 1].id)}>
                Next drill
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
