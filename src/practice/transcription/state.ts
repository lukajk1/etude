import { playNotes, stop } from "../../audio/live";
import { makeTrack } from "../../model/demo";
import { focusedNotes, marks, type MarkSeverity } from "../../model/marks";
import { store } from "../../model/store";
import { newId, PPQ, type Note, type Project } from "../../model/types";
import { Signal, ui } from "../../model/ui";
import { recordProgress } from "../exercises/state";
import { generateMelody } from "./generate";
import { gradeTranscription, type TrIssue, type TrResult } from "./grade";
import { melodyEnd, type DictationStage, type Melody } from "./melodies";

export interface TrChecked {
  id: string;
  result: TrResult;
  notes: Note[];
  revealed: boolean;
  /** Checked in practice mode, so it didn't count. */
  practiced: boolean;
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

// ---- The current melody for each stage, kept across visits -------------------

/** A stage's melody in progress: how many times it's been played, and whether practice mode was on for it. */
export interface Dictation {
  melody: Melody;
  plays: number;
  /** Played or checked in practice mode (no play limit), so its check doesn't count. */
  practiced: boolean;
}

const DICTATION_KEY = "etude.dictation.v1";

function loadDictations(): Record<string, Dictation> {
  try {
    return JSON.parse(localStorage.getItem(DICTATION_KEY) ?? "{}") as Record<string, Dictation>;
  } catch {
    return {};
  }
}

export const dictations = new Signal<Record<string, Dictation>>(loadDictations());

function saveDictation(stageId: string, d: Dictation) {
  const next = { ...dictations.value, [stageId]: d };
  dictations.set(next);
  try {
    localStorage.setItem(DICTATION_KEY, JSON.stringify(next));
  } catch {
    // Not kept this visit.
  }
}

/** Practice mode: no play limit, and checks don't count toward progress. */
export const practiceMode = new Signal<boolean>(false);

export function setPracticeMode(on: boolean, stage: DictationStage) {
  practiceMode.set(on);
  const d = dictations.value[stage.id];
  if (on && d) saveDictation(stage.id, { ...d, practiced: true });
}

export const playsLeft = (stage: DictationStage, d: Dictation | undefined) => (practiceMode.value ? Infinity : stage.plays - (d?.plays ?? 0));

// ---- The exercise project ------------------------------------------------------------

function transcriptionProject(stage: DictationStage, m: Melody): Project {
  const first = m.notes[0];
  const lane = makeTrack("piano", "Your transcription", [{ id: newId(), pitch: first.pitch, start: first.start, dur: first.dur, vel: 0.75 }]);
  return {
    title: `${stage.number} ${stage.title}`,
    bpm: m.bpm,
    timeSig: m.timeSig,
    key: m.tonic,
    scale: m.mode === "minor" ? "minor" : "major",
    loop: { on: false, start: 0, end: melodyEnd(m) },
    tracks: [lane],
    exercise: { id: stage.id },
  };
}

function clear() {
  lastTranscription.set(null);
  focusedTrIssue.set(null);
  marks.set(new Map());
  focusedNotes.set([]);
}

function setupView() {
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

/** Open a stage: pick up its melody in progress, or start a fresh one. */
export function openTranscription(stage: DictationStage) {
  stop();
  const d = dictations.value[stage.id];
  if (!d) {
    newMelody(stage);
    return;
  }
  if (store.project.exercise?.id !== stage.id) {
    store.replace(transcriptionProject(stage, d.melody));
    clear();
  }
  setupView();
}

/** A fresh melody for the stage, with a full set of plays. */
export function newMelody(stage: DictationStage) {
  stop();
  const melody = generateMelody(stage);
  saveDictation(stage.id, { melody, plays: 0, practiced: practiceMode.value });
  store.replace(transcriptionProject(stage, melody));
  clear();
  setupView();
}

/** Clear your lane; the melody and the plays used stay. */
export function restartTranscription(stage: DictationStage) {
  const d = dictations.value[stage.id];
  if (!d) return newMelody(stage);
  stop();
  store.replace(transcriptionProject(stage, d.melody));
  clear();
  setupView();
}

const seconds = (m: Melody, ticks: number) => (ticks / PPQ) * (60 / m.bpm);

/** Play the melody from a tick onward, if a play is left. Each play counts, from the start or the cursor. */
export function playMelody(stage: DictationStage, fromTick = 0) {
  const d = dictations.value[stage.id];
  if (!d || playsLeft(stage, d) <= 0) return;
  const m = d.melody;
  const notes = m.notes.filter((n) => n.start + n.dur > fromTick);
  if (!notes.length) return;
  saveDictation(stage.id, { ...d, plays: d.plays + 1, practiced: d.practiced || practiceMode.value });
  const t0 = Math.max(fromTick, Math.min(...notes.map((n) => n.start)));
  void playNotes(notes.map((n) => ({ pitches: [n.pitch], at: seconds(m, Math.max(0, n.start - t0)), dur: seconds(m, n.dur) * 0.95 })));
}

/** Set the key in your ear: I-IV-V-I in the melody's key (i-iv-V-i in minor), then the tonic. Free; doesn't use a play. */
export function playKey(m: Melody) {
  // The tonic between F3 and E4, so the chords sit under the melody.
  const t = 48 + m.tonic + (m.tonic > 4 ? 0 : 12);
  const third = m.mode === "minor" ? 3 : 4;
  const sixth = m.mode === "minor" ? 8 : 9;
  const chords = [
    [t - 12, t, t + third, t + 7],
    [t - 7, t, t + 5, t + sixth],
    [t - 5, t - 1, t + 2, t + 7],
    [t - 12, t, t + third, t + 7],
  ];
  void playNotes([...chords.map((c, i) => ({ pitches: c, at: i * 0.7, dur: 0.65 })), { pitches: [t], at: 3.1, dur: 1.2 }]);
}

export function checkTranscription(stage: DictationStage): TrResult | null {
  const lane = store.project.tracks.find((t) => !t.locked);
  const d = dictations.value[stage.id];
  if (!lane || !d) return null;
  const m = d.melody;
  const result = gradeTranscription(m.notes, lane.notes, m.timeSig);
  const revealed = store.project.tracks.some((t) => t.locked);
  const practiced = d.practiced || practiceMode.value;
  lastTranscription.set({ id: stage.id, result, notes: lane.notes, revealed, practiced });
  const map = new Map<string, MarkSeverity>();
  for (const issue of result.issues) for (const id of issue.noteIds) if (map.get(id) !== "error") map.set(id, issue.severity);
  marks.set(map);
  focusedTrIssue.set(null);
  focusedNotes.set([]);
  if (!result.blocking && !revealed && !practiced) {
    recordProgress(stage.id, result.score, result.passed);
    recordIntervals(result.intervals);
  }
  return result;
}

/** Add the original as a locked lane so you can compare (stops counting toward progress). */
export function revealAnswer(stage: DictationStage) {
  const m = dictations.value[stage.id]?.melody;
  if (!m || store.project.tracks.some((t) => t.locked)) return;
  const answer = { ...makeTrack("piano", "Answer", m.notes.map((n) => ({ id: newId(), pitch: n.pitch, start: n.start, dur: n.dur, vel: 0.6 }))), locked: true, mute: true };
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
