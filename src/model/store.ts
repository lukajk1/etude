import { produce, type Draft } from "immer";
import { useSyncExternalStore } from "react";
import type { Project } from "./types";
import { demoProject } from "./demo";

const STORAGE_KEY = "etude.project.v1";
const HISTORY_LIMIT = 200;

type Listener = () => void;

/**
 * Holds the project with undo/redo. Edits go through `edit` (one undo step each).
 * Drags call `beginGesture`, then `edit(..., { transient: true })` as often as they
 * like, then `endGesture`, so the whole drag is a single undo step.
 */
class ProjectStore {
  project: Project;
  private past: Project[] = [];
  private future: Project[] = [];
  private gestureBase: Project | null = null;
  private listeners = new Set<Listener>();
  private saveTimer = 0;

  constructor() {
    this.project = loadSaved() ?? demoProject();
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = () => this.project;

  private emit() {
    for (const fn of this.listeners) fn();
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.project));
      } catch {
        // Storage full or blocked; the in-memory project is still fine.
      }
    }, 400);
  }

  edit(recipe: (draft: Draft<Project>) => void, opts: { transient?: boolean } = {}) {
    const next = produce(this.project, recipe);
    if (next === this.project) return;
    if (!opts.transient && !this.gestureBase) this.pushHistory(this.project);
    this.project = next;
    this.emit();
  }

  /** Replace the whole project, such as after opening a file. Undoable. */
  replace(next: Project) {
    this.pushHistory(this.project);
    this.project = next;
    this.emit();
  }

  beginGesture() {
    this.gestureBase = this.project;
  }

  endGesture() {
    if (this.gestureBase && this.gestureBase !== this.project) this.pushHistory(this.gestureBase);
    this.gestureBase = null;
  }

  private pushHistory(p: Project) {
    this.past.push(p);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.project);
    this.project = prev;
    this.emit();
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.project);
    this.project = next;
    this.emit();
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}

function loadSaved(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Project;
    return Array.isArray(p.tracks) ? p : null;
  } catch {
    return null;
  }
}

export const store = new ProjectStore();

export function useProject(): Project {
  return useSyncExternalStore(store.subscribe, store.get);
}
