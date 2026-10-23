import { PPQ, ticksPerBar, ticksPerBeat, type Note } from "../../model/types";
import { intervalName } from "../../theory/theory";
import type { Mode, TargetNote } from "./melodies";

/**
 * Grade a transcription note by note. Notes are lined up by order (so one missed note
 * doesn't throw off everything after it), and a whole-melody transposition is
 * accepted: what's graded is the intervals and the rhythm.
 */

export interface TrIssue {
  severity: "error" | "warning";
  rule: string;
  detail: string;
  tick: number;
  /** Your notes involved (target notes aren't in the project). */
  noteIds: string[];
}

export interface TrResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  /** Semitones your version is shifted from the original (0 if written as heard). */
  shift: number;
  issues: TrIssue[];
  /** Each melodic interval in the original, and whether you got it. */
  intervals: { semitones: number; ok: boolean }[];
  blocking?: string;
}

export const TR_PASS = 90;
/** How far a note may start from the right place and still count as on time. */
const ONSET_TOLERANCE = PPQ / 8;

/**
 * Scale degrees by semitones above do, as solfège and number: do-based in both modes, so in
 * minor, me (3) and te (7) are in the key and ti (raised 7) is the leading tone.
 */
const DEGREES: Record<Mode, [string, string][]> = {
  major: [["do", "1"], ["di", "raised 1"], ["re", "2"], ["me", "lowered 3"], ["mi", "3"], ["fa", "4"], ["fi", "raised 4"], ["sol", "5"], ["le", "lowered 6"], ["la", "6"], ["te", "lowered 7"], ["ti", "7"]],
  minor: [["do", "1"], ["ra", "lowered 2"], ["re", "2"], ["me", "3"], ["mi", "raised 3"], ["fa", "4"], ["fi", "raised 4"], ["sol", "5"], ["le", "6"], ["la", "raised 6"], ["te", "7"], ["ti", "raised 7"]],
};

/** "sol (5)", "fi (raised 4)": a pitch as a degree of the key whose do is `tonic`. */
export function degreeLabel(pitch: number, tonic: number, mode: Mode): string {
  const [name, num] = DEGREES[mode][(((pitch - tonic) % 12) + 12) % 12];
  return `${name} (${num})`;
}

/**
 * Grade a transcription. Wrong notes are named by scale degree in the melody's key ("this
 * note is sol; you wrote la"), with the interval from the previous note as a hint.
 */
export function gradeTranscription(target: TargetNote[], mine: Note[], timeSig: [number, number], key: { tonic: number; mode: Mode }): TrResult {
  const S = [...mine].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const T = target;
  const empty = { score: 0, passed: false, correct: 0, total: T.length, shift: 0, issues: [], intervals: [] };
  if (S.length === 0) return { ...empty, blocking: "Write the melody in your lane, then check it." };

  const bar = ticksPerBar({ timeSig });
  const beat = ticksPerBeat({ timeSig });
  const where = (tick: number) => {
    const b = Math.floor(tick / bar) + 1;
    const pos = (tick % bar) / beat + 1;
    const nice = Number.isInteger(pos) ? `${pos}` : Math.abs(pos - Math.floor(pos) - 0.5) < 0.01 ? `${Math.floor(pos)}½` : pos.toFixed(2);
    return pos === 1 ? `bar ${b}` : `bar ${b}, beat ${nice}`;
  };

  // The likeliest transposition: the commonest pitch difference between notes that line up in time.
  const votes = new Map<number, number>();
  for (const t of T) {
    for (const s of S) {
      if (Math.abs(s.start - t.start) <= ONSET_TOLERANCE) votes.set(s.pitch - t.pitch, (votes.get(s.pitch - t.pitch) ?? 0) + 1);
    }
  }
  let shift = 0;
  let bestVotes = 0;
  for (const [d, v] of votes) if (v > bestVotes || (v === bestVotes && Math.abs(d) < Math.abs(shift))) [shift, bestVotes] = [d, v];

  const pitchOk = (t: TargetNote, s: Note) => s.pitch - shift === t.pitch;
  const onsetOk = (t: TargetNote, s: Note) => Math.abs(s.start - t.start) <= ONSET_TOLERANCE;

  // Align by order: edit distance where a note can match, be missing, or be extra.
  const GAP = 1.2;
  const n = T.length;
  const m = S.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) cost[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) cost[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = (pitchOk(T[i - 1], S[j - 1]) ? 0 : 1) + (onsetOk(T[i - 1], S[j - 1]) ? 0 : 1);
      cost[i][j] = Math.min(cost[i - 1][j - 1] + c, cost[i - 1][j] + GAP, cost[i][j - 1] + GAP);
    }
  }
  const pairOf: (number | null)[] = new Array(n).fill(null);
  const usedS = new Set<number>();
  for (let i = n, j = m; i > 0 || j > 0; ) {
    if (i > 0 && j > 0) {
      const c = (pitchOk(T[i - 1], S[j - 1]) ? 0 : 1) + (onsetOk(T[i - 1], S[j - 1]) ? 0 : 1);
      if (Math.abs(cost[i][j] - (cost[i - 1][j - 1] + c)) < 1e-9) {
        pairOf[i - 1] = j - 1;
        usedS.add(j - 1);
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && Math.abs(cost[i][j] - (cost[i - 1][j] + GAP)) < 1e-9) i--;
    else j--;
  }

  const issues: TrIssue[] = [];
  let correct = 0;
  let lengthSlips = 0;
  // Your notes are named in the key you wrote in (the melody's, moved by any transposition).
  const heard = (p: number) => degreeLabel(p, key.tonic, key.mode);
  const yours = (p: number) => degreeLabel(p - shift, key.tonic, key.mode);
  const move = (semis: number) => (semis === 0 ? "the same note" : `${semis > 0 ? "up" : "down"} a ${intervalName(Math.abs(semis))}`);

  // Runs of unwritten notes are reported once, not note by note.
  for (let i = 0; i < n; ) {
    if (pairOf[i] !== null) {
      i++;
      continue;
    }
    let k = i;
    while (k + 1 < n && pairOf[k + 1] === null) k++;
    const count = k - i + 1;
    issues.push({
      severity: "error",
      rule: count === 1 ? "Missing note" : "Missing notes",
      detail: count === 1 ? `There's a note at ${where(T[i].start)} you haven't written.` : `${count} notes from ${where(T[i].start)} to ${where(T[k].start)} aren't written yet.`,
      tick: T[i].start,
      noteIds: [],
    });
    i = k + 1;
  }

  T.forEach((t, i) => {
    const j = pairOf[i];
    if (j === null) return;
    const s = S[j];
    const pOk = pitchOk(t, s);
    const oOk = onsetOk(t, s);
    if (pOk && oOk) {
      correct++;
      const tooShort = s.dur < t.dur * 0.5 && t.dur - s.dur >= PPQ / 2;
      const tooLong = s.dur > t.dur * 1.5 && s.dur - t.dur >= PPQ / 2;
      if (tooShort || tooLong) {
        lengthSlips++;
        issues.push({ severity: "warning", rule: "Note length", detail: `The note at ${where(t.start)} should be held ${t.dur / PPQ} beat${t.dur === PPQ ? "" : "s"}; yours is ${s.dur / PPQ}.`, tick: s.start, noteIds: [s.id] });
      }
      return;
    }
    if (!pOk) {
      const prevT = T[i - 1];
      const prevJ = i > 0 ? pairOf[i - 1] : null;
      let detail = `This note is ${heard(t.pitch)}; you wrote ${yours(s.pitch)}.`;
      if (prevT && prevJ !== null) {
        const want = t.pitch - prevT.pitch;
        const got = s.pitch - S[prevJ].pitch;
        if (want !== got) detail += ` (From the note before: ${move(want)}; yours is ${move(got)}.)`;
      }
      issues.push({ severity: "error", rule: oOk ? "Wrong note" : "Wrong note and timing", detail, tick: s.start, noteIds: [s.id] });
    } else {
      const diff = s.start - t.start;
      const amount = Math.abs(diff) / PPQ;
      issues.push({
        severity: "error",
        rule: "Timing",
        detail: `This ${yours(s.pitch)} starts ${amount === 0.5 ? "half a beat" : `${amount} beat${amount === 1 ? "" : "s"}`} ${diff > 0 ? "late" : "early"}; it belongs at ${where(t.start)}.`,
        tick: s.start,
        noteIds: [s.id],
      });
    }
  });

  const extras = S.filter((_, j) => !usedS.has(j));
  for (const s of extras) {
    issues.push({ severity: "warning", rule: "Extra note", detail: `The ${yours(s.pitch)} at ${where(s.start)} isn't in the melody.`, tick: s.start, noteIds: [s.id] });
  }

  const intervals = T.slice(1).map((t, k) => {
    const i = k + 1;
    const a = pairOf[i - 1];
    const b = pairOf[i];
    const ok = a !== null && b !== null && S[b].pitch - S[a].pitch === t.pitch - T[i - 1].pitch;
    return { semitones: t.pitch - T[i - 1].pitch, ok };
  });

  issues.sort((x, y) => x.tick - y.tick);
  const score = Math.max(0, Math.round((100 * correct) / T.length) - 5 * extras.length - 2 * lengthSlips);
  return { score, passed: score >= TR_PASS, correct, total: T.length, shift, issues, intervals };
}
