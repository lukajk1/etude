import { useEffect, useRef, useState } from "react";
import { soundError, soundLoading, stop, togglePlay } from "../audio/live";
import { SOURCES } from "../audio/sources";
import { renderWav } from "../audio/render";
import { exportMidi, importMidi } from "../midi/midiio";
import { DEMOS } from "../demos/catalog";
import { EXERCISES, ROADMAP } from "../exercises/catalog";
import { openExercise, progress } from "../exercises/state";
import { DRILLS } from "../drills/catalog";
import { activeDrill } from "../drills/state";
import { emptyProject } from "../model/demo";
import { store, useProject } from "../model/store";
import type { Project, ScaleId } from "../model/types";
import { ui, useSignal, useUi } from "../model/ui";
import { KEY_NAMES, SCALE_ORDER, SCALES } from "../theory/theory";

function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safeName = (s: string) => s.trim().replace(/[\\/:*?"<>|]+/g, "-") || "untitled";

function load(p: Project) {
  stop();
  activeDrill.set(null);
  store.replace(p);
  ui.set({ selectedTrackId: p.tracks[0]?.id ?? null, selectedNoteIds: new Set(), cursorTick: 0, scrollTick: 0 });
}

const Icon = {
  play: <path d="M5 3.5v9l8-4.5z" fill="currentColor" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />,
  start: <path d="M4 3.5v9M13 3.5v9L6 8z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" strokeLinejoin="round" />,
  loop: <path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h3l-1.5-1.5M12 9.5A3.5 3.5 0 0 1 8.5 13h-3L7 14.5M4 6.5v1M12 9.5v-1" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  undo: <path d="M6 4L3 7l3 3M3.5 7H10a3 3 0 0 1 0 6H8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  volume: <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  muted: <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5zM11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  redo: <path d="M10 4l3 3-3 3M12.5 7H6a3 3 0 0 0 0 6h2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      {children}
    </svg>
  );
}

function FileMenu({ onMessage }: { onMessage: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const midiInput = useRef<HTMLInputElement>(null);
  const projInput = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const act = (fn: () => void | Promise<void>) => async () => {
    setOpen(false);
    try {
      await fn();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="file-menu" ref={wrap}>
      <button className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        File
      </button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" className="menu-item" onClick={act(() => load(emptyProject()))}>
            New project
          </button>
          <div className="menu-sep" />
          <button role="menuitem" className="menu-item" onClick={act(() => projInput.current?.click())}>
            Open project…
          </button>
          <button
            role="menuitem"
            className="menu-item"
            onClick={act(() => download(JSON.stringify(store.project, null, 1), `${safeName(store.project.title)}.etude.json`, "application/json"))}
          >
            Save project
          </button>
          <div className="menu-sep" />
          <button role="menuitem" className="menu-item" onClick={act(() => midiInput.current?.click())}>
            Import MIDI…
          </button>
          <button
            role="menuitem"
            className="menu-item"
            onClick={act(() => {
              const bytes = exportMidi(store.project);
              download(bytes.slice().buffer, `${safeName(store.project.title)}.mid`, "audio/midi");
            })}
          >
            Export MIDI
          </button>
          <button
            role="menuitem"
            className="menu-item"
            onClick={act(async () => {
              onMessage("Rendering audio…");
              const wav = await renderWav(store.project, ui.state.soundSource);
              download(wav, `${safeName(store.project.title)}.wav`, "audio/wav");
              onMessage("Exported WAV.");
            })}
          >
            Export WAV
          </button>
        </div>
      )}
      <input
        ref={midiInput}
        type="file"
        accept=".mid,.midi,audio/midi"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const { project, notes } = importMidi(await f.arrayBuffer(), f.name.replace(/\.midi?$/i, ""), store.project);
            load(project);
            onMessage(notes[0] ?? `Imported ${project.tracks.length} lanes from ${f.name}.`);
          } catch (err) {
            onMessage(`Couldn't read ${f.name}: ${err instanceof Error ? err.message : err}`);
          }
        }}
      />
      <input
        ref={projInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const p = JSON.parse(await f.text()) as Project;
            if (!Array.isArray(p.tracks)) throw new Error("it isn't an Etude project");
            load(p);
            onMessage(`Opened ${f.name}.`);
          } catch (err) {
            onMessage(`Couldn't open ${f.name}: ${err instanceof Error ? err.message : err}`);
          }
        }}
      />
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

function MasterVolume() {
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

function DemosMenu({ onMessage }: { onMessage: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="file-menu" ref={wrap}>
      <button className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Demos
      </button>
      {open && (
        <div className="menu demos-menu" role="menu">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              role="menuitem"
              className="menu-item"
              title={d.credit}
              onClick={async () => {
                setOpen(false);
                try {
                  load(await d.load());
                  onMessage(`Opened ${d.title}. ${d.credit}`);
                } catch (err) {
                  onMessage(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              <span>
                <span className="menu-label">
                  {d.title} <span className="menu-composer">{d.composer}</span>
                </span>
                <span className="menu-hint">{d.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExercisesMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const prog = useSignal(progress);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="file-menu" ref={wrap}>
      <button className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Exercises
      </button>
      {open && (
        <div className="menu demos-menu" role="menu">
          <div className="menu-heading">Foundations: timed drills</div>
          {DRILLS.map((d) => {
            const p = prog[d.id];
            return (
              <button
                key={d.id}
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setOpen(false);
                  stop();
                  activeDrill.set(d.id);
                }}
              >
                <span className="menu-num">{d.number}</span>
                <span style={{ flex: 1 }}>
                  <span className="menu-label">{d.title}</span>
                  <span className="menu-hint">{d.summary}</span>
                </span>
                {p && <span className={`menu-status${p.passed ? " is-pass" : ""}`}>{p.passed ? "Passed" : `${p.best}%`}</span>}
              </button>
            );
          })}
          <div className="menu-sep" />
          <div className="menu-heading">{EXERCISES[0].unit}</div>
          {EXERCISES.map((ex) => {
            const p = prog[ex.id];
            return (
              <button
                key={ex.id}
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setOpen(false);
                  openExercise(ex);
                }}
              >
                <span className="menu-num">{ex.number}</span>
                <span style={{ flex: 1 }}>
                  <span className="menu-label">{ex.title}</span>
                  <span className="menu-hint">{ex.summary}</span>
                </span>
                {p && <span className={`menu-status${p.passed ? " is-pass" : ""}`}>{p.passed ? "Passed" : p.best}</span>}
              </button>
            );
          })}
          <div className="menu-sep" />
          <div className="menu-heading">Coming next</div>
          {ROADMAP.map((r) => (
            <div key={r.unit} className="menu-item is-disabled" aria-disabled>
              <span>
                <span className="menu-label">{r.unit}</span>
                <span className="menu-hint">{r.topics}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toolbar() {
  const p = useProject();
  const s = useUi();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const setNum = (fn: (d: Project, v: number) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v)) store.edit((d) => fn(d as Project, v));
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="22" height="22" />
        <span>Etude</span>
      </div>
      <input
        className="title-input"
        value={p.title}
        aria-label="Project title"
        onChange={(e) => {
          const v = e.target.value;
          store.edit((d) => {
            d.title = v;
          });
        }}
      />
      <FileMenu onMessage={setMessage} />
      <DemosMenu onMessage={setMessage} />
      <ExercisesMenu />

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

      <MasterVolume />

      <div className="group">
        <label className="mini-field">
          <input type="number" min={20} max={300} value={p.bpm} onChange={setNum((d, v) => (d.bpm = Math.max(20, Math.min(300, v))))} />
          <span>BPM</span>
        </label>
        <label className="mini-field" title="Time signature">
          <select value={p.timeSig[0]} aria-label="Beats per bar" onChange={setNum((d, v) => (d.timeSig[0] = v))}>
            {[2, 3, 4, 5, 6, 7, 9, 12].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <span className="slash">/</span>
          <select value={p.timeSig[1]} aria-label="Beat unit" onChange={setNum((d, v) => (d.timeSig[1] = v))}>
            {[2, 4, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="group">
        <label className="mini-field" title="Key: highlights its scale in the piano roll and names chords">
          <span>Key</span>
          <select value={p.key} onChange={setNum((d, v) => (d.key = v))}>
            {KEY_NAMES.map((k, i) => (
              <option key={k} value={i}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={p.scale}
            aria-label="Scale"
            onChange={(e) => {
              const v = e.target.value as ScaleId;
              store.edit((d) => {
                d.scale = v;
              });
            }}
          >
            {SCALE_ORDER.map((id) => (
              <option key={id} value={id}>
                {SCALES[id].name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="group">
        <button className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!store.canUndo} onClick={() => store.undo()}>
          <Svg>{Icon.undo}</Svg>
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!store.canRedo} onClick={() => store.redo()}>
          <Svg>{Icon.redo}</Svg>
        </button>
      </div>

      <div className="toast" role="status">
        {message}
      </div>
    </header>
  );
}
