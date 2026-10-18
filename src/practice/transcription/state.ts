import { playNotes, stop } from "../../audio/live";
import { makeTrack } from "../../model/demo";
import { focusedNotes, marks, type MarkSeverity } from "../../model/marks";
import { store } from "../../model/store";
import { newId, PPQ, type Note, type Project } from "../../model/types";
import { Signal, ui } from "../../model/ui";
import { recordProgress } from "../exercises/state";
import { gradeTranscription, type TrIssue, type TrResult } from "./grade";
import { melodyEnd, type Melody } from "./melodies";

export interface TrChecked {
  id: string;
  result: TrResult;
  notes: Note[];
  revealed: boolean;
}

export const lastTranscription = new Signal<TrChecked | null>(null);
export const focusedTrIssue = new Signal<TrIssue | null>(null);

// ---- Interval accuracy, kept across sessions -----------------------------------

export type IntervalStats = Record<string, { ok: number; miss: number }>;
const STATS_KEY = "etude.intervals.v1";

function loadStats(): IntervalStats {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as IntervalStats;
  } catch {
    return {};
  }
}

export const intervalStats = new Signal<IntervalStats>(loadStats());

function recordIntervals(list: { semitones: number; ok: boolean }[]) {
  const next = { ...intervalStats.value };
  for (const { semitones, ok } of list) {
    if (semitones === 0) continue;
    const key = String(semitones);
    const cur = next[key] ?? { ok: 0, miss: 0 };
    next[key] = ok ? { ...cur, ok: cur.ok + 1 } : { ...cur, miss: cur.miss + 1 };
  }
  intervalStats.set(next);
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    // Not saved this visit.
  }
}

// ---- The exercise project ------------------------------------------------------------

function transcriptionProject(m: Melody): Project {
  const first = m.notes[0];
  const lane = makeTrack("piano", "Your transcription", [{ id: newId(), pitch: first.pitch, start: first.start, dur: first.dur, vel: 0.75 }]);
  return {
    title: `${m.number} ${m.title}`,
    bpm: m.bpm,
    timeSig: m.timeSig,
    key: 0,
    scale: "major",
    loop: { on: false, start: 0, end: melodyEnd(m) },
    tracks: [lane],
    exercise: { id: m.id },
  };
}

function clear() {
  lastTranscription.set(null);
  focusedTrIssue.set(null);
  marks.set(new Map());
  focusedNotes.set([]);
}

/** Open a melody, or pick up where you left off if it's the one already in progress. */
export function openTranscription(m: Melody) {
  stop();
  if (store.project.exercise?.id !== m.id) {
    store.replace(transcriptionProject(m));
    clear();
  }
  const lane = store.project.tracks.find((t) => !t.locked);
  ui.set({
    selectedTrackId: lane?.id ?? null,
    selectedNoteIds: new Set(),
    cursorTick: 0,
    scrollTick: 0,
    snap: 3, // 1/8
    drawLength: PPQ,
    view: "roll",
  });
}

export function restartTranscription(m: Melody) {
  stop();
  store.replace(transcriptionProject(m));
  clear();
  openTranscription(m);
}

const seconds = (m: Melody, ticks: number) => (ticks / PPQ) * (60 / m.bpm);

/** Play the original melody, from a tick onward. */
export function playMelody(m: Melody, fromTick = 0) {
  const notes = m.notes.filter((n) => n.start + n.dur > fromTick);
  if (!notes.length) return;
  const t0 = Math.max(fromTick, 0);
  void playNotes(notes.map((n) => ({ pitches: [n.pitch], at: seconds(m, Math.max(0, n.start - t0)), dur: seconds(m, n.dur) * 0.95 })));
}

/** Set the key in your ear: a I–IV–V–I cadence in C, then the tonic. */
export function playKey() {
  const t = 60;
  const chords = [
    [t - 12, t, t + 4, t + 7],
    [t - 7, t, t + 5, t + 9],
    [t - 5, t - 1, t + 2, t + 7],
    [t - 12, t, t + 4, t + 7],
  ];
  void playNotes([...chords.map((c, i) => ({ pitches: c, at: i * 0.7, dur: 0.65 })), { pitches: [t], at: 3.1, dur: 1.2 }]);
}

export function checkTranscription(m: Melody): TrResult | null {
  const lane = store.project.tracks.find((t) => !t.locked);
  if (!lane) return null;
  const result = gradeTranscription(m.notes, lane.notes, m.timeSig);
  const revealed = store.project.tracks.some((t) => t.locked);
  lastTranscription.set({ id: m.id, result, notes: lane.notes, revealed });
  const map = new Map<string, MarkSeverity>();
  for (const issue of result.issues) for (const id of issue.noteIds) if (map.get(id) !== "error") map.set(id, issue.severity);
  marks.set(map);
  focusedTrIssue.set(null);
  focusedNotes.set([]);
  if (!result.blocking && !revealed) {
    recordProgress(m.id, result.score, result.passed);
    recordIntervals(result.intervals);
  }
  return result;
}

/** Add the original as a locked lane so you can compare (stops counting toward progress). */
export function revealAnswer(m: Melody) {
  if (store.project.tracks.some((t) => t.locked)) return;
  const answer = { ...makeTrack("piano", "Answer", m.notes.map((n) => ({ id: newId(), ...n, vel: 0.6 }))), locked: true, mute: true };
  store.edit((d) => {
    d.tracks.push(answer);
  });
}

export function focusTrIssue(issue: TrIssue) {
  focusedTrIssue.set(issue);
  focusedNotes.set(issue.noteIds);
  const lane = store.project.tracks.find((t) => !t.locked);
  ui.set({ cursorTick: issue.tick, selectedTrackId: lane?.id ?? null, selectedNoteIds: new Set(issue.noteIds) });
}

/** Your least accurate intervals so far (needs a few attempts each to count). */
export function weakestIntervals(stats: IntervalStats, count = 3) {
  return Object.entries(stats)
    .map(([k, v]) => ({ semitones: Number(k), ...v, rate: v.ok / Math.max(1, v.ok + v.miss) }))
    .filter((x) => x.ok + x.miss >= 3)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, count);
}
