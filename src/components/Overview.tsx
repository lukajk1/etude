import { useRef } from "react";
import { engine, playheadTick, seek } from "../audio/live";
import { PPQ, songEnd, ticksPerBar, ticksPerBeat, type Project } from "../model/types";
import { cssVar, localPoint, useCanvas, withAlpha } from "../lib/useCanvas";
import { view } from "../lib/geom";
import { store } from "../model/store";
import { TIMBRES } from "../model/timbres";
import { ui } from "../model/ui";

export const OVERVIEW_H = 46;

/** The whole song's length as shown in the overview: the music plus a bar, at least 8 bars. */
function overviewLength(p: Project): number {
  const bar = ticksPerBar(p);
  return Math.max(bar * 8, Math.ceil((songEnd(p) + bar) / bar) * bar);
}

/** The ticks the piano roll currently shows. */
function visibleRange() {
  const s = ui.state;
  return { start: s.scrollTick, end: s.scrollTick + (view.timelineWidth / s.pxPerBeat) * PPQ };
}

/** Sound the notes the scrub passed over, so dragging while stopped is audible. */
function auditionBetween(p: Project, from: number, to: number) {
  if (from === to) return;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const anySolo = p.tracks.some((t) => t.solo);
  let count = 0;
  for (const t of p.tracks) {
    if (t.mute || (anySolo && !t.solo)) continue;
    for (const n of t.notes) {
      if (n.start > lo && n.start <= hi) {
        engine.audition(t.id, n.pitch, n.vel * 0.85, 0.22);
        if (++count >= 14) return;
      }
    }
  }
}

/**
 * The whole song in one strip. Drag to scrub: the cursor follows, playback jumps along
 * if it is running, and you hear the notes you pass over if it isn't. In the piano roll
 * view, the box shows what's on screen, and the roll scrolls to keep the cursor in it.
 */
export function Overview() {
  const drag = useRef<null | { last: number; lastSeek: number }>(null);

  const { ref } = useCanvas((g, w, h) => {
    const p = store.project;
    const s = ui.state;
    const len = overviewLength(p);
    const x = (tick: number) => (tick / len) * w;
    const bar = ticksPerBar(p);

    g.fillStyle = cssVar("--ink-1");
    g.fillRect(0, 0, w, h);

    if (p.loop.on && p.loop.end > p.loop.start) {
      g.fillStyle = cssVar("--loop-wash");
      g.fillRect(x(p.loop.start), 0, x(p.loop.end) - x(p.loop.start), h);
    }

    // Bar lines, thinned out so they never crowd.
    const barPx = x(bar);
    const every = Math.max(1, Math.ceil(48 / barPx));
    g.font = `500 10px ${cssVar("--font-ui")}`;
    g.textBaseline = "top";
    for (let b = 0; b * bar < len; b += every) {
      const bx = Math.round(x(b * bar)) + 0.5;
      g.fillStyle = cssVar("--line");
      g.fillRect(bx - 0.5, 0, 1, h);
      g.fillStyle = cssVar("--text-dim");
      g.fillText(String(b + 1), bx + 3, 2);
    }

    // Notes, one thin band per lane.
    const tracks = p.tracks.filter((t) => t.notes.length > 0);
    const top = 14;
    const band = (h - top - 2) / Math.max(1, tracks.length);
    tracks.forEach((t, i) => {
      let lo = 127;
      let hi = 0;
      for (const n of t.notes) {
        lo = Math.min(lo, n.pitch);
        hi = Math.max(hi, n.pitch);
      }
      const span = Math.max(1, hi - lo);
      g.fillStyle = withAlpha(TIMBRES[t.timbre].color, t.mute ? 0.3 : 0.85);
      for (const n of t.notes) {
        const y = top + i * band + (1 - (n.pitch - lo) / span) * Math.max(0, band - 1.5);
        g.fillRect(x(n.start), y, Math.max(1, x(n.dur)), 1.5);
      }
    });

    if (s.view === "roll") {
      const r = visibleRange();
      const x0 = x(r.start);
      const x1 = Math.min(w, x(r.end));
      g.fillStyle = cssVar("--wash");
      g.fillRect(x0, 0, x1 - x0, h);
      g.strokeStyle = cssVar("--text-dim");
      g.lineWidth = 1;
      g.strokeRect(Math.round(x0) + 0.5, 0.5, Math.round(x1 - x0) - 1, h - 1);
    }

    const cx = Math.round(x(s.cursorTick)) + 0.5;
    g.fillStyle = cssVar("--text");
    g.fillRect(cx - 0.5, 0, 1, h);
    g.beginPath();
    g.moveTo(cx - 5, 0);
    g.lineTo(cx + 5, 0);
    g.lineTo(cx, 7);
    g.fill();
    if (s.playing) {
      g.fillStyle = cssVar("--playhead");
      g.fillRect(Math.round(x(playheadTick())) - 1, 0, 2, h);
    }
    g.fillStyle = cssVar("--line-strong");
    g.fillRect(0, h - 1, w, 1);
  });

  const tickAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x } = localPoint(e, e.currentTarget);
    const w = e.currentTarget.clientWidth;
    return Math.max(0, Math.min(1, x / w)) * overviewLength(store.project);
  };

  /** Keep the piano roll showing the cursor. */
  const reveal = (tick: number) => {
    const r = visibleRange();
    if (tick < r.start || tick > r.end) {
      ui.set({ scrollTick: Math.max(0, tick - (r.end - r.start) * 0.25) });
    }
  };

  const scrubTo = (tick: number, last: number, lastSeek: number): number => {
    const beat = ticksPerBeat(store.project) / 4;
    const t = Math.round(tick / beat) * beat;
    if (ui.state.playing) {
      const now = performance.now();
      if (now - lastSeek > 90) {
        seek(t);
        lastSeek = now;
      } else ui.set({ cursorTick: t });
    } else {
      auditionBetween(store.project, last, t);
      ui.set({ cursorTick: t });
    }
    if (ui.state.view === "roll") reveal(t);
    return lastSeek;
  };

  return (
    <canvas
      ref={ref}
      className="overview"
      style={{ height: OVERVIEW_H }}
      aria-label="Song overview: drag to scrub"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const before = ui.state.cursorTick;
        const lastSeek = scrubTo(tickAt(e), before, 0);
        drag.current = { last: ui.state.cursorTick, lastSeek };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.lastSeek = scrubTo(tickAt(e), d.last, d.lastSeek);
        d.last = ui.state.cursorTick;
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d && ui.state.playing) seek(ui.state.cursorTick);
      }}
    />
  );
}
