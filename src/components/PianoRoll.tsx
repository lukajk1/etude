import { useEffect, useRef } from "react";
import { engine, playheadTick } from "../audio/live";
import { KEYS_W, ROW_H, RULER_H, SHOW_VELOCITY, snapFloor, snapRound, snapSize, tickToX, timelineWheel, VEL_H, view, xToTick } from "../lib/geom";
import { cssVar, localPoint, roundRect, useCanvas, useNativeWheel, withAlpha } from "../lib/useCanvas";
import { draftTrack, selectedTrack } from "../model/edits";
import { store, useProject } from "../model/store";
import { TIMBRES } from "../model/timbres";
import { newId, ticksPerBar, ticksPerBeat, type Note, type Track } from "../model/types";
import { hover, ui, useUi } from "../model/ui";
import { focused, marks } from "../exercises/state";
import { DRUM_NAMES, isBlackKey, noteName, scaleDegree, usesFlats } from "../theory/theory";
import { Inspector } from "./Inspector";
import { Ruler } from "./Ruler";

type Drag =
  | { kind: "move"; downTick: number; downPitch: number; primary: Note; orig: Map<string, Note>; lastPitch: number; moved: boolean; reselect: boolean }
  | { kind: "resize"; downTick: number; primary: Note; orig: Map<string, Note> }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; base: Set<string> }
  | { kind: "erase" }
  | { kind: "velocity" };

const MARK_COLOR = { error: "#ef6b5a", warning: "#e8b04a" } as const;

function noteRect(n: Note, top: number) {
  const x0 = tickToX(n.start);
  const x1 = tickToX(n.start + n.dur);
  return { x0, x1, y: (top - n.pitch) * ROW_H };
}

export function PianoRoll() {
  const project = useProject();
  useUi(); // re-render when the selected lane changes
  const track = selectedTrack(project);
  const pv = useRef({ topPitch: 84, pressedKey: -1 });
  const drag = useRef<Drag | null>(null);
  const keyDrag = useRef(false);

  const pitchAt = (y: number) => Math.max(0, Math.min(127, Math.ceil(pv.current.topPitch - y / ROW_H)));

  const hitNote = (t: Track, x: number, y: number): Note | null => {
    const pitch = pitchAt(y);
    for (let i = t.notes.length - 1; i >= 0; i--) {
      const n = t.notes[i];
      if (n.pitch !== pitch) continue;
      const r = noteRect(n, pv.current.topPitch);
      if (x >= r.x0 && x <= Math.max(r.x1, r.x0 + 4)) return n;
    }
    return null;
  };

  // ---- Grid ---------------------------------------------------------------
  const grid = useCanvas((g, w, h) => {
    view.timelineWidth = w;
    const p = store.project;
    const st = ui.state;
    const t = selectedTrack(p);
    const top = pv.current.topPitch;
    const lo = Math.max(0, Math.floor(top - h / ROW_H));
    const hi = Math.min(127, Math.ceil(top));
    const isDrum = t?.timbre === "percussion";
    const color = t ? TIMBRES[t.timbre].color : "#888888";
    const chromatic = p.scale === "chromatic";
    const hp = hover.value?.pitch ?? -1;

    for (let pitch = lo; pitch <= hi; pitch++) {
      const y = (top - pitch) * ROW_H;
      const deg = scaleDegree(pitch, p.key, p.scale);
      const inside = isDrum ? pitch in DRUM_NAMES : chromatic ? !isBlackKey(pitch) : deg > 0;
      g.fillStyle = inside ? cssVar("--row-in") : cssVar("--row-out");
      g.fillRect(0, y, w, ROW_H);
      if (!isDrum && !chromatic && deg === 1) {
        g.fillStyle = withAlpha(color, 0.1);
        g.fillRect(0, y, w, ROW_H);
      }
      if (pitch === hp) {
        g.fillStyle = cssVar("--row-hover");
        g.fillRect(0, y, w, ROW_H);
      }
      g.fillStyle = pitch % 12 === 0 ? cssVar("--line-strong") : cssVar("--line-faint");
      g.fillRect(0, Math.round(y + ROW_H) - 1, w, 1);
    }

    // Vertical lines: snap subdivisions, beats, bars.
    const bar = ticksPerBar(p);
    const beat = ticksPerBeat(p);
    const snap = snapSize(p);
    const first = xToTick(0);
    const last = xToTick(w);
    const pxPer = (ticks: number) => tickToX(ticks) - tickToX(0);
    const step = pxPer(snap) >= 7 && snap < beat ? snap : pxPer(beat) >= 7 ? beat : bar;
    for (let tk = Math.floor(first / step) * step; tk <= last; tk += step) {
      const x = Math.round(tickToX(tk));
      g.fillStyle = tk % bar === 0 ? cssVar("--line-strong") : tk % beat === 0 ? cssVar("--line") : cssVar("--line-faint");
      g.fillRect(x, 0, 1, h);
    }

    if (p.loop.on) {
      const x0 = tickToX(p.loop.start);
      g.fillStyle = cssVar("--loop-wash");
      g.fillRect(x0, 0, tickToX(p.loop.end) - x0, h);
    }

    const focusedIds = new Set(focused.value?.noteIds ?? []);
    // Other lanes, faintly, so you can write against them.
    if (st.showGhosts && !isDrum) {
      for (const other of p.tracks) {
        if (other.id === t?.id || other.timbre === "percussion") continue;
        // Given material in an exercise shows more strongly than ordinary context.
        g.fillStyle = withAlpha(TIMBRES[other.timbre].color, other.locked ? 0.45 : 0.2);
        for (const n of other.notes) {
          if (n.pitch < lo || n.pitch > hi) continue;
          const r = noteRect(n, top);
          if (r.x1 < 0 || r.x0 > w) continue;
          roundRect(g, r.x0, r.y + 2, Math.max(2, r.x1 - r.x0 - 1), ROW_H - 4, 2);
          g.fill();
          const mark = marks.value.get(n.id);
          if (mark) {
            g.strokeStyle = MARK_COLOR[mark];
            g.lineWidth = focusedIds.has(n.id) ? 3 : 2;
            g.stroke();
          }
        }
      }
    }

    if (t) {
      const flats = usesFlats(p.key, p.scale);
      const sel = st.selectedNoteIds;
      g.font = `600 9.5px ${cssVar("--font")}`;
      g.textBaseline = "middle";
      for (const n of t.notes) {
        if (n.pitch < lo || n.pitch > hi) continue;
        const r = noteRect(n, top);
        if (r.x1 < 0 || r.x0 > w) continue;
        const nw = Math.max(3, r.x1 - r.x0 - 1);
        const selected = sel.has(n.id);
        roundRect(g, r.x0, r.y + 0.5, nw, ROW_H - 1, 2.5);
        g.fillStyle = withAlpha(color, selected ? 1 : 0.5 + 0.45 * n.vel);
        g.fill();
        const mark = marks.value.get(n.id);
        g.strokeStyle = mark ? MARK_COLOR[mark] : selected ? cssVar("--text") : "rgba(0, 0, 0, 0.35)";
        g.lineWidth = mark ? (focusedIds.has(n.id) ? 3 : 2) : selected ? 1.5 : 1;
        g.stroke();
        if (nw > 26) {
          g.fillStyle = cssVar("--note-text");
          const label = isDrum ? (DRUM_NAMES[n.pitch] ?? noteName(n.pitch, flats)) : noteName(n.pitch, flats);
          g.save();
          g.beginPath();
          g.rect(r.x0, r.y, nw - 3, ROW_H);
          g.clip();
          g.fillText(label, r.x0 + 4, r.y + ROW_H / 2 + 0.5);
          g.restore();
        }
      }
    }

    const cx = Math.round(tickToX(st.cursorTick)) + 0.5;
    g.strokeStyle = cssVar("--text-dim");
    g.lineWidth = 1;
    g.setLineDash([2, 3]);
    g.beginPath();
    g.moveTo(cx, 0);
    g.lineTo(cx, h);
    g.stroke();
    g.setLineDash([]);
    if (st.playing) {
      g.fillStyle = cssVar("--playhead");
      g.fillRect(Math.round(tickToX(playheadTick())) - 1, 0, 2, h);
    }

    const d = drag.current;
    if (d?.kind === "marquee") {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      g.fillStyle = "rgba(255, 255, 255, 0.05)";
      g.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      g.strokeStyle = cssVar("--text-dim");
      g.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    }
  });

  // ---- Keyboard -----------------------------------------------------------
  const keys = useCanvas((g, w, h) => {
    const p = store.project;
    const t = selectedTrack(p);
    const top = pv.current.topPitch;
    const lo = Math.max(0, Math.floor(top - h / ROW_H));
    const hi = Math.min(127, Math.ceil(top));
    const isDrum = t?.timbre === "percussion";
    const color = t ? TIMBRES[t.timbre].color : "#888888";
    const flats = usesFlats(p.key, p.scale);
    const hp = hover.value?.pitch ?? -1;
    g.font = `500 9.5px ${cssVar("--font")}`;
    g.textBaseline = "middle";

    for (let pitch = lo; pitch <= hi; pitch++) {
      const y = (top - pitch) * ROW_H;
      const black = isBlackKey(pitch);
      const pressed = pv.current.pressedKey === pitch;
      g.fillStyle = pressed ? color : black ? cssVar("--key-black") : cssVar("--key-white");
      g.fillRect(0, y, w, ROW_H);
      if (pitch === hp && !pressed) {
        g.fillStyle = withAlpha(color, 0.35);
        g.fillRect(0, y, w, ROW_H);
      }
      g.fillStyle = cssVar("--key-gap");
      g.fillRect(0, Math.round(y + ROW_H) - 1, w, 1);

      const label = isDrum ? DRUM_NAMES[pitch] : pitch % 12 === 0 ? noteName(pitch, flats) : null;
      if (label) {
        g.fillStyle = black && !pressed ? cssVar("--text-dim") : cssVar("--key-label");
        g.fillText(label, 4, y + ROW_H / 2 + 0.5, w - 16);
      }
      if (!isDrum && p.scale !== "chromatic") {
        const deg = scaleDegree(pitch, p.key, p.scale);
        if (deg > 0) {
          g.fillStyle = deg === 1 ? color : withAlpha(color, 0.6);
          g.font = `${deg === 1 ? 700 : 500} 9px ${cssVar("--font")}`;
          g.textAlign = "right";
          g.fillText(String(deg), w - 4, y + ROW_H / 2 + 0.5);
          g.textAlign = "left";
          g.font = `500 9.5px ${cssVar("--font")}`;
        }
      }
    }
  });

  // ---- Velocity lane ------------------------------------------------------
  const vel = useCanvas((g, w, h) => {
    const t = selectedTrack(store.project);
    g.fillStyle = cssVar("--ink-0");
    g.fillRect(0, 0, w, h);
    g.fillStyle = cssVar("--line-strong");
    g.fillRect(0, 0, w, 1);
    if (!t) return;
    const color = TIMBRES[t.timbre].color;
    const sel = ui.state.selectedNoteIds;
    for (const n of t.notes) {
      const x = tickToX(n.start);
      if (x < -4 || x > w) continue;
      const bh = (h - 8) * n.vel;
      g.fillStyle = sel.has(n.id) ? cssVar("--text") : withAlpha(color, 0.85);
      g.fillRect(Math.round(x), h - bh, 2, bh);
      g.fillRect(Math.round(x) - 2, h - bh, 6, 2);
    }
  });

  useEffect(() => {
    const unsubs = [marks.subscribe(() => grid.invalidate()), focused.subscribe(() => grid.invalidate())];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redrawAll = () => {
    grid.invalidate();
    keys.invalidate();
  };

  const scrollPitch = (deltaRows: number) => {
    const h = grid.ref.current?.clientHeight ?? 300;
    const rows = h / ROW_H;
    pv.current.topPitch = Math.max(rows - 1, Math.min(127, pv.current.topPitch + deltaRows));
    redrawAll();
  };

  const verticalWheel = (e: WheelEvent, x: number) => {
    if (timelineWheel(e, x)) return true;
    scrollPitch(-e.deltaY / ROW_H);
    return true;
  };
  useNativeWheel(grid.ref, verticalWheel);
  useNativeWheel(keys.ref, (e) => {
    scrollPitch(-e.deltaY / ROW_H);
    return true;
  });
  useNativeWheel(vel.ref, (e, x) => timelineWheel(e, x));

  // Center the lane's notes (or its instrument's range) when switching lanes.
  const trackId = track?.id;
  useEffect(() => {
    const t = selectedTrack(store.project);
    if (!t) return;
    let center: number;
    if (t.notes.length) {
      const ps = t.notes.map((n) => n.pitch);
      center = (Math.min(...ps) + Math.max(...ps)) / 2;
    } else {
      const [a, b] = TIMBRES[t.timbre].range;
      center = (a + b) / 2;
    }
    const h = grid.ref.current?.clientHeight ?? 300;
    const rows = h / ROW_H;
    pv.current.topPitch = Math.max(rows - 1, Math.min(127, Math.round(center + rows / 2)));
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // ---- Grid pointer handling ---------------------------------------------
  const audition = (pitch: number, v = 0.75) => {
    if (track) engine.audition(track.id, pitch, v, 0.35);
  };

  const eraseAt = (t: Track, x: number, y: number) => {
    const n = hitNote(t, x, y);
    if (!n) return;
    store.edit((d) => {
      const dt = draftTrack(d, t.id);
      if (dt) dt.notes = dt.notes.filter((m) => m.id !== n.id);
    }, { transient: true });
  };

  const onGridDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!track) return;
    if (track.locked) {
      // Given material: listen, don't edit.
      const { x, y } = localPoint(e, e.currentTarget);
      const hit = hitNote(track, x, y);
      if (hit && e.button === 0) audition(hit.pitch, hit.vel);
      return;
    }
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const { x, y } = localPoint(e, el);
    const tick = Math.max(0, xToTick(x));
    const pitch = pitchAt(y);
    const snap = snapSize(store.project);

    if (e.button === 2) {
      store.beginGesture();
      drag.current = { kind: "erase" };
      eraseAt(track, x, y);
      return;
    }
    if (e.button !== 0) return;

    const hit = hitNote(track, x, y);
    const sel = ui.state.selectedNoteIds;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    if (hit) {
      if (additive) {
        const next = new Set(sel);
        if (next.has(hit.id)) {
          next.delete(hit.id);
          ui.set({ selectedNoteIds: next });
          return;
        }
        next.add(hit.id);
        ui.set({ selectedNoteIds: next });
      } else if (!sel.has(hit.id)) {
        ui.set({ selectedNoteIds: new Set([hit.id]) });
      }
      const ids = ui.state.selectedNoteIds;
      const orig = new Map(track.notes.filter((n) => ids.has(n.id)).map((n) => [n.id, n]));
      const r = noteRect(hit, pv.current.topPitch);
      const onEdge = x > r.x1 - 6 && r.x1 - r.x0 > 10;
      store.beginGesture();
      drag.current = onEdge
        ? { kind: "resize", downTick: tick, primary: hit, orig }
        : { kind: "move", downTick: tick, downPitch: pitch, primary: hit, orig, lastPitch: hit.pitch, moved: false, reselect: !additive && sel.has(hit.id) && sel.size > 1 };
      audition(hit.pitch, hit.vel);
      return;
    }

    if (additive) {
      drag.current = { kind: "marquee", x0: x, y0: y, x1: x, y1: y, base: e.shiftKey ? new Set(sel) : new Set() };
      return;
    }

    // Empty space: place a note, then let the same drag move it.
    const n: Note = { id: newId(), pitch, start: snapFloor(tick, snap), dur: ui.state.drawLength, vel: 0.75 };
    store.beginGesture();
    store.edit((d) => {
      draftTrack(d, track.id)?.notes.push(n);
    }, { transient: true });
    ui.set({ selectedNoteIds: new Set([n.id]) });
    drag.current = { kind: "move", downTick: tick, downPitch: pitch, primary: n, orig: new Map([[n.id, n]]), lastPitch: pitch, moved: true, reselect: false };
    audition(pitch);
  };

  const onGridMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const { x, y } = localPoint(e, el);
    const tick = Math.max(0, xToTick(x));
    const pitch = pitchAt(y);
    hover.set(hover.value?.pitch === pitch && Math.abs(hover.value.tick - tick) < 1 ? hover.value : { pitch, tick });
    redrawAll();
    const d = drag.current;
    if (!track) return;

    if (!d) {
      const hit = hitNote(track, x, y);
      if (!hit) el.style.cursor = "default";
      else {
        const r = noteRect(hit, pv.current.topPitch);
        el.style.cursor = x > r.x1 - 6 && r.x1 - r.x0 > 10 ? "ew-resize" : "grab";
      }
      return;
    }

    const snap = snapSize(store.project);
    if (d.kind === "move") {
      const prim = d.orig.get(d.primary.id) ?? d.primary;
      let dt = snapRound(prim.start + (tick - d.downTick), snap) - prim.start;
      let dp = pitch - d.downPitch;
      const all = [...d.orig.values()];
      dt = Math.max(dt, -Math.min(...all.map((n) => n.start)));
      dp = Math.max(-Math.min(...all.map((n) => n.pitch)), Math.min(127 - Math.max(...all.map((n) => n.pitch)), dp));
      if (dt !== 0 || dp !== 0) d.moved = true;
      store.edit((dr) => {
        const t = draftTrack(dr, track.id);
        if (!t) return;
        for (const n of t.notes) {
          const o = d.orig.get(n.id);
          if (!o) continue;
          n.start = o.start + dt;
          n.pitch = o.pitch + dp;
        }
      }, { transient: true });
      const newPitch = prim.pitch + dp;
      if (newPitch !== d.lastPitch) {
        d.lastPitch = newPitch;
        audition(newPitch, prim.vel);
      }
    } else if (d.kind === "resize") {
      const prim = d.orig.get(d.primary.id) ?? d.primary;
      const end = prim.start + prim.dur;
      const dt = snapRound(end + (tick - d.downTick), snap) - end;
      store.edit((dr) => {
        const t = draftTrack(dr, track.id);
        if (!t) return;
        for (const n of t.notes) {
          const o = d.orig.get(n.id);
          if (!o) continue;
          n.dur = Math.max(Math.min(snap, o.dur), o.dur + dt);
        }
      }, { transient: true });
    } else if (d.kind === "marquee") {
      d.x1 = x;
      d.y1 = y;
      const t0 = xToTick(Math.min(d.x0, d.x1));
      const t1 = xToTick(Math.max(d.x0, d.x1));
      const pHi = pitchAt(Math.min(d.y0, d.y1));
      const pLo = pitchAt(Math.max(d.y0, d.y1));
      const next = new Set(d.base);
      for (const n of track.notes) {
        if (n.pitch >= pLo && n.pitch <= pHi && n.start < t1 && n.start + n.dur > t0) next.add(n.id);
      }
      ui.set({ selectedNoteIds: next });
    } else if (d.kind === "erase") {
      eraseAt(track, x, y);
    }
  };

  const onGridUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "move" || d.kind === "resize") {
      store.endGesture();
      const latest = selectedTrack()?.notes.find((n) => n.id === d.primary.id);
      if (latest) ui.set({ drawLength: latest.dur });
      if (d.kind === "move" && !d.moved && d.reselect) ui.set({ selectedNoteIds: new Set([d.primary.id]) });
    } else if (d.kind === "erase") {
      store.endGesture();
    }
    grid.invalidate();
  };

  // ---- Keyboard pointer handling -----------------------------------------
  const pressKey = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pitch = pitchAt(localPoint(e, e.currentTarget).y);
    if (pitch === pv.current.pressedKey) return;
    pv.current.pressedKey = pitch;
    audition(pitch, 0.8);
    keys.invalidate();
  };

  // ---- Velocity pointer handling -----------------------------------------
  const paintVelocity = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!track || track.locked) return;
    const { x, y } = localPoint(e, e.currentTarget);
    const h = e.currentTarget.clientHeight;
    const v = Math.max(0.02, Math.min(1, (h - y) / (h - 8)));
    const sel = ui.state.selectedNoteIds;
    const hits = track.notes.filter((n) => {
      const x0 = tickToX(n.start);
      return x >= x0 - 3 && x <= Math.max(x0 + 5, tickToX(n.start + n.dur));
    });
    const targets = hits.some((n) => sel.has(n.id)) ? hits.filter((n) => sel.has(n.id)) : hits;
    if (targets.length === 0) return;
    const ids = new Set(targets.map((n) => n.id));
    store.edit((d) => {
      const t = draftTrack(d, track.id);
      if (!t) return;
      for (const n of t.notes) if (ids.has(n.id)) n.vel = v;
    }, { transient: true });
  };

  return (
    <div className="roll">
      <Inspector track={track} />
      <div className="roll-keys" style={{ width: KEYS_W }}>
        <div className="roll-corner" style={{ height: RULER_H }} />
        <canvas
          ref={keys.ref}
          className="keys-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            keyDrag.current = true;
            pressKey(e);
          }}
          onPointerMove={(e) => {
            const pitch = pitchAt(localPoint(e, e.currentTarget).y);
            if (hover.value?.pitch !== pitch) {
              hover.set({ pitch, tick: hover.value?.tick ?? 0 });
              redrawAll();
            }
            if (keyDrag.current) pressKey(e);
          }}
          onPointerUp={() => {
            keyDrag.current = false;
            pv.current.pressedKey = -1;
            keys.invalidate();
          }}
          onPointerLeave={() => {
            if (!keyDrag.current) {
              hover.set(null);
              redrawAll();
            }
          }}
        />
        {SHOW_VELOCITY && (
          <div className="vel-label" style={{ height: VEL_H }}>
            Velocity
          </div>
        )}
      </div>
      <div className="roll-main">
        <Ruler />
        <canvas
          ref={grid.ref}
          className="grid-canvas"
          onPointerDown={onGridDown}
          onPointerMove={onGridMove}
          onPointerUp={onGridUp}
          onPointerCancel={onGridUp}
          onPointerLeave={() => {
            if (!drag.current) {
              hover.set(null);
              redrawAll();
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {SHOW_VELOCITY && (
          <canvas
            ref={vel.ref}
            className="vel-canvas"
            style={{ height: VEL_H }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              store.beginGesture();
              drag.current = { kind: "velocity" };
              paintVelocity(e);
            }}
            onPointerMove={(e) => {
              if (drag.current?.kind === "velocity") paintVelocity(e);
            }}
            onPointerUp={() => {
              if (drag.current?.kind === "velocity") store.endGesture();
              drag.current = null;
            }}
          />
        )}
      </div>
    </div>
  );
}
