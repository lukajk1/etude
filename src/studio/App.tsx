import { useEffect } from "react";
import { Editor } from "../components/Editor";
import { Overview } from "../components/Overview";
import { StatusBar } from "../components/StatusBar";
import { useEditorShortcuts } from "../lib/shortcuts";
import { store } from "../model/store";
import { ui } from "../model/ui";
import { Toolbar } from "./Toolbar";

export function App() {
  useEditorShortcuts();
  useEffect(() => {
    // Projects saved before the Practice Room split may still carry exercise locks.
    const p = store.project;
    if (p.exercise || p.tracks.some((t) => t.locked)) {
      store.replace({ ...p, exercise: undefined, tracks: p.tracks.map((t) => ({ ...t, locked: false })) });
    }
    if (!ui.state.selectedTrackId) ui.set({ selectedTrackId: store.project.tracks[0]?.id ?? null });
  }, []);

  return (
    <div className="app" style={{ gridTemplateRows: "auto auto 1fr auto" }}>
      <Toolbar />
      <Overview />
      <div className="main">
        <Editor />
      </div>
      <StatusBar />
    </div>
  );
}
