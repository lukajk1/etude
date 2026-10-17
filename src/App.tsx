import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { togglePlay } from "./audio/live";
import { Lanes } from "./components/Lanes";
import { Overview } from "./components/Overview";
import { PianoRoll } from "./components/PianoRoll";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { snapSize } from "./lib/geom";
import { copySelected, deleteSelected, duplicateSelected, nudgeSelected, paste, selectedTrack } from "./model/edits";
import { store } from "./model/store";
import { ui, useUi } from "./model/ui";

const Score = lazy(() => import("./components/Score"));

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

/** Drag handle between the lanes and the piano roll. */
function useSplit(initial: number) {
  const [top, setTop] = useState(initial);
  const drag = useRef<{ y: number; top: number } | null>(null);
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { y: e.clientY, top };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      const next = drag.current.top + e.clientY - drag.current.y;
      setTop(Math.max(90, Math.min(Math.max(150, window.innerHeight - 260), next)));
    },
    onPointerUp: () => {
      drag.current = null;
    },
  };
  return { top, handle };
}

export function App() {
  useEffect(() => {
    if (!ui.state.selectedTrackId) ui.set({ selectedTrackId: store.project.tracks[0]?.id ?? null });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { top, handle } = useSplit(Math.max(150, Math.round(window.innerHeight * 0.3)));
  const { view } = useUi();

  if (view === "score") {
    return (
      <div className="app" style={{ gridTemplateRows: "auto auto 1fr auto" }}>
        <Toolbar />
        <Overview />
        <Suspense fallback={<div className="score score-loading">Loading the score…</div>}>
          <Score />
        </Suspense>
        <StatusBar />
      </div>
    );
  }

  return (
    <div className="app" style={{ gridTemplateRows: `auto auto ${top}px 6px 1fr auto` }}>
      <Toolbar />
      <Overview />
      <Lanes />
      <div className="splitter" role="separator" aria-orientation="horizontal" {...handle} />
      <PianoRoll />
      <StatusBar />
    </div>
  );
}
