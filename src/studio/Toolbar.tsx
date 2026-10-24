import { useEffect, useRef, useState } from "react";
import { stop } from "../audio/live";
import { renderWav } from "../audio/render";
import { SoundControls, TransportButtons, UndoRedo, ViewToggle } from "../components/Controls";
import { exportMidi, importMidi } from "../midi/midiio";
import { emptyProject } from "../model/demo";
import { store, useProject } from "../model/store";
import type { Project, ScaleId } from "../model/types";
import { ui } from "../model/ui";
import { KEY_NAMES, SCALE_ORDER, SCALES } from "../theory/theory";
import { DEMOS } from "./demos/catalog";

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
  store.replace(p);
  ui.set({ selectedTrackId: p.tracks[0]?.id ?? null, selectedNoteIds: new Set(), cursorTick: 0, scrollTick: 0 });
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

export function Toolbar() {
  const p = useProject();
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
        <span>Etude Studio</span>
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
      <a className="btn" href={`${import.meta.env.BASE_URL}practice/`} title="Drills, ear training and graded exercises">
        Etude Study
      </a>

      <TransportButtons />
      <ViewToggle />

      <SoundControls />

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

      <UndoRedo />

      <div className="toast" role="status">
        {message}
      </div>
    </header>
  );
}
