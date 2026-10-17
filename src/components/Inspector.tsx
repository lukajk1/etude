import { sourceFor } from "../audio/sources";
import { KEYS_W, LEFT_W, zoomAt } from "../lib/geom";
import { store } from "../model/store";
import { TIMBRES } from "../model/timbres";
import { PPQ, type Track } from "../model/types";
import { SNAPS, ui, useSignal, useUi } from "../model/ui";
import { soundLoading } from "../audio/live";
import { degreeName, intervalName, noteName, readChord, scaleDegree, SCALES, usesFlats, DRUM_NAMES } from "../theory/theory";

const LENGTHS: Record<number, string> = {
  [PPQ * 4]: "Whole note",
  [PPQ * 3]: "Dotted half",
  [PPQ * 2]: "Half note",
  [(PPQ * 3) / 2]: "Dotted quarter",
  [PPQ]: "Quarter note",
  [(PPQ * 3) / 4]: "Dotted eighth",
  [PPQ / 2]: "Eighth note",
  [PPQ / 4]: "16th note",
  [PPQ / 8]: "32nd note",
  [(PPQ * 2) / 3]: "Quarter triplet",
  [PPQ / 3]: "Eighth triplet",
  [PPQ / 6]: "16th triplet",
};

export function lengthName(ticks: number): string {
  return LENGTHS[ticks] ?? `${+(ticks / PPQ).toFixed(2)} beats`;
}

function SelectionReadout({ track }: { track: Track }) {
  const s = useUi();
  const p = store.project;
  const notes = track.notes.filter((n) => s.selectedNoteIds.has(n.id));
  if (notes.length === 0) {
    return <p className="hint">Select notes to see what they spell. Shift-drag to select several.</p>;
  }
  const flats = usesFlats(p.key, p.scale);
  if (track.timbre === "percussion") {
    const names = [...new Set(notes.map((n) => DRUM_NAMES[n.pitch] ?? noteName(n.pitch)))];
    return (
      <div className="readout">
        <div className="readout-main">{notes.length === 1 ? names[0] : `${notes.length} hits`}</div>
        {notes.length > 1 && <div className="readout-sub">{names.slice(0, 4).join(", ")}</div>}
      </div>
    );
  }
  if (notes.length === 1) {
    const n = notes[0];
    const deg = scaleDegree(n.pitch, p.key, p.scale);
    return (
      <div className="readout">
        <div className="readout-main">{noteName(n.pitch, flats)}</div>
        <div className="readout-sub">
          {p.scale === "chromatic"
            ? lengthName(n.dur)
            : deg > 0
              ? `Degree ${deg}, the ${degreeName(deg, p.scale)}`
              : `Outside ${SCALES[p.scale].name.toLowerCase()}`}
        </div>
      </div>
    );
  }
  const pitches = notes.map((n) => n.pitch);
  const chord = readChord(pitches, p.key, p.scale);
  const span = Math.max(...pitches) - Math.min(...pitches);
  return (
    <div className="readout">
      <div className="readout-main">
        {chord?.name}
        {chord?.numeral && <span className="numeral">{chord.numeral}</span>}
      </div>
      <div className="readout-sub">
        {chord?.detail ?? `${notes.length} notes, spanning a ${intervalName(span)}`}
      </div>
    </div>
  );
}

function SoundLine({ timbre }: { timbre: Track["timbre"] }) {
  const { soundSource } = useUi();
  useSignal(soundLoading); // re-check once sounds finish loading
  const playing = sourceFor(soundSource, timbre);
  const fallback = playing.id !== soundSource;
  const credit = playing.credit?.(timbre);
  return (
    <div className="insp-sound">
      {fallback ? "Synth (no recording for this timbre)" : playing.id === "synth" ? "Synth" : credit}
    </div>
  );
}

export function Inspector({ track }: { track: Track | null }) {
  const s = useUi();
  const info = track ? TIMBRES[track.timbre] : null;
  return (
    <aside className="inspector" style={{ width: LEFT_W - KEYS_W }}>
      {track && info ? (
        <>
          <div className="insp-lane" style={{ "--lane": info.color } as React.CSSProperties}>
            <span className="dot" />
            <div>
              <div className="insp-name">{track.name}</div>
              <div className="insp-role">{info.role}</div>
              <SoundLine timbre={track.timbre} />
            </div>
          </div>

          <label className="field">
            <span>Snap</span>
            <select value={s.snap} onChange={(e) => ui.set({ snap: Number(e.target.value) })}>
              {SNAPS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>New notes</span>
            <output title="Set by the last note you placed or resized">{lengthName(s.drawLength)}</output>
          </div>
          <div className="field">
            <span>Zoom</span>
            <div className="seg">
              <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4, 0)}>
                −
              </button>
              <button aria-label="Zoom in" onClick={() => zoomAt(1.4, 0)}>
                +
              </button>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={s.showGhosts} onChange={(e) => ui.set({ showGhosts: e.target.checked })} />
            Show other lanes
          </label>

          <SelectionReadout track={track} />
        </>
      ) : (
        <p className="hint">Add a lane to start writing.</p>
      )}
    </aside>
  );
}
