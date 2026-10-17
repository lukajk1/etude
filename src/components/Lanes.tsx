import { useState } from "react";
import { playheadTick } from "../audio/live";
import { LANE_H, tickToX, timelineWheel, xToTick } from "../lib/geom";
import { cssVar, localPoint, roundRect, useCanvas, useNativeWheel, withAlpha } from "../lib/useCanvas";
import { makeTrack } from "../model/demo";
import { draftTrack, selectedTrack } from "../model/edits";
import { store, useProject } from "../model/store";
import { TIMBRE_ORDER, TIMBRES } from "../model/timbres";
import { PPQ, ticksPerBar, type TimbreId, type Track } from "../model/types";
import { ui, useUi } from "../model/ui";

function selectLane(id: string) {
  if (ui.state.selectedTrackId !== id) ui.set({ selectedTrackId: id, selectedNoteIds: new Set() });
}

function editTrack(id: string, fn: (t: Track) => void) {
  store.edit((d) => {
    const t = draftTrack(d, id);
    if (t) fn(t as Track);
  });
}

function LaneHeader({ track, selected }: { track: Track; selected: boolean }) {
  const info = TIMBRES[track.timbre];
  return (
    <div
      className={`lane-head${selected ? " is-selected" : ""}${track.mute ? " is-muted" : ""}`}
      style={{ height: LANE_H, "--lane": info.color } as React.CSSProperties}
      onPointerDown={() => selectLane(track.id)}
    >
      <div className="lane-swatch" />
      <div className="lane-main">
        <input
          className="lane-name"
          value={track.name}
          aria-label="Lane name"
          onChange={(e) => editTrack(track.id, (t) => (t.name = e.target.value))}
        />
        <select
          className="lane-timbre"
          value={track.timbre}
          aria-label="Timbre"
          title={info.role}
          onChange={(e) => editTrack(track.id, (t) => (t.timbre = e.target.value as TimbreId))}
        >
          {TIMBRE_ORDER.map((id) => (
            <option key={id} value={id}>
              {TIMBRES[id].name}
            </option>
          ))}
        </select>
      </div>
      <div className="lane-controls">
        <div className="lane-buttons">
          <button
            className="toggle"
            aria-pressed={track.mute}
            title="Mute"
            onClick={() => editTrack(track.id, (t) => (t.mute = !t.mute))}
          >
            M
          </button>
          <button
            className="toggle toggle-solo"
            aria-pressed={track.solo}
            title="Solo"
            onClick={() => editTrack(track.id, (t) => (t.solo = !t.solo))}
          >
            S
          </button>
          <button
            className="icon-btn lane-delete"
            title="Delete lane"
            aria-label={`Delete ${track.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (track.notes.length > 0 && !confirm(`Delete "${track.name}" and its ${track.notes.length} notes?`)) return;
              store.edit((d) => {
                d.tracks = d.tracks.filter((t) => t.id !== track.id);
              });
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <input
          className="lane-volume"
          type="range"
          min={-36}
          max={6}
          step={0.5}
          value={track.volume}
          title={`Volume ${track.volume > 0 ? "+" : ""}${track.volume} dB (double-click to reset)`}
          aria-label="Volume"
          onPointerDown={() => store.beginGesture()}
          onPointerUp={() => store.endGesture()}
          onDoubleClick={() => editTrack(track.id, (t) => (t.volume = 0))}
          onChange={(e) => {
            const v = Number(e.target.value);
            store.edit((d) => {
              const t = draftTrack(d, track.id);
              if (t) t.volume = v;
            }, { transient: true });
          }}
        />
      </div>
    </div>
  );
}

function AddLane() {
  const [open, setOpen] = useState(false);
  return (
    <div className="add-lane">
      <button className="add-lane-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Add lane
      </button>
      {open && (
        <div className="menu add-lane-menu" role="menu" onMouseLeave={() => setOpen(false)}>
          {TIMBRE_ORDER.map((id) => (
            <button
              key={id}
              role="menuitem"
              className="menu-item"
              style={{ "--lane": TIMBRES[id].color } as React.CSSProperties}
              onClick={() => {
                const t = makeTrack(id, TIMBRES[id].name);
                store.edit((d) => {
                  d.tracks.push(t);
                });
                ui.set({ selectedTrackId: t.id, selectedNoteIds: new Set() });
                setOpen(false);
              }}
            >
              <span className="dot" />
              <span>
                <span className="menu-label">{TIMBRES[id].name}</span>
                <span className="menu-hint">{TIMBRES[id].role}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The overview: one row per lane with its notes in miniature. */
function LaneCanvas({ tracks }: { tracks: Track[] }) {
  const { ref } = useCanvas((g, w, h) => {
    const p = store.project;
    const s = ui.state;
    const sel = selectedTrack(p);
    const bar = ticksPerBar(p);
    const anySolo = p.tracks.some((t) => t.solo);

    g.fillStyle = cssVar("--ink-0");
    g.fillRect(0, 0, w, h);

    p.tracks.forEach((t, i) => {
      const y = i * LANE_H;
      if (t.id === sel?.id) {
        g.fillStyle = withAlpha(TIMBRES[t.timbre].color, 0.07);
        g.fillRect(0, y, w, LANE_H);
      }
      g.fillStyle = cssVar("--line");
      g.fillRect(0, y + LANE_H - 1, w, 1);
    });

    if (p.loop.on) {
      const x0 = tickToX(p.loop.start);
      g.fillStyle = cssVar("--loop-wash");
      g.fillRect(x0, 0, tickToX(p.loop.end) - x0, h);
    }

    const lastTick = xToTick(w);
    for (let b = Math.floor(s.scrollTick / bar); b * bar <= lastTick; b++) {
      const x = Math.round(tickToX(b * bar));
      g.fillStyle = cssVar("--line");
      g.fillRect(x, 0, 1, h);
    }

    p.tracks.forEach((t, i) => {
      if (t.notes.length === 0) return;
      const y = i * LANE_H;
      const color = TIMBRES[t.timbre].color;
      const audible = !t.mute && (!anySolo || t.solo);
      let lo = 127;
      let hi = 0;
      for (const n of t.notes) {
        lo = Math.min(lo, n.pitch);
        hi = Math.max(hi, n.pitch);
      }
      const span = Math.max(12, hi - lo + 1);
      const mid = (lo + hi) / 2;
      const inner = LANE_H - 14;
      const rowH = Math.max(1.5, Math.min(4, inner / span));
      g.fillStyle = audible ? color : withAlpha(color, 0.3);
      for (const n of t.notes) {
        const x0 = tickToX(n.start);
        const x1 = tickToX(n.start + n.dur);
        if (x1 < 0 || x0 > w) continue;
        const ny = y + LANE_H / 2 - (n.pitch - mid) * (inner / span) - rowH / 2;
        roundRect(g, x0, ny, Math.max(1.5, x1 - x0 - 1), rowH, 1);
        g.fill();
      }
    });

    const cx = Math.round(tickToX(s.cursorTick)) + 0.5;
    g.strokeStyle = cssVar("--text-dim");
    g.setLineDash([2, 3]);
    g.beginPath();
    g.moveTo(cx, 0);
    g.lineTo(cx, h);
    g.stroke();
    g.setLineDash([]);
    if (s.playing) {
      g.fillStyle = cssVar("--playhead");
      g.fillRect(Math.round(tickToX(playheadTick())) - 1, 0, 2, h);
    }
  });

  useNativeWheel(ref, (e, x) => timelineWheel(e, x));

  return (
    <canvas
      ref={ref}
      className="lane-canvas"
      style={{ height: Math.max(1, tracks.length) * LANE_H }}
      onPointerDown={(e) => {
        const { x, y } = localPoint(e, e.currentTarget);
        const t = store.project.tracks[Math.floor(y / LANE_H)];
        if (t) selectLane(t.id);
        if (e.detail === 2) ui.set({ cursorTick: Math.max(0, Math.floor(xToTick(x) / PPQ) * PPQ) });
      }}
    />
  );
}

export function Lanes() {
  const project = useProject();
  useUi(); // re-render when the selected lane changes
  const sel = selectedTrack(project);
  return (
    <div className="lanes">
      <div className="lane-heads">
        {project.tracks.map((t) => (
          <LaneHeader key={t.id} track={t} selected={t.id === sel?.id} />
        ))}
        <AddLane />
      </div>
      <div className="lane-canvas-wrap">
        <LaneCanvas tracks={project.tracks} />
      </div>
    </div>
  );
}
