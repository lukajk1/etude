import { useEffect, useState } from "react";
import { playheadTick } from "../audio/live";
import { selectedTrack } from "../model/edits";
import { store, useProject } from "../model/store";
import { hover, useSignal, useUi } from "../model/ui";
import { DRUM_NAMES, degreeName, noteName, readChord, scaleDegree, usesFlats } from "../theory/theory";
import { ticksPerBar, ticksPerBeat, type Project } from "../model/types";

/** Pitches sounding at a tick across audible, pitched lanes. */
function soundingAt(p: Project, tick: number): number[] {
  const anySolo = p.tracks.some((t) => t.solo);
  const out: number[] = [];
  for (const t of p.tracks) {
    if (t.timbre === "percussion" || t.mute || (anySolo && !t.solo)) continue;
    for (const n of t.notes) if (n.start <= tick && tick < n.start + n.dur) out.push(n.pitch);
  }
  return out;
}

function position(p: Project, tick: number): string {
  const bar = ticksPerBar(p);
  const beat = ticksPerBeat(p);
  return `${Math.floor(tick / bar) + 1}.${Math.floor((tick % bar) / beat) + 1}`;
}

function useChordAtPlayhead() {
  const [text, setText] = useState({ pos: "1.1", chord: "", numeral: "", detail: "" });
  useEffect(() => {
    let raf = 0;
    let last = "";
    const update = () => {
      const p = store.project;
      const tick = playheadTick();
      const c = readChord(soundingAt(p, tick), p.key, p.scale);
      const next = { pos: position(p, tick), chord: c?.name ?? "", numeral: c?.numeral ?? "", detail: c?.detail ?? "" };
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setText(next);
      }
    };
    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return text;
}

export function StatusBar() {
  const p = useProject();
  const s = useUi();
  const h = useSignal(hover);
  const now = useChordAtPlayhead();
  const track = selectedTrack(p);
  const flats = usesFlats(p.key, p.scale);

  let hoverText = "";
  if (h) {
    if (track?.timbre === "percussion") hoverText = DRUM_NAMES[h.pitch] ?? noteName(h.pitch, flats);
    else {
      const deg = scaleDegree(h.pitch, p.key, p.scale);
      hoverText = noteName(h.pitch, flats);
      if (p.scale !== "chromatic") hoverText += deg > 0 ? `, degree ${deg} (${degreeName(deg, p.scale)})` : ", outside the scale";
    }
    hoverText += ` at ${position(p, h.tick)}`;
  }

  return (
    <footer className="status">
      <div className="status-now" aria-live="polite">
        <span className="status-pos">{now.pos}</span>
        {now.chord ? (
          <>
            <span className="status-chord">{now.chord}</span>
            {now.numeral && <span className="numeral">{now.numeral}</span>}
            {now.detail && <span className="status-dim">{now.detail}</span>}
          </>
        ) : (
          <span className="status-dim">{s.playing ? "Rest" : "Nothing sounding at the cursor"}</span>
        )}
      </div>
      <div className="status-hover">{hoverText}</div>
      <div className="status-hint">
        Click to add a note, drag to move it, drag its end to resize, right-click to delete. Shift-drag the ruler to set a loop.
      </div>
    </footer>
  );
}

