import { stop } from "../audio/live";
import { store } from "../model/store";
import type { Note, Project, Track } from "../model/types";
import { Signal, ui } from "../model/ui";
import { exerciseProject, getExercise, type Exercise } from "./catalog";
import { activeDrill } from "../drills/state";
import type { Issue, Result, Severity } from "./grade";

export interface Checked {
  exerciseId: string;
  result: Result;
  /** The student's notes when checked; a different array means they've edited since. */
  notes: Note[];
}

/** The latest check, if any. */
export const lastCheck = new Signal<Checked | null>(null);
/** Notes to outline in the piano roll, by id. */
export const marks = new Signal<Map<string, Severity>>(new Map());
/** The issue the user clicked, drawn more strongly. */
export const focused = new Signal<Issue | null>(null);

// ---- Progress ----------------------------------------------------------------

export interface Progress {
  best: number;
  passed: boolean;
  attempts: number;
}

const PROGRESS_KEY = "etude.progress.v1";

function loadProgress(): Record<string, Progress> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, Progress>;
  } catch {
    return {};
  }
}

export const progress = new Signal<Record<string, Progress>>(loadProgress());

function record(id: string, r: Result) {
  recordProgress(id, r.score, r.passed);
}

/** Save a score (0–100) for an exercise or drill, keeping the best. */
export function recordProgress(id: string, score: number, passed: boolean) {
  const prev = progress.value[id] ?? { best: 0, passed: false, attempts: 0 };
  const next = {
    ...progress.value,
    [id]: { best: Math.max(prev.best, score), passed: prev.passed || passed, attempts: prev.attempts + 1 },
  };
  progress.set(next);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // Progress just won't persist this visit.
  }
}

// ---- Lanes -------------------------------------------------------------------

export function givenTrack(p: Project): Track | null {
  return p.tracks.find((t) => t.locked) ?? null;
}

export function studentTrack(p: Project): Track | null {
  return p.tracks.find((t) => !t.locked) ?? null;
}

export function currentExercise(p: Project = store.project): Exercise | null {
  return getExercise(p.exercise?.id);
}

function clearResults() {
  lastCheck.set(null);
  marks.set(new Map());
  focused.set(null);
}

// ---- Actions -----------------------------------------------------------------

export function openExercise(ex: Exercise) {
  stop();
  activeDrill.set(null);
  const p = exerciseProject(ex);
  store.replace(p);
  clearResults();
  const student = studentTrack(p);
  ui.set({
    selectedTrackId: student?.id ?? null,
    selectedNoteIds: new Set(),
    cursorTick: 0,
    scrollTick: 0,
    snap: ex.snap,
    drawLength: ex.drawLength,
    view: "roll",
  });
}

export function checkWork(): Result | null {
  const p = store.project;
  const ex = currentExercise(p);
  const student = studentTrack(p);
  if (!ex || !student) return null;
  const result = ex.grade({ project: p, given: givenTrack(p), student });
  lastCheck.set({ exerciseId: ex.id, result, notes: student.notes });
  const m = new Map<string, Severity>();
  for (const issue of result.issues) {
    for (const id of issue.noteIds) if (m.get(id) !== "error") m.set(id, issue.severity);
  }
  marks.set(m);
  focused.set(null);
  if (!result.blocking) record(ex.id, result);
  return result;
}

/** Clear your lane and start the exercise over (undoable). */
export function resetWork() {
  const student = studentTrack(store.project);
  if (!student) return;
  store.edit((d) => {
    const t = d.tracks.find((x) => x.id === student.id);
    if (t) t.notes = [];
  });
  clearResults();
  ui.set({ selectedNoteIds: new Set() });
}

/** Jump to an issue: move the cursor there and select your notes involved. */
export function focusIssue(issue: Issue) {
  const p = store.project;
  const student = studentTrack(p);
  focused.set(issue);
  const mine = new Set(student ? student.notes.filter((n) => issue.noteIds.includes(n.id)).map((n) => n.id) : []);
  ui.set({ cursorTick: issue.tick, selectedTrackId: student?.id ?? ui.state.selectedTrackId, selectedNoteIds: mine });
}

// Leaving the exercise (opening another project) clears the results.
store.subscribe(() => {
  const c = lastCheck.value;
  if (c && store.project.exercise?.id !== c.exerciseId) clearResults();
});
