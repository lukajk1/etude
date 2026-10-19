import { useEffect, useRef } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { EAR_INTERVALS, SOLFEGE, type AnswerType, type StaffSpec, type Step } from "./drills/catalog";
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
  if (reveal && value === step.correct) cls += " is-right";
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
          {INTERVAL_ROWS.map((row) => [
            <span key={row.label} className="drill-axis is-row">
              {row.label}
            </span>,
            ...row.cells.map((cell, i) => (cell ? <Choice key={cell} {...props} value={cell} label={cell} /> : <span key={row.label + i} />)),
          ])}
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
          {["major", "minor", "diminished", "augmented"].map((q) => (
            <Choice key={q} {...props} value={q} label={q[0].toUpperCase() + q.slice(1)} wide />
          ))}
        </div>
      );
    case "degree":
      return (
        <div className="drill-row">
          {SOLFEGE.map((s, i) => (
            <Choice key={s} {...props} value={String(i + 1)} label={`${i + 1} ${s}`} />
          ))}
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

