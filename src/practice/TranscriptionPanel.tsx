import { useProject } from "../model/store";
import { useSignal, useUi } from "../model/ui";
import { progress } from "./exercises/state";
import { TR_PASS, type TrIssue } from "./transcription/grade";
import { MelodyStaff } from "./transcription/MelodyStaff";
import { displayNumber, nextStage } from "./course";
import type { DictationStage } from "./transcription/melodies";
import {
  checkTranscription,
  dictations,
  focusedTrIssue,
  focusTrIssue,
  lastTranscription,
  newMelody,
  playKey,
  playMelody,
  playsLeft,
  practiceMode,
  restartTranscription,
  revealAnswer,
  setPracticeMode,
} from "./transcription/state";
import { go } from "./route";
import { prettyCode } from "./drills/theory";

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

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "D4" for a MIDI pitch, spelled as the melody spells it ("f#/4" → "F♯4"). */
const spelledName = (vf: string) => {
  const [name, octave] = vf.split("/");
  return `${prettyCode(name.charAt(0).toUpperCase() + name.slice(1))}${octave}`;
};

export function TranscriptionPanel({ stage }: { stage: DictationStage }) {
  const project = useProject();
  const { cursorTick } = useUi();
  const checked = useSignal(lastTranscription);
  const focus = useSignal(focusedTrIssue);
  const practice = useSignal(practiceMode);
  const d = useSignal(dictations)[stage.id];
  const best = useSignal(progress)[stage.id];
  const lane = project.tracks.find((t) => !t.locked);
  const result = checked?.id === stage.id ? checked.result : null;
  const stale = !!(checked && lane && checked.notes !== lane.notes);
  const revealed = project.tracks.some((t) => t.locked);
  const next = nextStage(stage.id);
  if (!d) return null;
  const m = d.melody;
  const first = m.notes[0];
  const left = playsLeft(stage, d);
  const limited = Number.isFinite(stage.plays) && !practice;

  return (
    <aside className="ex-panel" aria-label="Melodic dictation">
      <div className="ex-number">Melodic dictation, stage {displayNumber(stage.number)}</div>
      <h2 className="ex-title">{capital(stage.title.replace(/^Melodic dictation: /, ""))}</h2>
      <p className="ex-brief">
        Listen, then write the melody in your lane. It's in {prettyCode(m.keyCode)} {m.mode}, {m.timeSig[0]}/{m.timeSig[1]}, and starts on {spelledName(first.vf)}
        {first.start > 0 ? " as a pickup" : ""} (already placed for you).
        {Number.isFinite(stage.plays) ? ` You get ${stage.plays} plays, as in a dictation exam.` : " Play it as often as you like."}
      </p>

      <div className="tr-listen">
        <button className="ex-check" onClick={() => playMelody(stage)} disabled={left <= 0}>
          Play the melody
        </button>
        <button className="btn" onClick={() => playMelody(stage, cursorTick)} disabled={left <= 0} title="Play from the dashed cursor; click the ruler to move it">
          From the cursor
        </button>
        <button className="btn" onClick={() => playKey(m)} title={`A cadence in ${prettyCode(m.keyCode)} ${m.mode}, to set the key in your ear. Doesn't use a play.`}>
          Hear the key
        </button>
      </div>
      <div className="tr-plays">
        {limited ? (
          <span className={left <= 1 ? "is-low" : ""}>
            {left > 0 ? `${left} of ${stage.plays} plays left` : "No plays left: write what you remember, then check."}
          </span>
        ) : (
          <span>{practice ? "Practice mode: no play limit, and checks don't count toward passing." : "No play limit at this stage."}</span>
        )}
        {Number.isFinite(stage.plays) && (
          <label className="tr-practice">
            <input type="checkbox" checked={practice} onChange={(e) => setPracticeMode(e.target.checked, stage)} /> Practice mode
          </label>
        )}
      </div>

      <details className="ex-rules">
        <summary>How to work</summary>
        <ul>
          <li>First play: just listen and count the beat. Second: catch the shape and where the long notes fall. Then fill in a bar at a time.</li>
          <li>Hear each note as a scale degree from do. Sing it back before writing it.</li>
          <li>Press Space to hear what you've written (that doesn't use a play), and compare it with your memory.</li>
          <li>Snap is set to eighth notes; drag a note's end to lengthen it.</li>
        </ul>
      </details>

      <div className="ex-actions">
        <button className="ex-check" onClick={() => checkTranscription(stage)}>
          Check my answer
        </button>
        <button className="btn" onClick={() => restartTranscription(stage)} title="Clear your lane; the melody and plays used stay (Ctrl+Z brings it back)">
          Start over
        </button>
        <button className="btn" onClick={() => newMelody(stage)} title="A different melody, with a fresh set of plays">
          New melody
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
            {checked?.practiced && !checked.revealed && " (Practice mode, so it doesn't count toward progress.)"}
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
            <button className="btn ex-next" onClick={() => revealAnswer(stage)}>
              Show the answer
            </button>
          )}
          {result.passed && (
            <button className="btn ex-next" onClick={() => newMelody(stage)}>
              Another melody
            </button>
          )}
          {result.passed && next && (
            <button className="btn ex-next" onClick={() => go(next.route)}>
              Next: {displayNumber(next.number)} {next.title}
            </button>
          )}
        </div>
      )}
      {(revealed || result?.passed) && (
        <div className="tr-answer">
          <div className="tr-answer-title">The melody in notation</div>
          <MelodyStaff melody={m} width={278} scale={0.8} />
        </div>
      )}
      {revealed && <p className="hint">The answer is also in a muted, locked lane behind yours in the piano roll. Unmute it to hear it.</p>}
    </aside>
  );
}
