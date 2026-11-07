import type { ReactNode } from "react";

/**
 * Small line icons for the skill cards on the home page, one per kind of exercise (the `kind`
 * of each unit in course.ts). Strokes take their color from the card's text color.
 */

// A solid notehead, tilted like an engraved one.
const head = (x: number, y: number) => (
  <ellipse cx={x} cy={y} rx={2.3} ry={1.6} transform={`rotate(-20 ${x} ${y})`} fill="currentColor" stroke="none" />
);

// A whole note, wider and hollow, for counterpoint.
const whole = (x: number, y: number) => (
  <ellipse cx={x} cy={y} rx={2.7} ry={1.8} transform={`rotate(-15 ${x} ${y})`} strokeWidth={1.4} />
);

const ICONS: Record<string, ReactNode> = {
  // An open book with a note on its right-hand page.
  Reading: (
    <>
      <path d="M12 6.5C10 5 7 4.5 2.5 5v13.5c4.5-.5 7.5 0 9.5 1.5c2-1.5 5-2 9.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20" />
      <path d="M5 9.5h4.5M5 13h4.5" />
      {head(15.3, 15)}
      <path d="M17.4 14.4V8.5" />
    </>
  ),
  // An ear and a single note.
  Ear: (
    <>
      <path d="M2.5 9a4.5 4.5 0 0 1 9 0c0 2.6-2.5 3.4-2.5 6.2a2.5 2.5 0 0 1-4.6 1.4" />
      <path d="M5 9a2 2 0 0 1 4 0c0 1.1-.9 1.5-1.5 2.2" />
      {head(16.5, 17.5)}
      <path d="M18.6 16.9V5.5" />
    </>
  ),
  // A microphone with sound coming off it.
  Singing: (
    <>
      <rect x={4.5} y={3} width={5} height={9} rx={2.5} />
      <path d="M3 10a4 4 0 0 0 8 0M7 14v5M4.5 19h5" />
      <path d="M14 5.5a6.5 6.5 0 0 1 0 9M17.5 3a10 10 0 0 1 0 14" />
    </>
  ),
  // A metronome with its arm swung over.
  Rhythm: (
    <>
      <path d="M6 21h12L14.8 3.5h-5.6z" />
      <path d="M7.4 15.5h9.2" />
      <path d="M12 15.5l6.5-11" />
      <circle cx={16.2} cy={8.4} r={1.2} fill="currentColor" stroke="none" />
    </>
  ),
  // Two beamed notes and a pencil writing them down.
  Transcription: (
    <>
      {head(3.8, 13)}
      {head(9.8, 13)}
      <path d="M5.9 12.4V3M11.9 12.4V3M5.9 3h6" />
      <path d="M12.5 21.5l.7-3.2 7.3-7.3 2.5 2.5-7.3 7.3zM18.6 12.9l2.5 2.5" />
    </>
  ),
  // Three chords in a row, with an arrow along them: a progression.
  Harmony: (
    <>
      {head(5, 15)}
      {head(5, 11)}
      {head(5, 7)}
      {head(12, 12.5)}
      {head(12, 8.5)}
      {head(12, 4.5)}
      {head(19, 15)}
      {head(19, 11)}
      {head(19, 7)}
      <path d="M3 20.5h17M17.5 18l2.5 2.5-2.5 2.5" />
    </>
  ),
  // A last chord and the final double bar.
  Cadences: (
    <>
      {head(7, 18)}
      {head(7, 13.5)}
      {head(7, 9)}
      <path d="M9.1 17.4V4" />
      <path d="M15 3.5v17" />
      <path d="M19.5 3.5v17" strokeWidth={3} strokeLinecap="butt" />
    </>
  ),
  // Two chord tones, with a ringed passing note between them.
  "Non-chord tones": (
    <>
      {head(4, 19.5)}
      {head(20, 4.5)}
      <circle cx={12} cy={12} r={5} strokeDasharray="2.8 2.4" />
      {head(12, 12)}
    </>
  ),
  // A melody above a strip of piano keys.
  Harmonizing: (
    <>
      {head(6, 8)}
      {head(12, 4.5)}
      {head(18, 6.5)}
      <rect x={2.5} y={12} width={19} height={9.5} rx={1} />
      <path d="M7.25 16v5.5M12 12v9.5M16.75 16v5.5" />
      <path d="M7.25 12v4M16.75 12v4" strokeWidth={2.6} strokeLinecap="butt" />
    </>
  ),
  // Two lines of whole notes moving apart, joined note against note.
  Counterpoint: (
    <>
      {whole(7, 7.5)}
      {whole(17, 4.5)}
      {whole(7, 16.5)}
      {whole(17, 19.5)}
      <path d="M7 10.3v3.4M17 7.3v9.4" strokeDasharray="1.6 1.6" />
    </>
  ),
};

// An eighth note, for any kind without its own icon.
const FALLBACK = (
  <>
    {head(9, 18)}
    <path d="M11.1 17.4V4c0 3 5.5 3.5 5.5 8" />
  </>
);

export function SkillIcon({ kind }: { kind: string }) {
  return (
    <svg
      className="pr-skill-icon"
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[kind] ?? FALLBACK}
    </svg>
  );
}
