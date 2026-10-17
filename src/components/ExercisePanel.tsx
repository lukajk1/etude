import { EXERCISES, type Exercise } from "../exercises/catalog";
import { PASS_SCORE, type Issue } from "../exercises/grade";
import { checkWork, focused, focusIssue, lastCheck, openExercise, progress, resetWork, studentTrack } from "../exercises/state";
import { useProject } from "../model/store";
import { ticksPerBar } from "../model/types";
import { useSignal } from "../model/ui";

function IssueItem({ issue, active, barTicks }: { issue: Issue; active: boolean; barTicks: number }) {
  return (
    <li>
      <button className={`ex-issue is-${issue.severity}${active ? " is-active" : ""}`} onClick={() => focusIssue(issue)}>
        <span className="ex-issue-dot" aria-label={issue.severity === "error" ? "Error" : "Warning"} />
        <span className="ex-issue-body">
          <span className="ex-issue-rule">
            {issue.rule}
            <span className="ex-issue-bar">bar {Math.floor(issue.tick / barTicks) + 1}</span>
          </span>
          <span className="ex-issue-detail">{issue.detail}</span>
        </span>
      </button>
    </li>
  );
}

export function ExercisePanel({ ex }: { ex: Exercise }) {
  const project = useProject();
  const check = useSignal(lastCheck);
  const prog = useSignal(progress)[ex.id];
  const focus = useSignal(focused);
  const student = studentTrack(project);
  const result = check?.exerciseId === ex.id ? check.result : null;
  const stale = !!(check && student && check.notes !== student.notes);
  const errors = result?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.severity === "warning") ?? [];
  const next = EXERCISES[EXERCISES.indexOf(ex) + 1];

  return (
    <aside className="ex-panel" aria-label="Exercise">
      <div className="ex-number">Exercise {ex.number}</div>
      <h2 className="ex-title">{ex.title}</h2>
      <p className="ex-brief">{ex.brief}</p>

      <details className="ex-rules" open>
        <summary>Rules</summary>
        <ul>
          {ex.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
      <details className="ex-rules">
        <summary>Why this matters</summary>
        <p>{ex.why}</p>
      </details>

      <div className="ex-actions">
        <button className="ex-check" onClick={() => checkWork()}>
          Check my work
        </button>
        <button className="btn" onClick={resetWork} title="Clear your lane (Ctrl+Z brings it back)">
          Start over
        </button>
      </div>
      {prog && (
        <div className="ex-best">
          Best score {prog.best}
          {prog.passed ? ", passed" : ""}
        </div>
      )}

      {result?.blocking && <div className="ex-blocking">{result.blocking}</div>}

      {result && !result.blocking && (
        <div className={`ex-result${stale ? " is-stale" : ""}`}>
          <div className="ex-score">
            <span className="ex-score-num">{result.score}</span>
            <span className="ex-score-of">/ 100</span>
            <span className={`ex-badge ${result.passed ? "is-pass" : "is-fail"}`}>{result.passed ? "Passed" : "Not yet"}</span>
          </div>
          <div className="ex-summary">
            {errors.length === 0 && warnings.length === 0
              ? "No problems found. Press Space to hear it."
              : `${errors.length} ${errors.length === 1 ? "error" : "errors"}, ${warnings.length} style ${warnings.length === 1 ? "warning" : "warnings"}. ${result.passed ? "" : errors.length ? "Fix every error to pass." : `Reach ${PASS_SCORE} to pass.`}`}
          </div>
          {stale && <div className="ex-stale">You've edited since this check.</div>}
          {result.issues.length > 0 && (
            <ul className="ex-issues">
              {result.issues.map((issue, i) => (
                <IssueItem key={i} issue={issue} active={focus === issue} barTicks={ticksPerBar(project)} />
              ))}
            </ul>
          )}
          {result.passed && next && (
            <button className="btn ex-next" onClick={() => openExercise(next)}>
              Next: {next.number} {next.title}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
