import { useRef } from "react";
import { soundError, soundLoading, togglePlay } from "../audio/live";
import { SOURCES } from "../audio/sources";
import { store, useProject } from "../model/store";
import { ui, useSignal, useUi } from "../model/ui";

/** Toolbar controls shared by Studio and the Practice Room. */

export const Icon = {
  play: <path d="M5 3.5v9l8-4.5z" fill="currentColor" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />,
  start: <path d="M4 3.5v9M13 3.5v9L6 8z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" strokeLinejoin="round" />,
  loop: <path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h3l-1.5-1.5M12 9.5A3.5 3.5 0 0 1 8.5 13h-3L7 14.5M4 6.5v1M12 9.5v-1" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  undo: <path d="M6 4L3 7l3 3M3.5 7H10a3 3 0 0 1 0 6H8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  redo: <path d="M10 4l3 3-3 3M12.5 7H6a3 3 0 0 0 0 6h2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  volume: <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  muted: <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5zM11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      {children}
    </svg>
  );
}

/** Back to start, play/stop, loop. */
export function TransportButtons() {
  const p = useProject();
  const s = useUi();
  return (
    <div className="group transport">
      <button className="icon-btn" title="Back to start (Home)" aria-label="Back to start" onClick={() => ui.set({ cursorTick: 0, scrollTick: 0 })}>
        <Svg>{Icon.start}</Svg>
      </button>
      <button className={`play-btn${s.playing ? " is-playing" : ""}`} title="Play or stop (Space)" aria-label={s.playing ? "Stop" : "Play"} onClick={togglePlay}>
        <Svg>{s.playing ? Icon.stop : Icon.play}</Svg>
      </button>
      <button
        className="icon-btn"
        aria-pressed={p.loop.on}
        title="Loop (shift-drag the ruler to set its range)"
        aria-label="Loop"
        onClick={() =>
          store.edit((d) => {
            d.loop.on = !d.loop.on;
          })
        }
      >
        <Svg>{Icon.loop}</Svg>
      </button>
    </div>
  );
}

export function ViewToggle() {
  const s = useUi();
  return (
    <div className="group">
      <div className="view-toggle" role="group" aria-label="View">
        <button aria-pressed={s.view === "roll"} onClick={() => ui.set({ view: "roll" })}>
          Piano roll
        </button>
        <button aria-pressed={s.view === "score"} onClick={() => ui.set({ view: "score" })}>
          Score
        </button>
      </div>
    </div>
  );
}

function SoundPicker() {
  const { soundSource } = useUi();
  const loading = useSignal(soundLoading);
  const error = useSignal(soundError);
  const current = SOURCES.find((s) => s.id === soundSource);
  return (
    <label className="mini-field" title={error || current?.description}>
      <span>Sound</span>
      <select value={soundSource} onChange={(e) => ui.set({ soundSource: e.target.value })}>
        {SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {loading !== null && <span className="sound-loading">{Math.round(loading * 100)}%</span>}
      {error && loading === null && <span className="sound-error" aria-label={error}>!</span>}
    </label>
  );
}

/** Sound source picker, mute and master volume. */
export function SoundControls() {
  const { masterVolume } = useUi();
  const restore = useRef(0.8);
  const pct = Math.round(masterVolume * 100);
  return (
    <div className="group master-volume">
      <SoundPicker />
      <button
        className="icon-btn"
        title={masterVolume === 0 ? "Unmute" : "Mute"}
        aria-label={masterVolume === 0 ? "Unmute" : "Mute"}
        onClick={() => {
          if (masterVolume > 0) {
            restore.current = masterVolume;
            ui.set({ masterVolume: 0 });
          } else ui.set({ masterVolume: restore.current || 0.8 });
        }}
      >
        <Svg>{masterVolume === 0 ? Icon.muted : Icon.volume}</Svg>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={masterVolume}
        aria-label="Master volume"
        title={`Master volume ${pct}% (double-click to reset)`}
        onChange={(e) => ui.set({ masterVolume: Number(e.target.value) })}
        onDoubleClick={() => ui.set({ masterVolume: 0.8 })}
      />
      <span className="volume-pct">{pct}%</span>
    </div>
  );
}

export function UndoRedo() {
  useProject(); // re-render when history changes
  return (
    <div className="group">
      <button className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!store.canUndo} onClick={() => store.undo()}>
        <Svg>{Icon.undo}</Svg>
      </button>
      <button className="icon-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!store.canRedo} onClick={() => store.redo()}>
        <Svg>{Icon.redo}</Svg>
      </button>
    </div>
  );
}
