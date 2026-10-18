import { useEffect } from "react";
import { togglePlay } from "../audio/live";
import { copySelected, deleteSelected, duplicateSelected, nudgeSelected, paste, selectedTrack } from "../model/edits";
import { store } from "../model/store";
import { ui } from "../model/ui";
import { snapSize } from "./geom";

/** Keyboard shortcuts for the note editor (both apps). */
function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return type === "text" || type === "number" || type === "search";
  }
  return false;
}

function onKey(e: KeyboardEvent) {
  if (isTyping(e)) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const snap = snapSize(store.project);

  if (e.key === " ") {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    togglePlay();
  } else if (mod && k === "z") {
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
  } else if (mod && k === "y") {
    e.preventDefault();
    store.redo();
  } else if (mod && k === "a") {
    e.preventDefault();
    const t = selectedTrack();
    if (t) ui.set({ selectedNoteIds: new Set(t.notes.map((n) => n.id)) });
  } else if (mod && k === "c") {
    copySelected();
  } else if (mod && k === "x") {
    if (copySelected()) deleteSelected();
  } else if (mod && k === "v") {
    e.preventDefault();
    paste(ui.state.cursorTick);
  } else if (mod && k === "d") {
    e.preventDefault();
    duplicateSelected();
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === "Escape") {
    ui.set({ selectedNoteIds: new Set() });
  } else if (e.key === "Home") {
    ui.set({ cursorTick: 0, scrollTick: 0 });
  } else if (ui.state.selectedNoteIds.size > 0 && e.key.startsWith("Arrow")) {
    e.preventDefault();
    if (e.key === "ArrowUp") nudgeSelected(e.shiftKey ? 12 : 1, 0);
    if (e.key === "ArrowDown") nudgeSelected(e.shiftKey ? -12 : -1, 0);
    if (e.key === "ArrowLeft") nudgeSelected(0, -snap);
    if (e.key === "ArrowRight") nudgeSelected(0, snap);
  }
}

/** Turn the editor shortcuts on while the component is mounted. */
export function useEditorShortcuts() {
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
