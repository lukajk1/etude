import { useEffect, useRef, useState } from "react";
import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { engine, ensureAudio, playNotes } from "../audio/live";
import { CADENCE_INFO, type Cadence } from "./drills/cadences";
import { EAR_INTERVALS, isRight, SOLFEGE, type AnswerType, type StaffSpec, type Step } from "./drills/catalog";
import { NCT_INFO, type Nct } from "./drills/nct";
import { NUMERAL_NAME, NUMERALS, type Numeral } from "./drills/harmony";
import { BPM, beatsLabel, countText, fromSpec, METER_LABEL, onsets, rhythmAudio, VALUES, type MeterId } from "./drills/rhythm";
import { MAJOR_KEYS, MINOR_KEYS, accidentalsLabel, intervalLabel, prettyCode, vfKey } from "./drills/theory";

/** Shared by the drills and flashcards: a small staff, and the answer button pads. */

// ---- Staff --------------------------------------------------------------------

const SCALE = 1.5;

export function Staff({ spec }: { spec: StaffSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const sigWidth = spec.keySig ? 14 * (MAJOR_KEYS.find((k) => k.code === spec.keySig)?.accidentals ?? 0) : 0;
    const width = 120 + Math.abs(sigWidth) + spec.groups.length * 70;
    const height = 140;
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width * SCALE, height * SCALE);
    const ctx = renderer.getContext();
    ctx.scale(SCALE, SCALE);
    const stave = new Stave(8, 20, width - 16);
    stave.addClef(spec.clef);
    if (spec.keySig && spec.keySig !== "C") stave.addKeySignature(spec.keySig);
    stave.setContext(ctx).draw();
    if (spec.groups.length) {
      const notes = spec.groups.map((group) => {
        const sorted = [...group];
        const note = new StaveNote({ keys: sorted.map(vfKey), duration: "w", clef: spec.clef });
        sorted.forEach((n, i) => {
          if (n.acc !== 0) note.addModifier(new Accidental(n.acc === 1 ? "#" : n.acc === -1 ? "b" : n.acc === 2 ? "##" : "bb"), i);
        });
        return note;
      });
      const voice = new Voice({ num_beats: 4 * notes.length, beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], width - stave.getNoteStartX() - 30);
      voice.draw(ctx, stave);
    }
  }, [spec]);
  return <div className="drill-staff" ref={ref} />;
}

// ---- Rhythm notation ------------------------------------------------------------------

/** VexFlow durations by length in sixteenths ("d" for dotted). */
const VF_DUR: Record<number, string> = { 16: "w", 12: "hd", 8: "h", 6: "qd", 4: "q", 3: "8d", 2: "8", 1: "16" };

/** A rhythm on a staff without clef or pitch, as "beats:durations" (beats 0: no time signature). */
export function RhythmStaff({ spec, scale = 1.35 }: { spec: string; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const { beats, bars } = fromSpec(spec);
    // One stave per bar, the time signature on the first.
    const widths = bars.map((notes, i) => 32 + (beats && i === 0 ? 34 : 0) + notes.reduce((w, x) => w + (x.dur >= 8 ? 46 : 34), 0));
    const width = 8 + widths.reduce((s, w) => s + w, 0);
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    // Tall enough for stems and beams below the middle line.
    renderer.resize(width * scale, 122 * scale);
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);
    let x0 = 4;
    bars.forEach((notes, i) => {
      const stave = new Stave(x0, 2, widths[i]);
      x0 += widths[i];
      if (beats && i === 0) stave.addTimeSignature(`${beats}/4`);
      stave.setContext(ctx).draw();
      const vfNotes = notes.map((x) => {
        const base = VF_DUR[x.dur] ?? "q";
        const dotted = base.endsWith("d");
        const note = new StaveNote({ keys: ["b/4"], duration: (dotted ? base.slice(0, -1) : base) + (x.rest ? "r" : ""), dots: dotted ? 1 : 0 });
        if (dotted) Dot.buildAndAttach([note], { all: true });
        return note;
      });
      const beams = Beam.generateBeams(vfNotes.filter((v) => !v.isRest()));
      const total = notes.reduce((t, x) => t + x.dur, 0);
      const voice = new Voice({ num_beats: Math.max(1, total / 4), beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables(vfNotes);
      new Formatter().joinVoices([voice]).format([voice], Math.max(30, stave.getNoteEndX() - stave.getNoteStartX() - 14));
      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx).draw());
    });
  }, [spec, scale]);
  return <div className="drill-staff" ref={ref} />;
}

// ---- Answer pads -------------------------------------------------------------------

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const INTERVAL_ROWS: { label: string; cells: (string | null)[] }[] = [
  { label: "Augmented", cells: ["A2", null, "A4", "A5", "A6", null, null] },
  { label: "Major / perfect", cells: ["M2", "M3", "P4", "P5", "M6", "M7", "P8"] },
  { label: "Minor", cells: ["m2", "m3", null, null, "m6", "m7", null] },
  { label: "Diminished", cells: [null, null, null, "d5", null, "d7", null] },
];
const INTERVAL_COLS = ["2nd", "3rd", "4th", "5th", "6th", "7th", "8ve"];

export function answerLabel(type: AnswerType, value: string): string {
  switch (type) {
    case "letter":
    case "note":
      return prettyCode(value);
    case "interval":
      return intervalLabel(value);
    case "majorKey":
      return `${prettyCode(value)} major`;
    case "minorKey":
      return `${prettyCode(value)} minor`;
    case "accidentals":
      return accidentalsLabel(Number(value));
    case "triadQuality":
      return value;
    case "degree":
      return `${value} (${SOLFEGE[Number(value) - 1]})`;
    case "earInterval":
      return Object.values(EAR_INTERVALS).find((e) => e.code === value)?.label ?? value;
    case "semitones":
      return `${value} semitone${value === "1" ? "" : "s"}`;
    case "numeral":
      return `${value} (${NUMERAL_NAME[value as Numeral]})`;
    case "beats":
      return `${beatsLabel(value)} beat${value === "1" ? "" : "s"}`;
    case "noteValue":
      return VALUES.find((v) => v.id === value)?.name ?? value;
    case "meter":
      return value === "6/8" ? "6/8 (two beats, each in three)" : `${METER_LABEL[value as MeterId]} (${value} beats)`;
    case "rhythm":
      return `the rhythm counted ${countText(fromSpec(value).notes, fromSpec(value).bars)}`;
    case "tap":
      return value === "ok" ? "every note in time" : "some notes off the beat";
    case "cadence":
      return `${CADENCE_INFO[value as Cadence].label} (${CADENCE_INFO[value as Cadence].chords})`;
    case "nct":
      return NCT_INFO[value as Nct].label.toLowerCase();
  }
}

export interface PadProps {
  step: Step;
  chosen: string | null;
  reveal: boolean;
  onPick: (value: string) => void;
}

function Choice({ value, label, step, chosen, reveal, onPick, wide }: PadProps & { value: string; label: string; wide?: boolean }) {
  let cls = "drill-choice";
  if (wide) cls += " is-wide";
  if (reveal && (value === step.correct || (value === chosen && isRight(step, value)))) cls += " is-right";
  else if (reveal && value === chosen) cls += " is-wrong";
  return (
    <button className={cls} disabled={reveal} onClick={() => onPick(value)} title={answerLabel(step.type, value)}>
      {label}
    </button>
  );
}

export function AnswerPad(props: PadProps) {
  const { step } = props;
  switch (step.type) {
    case "letter":
      return (
        <div className="drill-row">
          {LETTERS.map((l) => (
            <Choice key={l} {...props} value={l} label={l} />
          ))}
        </div>
      );
    case "note":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {["b", "", "#"].flatMap((acc) => LETTERS.map((l) => <Choice key={l + acc} {...props} value={l + acc} label={prettyCode(l + acc)} />))}
        </div>
      );
    case "interval":
      return (
        <div className="drill-intervals">
          <span />
          {INTERVAL_COLS.map((c) => (
            <span key={c} className="drill-axis">
              {c}
            </span>
          ))}
          {INTERVAL_ROWS.map((row) => {
            // Only the intervals this question allows, and only rows that still have any.
            const cells = row.cells.map((c) => (c && (!step.options || step.options.includes(c)) ? c : null));
            if (!cells.some(Boolean)) return null;
            return [
              <span key={row.label} className="drill-axis is-row">
                {row.label}
              </span>,
              ...cells.map((cell, i) => (cell ? <Choice key={cell} {...props} value={cell} label={cell} /> : <span key={row.label + i} />)),
            ];
          })}
        </div>
      );
    case "majorKey":
    case "minorKey": {
      const all = step.type === "majorKey" ? MAJOR_KEYS : MINOR_KEYS;
      const keys = step.options ? all.filter((k) => step.options!.includes(k.code)) : all;
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {keys.map((k) => (
            <Choice key={k.code} {...props} value={k.code} label={prettyCode(k.code)} />
          ))}
        </div>
      );
    }
    case "accidentals":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {(step.options ? step.options.map(Number) : Array.from({ length: 15 }, (_, i) => i - 7)).map((n) => (
            <Choice key={n} {...props} value={String(n)} label={accidentalsLabel(n)} />
          ))}
        </div>
      );
    case "triadQuality":
      return (
        <div className="drill-row">
          {["major", "minor", "diminished", "augmented"].filter((q) => !step.options || step.options.includes(q)).map((q) => (
            <Choice key={q} {...props} value={q} label={q[0].toUpperCase() + q.slice(1)} wide />
          ))}
        </div>
      );
    case "degree":
      return (
        <div className="drill-row">
          {SOLFEGE.map((s, i) =>
            !step.options || step.options.includes(String(i + 1)) ? <Choice key={s} {...props} value={String(i + 1)} label={`${i + 1} ${s}`} /> : null,
          )}
        </div>
      );
    case "earInterval":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: `repeat(${Math.min(6, step.options?.length ?? 6)}, minmax(0, 1fr))` }}>
          {(step.options ?? []).map((code) => (
            <Choice key={code} {...props} value={code} label={answerLabel("earInterval", code)} wide />
          ))}
        </div>
      );
    case "numeral":
      return (
        <div className="drill-row">
          {(step.options ?? NUMERALS).map((n) => (
            <Choice key={n} {...props} value={n} label={n} wide />
          ))}
        </div>
      );
    case "beats":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
          {(step.options ?? []).map((v) => (
            <Choice key={v} {...props} value={v} label={beatsLabel(v)} />
          ))}
        </div>
      );
    case "noteValue":
      return (
        <div className="drill-row">
          {(step.options ?? []).map((v) => {
            const name = VALUES.find((x) => x.id === v)?.name.replace(/ note$/, "") ?? v;
            return <Choice key={v} {...props} value={v} label={name.charAt(0).toUpperCase() + name.slice(1)} wide />;
          })}
        </div>
      );
    case "meter":
      return (
        <div className="drill-row">
          {(step.options ?? []).map((v) => (
            <Choice key={v} {...props} value={v} label={v === "6/8" ? "6/8" : `${v} beats (${METER_LABEL[v as MeterId]})`} wide />
          ))}
        </div>
      );
    case "cadence":
      return (
        <div className="drill-row">
          {(step.options ?? []).map((v) => (
            <Choice key={v} {...props} value={v} label={CADENCE_INFO[v as Cadence].label} wide />
          ))}
        </div>
      );
    case "nct":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, step.options?.length ?? 3)}, minmax(0, 1fr))` }}>
          {(step.options ?? []).map((v) => (
            <Choice key={v} {...props} value={v} label={NCT_INFO[v as Nct].label} wide />
          ))}
        </div>
      );
    case "rhythm":
      return <RhythmChoices {...props} />;
    case "tap":
      return <TapPad key={step.data} {...props} />;
    case "semitones":
      return (
        <div className="drill-grid" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
          {(step.options ?? []).map((n) => (
            <Choice key={n} {...props} value={n} label={n} />
          ))}
        </div>
      );
  }
}


/** Rhythmic dictation: each choice is a bar of notation. */
function RhythmChoices({ step, chosen, reveal, onPick }: PadProps) {
  return (
    <div className="rhythm-choices">
      {(step.options ?? []).map((v, i) => {
        let cls = "drill-choice rhythm-choice";
        if (reveal && v === step.correct) cls += " is-right";
        else if (reveal && v === chosen) cls += " is-wrong";
        return (
          <button key={v} className={cls} disabled={reveal} onClick={() => onPick(v)} aria-label={answerLabel("rhythm", v)}>
            <span className="rhythm-choice-letter">{"ABCD"[i]}</span>
            <RhythmStaff spec={v} scale={1.1} />
          </button>
        );
      })}
    </div>
  );
}

type TapMark = "hit" | "early" | "late" | "missed";

/**
 * Tap a rhythm in time. Start plays a bar of clicks, then soft clicks on each beat while
 * you tap. Taps are matched to the notes' start times, after removing any steady delay
 * (speakers, Bluetooth, reaction), so only the rhythm itself is graded.
 */
function TapPad({ step, reveal, onPick }: PadProps) {
  const spec = (step.data ?? "").split("#")[0];
  const { beats, notes } = fromSpec(spec);
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [marks, setMarks] = useState<TapMark[]>([]);
  const [summary, setSummary] = useState("");
  const [flash, setFlash] = useState(0);
  const taps = useRef<number[]>([]);
  const t0 = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const beat = 60 / BPM;
  const expected = onsets(beats, notes);

  const grade = () => {
    // About ±90 ms at 80 bpm: tight enough that a misplaced note counts as wrong.
    const tol = Math.max(0.07, 0.12 * beat);
    const t = taps.current;
    // A steady delay (speakers, Bluetooth, reaction) makes every tap late by about the same
    // amount. Correct for it only when most taps agree on it, so sloppy timing isn't hidden.
    const near = expected.map((e) => t.reduce((best, x) => (Math.abs(x - e) < Math.abs(best - e) ? x : best), Infinity) - e).filter((d) => Math.abs(d) < beat / 2);
    const sorted = [...near].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const agreeing = near.filter((d) => Math.abs(d - median) <= tol / 2).length;
    const offset = agreeing >= Math.max(2, Math.ceil(0.6 * expected.length)) ? Math.max(-0.25, Math.min(0.25, median)) : 0;
    const used = new Set<number>();
    const result: TapMark[] = expected.map((e) => {
      let bestI = -1;
      let bestD = Infinity;
      t.forEach((x, i) => {
        const d = x - offset - e;
        if (!used.has(i) && Math.abs(d) < Math.abs(bestD)) [bestI, bestD] = [i, d];
      });
      if (bestI >= 0 && Math.abs(bestD) <= tol) {
        used.add(bestI);
        return "hit";
      }
      if (bestI >= 0 && Math.abs(bestD) < beat / 2) {
        used.add(bestI);
        return bestD < 0 ? "early" : "late";
      }
      return "missed";
    });
    const extra = t.length - used.size;
    const hits = result.filter((m) => m === "hit").length;
    const score = (hits - 0.5 * extra) / expected.length;
    setMarks(result);
    setSummary(
      `${hits} of ${expected.length} notes in time${extra ? `, ${extra} extra tap${extra === 1 ? "" : "s"}` : ""}.` +
        (Math.abs(offset) > 0.03 ? ` Your taps ran ${Math.round(Math.abs(offset) * 1000)} ms ${offset > 0 ? "late" : "early"} overall, which is allowed for.` : ""),
    );
    setPhase("done");
    onPick(score >= 0.85 ? "ok" : "off");
  };

  const start = async () => {
    if (phase !== "ready") return;
    taps.current = [];
    setPhase("playing");
    await ensureAudio();
    const raw = engine.ctx.rawContext as unknown as AudioContext;
    const latency = (raw.outputLatency || raw.baseLatency || 0) * 1000;
    // The engine schedules previews 50 ms ahead.
    t0.current = performance.now() + 50 + latency;
    void playNotes(rhythmAudio(beats, notes, true));
    timer.current = setTimeout(grade, (2 * beats * beat + 0.5) * 1000);
  };

  const tap = () => {
    if (phase !== "playing") return;
    taps.current.push((performance.now() - t0.current) / 1000);
    setFlash((f) => f + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat || reveal) return;
      e.preventDefault();
      if (phase === "ready") void start();
      else tap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="tap-pad">
      {phase === "ready" && (
        <button className="ex-check tap-start" onClick={() => void start()}>
          Start (Space)
        </button>
      )}
      {phase === "playing" && (
        <button key={flash} className="tap-target" onPointerDown={tap}>
          Tap (Space)
        </button>
      )}
      {phase === "done" && (
        <div className="tap-result">
          <div className="tap-marks">
            {marks.map((m, i) => (
              <span key={i} className={`tap-mark is-${m}`} title={m}>
                {m === "hit" ? "✓" : m === "missed" ? "·" : m === "early" ? "early" : "late"}
              </span>
            ))}
          </div>
          <div className="pr-dim">{summary}</div>
        </div>
      )}
    </div>
  );
}
