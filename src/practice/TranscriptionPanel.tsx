import { useProject } from "../model/store";
import { useSignal, useUi } from "../model/ui";
import { progress } from "./exercises/state";
import { TR_PASS, type TrIssue } from "./transcription/grade";
import { intervalsUsed, MELODIES, type Melody } from "./transcription/melodies";
import { checkTranscription, focusedTrIssue, focusTrIssue, lastTranscription, playKey, playMelody, restartTranscription, revealAnswer } from "./transcription/state";
import { go } from "./route";
import { noteName } from "../theory/theory";

function IssueRow({ issue, active }: { issue: TrIssue; active: boolean }) {
  return (
    <li>
      <button className={`ex-issue is-${issue.severity}${active ? " is-active" : ""}`} onClick={() => focusTrIssue(issue)}>
        <span className="ex-issue-dot" aria-label={issue.severity === "error" ? "Error" : "Warning"} />
        <span className="ex-issue-body">
          <span className="ex-issue-rule">{issue.rule}</span>
          <span className="ex-issue-detail">{issue.detail}</span>
        </span>
      </button>
    </li>
  );
}

export function TranscriptionPanel({ melody }: { melody: Melody }) {
  const project = useProject();
  const { cursorTick } = useUi();
  const checked = useSignal(lastTranscription);
  const focus = useSignal(focusedTrIssue);
  const best = useSignal(progress)[melody.id];
  const lane = project.tracks.find((t) => !t.locked);
  const result = checked?.id === melody.id ? checked.result : null;
  const stale = !!(checked && lane && checked.notes !== lane.notes);
  const revealed = project.tracks.some((t) => t.locked);
  const next = MELODIES[MELODIES.indexOf(melody) + 1];
  const first = melody.notes[0];

  return (
    <aside className="ex-panel" aria-label="Transcription">
      <div className="ex-number">Transcription {melody.number}</div>
      <h2 className="ex-title">{melody.title}</h2>
      <p className="ex-brief">
        Listen, then write the melody in your lane. It's in C major, {melody.timeSig[0]}/{melody.timeSig[1]}, and starts on {noteName(first.pitch)} (already placed for you).
      </p>
      <div className="tr-chips" aria-label="Intervals in this melody">
        {intervalsUsed(melody).map((iv) => (
          <span key={iv} className="tr-chip">
            {iv}
          </span>
        ))}
      </div>

      <div className="tr-listen">
        <button className="ex-check" onClick={() => playMelody(melody)}>
          Play the melody
        </button>
        <button className="btn" onClick={() => playMelody(melody, cursorTick)} title="Play from the dashed cursor; click the ruler to move it">
          From the cursor
        </button>
        <button className="btn" onClick={playKey} title="A I–IV–V–I cadence in C, to set the key in your ear">
          Hear the key
        </button>
      </div>

      <details className="ex-rules">
        <summary>How to work</summary>
        <ul>
          <li>Sing each phrase back before writing it.</li>
          <li>Guess the next note first (as an interval or a scale degree), then play your guess to check it. Don't hunt key by key.</li>
          <li>Press Space to hear what you've written, and compare.</li>
          <li>Snap is set to eighth notes; drag a note's end to lengthen it.</li>
        </ul>
      </details>

      <div className="ex-actions">
        <button className="ex-check" onClick={() => checkTranscription(melody)}>
          Check my answer
        </button>
        <button className="btn" onClick={() => restartTranscription(melody)} title="Clear your lane (Ctrl+Z brings it back)">
          Start over
        </button>
      </div>
      {best && (
        <div className="ex-best">
          Best score {best.best}
          {best.passed ? ", passed" : ""}
        </div>
      )}

      {result?.blocking && <div className="ex-blocking">{result.blocking}</div>}

      {result && !result.blocking && (
        <div className={`ex-result${stale ? " is-stale" : ""}`}>
          <div className="ex-score">
            <span className="ex-score-num">{result.score}</span>
            <span className="ex-score-of">
              {result.correct} of {result.total} notes
            </span>
            <span className={`ex-badge ${result.passed ? "is-pass" : "is-fail"}`}>{result.passed ? "Passed" : "Not yet"}</span>
          </div>
          <div className="ex-summary">
            {result.issues.length === 0 ? "Every note right." : `Reach ${TR_PASS} to pass.`}
            {result.shift !== 0 && ` You wrote it ${Math.abs(result.shift)} semitone${Math.abs(result.shift) === 1 ? "" : "s"} ${result.shift > 0 ? "higher" : "lower"} than played; that's fine, it's graded by intervals.`}
            {checked?.revealed && " (Checked with the answer showing, so it doesn't count toward progress.)"}
          </div>
          {stale && <div className="ex-stale">You've edited since this check.</div>}
          {result.issues.length > 0 && (
            <ul className="ex-issues">
              {result.issues.map((issue, i) => (
                <IssueRow key={i} issue={issue} active={focus === issue} />
              ))}
            </ul>
          )}
          {!result.passed && !revealed && (
            <button className="btn ex-next" onClick={() => revealAnswer(melody)}>
              Show the answer
            </button>
          )}
          {result.passed && next && (
            <button className="btn ex-next" onClick={() => go({ kind: "transcribe", id: next.id })}>
              Next: {next.number} {next.title}
            </button>
          )}
        </div>
      )}
      {revealed && <p className="hint">The answer is in a muted, locked lane and shows behind yours in the piano roll. Unmute it to hear it.</p>}
    </aside>
  );
}
