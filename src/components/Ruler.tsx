import { useRef } from "react";
import { playheadTick, seek } from "../audio/live";
import { RULER_H, snapFloor, snapRound, snapSize, tickToX, timelineWheel, xToTick } from "../lib/geom";
import { cssVar, localPoint, useCanvas, useNativeWheel } from "../lib/useCanvas";
import { store } from "../model/store";
import { PPQ, ticksPerBar, ticksPerBeat } from "../model/types";
import { ui } from "../model/ui";

/**
 * Bar numbers above a timeline. Click or drag to move the start cursor;
 * shift-drag to mark a loop.
 */
export function Ruler() {
  const drag = useRef<null | { mode: "cursor" } | { mode: "loop"; anchor: number }>(null);

  const { ref } = useCanvas((g, w, h) => {
    const p = store.project;
    const s = ui.state;
    const bar = ticksPerBar(p);
    const beat = ticksPerBeat(p);
    g.fillStyle = cssVar("--ink-1");
    g.fillRect(0, 0, w, h);

    if (p.loop.end > p.loop.start) {
      const x0 = tickToX(p.loop.start);
      const x1 = tickToX(p.loop.end);
      g.fillStyle = p.loop.on ? cssVar("--loop") : cssVar("--loop-off");
      g.fillRect(x0, h - 8, x1 - x0, 6);
    }

    const firstBar = Math.floor(s.scrollTick / bar);
    const lastTick = xToTick(w);
    const barPx = (bar / PPQ) * s.pxPerBeat;
    const labelEvery = barPx < 28 ? Math.ceil(28 / barPx) : 1;
    g.font = `500 11px ${cssVar("--font")}`;
    g.textBaseline = "top";
    for (let b = firstBar; b * bar <= lastTick; b++) {
      const x = Math.round(tickToX(b * bar)) + 0.5;
      g.fillStyle = cssVar("--line-strong");
      g.fillRect(x - 0.5, 0, 1, h);
      if (b % labelEvery === 0) {
        g.fillStyle = cssVar("--text-dim");
        g.fillText(String(b + 1), x + 5, 5);
      }
      if ((beat / PPQ) * s.pxPerBeat > 10) {
        for (let k = 1; k * beat < bar; k++) {
          const bx = Math.round(tickToX(b * bar + k * beat)) + 0.5;
          g.fillStyle = cssVar("--line");
          g.fillRect(bx - 0.5, h - 7, 1, 7);
        }
      }
    }

    // Start cursor: a small flag; playhead: a line.
    const cx = tickToX(s.cursorTick);
    g.fillStyle = cssVar("--text-dim");
    g.beginPath();
    g.moveTo(cx - 5, 0);
    g.lineTo(cx + 5, 0);
    g.lineTo(cx, 7);
    g.fill();
    if (s.playing) {
      const px = Math.round(tickToX(playheadTick())) + 0.5;
      g.fillStyle = cssVar("--playhead");
      g.fillRect(px - 1, 0, 2, h);
    }
    g.fillStyle = cssVar("--line-strong");
    g.fillRect(0, h - 1, w, 1);
  });

  useNativeWheel(ref, (e, x) => timelineWheel(e, x));

  const tickAt = (e: React.PointerEvent) => Math.max(0, xToTick(localPoint(e, e.currentTarget).x));

  return (
    <canvas
      ref={ref}
      className="ruler"
      style={{ height: RULER_H }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const snap = snapSize(store.project);
        const t = tickAt(e);
        if (e.shiftKey) {
          const anchor = snapRound(t, snap);
          store.beginGesture();
          drag.current = { mode: "loop", anchor };
        } else {
          drag.current = { mode: "cursor" };
          seek(snapFloor(t, snap));
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const snap = snapSize(store.project);
        const t = tickAt(e);
        if (d.mode === "cursor") {
          ui.set({ cursorTick: snapFloor(t, snap) });
        } else {
          const other = snapRound(t, snap);
          if (other === d.anchor) return;
          const start = Math.min(d.anchor, other);
          const end = Math.max(d.anchor, other);
          store.edit((p) => {
            p.loop = { on: true, start, end };
          }, { transient: true });
        }
      }}
      onPointerUp={() => {
        if (drag.current?.mode === "loop") store.endGesture();
        if (drag.current?.mode === "cursor" && ui.state.playing) seek(ui.state.cursorTick);
        drag.current = null;
      }}
    />
  );
}
