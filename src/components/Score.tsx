import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accidental,
  Beam,
  Dot,
  Formatter,
  Fraction,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
  type StemmableNote,
} from "vexflow";
import { playheadTick, seek } from "../audio/live";
import { buildScore, type Clef, type Piece, type ScoreModel, type Staff } from "../notation/score";
import { store, useProject } from "../model/store";
import { ticksPerBeat } from "../model/types";
import { ui, useUi } from "../model/ui";

const LABEL_W = 120;
const STAFF_GAP = 108;
const TOP = 34;
const CHUNK_MAX = 1400;

// ---- Layout ------------------------------------------------------------------

interface Layout {
  x: number[];
  w: number[];
  /** Where notes begin inside each measure, relative to its left edge. */
  noteStart: number[];
  total: number;
  height: number;
  chunks: [number, number][];
}

function headerWidth(model: ScoreModel) {
  return 38 + Math.abs(model.keyAccidentals) * 11 + 30;
}

function computeLayout(model: ScoreModel): Layout {
  const x: number[] = [];
  const w: number[] = [];
  const noteStart: number[] = [];
  let cursor = 12;
  for (let m = 0; m < model.measureCount; m++) {
    let count = 1;
    for (const st of model.staves) {
      for (const v of st.measures[m] ?? []) count = Math.max(count, v.filter((p) => !p.ghost).length);
    }
    const head = m === 0 ? headerWidth(model) : 14;
    const width = Math.max(96, head + 26 + count * 27);
    x.push(cursor);
    w.push(width);
    noteStart.push(head);
    cursor += width;
  }
  const chunks: [number, number][] = [];
  let start = 0;
  let acc = 0;
  for (let m = 0; m < model.measureCount; m++) {
    if (acc + w[m] > CHUNK_MAX && m > start) {
      chunks.push([start, m]);
      start = m;
      acc = 0;
    }
    acc += w[m];
  }
  chunks.push([start, model.measureCount]);
  return { x, w, noteStart, total: cursor + 40, height: TOP + model.staves.length * STAFF_GAP + 10, chunks };
}

function tickToX(tick: number, model: ScoreModel, layout: Layout): number {
  const m = Math.min(model.measureCount - 1, Math.max(0, Math.floor(tick / model.measureTicks)));
  const f = Math.min(1, (tick - m * model.measureTicks) / model.measureTicks);
  const inner = layout.w[m] - layout.noteStart[m] - 14;
  return layout.x[m] + layout.noteStart[m] + f * inner;
}

function xToTick(x: number, model: ScoreModel, layout: Layout): number {
  let m = layout.x.findIndex((mx, i) => x >= mx && x < mx + layout.w[i]);
  if (m < 0) m = x < layout.x[0] ? 0 : model.measureCount - 1;
  const inner = layout.w[m] - layout.noteStart[m] - 14;
  const f = Math.max(0, Math.min(1, (x - layout.x[m] - layout.noteStart[m]) / inner));
  return m * model.measureTicks + f * model.measureTicks;
}

// ---- Notes -------------------------------------------------------------------

const SHARP = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const FLAT = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];

/** General MIDI drums placed on a percussion staff, with x noteheads for cymbals. */
const DRUM_KEYS: Record<number, string> = {
  35: "f/4", 36: "f/4", 37: "c/5/x2", 38: "c/5", 39: "c/5/x2", 40: "c/5",
  41: "a/4", 43: "a/4", 45: "d/5", 47: "d/5", 48: "e/5", 50: "e/5",
  42: "g/5/x2", 44: "d/4/x2", 46: "g/5/x2", 49: "a/5/x2", 57: "a/5/x2", 52: "a/5/x2", 55: "a/5/x2",
  51: "f/5/x2", 53: "f/5/x2", 59: "f/5/x2", 54: "b/4/x2", 56: "b/4/x2",
};

function keyName(pitch: number, clef: Clef, flats: boolean): string {
  if (clef === "percussion") return DRUM_KEYS[pitch] ?? "c/5";
  return `${(flats ? FLAT : SHARP)[pitch % 12]}/${Math.floor(pitch / 12) - 1}`;
}

const STRAIGHT_DUR: Record<number, string> = { 96: "w", 72: "hd", 48: "h", 36: "qd", 24: "q", 18: "8d", 12: "8", 9: "16d", 6: "16", 3: "32" };
const TRIPLET_DUR: Record<number, string> = { 16: "q", 8: "8", 4: "16" };

function duration(p: Piece): string {
  return (p.triplet ? TRIPLET_DUR[p.units] : STRAIGHT_DUR[p.units]) ?? "16";
}

interface BuiltVoice {
  voice: Voice;
  notes: (StaveNote | GhostNote)[];
  beams: Beam[];
  tuplets: Tuplet[];
}

function buildVoice(pieces: Piece[], staff: Staff, voiceIndex: number, twoVoices: boolean, model: ScoreModel): BuiltVoice {
  const notes = pieces.map((p) => {
    const dur = duration(p);
    if (p.ghost) return new GhostNote(dur.replace("d", ""));
    const restKey = staff.clef === "bass" ? "d/3" : "b/4";
    const n = new StaveNote({
      keys: p.rest ? [restKey] : p.keys.map((k) => keyName(k, staff.clef, model.flats)),
      duration: p.measureRest ? "wr" : dur.replace("d", "") + (p.rest ? "r" : ""),
      clef: staff.clef,
      align_center: p.measureRest,
      ...(twoVoices ? { stem_direction: voiceIndex === 0 ? 1 : -1 } : { auto_stem: true }),
    });
    if (dur.includes("d") && !p.measureRest) Dot.buildAndAttach([n], { all: true });
    return n;
  });

  // Triplets: one group per beat. Spacers just get the timing, without a bracket.
  const tuplets: Tuplet[] = [];
  let i = 0;
  while (i < pieces.length) {
    if (!pieces[i].triplet) {
      i++;
      continue;
    }
    const beat = Math.floor(pieces[i].start / 24);
    let j = i;
    while (j < pieces.length && pieces[j].triplet && Math.floor(pieces[j].start / 24) === beat) j++;
    const group = notes.slice(i, j);
    const ghosts = group.filter((n) => n instanceof GhostNote);
    const real = group.filter((n) => !(n instanceof GhostNote));
    for (const g of ghosts) g.applyTickMultiplier(2, 3);
    if (real.length) tuplets.push(new Tuplet(real, { num_notes: 3, notes_occupied: 2, ratioed: false, bracketed: real.length !== group.length }));
    i = j;
  }

  const voice = new Voice({ num_beats: model.timeSig[0], beat_value: model.timeSig[1] }).setMode(Voice.Mode.SOFT);
  voice.addTickables(notes);

  const beamable = notes.filter((n): n is StaveNote => n instanceof StaveNote) as StemmableNote[];
  const [num, den] = model.timeSig;
  const groups = den === 8 && num % 3 === 0 ? [new Fraction(3, 8)] : [new Fraction(1, 4)];
  const beams = Beam.generateBeams(beamable, {
    groups,
    ...(twoVoices ? { stem_direction: voiceIndex === 0 ? 1 : -1, maintain_stem_directions: true } : {}),
  });
  return { voice, notes, beams, tuplets };
}

// ---- Drawing one chunk of measures -------------------------------------------------

function drawChunk(el: HTMLDivElement, model: ScoreModel, layout: Layout, from: number, to: number) {
  el.innerHTML = "";
  const left = layout.x[from];
  const width = layout.x[to - 1] + layout.w[to - 1] - left + 2;
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(width, layout.height);
  const ctx = renderer.getContext();
  const n = model.staves.length;
  // Last drawn note of each staff/voice that is tied onward.
  const pending = new Map<string, StaveNote>();

  // A tie coming in from before this chunk starts.
  if (from > 0) {
    model.staves.forEach((st, si) => {
      (st.measures[from - 1] ?? []).forEach((v, vi) => {
        if (v.length && v[v.length - 1].tie) pending.set(`${si}:${vi}`, null as unknown as StaveNote);
      });
    });
  }

  for (let m = from; m < to; m++) {
    const x = layout.x[m] - left;
    const staves = model.staves.map((st, si) => {
      const stave = new Stave(x, TOP + si * STAFF_GAP - 30, layout.w[m]);
      if (m === 0) {
        stave.addClef(st.clef);
        if (st.clef !== "percussion" && model.keySig !== "C") stave.addKeySignature(model.keySig);
        stave.addTimeSignature(`${model.timeSig[0]}/${model.timeSig[1]}`);
      }
      if (si === 0) stave.setMeasure(m + 1);
      return stave.setContext(ctx);
    });
    const startX = Math.max(...staves.map((s) => s.getNoteStartX()));
    for (const s of staves) s.setNoteStartX(startX);
    for (const s of staves) s.draw();

    if (n > 1) {
      new StaveConnector(staves[0], staves[n - 1]).setType("singleRight").setContext(ctx).draw();
      if (m === 0) {
        new StaveConnector(staves[0], staves[n - 1]).setType("singleLeft").setContext(ctx).draw();
        new StaveConnector(staves[0], staves[n - 1]).setType("bracket").setContext(ctx).draw();
      }
    }

    try {
      const built = model.staves.map((st) => {
        const voices = st.measures[m] ?? [];
        return voices.map((pieces, vi) => buildVoice(pieces, st, vi, voices.length > 1, model));
      });
      const formatter = new Formatter();
      built.forEach((bv, si) => {
        if (!bv.length) return;
        const vs = bv.map((b) => b.voice);
        if (model.staves[si].clef !== "percussion") Accidental.applyAccidentals(vs, model.keySig);
        formatter.joinVoices(vs);
      });
      const all = built.flat().map((b) => b.voice);
      const justify = staves[0].getNoteEndX() - startX - 10;
      if (all.length) formatter.format(all, Math.max(20, justify));

      built.forEach((bv, si) => {
        bv.forEach((b, vi) => {
          b.voice.draw(ctx, staves[si]);
          b.beams.forEach((beam) => beam.setContext(ctx).draw());
          b.tuplets.forEach((t) => t.setContext(ctx).draw());

          const pieces = model.staves[si].measures[m][vi];
          const key = `${si}:${vi}`;
          b.notes.forEach((note, k) => {
            if (!(note instanceof StaveNote) || pieces[k].rest) return;
            if (pending.has(key)) {
              const first = pending.get(key) ?? null;
              const idx = pieces[k].keys.map((_, ii) => ii);
              new StaveTie({ first_note: first, last_note: note, first_indices: idx, last_indices: idx }).setContext(ctx).draw();
              pending.delete(key);
            }
            if (pieces[k].tie) pending.set(key, note);
          });
        });
      });
    } catch (err) {
      console.warn(`Couldn't engrave measure ${m + 1}:`, err);
    }
  }

  // Ties running past the end of this chunk.
  for (const note of pending.values()) {
    if (note) new StaveTie({ first_note: note, last_note: null, first_indices: [0], last_indices: [0] }).setContext(ctx).draw();
  }
}

function Chunk({ model, layout, from, to, root }: { model: ScoreModel; layout: Layout; from: number; to: number; root: HTMLDivElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !root) return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), {
      root,
      rootMargin: "0px 1200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (visible && ref.current) drawChunk(ref.current, model, layout, from, to);
  }, [visible, model, layout, from, to]);

  const left = layout.x[from];
  const width = layout.x[to - 1] + layout.w[to - 1] - left + 2;
  return <div ref={ref} className="score-chunk" style={{ left: LABEL_W + left, width, height: layout.height }} />;
}

// ---- The view ------------------------------------------------------------------

export default function Score() {
  const project = useProject();
  const s = useUi();
  const model = useMemo(() => buildScore(project), [project]);
  const layout = useMemo(() => computeLayout(model), [model]);
  const scroller = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);

  // Move the playhead every frame while playing, and keep it in view.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = scroller.current;
      if (!el) return;
      const cx = LABEL_W + tickToX(ui.state.cursorTick, model, layout);
      if (cursor.current) cursor.current.style.transform = `translateX(${cx}px)`;
      if (playhead.current) {
        playhead.current.style.display = ui.state.playing ? "block" : "none";
        if (ui.state.playing) {
          const px = LABEL_W + tickToX(playheadTick(), model, layout);
          playhead.current.style.transform = `translateX(${px}px)`;
          if (px > el.scrollLeft + el.clientWidth * 0.85 || px < el.scrollLeft + LABEL_W) {
            el.scrollLeft = px - LABEL_W - el.clientWidth * 0.1;
          }
        }
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [model, layout]);

  // When the cursor moves while stopped (scrubbing, the ruler), bring it into view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || s.playing) return;
    const cx = LABEL_W + tickToX(s.cursorTick, model, layout);
    if (cx < el.scrollLeft + LABEL_W || cx > el.scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = cx - LABEL_W - el.clientWidth * 0.2;
    }
  }, [s.cursorTick, s.playing, model, layout]);

  return (
    <div
      className="score"
      ref={(el) => {
        scroller.current = el;
        if (el !== root) setRoot(el);
      }}
    >
      <div
        className="score-sheet"
        style={{ width: LABEL_W + layout.total, height: layout.height }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".score-labels")) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left - LABEL_W;
          const beat = ticksPerBeat(store.project);
          seek(Math.floor(xToTick(x, model, layout) / beat) * beat);
        }}
      >
        <div className="score-labels" style={{ width: LABEL_W, height: layout.height }}>
          {model.staves.map((st, i) => (
            <div
              key={st.trackId}
              className={`score-label${st.trackId === s.selectedTrackId ? " is-selected" : ""}`}
              style={{ top: TOP + i * STAFF_GAP + 30, "--lane": st.color } as React.CSSProperties}
              onPointerDown={() => ui.set({ selectedTrackId: st.trackId, selectedNoteIds: new Set() })}
            >
              <span className="dot" />
              <span className="score-label-name">{st.name}</span>
            </div>
          ))}
        </div>
        {layout.chunks.map(([from, to]) => (
          <Chunk key={`${from}-${to}`} model={model} layout={layout} from={from} to={to} root={root} />
        ))}
        <div ref={cursor} className="score-cursor" style={{ height: layout.height }} />
        <div ref={playhead} className="score-playhead" style={{ height: layout.height }} />
      </div>
    </div>
  );
}
