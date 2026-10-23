import { useEffect, useRef } from "react";
import { Accidental, BarlineType, Beam, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { PPQ } from "../../model/types";
import { MAJOR_KEYS } from "../drills/theory";
import type { Melody } from "./melodies";

/** Vertical distance between lines, in unscaled units. */
const LINE_H = 104;
const MAX_BARS_PER_LINE = 4;

/** VexFlow durations by length in ticks ("d" for dotted). */
const VF_DUR: Record<number, string> = {
  [PPQ * 4]: "w",
  [PPQ * 3]: "hd",
  [PPQ * 2]: "h",
  [(PPQ * 3) / 2]: "qd",
  [PPQ]: "q",
  [(PPQ * 3) / 4]: "8d",
  [PPQ / 2]: "8",
  [PPQ / 4]: "16",
};

/** Rough minimum width of a note by duration, before an accidental. */
const MIN_W: Record<string, number> = { w: 36, hd: 34, h: 30, qd: 26, q: 22, "8d": 20, "8": 16, "16": 13 };

const SHARP_ORDER = ["f", "c", "g", "d", "a", "e", "b"];
const FLAT_ORDER = ["b", "e", "a", "d", "g", "c", "f"];
const ACC_ALTER: Record<string, number> = { "": 0, n: 0, "#": 1, "##": 2, b: -1, bb: -2 };
const ALTER_GLYPH: Record<number, string> = { [-2]: "bb", [-1]: "b", 0: "n", 1: "#", 2: "##" };

/** One thing to draw in a bar: a note (with its accidental, if one is shown) or a rest. */
interface Item {
  dur: string;
  key: string;
  rest: boolean;
  acc: string | null;
}

/** The signature's alteration of a letter: 1 sharp, -1 flat, 0 natural. */
function sigAlter(letter: string, accidentals: number): number {
  if (accidentals > 0 && SHARP_ORDER.indexOf(letter) < accidentals) return 1;
  if (accidentals < 0 && FLAT_ORDER.indexOf(letter) < -accidentals) return -1;
  return 0;
}

/** Rests filling [from, to) inside one bar, on the beat: half rests only on beats 1 and 3 of 4/4. */
function rests(from: number, to: number, beats: number): Item[] {
  // An empty bar takes a whole rest, whatever the meter.
  if (from === 0 && to === beats * PPQ) return [{ dur: "w", key: "d/5", rest: true, acc: null }];
  const out: Item[] = [];
  let t = from;
  while (t < to) {
    const left = to - t;
    let len: number;
    if (beats === 4 && t % (PPQ * 2) === 0 && left >= PPQ * 2) len = PPQ * 2;
    else if (t % PPQ === 0 && left >= PPQ) len = PPQ;
    else if (t % (PPQ / 2) === 0 && left >= PPQ / 2) len = PPQ / 2;
    else len = Math.min(left, PPQ / 4);
    out.push({ dur: VF_DUR[len] ?? "16", key: "b/4", rest: true, acc: null });
    t += len;
  }
  return out;
}

/** Splits a melody into bars of items, with rests in any gaps and accidentals worked out per bar. */
function toBars(melody: Melody): Item[][] {
  const beats = melody.timeSig[0];
  const barTicks = beats * PPQ;
  const notes = [...melody.notes].sort((a, b) => a.start - b.start);
  const end = Math.max(barTicks, ...notes.map((n) => n.start + n.dur));
  const count = Math.ceil(end / barTicks);
  const bars: Item[][] = [];
  for (let b = 0; b < count; b++) {
    const barStart = b * barTicks;
    const items: Item[] = [];
    // Alteration in force for each letter+octave so far in this bar.
    const inForce = new Map<string, number>();
    let t = 0;
    for (const n of notes.filter((x) => x.start >= barStart && x.start < barStart + barTicks)) {
      const at = n.start - barStart;
      if (at > t) items.push(...rests(t, at, beats));
      const m = /^([a-g])(##|bb|#|b|n)?\/(-?\d+)$/i.exec(n.vf.trim());
      let acc: string | null = null;
      let key = n.vf;
      if (m) {
        const letter = m[1].toLowerCase();
        const alter = ACC_ALTER[(m[2] ?? "").toLowerCase()] ?? 0;
        const slot = letter + m[3];
        const current = inForce.get(slot) ?? sigAlter(letter, melody.accidentals);
        if (alter !== current) acc = ALTER_GLYPH[alter];
        inForce.set(slot, alter);
        key = `${letter}${alter === 0 ? "" : ALTER_GLYPH[alter]}/${m[3]}`;
      }
      items.push({ dur: VF_DUR[n.dur] ?? "q", key, rest: false, acc });
      t = at + n.dur;
    }
    if (t < barTicks) items.push(...rests(t, barTicks, beats));
    bars.push(items);
  }
  return bars;
}

/** Where the notes start in a stave with these modifiers, from its left edge. */
function noteStart(clefAndKey: boolean, timeSig: string | null, keySig: string): number {
  const stave = new Stave(0, 0, 500);
  if (clefAndKey) stave.addClef("treble").addKeySignature(keySig);
  if (timeSig) stave.addTimeSignature(timeSig);
  return stave.getNoteStartX() - stave.getX();
}

/** A dictation melody in standard notation on treble staves, about four bars to a line. `scale` sizes the notation; smaller fits more bars in a narrow width. */
export function MelodyStaff({ melody, width = 640, scale: SCALE = 1.2 }: { melody: Melody; width?: number; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const beats = melody.timeSig[0];
    const timeSig = `${beats}/4`;
    // addKeySignature wants the major key with this signature, so minor keys work too.
    const keySig = MAJOR_KEYS.find((k) => k.accidentals === melody.accidentals)?.code ?? "C";
    const bars = toBars(melody);
    const inner = width / SCALE - 8;
    const headFirst = noteStart(true, timeSig, keySig);
    const headLine = noteStart(true, null, keySig);
    const headPlain = noteStart(false, null, keySig);
    // Content width each bar needs, past the stave's own start padding.
    const need = bars.map((items) => 12 + items.reduce((w, x) => w + MIN_W[x.dur] + (x.acc ? 10 : 0), 0));
    const barMin = (i: number, lineStart: boolean) => need[i] + (i === 0 ? headFirst : lineStart ? headLine : headPlain);

    // Balanced lines: the most bars per line (up to 4) whose lines all fit the width.
    const split = (perLine: number) => {
      const lines = Math.ceil(bars.length / perLine);
      const size = Math.ceil(bars.length / lines);
      const out: number[][] = [];
      for (let i = 0; i < bars.length; i += size) out.push(bars.map((_, j) => j).slice(i, i + size));
      return out;
    };
    let lines = split(1);
    for (let n = Math.min(MAX_BARS_PER_LINE, bars.length); n >= 1; n--) {
      const candidate = split(n);
      if (candidate.every((line) => line.reduce((s, i, k) => s + barMin(i, k === 0), 0) <= inner)) {
        lines = candidate;
        break;
      }
    }

    const height = lines.length * LINE_H + 12;
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height * SCALE);
    const ctx = renderer.getContext();
    ctx.scale(SCALE, SCALE);

    let prevStretch = Infinity;
    lines.forEach((line, li) => {
      // Spread the spare width over the note areas only, so headers keep their size.
      const heads = line.map((i, k) => barMin(i, k === 0) - need[i]);
      const spare = inner - heads.reduce((s, w) => s + w, 0);
      let stretch = Math.max(1, spare / line.reduce((s, i) => s + need[i], 0));
      // A short last line keeps the spacing of the line above rather than stretching out.
      if (li > 0 && line.length < lines[0].length) stretch = Math.min(stretch, prevStretch);
      prevStretch = stretch;
      let x = 4;
      const y = li * LINE_H - 6;
      line.forEach((bi, k) => {
        const w = heads[k] + need[bi] * stretch;
        const stave = new Stave(x, y, w);
        x += w;
        if (k === 0) stave.addClef("treble").addKeySignature(keySig);
        if (bi === 0) stave.addTimeSignature(timeSig);
        // The previous bar's end line serves as this one's start; no line at the start of a system.
        stave.setBegBarType(BarlineType.NONE);
        if (bi === bars.length - 1) stave.setEndBarType(BarlineType.END);
        stave.setContext(ctx).draw();

        const vfNotes = bars[bi].map((item) => {
          const dotted = item.dur.endsWith("d");
          const base = dotted ? item.dur.slice(0, -1) : item.dur;
          const wholeBarRest = item.rest && bars[bi].length === 1;
          const note = new StaveNote({ keys: [item.key], duration: base + (item.rest ? "r" : ""), dots: dotted ? 1 : 0, clef: "treble", auto_stem: !item.rest, align_center: wholeBarRest });
          if (item.acc) note.addModifier(new Accidental(item.acc), 0);
          if (dotted) Dot.buildAndAttach([note], { all: true });
          return note;
        });
        // Eighths beamed by the beat; rests break the beams.
        const beams = Beam.generateBeams(vfNotes);
        const voice = new Voice({ num_beats: beats, beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables(vfNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 12));
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
      });
    });
  }, [melody, width, SCALE]);
  return <div className="drill-staff tr-notation" ref={ref} />;
}
