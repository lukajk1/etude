import type { Draft } from "immer";
import { store } from "./store";
import { newId, type Note, type Project, type Track } from "./types";
import { ui } from "./ui";

export function selectedTrack(p: Project = store.project): Track | null {
  const id = ui.state.selectedTrackId;
  return p.tracks.find((t) => t.id === id) ?? p.tracks[0] ?? null;
}

export function draftTrack(d: Draft<Project>, id: string): Draft<Track> | undefined {
  return d.tracks.find((t) => t.id === id);
}

export function selectedNotes(track: Track | null): Note[] {
  if (!track) return [];
  const sel = ui.state.selectedNoteIds;
  return track.notes.filter((n) => sel.has(n.id));
}

export function deleteSelected() {
  const track = selectedTrack();
  const sel = ui.state.selectedNoteIds;
  if (!track || track.locked || sel.size === 0) return;
  store.edit((d) => {
    const t = draftTrack(d, track.id);
    if (t) t.notes = t.notes.filter((n) => !sel.has(n.id));
  });
  ui.set({ selectedNoteIds: new Set() });
}

/** Move selected notes by a pitch and time offset in one undo step. */
export function nudgeSelected(dPitch: number, dTick: number) {
  const track = selectedTrack();
  const sel = ui.state.selectedNoteIds;
  if (!track || track.locked || sel.size === 0) return;
  const notes = selectedNotes(track);
  const minPitch = Math.min(...notes.map((n) => n.pitch));
  const maxPitch = Math.max(...notes.map((n) => n.pitch));
  const minStart = Math.min(...notes.map((n) => n.start));
  const dp = Math.max(-minPitch, Math.min(127 - maxPitch, dPitch));
  const dt = Math.max(-minStart, dTick);
  store.edit((d) => {
    const t = draftTrack(d, track.id);
    if (!t) return;
    for (const n of t.notes) {
      if (!sel.has(n.id)) continue;
      n.pitch += dp;
      n.start += dt;
    }
  });
}

let clipboard: Note[] = [];

export function copySelected(): boolean {
  const notes = selectedNotes(selectedTrack());
  if (notes.length === 0) return false;
  const first = Math.min(...notes.map((n) => n.start));
  clipboard = notes.map((n) => ({ ...n, start: n.start - first }));
  return true;
}

/** Paste the clipboard into the selected lane at `atTick`. */
export function paste(atTick: number) {
  const track = selectedTrack();
  if (!track || track.locked || clipboard.length === 0) return;
  const pasted = clipboard.map((n) => ({ ...n, id: newId(), start: n.start + atTick }));
  store.edit((d) => {
    draftTrack(d, track.id)?.notes.push(...pasted);
  });
  ui.set({ selectedNoteIds: new Set(pasted.map((n) => n.id)) });
}

/** Copy the selection to right after itself. */
export function duplicateSelected() {
  const notes = selectedNotes(selectedTrack());
  if (notes.length === 0) return;
  const end = Math.max(...notes.map((n) => n.start + n.dur));
  copySelected();
  paste(end);
}
