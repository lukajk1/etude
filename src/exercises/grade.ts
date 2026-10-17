import { ticksPerBar, type Note, type Project, type ScaleId, type Track } from "../model/types";
import { intervalName, noteName, pcName, SCALES, usesFlats } from "../theory/theory";

/**
 * Rule checks for counterpoint exercises, following the strict two-voice style taught
 * from Fux's Gradus ad Parnassum (1725) onward. Each check produces issues tied to
 * notes and a time, so the UI can point at them.
 */

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  /** Short name, such as "Parallel fifths". */
  rule: string;
  /** What happened and why it matters. */
  detail: string;
  /** Where to jump to, in ticks. */
  tick: number;
  /** Notes involved, from any lane. */
  noteIds: string[];
}

export interface Result {
  score: number;
  passed: boolean;
  issues: Issue[];
  /** Set when the work can't be graded yet (wrong shape); explains what to fix. */
  blocking?: string;
}

export interface GradeInput {
  project: Project;
  given: Track | null;
  student: Track;
}

const ERROR_COST = 12;
const WARNING_COST = 4;
export const PASS_SCORE = 80;

function finish(issues: Issue[]): Result {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const score = Math.max(0, 100 - errors * ERROR_COST - warnings * WARNING_COST);
  issues.sort((a, b) => a.tick - b.tick || (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  return { score, passed: errors === 0 && score >= PASS_SCORE, issues };
}

function blocked(message: string): Result {
  return { score: 0, passed: false, issues: [], blocking: message };
}

// ---- Helpers ---------------------------------------------------------------

const pc = (p: number) => ((p % 12) + 12) % 12;
const sorted = (notes: Note[]) => [...notes].sort((a, b) => a.start - b.start || b.pitch - a.pitch);

function degreeIndex(pitch: number, key: number, scale: ScaleId): number {
  return SCALES[scale].steps.indexOf(pc(pitch - key));
}

/** The raised seventh (a half step below the tonic), allowed at cadences in any mode. */
const isLeadingTone = (pitch: number, key: number) => pc(pitch - key) === 11;

const CONSONANT = new Set([0, 3, 4, 7, 8, 9]);
const PERFECT = new Set([0, 7]);
const IMPERFECT = new Set([3, 4, 8, 9]);

function harmonicName(semitones: number): string {
  const s = Math.abs(semitones);
  if (s === 0) return "unison";
  if (s % 12 === 0) return s === 12 ? "octave" : "double octave";
  return intervalName(s % 12) + (s > 12 ? " (compound)" : "");
}

/** Interval class of a vertical, 0–11 (octaves fold onto unisons). */
const cls = (v: number) => pc(Math.abs(v));

type Motion = "contrary" | "similar" | "oblique" | "static";
function motion(a1: number, a2: number, b1: number, b2: number): Motion {
  const da = Math.sign(a2 - a1);
  const db = Math.sign(b2 - b1);
  if (da === 0 && db === 0) return "static";
  if (da === 0 || db === 0) return "oblique";
  return da === db ? "similar" : "contrary";
}

interface Ctx {
  key: number;
  scale: ScaleId;
  flats: boolean;
  barTicks: number;
  where: (tick: number) => string;
  name: (pitch: number) => string;
  /** Note name without octave. */
  pcn: (pitch: number) => string;
}

function context(p: Project): Ctx {
  const barTicks = ticksPerBar(p);
  const beatTicks = barTicks / p.timeSig[0];
  const flats = usesFlats(p.key, p.scale);
  return {
    key: p.key,
    scale: p.scale,
    flats,
    barTicks,
    where: (tick) => {
      const bar = Math.floor(tick / barTicks) + 1;
      const beat = Math.round((tick % barTicks) / beatTicks) + 1;
      return beat === 1 ? `bar ${bar}` : `bar ${bar}, beat ${beat}`;
    },
    name: (pitch) => noteName(pitch, flats),
    pcn: (pitch) => pcName(pitch, flats),
  };
}

function hasOverlaps(notes: Note[]): Note | null {
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].start < notes[i - 1].start + notes[i - 1].dur - 1) return notes[i];
  }
  return null;
}

// ---- Melody rules (shared by every exercise) --------------------------------------

interface MelodyOptions {
  /** How strictly to treat repeated notes. */
  repeats: Severity | "allowOnce";
  /** Allow the raised leading tone only right before the final note. */
  cadenceLeadingTone: boolean;
  label: string;
}

function melodyIssues(line: Note[], c: Ctx, opts: MelodyOptions): Issue[] {
  const out: Issue[] = [];
  const p = line.map((n) => n.pitch);
  let repeatsSeen = 0;
  let steps = 0;

  line.forEach((n, i) => {
    const inMode = degreeIndex(n.pitch, c.key, c.scale) >= 0;
    const cadenceLT = opts.cadenceLeadingTone && i === line.length - 2 && isLeadingTone(n.pitch, c.key);
    if (!inMode && !cadenceLT) {
      out.push({
        severity: "error",
        rule: "Note outside the mode",
        detail: `${c.name(n.pitch)} isn't in ${SCALES[c.scale].name.toLowerCase()} on this tonic. Strict counterpoint stays in the mode; the only exception is the raised leading tone just before the final note.`,
        tick: n.start,
        noteIds: [n.id],
      });
    }
  });

  for (let i = 1; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    const a = Math.abs(d);
    const at = line[i - 1].start;
    const ids = [line[i - 1].id, line[i].id];
    if (a >= 1 && a <= 2) steps++;
    if (a === 0) {
      repeatsSeen++;
      const sev: Severity | null = opts.repeats === "allowOnce" ? (repeatsSeen > 1 ? "warning" : null) : opts.repeats;
      if (sev) {
        out.push({
          severity: sev,
          rule: "Repeated note",
          detail: `${c.name(p[i])} is sounded twice in a row. Repeats stall the line; move on instead.`,
          tick: at,
          noteIds: ids,
        });
      }
    } else if (a === 6) {
      out.push({ severity: "error", rule: "Tritone leap", detail: `${c.name(p[i - 1])} to ${c.name(p[i])} leaps a tritone, which is hard to sing and sounds unstable. Use a perfect 4th or 5th instead.`, tick: at, noteIds: ids });
    } else if (a === 10 || a === 11) {
      out.push({ severity: "error", rule: "Leap of a seventh", detail: `${c.name(p[i - 1])} to ${c.name(p[i])} leaps a 7th. Sevenths are dissonant leaps; stay within a 6th, or an octave.`, tick: at, noteIds: ids });
    } else if (a > 12) {
      out.push({ severity: "error", rule: "Leap larger than an octave", detail: `${c.name(p[i - 1])} to ${c.name(p[i])} leaps more than an octave.`, tick: at, noteIds: ids });
    } else if (a === 9) {
      out.push({ severity: "warning", rule: "Major sixth leap", detail: `${c.name(p[i - 1])} to ${c.name(p[i])} leaps a major 6th, which the strict style avoids.`, tick: at, noteIds: ids });
    } else if (a === 8 && d < 0) {
      out.push({ severity: "warning", rule: "Descending minor sixth", detail: `${c.name(p[i - 1])} down to ${c.name(p[i])}: minor sixths are allowed going up, but avoided going down.`, tick: at, noteIds: ids });
    } else if (a === 3) {
      const d1 = degreeIndex(p[i - 1], c.key, c.scale);
      const d2 = degreeIndex(p[i], c.key, c.scale);
      const lt1 = isLeadingTone(p[i - 1], c.key);
      const lt2 = isLeadingTone(p[i], c.key);
      const n = SCALES[c.scale].steps.length;
      // Three semitones between adjacent scale degrees is an augmented second.
      const idx1 = lt1 ? n - 1 : d1;
      const idx2 = lt2 ? n - 1 : d2;
      if (idx1 >= 0 && idx2 >= 0 && n === 7 && (Math.abs(idx1 - idx2) === 1 || Math.abs(idx1 - idx2) === n - 1)) {
        out.push({ severity: "error", rule: "Augmented second", detail: `${c.name(p[i - 1])} to ${c.name(p[i])} is an augmented 2nd, an awkward melodic interval in this style.`, tick: at, noteIds: ids });
      }
    }

    // A big leap should turn around and move back by step.
    if (a >= 5 && i + 1 < p.length) {
      const d2 = p[i + 1] - p[i];
      if (!(Math.sign(d2) === -Math.sign(d) && Math.abs(d2) >= 1 && Math.abs(d2) <= 2)) {
        out.push({
          severity: "warning",
          rule: "Leap not recovered",
          detail: `After leaping a ${intervalName(a)} to ${c.name(p[i])}, move back by step in the other direction to balance the line.`,
          tick: line[i].start,
          noteIds: [line[i - 1].id, line[i].id, line[i + 1].id],
        });
      }
    }
    // Two leaps the same way, unless they spell a triad.
    if (i + 1 < p.length) {
      const d2 = p[i + 1] - p[i];
      const a2 = Math.abs(d2);
      const triad = (a === 3 && a2 === 4) || (a === 4 && a2 === 3);
      if (a >= 3 && a2 >= 3 && Math.sign(d) === Math.sign(d2) && !triad) {
        out.push({
          severity: "warning",
          rule: "Two leaps in the same direction",
          detail: `${c.name(p[i - 1])}, ${c.name(p[i])}, ${c.name(p[i + 1])} leaps twice the same way. Unless they outline a chord, follow a leap with a step.`,
          tick: line[i].start,
          noteIds: [line[i - 1].id, line[i].id, line[i + 1].id],
        });
      }
    }
  }

  if (p.length > 3 && steps / (p.length - 1) < 0.5) {
    out.push({ severity: "warning", rule: "Too many leaps", detail: `Only ${steps} of ${p.length - 1} moves are steps. Good lines move mostly by step, with a few leaps for shape.`, tick: line[0].start, noteIds: [] });
  }
  const hi = Math.max(...p);
  const highs = line.filter((n) => n.pitch === hi);
  if (highs.length > 1) {
    out.push({ severity: "warning", rule: "Climax repeated", detail: `The top note, ${c.name(hi)}, appears ${highs.length} times. A single high point gives the ${opts.label} a clear shape.`, tick: highs[1].start, noteIds: highs.map((n) => n.id) });
  }
  const range = hi - Math.min(...p);
  if (range > 16) {
    out.push({ severity: "warning", rule: "Range too wide", detail: `The ${opts.label} spans ${harmonicName(range)}. Keep it within a 10th.`, tick: line[0].start, noteIds: [] });
  }
  return out;
}

// ---- Cantus firmus ------------------------------------------------------------------

export function gradeCantus({ project, student }: GradeInput, len: [number, number] = [8, 14]): Result {
  const c = context(project);
  const line = sorted(student.notes);
  if (line.length < 3) return blocked("Write your melody in the lane, one note per bar, then check it.");
  const overlap = hasOverlaps(line);
  if (overlap) return blocked(`Two notes overlap at ${c.where(overlap.start)}. A melody plays one note at a time.`);

  const issues: Issue[] = [];
  const first = line[0];
  const last = line[line.length - 1];
  if (line.length < len[0] || line.length > len[1]) {
    issues.push({ severity: "error", rule: "Length", detail: `Use ${len[0]} to ${len[1]} notes; this has ${line.length}.`, tick: last.start, noteIds: [] });
  }
  if (pc(first.pitch - c.key) !== 0) {
    issues.push({ severity: "error", rule: "Start on the tonic", detail: `Begin on the tonic, ${c.pcn(c.key)}, to establish the mode.`, tick: first.start, noteIds: [first.id] });
  }
  if (pc(last.pitch - c.key) !== 0) {
    issues.push({ severity: "error", rule: "End on the tonic", detail: `End on the tonic so the melody comes home.`, tick: last.start, noteIds: [last.id] });
  }
  const pen = line[line.length - 2];
  const stepIn = Math.abs(last.pitch - pen.pitch);
  if (stepIn < 1 || stepIn > 2) {
    issues.push({ severity: "error", rule: "Approach the final by step", detail: `Come into the last note by step, from the 2nd degree above or the leading tone below.`, tick: pen.start, noteIds: [pen.id, last.id] });
  }
  const durs = new Set(line.map((n) => n.dur));
  if (durs.size > 1) {
    issues.push({ severity: "warning", rule: "Uneven note lengths", detail: `A cantus firmus is all whole notes, one per bar.`, tick: line[0].start, noteIds: [] });
  }
  const hiIdx = line.findIndex((n) => n.pitch === Math.max(...line.map((m) => m.pitch)));
  if (hiIdx === 0 || hiIdx === line.length - 1) {
    issues.push({ severity: "warning", rule: "Climax at the edge", detail: `Put the high point somewhere in the middle, not at the start or end.`, tick: line[hiIdx].start, noteIds: [line[hiIdx].id] });
  }
  issues.push(...melodyIssues(line, c, { repeats: "error", cadenceLeadingTone: true, label: "melody" }));
  return finish(issues);
}

// ---- Two-voice species counterpoint ----------------------------------------------------

interface Vertical {
  cf: Note;
  cp: Note;
  /** Upper minus lower, in semitones (negative means the voices crossed). */
  v: number;
  tick: number;
}

function vertical(cf: Note, cp: Note, above: boolean): Vertical {
  return { cf, cp, v: above ? cp.pitch - cf.pitch : cf.pitch - cp.pitch, tick: cp.start };
}

/** Checks shared by first and second species on the downbeats. */
function frameIssues(downs: Vertical[], above: boolean, out: Issue[]) {
  const first = downs[0];
  const last = downs[downs.length - 1];
  const okStart = above ? PERFECT.has(cls(first.v)) : cls(first.v) === 0;
  if (!okStart) {
    out.push({
      severity: "error",
      rule: "Start on a perfect interval",
      detail: above
        ? `Open on a unison, 5th or octave above the cantus; this is a ${harmonicName(first.v)}.`
        : `Below the cantus, open on a unison or octave (a 5th below would sound like the wrong key); this is a ${harmonicName(first.v)}.`,
      tick: first.tick,
      noteIds: [first.cf.id, first.cp.id],
    });
  }
  if (cls(last.v) !== 0) {
    out.push({ severity: "error", rule: "End on a unison or octave", detail: `The last interval must be a unison or octave; this is a ${harmonicName(last.v)}.`, tick: last.tick, noteIds: [last.cf.id, last.cp.id] });
  }
}

function voicePairIssues(vs: Vertical[], c: Ctx, out: Issue[], opts: { parallelsAre: Severity; directAre: Severity | null; label: string }) {
  for (let i = 1; i < vs.length; i++) {
    const a = vs[i - 1];
    const b = vs[i];
    const m = motion(a.cp.pitch, b.cp.pitch, a.cf.pitch, b.cf.pitch);
    const ca = cls(a.v);
    const cb = cls(b.v);
    if (PERFECT.has(cb) && ca === cb && m !== "static" && m !== "oblique") {
      const kind = cb === 7 ? "fifths" : Math.abs(b.v) === 0 && Math.abs(a.v) === 0 ? "unisons" : "octaves";
      out.push({
        severity: opts.parallelsAre,
        rule: m === "contrary" ? `Consecutive ${kind} by contrary motion` : `Parallel ${kind}`,
        detail: `${opts.label}: ${harmonicName(a.v)} at ${c.where(a.tick)} moves to another ${harmonicName(b.v)}. Consecutive perfect intervals make the two voices fuse into one and lose their independence.`,
        tick: b.tick,
        noteIds: [a.cf.id, a.cp.id, b.cf.id, b.cp.id],
      });
    } else if (opts.directAre && PERFECT.has(cb) && m === "similar") {
      out.push({
        severity: opts.directAre,
        rule: "Similar motion into a perfect interval",
        detail: `Both voices move the same way into a ${harmonicName(b.v)} (a "direct" or "hidden" ${cb === 7 ? "fifth" : "octave"}). Approach perfect intervals by contrary or oblique motion.`,
        tick: b.tick,
        noteIds: [a.cf.id, a.cp.id, b.cf.id, b.cp.id],
      });
    }
  }
}

function spacingIssues(vs: Vertical[], c: Ctx, out: Issue[]) {
  for (const x of vs) {
    if (x.v < 0) {
      out.push({ severity: "error", rule: "Voices cross", detail: `At ${c.where(x.tick)} your line crosses to the other side of the cantus. Keep each voice in its own register.`, tick: x.tick, noteIds: [x.cf.id, x.cp.id] });
    } else if (x.v > 19) {
      out.push({ severity: "warning", rule: "Voices too far apart", detail: `${harmonicName(x.v)} apart at ${c.where(x.tick)}. Keep within a 12th so the voices still sound related.`, tick: x.tick, noteIds: [x.cf.id, x.cp.id] });
    }
  }
}

function cadenceIssues(cpLine: Note[], cf: Note[], c: Ctx, out: Issue[]) {
  const last = cpLine[cpLine.length - 1];
  const pen = cpLine[cpLine.length - 2];
  if (!pen) return;
  const cfPen = cf[cf.length - 2];
  const step = last.pitch - pen.pitch;
  if (Math.abs(step) < 1 || Math.abs(step) > 2) {
    out.push({ severity: "error", rule: "Approach the final by step", detail: `Your last two notes, ${c.name(pen.pitch)} to ${c.name(last.pitch)}, should move by step into the final.`, tick: pen.start, noteIds: [pen.id, last.id] });
    return;
  }
  // Whichever voice isn't on the 2nd degree needs the leading tone, rising a half step.
  const cfOnSecond = cfPen && pc(cfPen.pitch - c.key) === SCALES[c.scale].steps[1];
  if (cfOnSecond && !(isLeadingTone(pen.pitch, c.key) && step === 1)) {
    out.push({
      severity: "error",
      rule: "Use the leading tone at the cadence",
      detail: `The cantus steps down 2–1, so your line should rise from the leading tone, ${c.pcn(c.key + 11)}, a half step below the tonic. ${SCALES[c.scale].steps[6] === 10 ? "In this mode that means raising the 7th degree." : ""}`.trim(),
      tick: pen.start,
      noteIds: [pen.id, last.id],
    });
  }
}

/** `moves` is the sequence to judge motion on (every note in second species). */
function styleIssues(downs: Vertical[], out: Issue[], moves: Vertical[] = downs) {
  const inner = downs.slice(1, -1);
  if (inner.length >= 4) {
    const perfect = inner.filter((x) => PERFECT.has(cls(x.v))).length;
    if (perfect / inner.length > 0.5) {
      out.push({ severity: "warning", rule: "Too many perfect intervals", detail: `${perfect} of ${inner.length} inner downbeats are unisons, 5ths or octaves. Favor 3rds and 6ths; they sound fuller and keep the voices distinct.`, tick: inner[0].tick, noteIds: [] });
    }
  }
  // Count only moves where both voices actually move.
  let contrary = 0;
  let moving = 0;
  for (let i = 1; i < moves.length; i++) {
    const m = motion(moves[i - 1].cp.pitch, moves[i].cp.pitch, moves[i - 1].cf.pitch, moves[i].cf.pitch);
    if (m === "contrary" || m === "similar") moving++;
    if (m === "contrary") contrary++;
  }
  if (moving > 3 && contrary / moving < 0.3) {
    out.push({ severity: "warning", rule: "Not enough contrary motion", detail: `Only ${contrary} of ${moving} moves where both voices move go in opposite directions. Contrary motion is what makes two lines sound independent.`, tick: moves[0].tick, noteIds: [] });
  }
  let run = 1;
  for (let i = 1; i < downs.length; i++) {
    const same = IMPERFECT.has(cls(downs[i].v)) && cls(downs[i].v) === cls(downs[i - 1].v) && motion(downs[i - 1].cp.pitch, downs[i].cp.pitch, downs[i - 1].cf.pitch, downs[i].cf.pitch) === "similar";
    run = same ? run + 1 : 1;
    if (run === 4) {
      out.push({ severity: "warning", rule: "Too many parallel thirds or sixths", detail: `Four ${intervalName(cls(downs[i].v))}s in a row moving together. More than three makes the lines sound like one voice doubled.`, tick: downs[i].tick, noteIds: downs.slice(i - 3, i + 1).flatMap((x) => [x.cf.id, x.cp.id]) });
    }
  }
}

function climaxClash(cpLine: Note[], cf: Note[], c: Ctx, out: Issue[]) {
  const cpHi = Math.max(...cpLine.map((n) => n.pitch));
  const cfHi = Math.max(...cf.map((n) => n.pitch));
  const cpAt = cpLine.find((n) => n.pitch === cpHi)!;
  const cfAt = cf.find((n) => n.pitch === cfHi)!;
  if (cpAt.start >= cfAt.start && cpAt.start < cfAt.start + cfAt.dur) {
    out.push({ severity: "warning", rule: "Climaxes coincide", detail: `Your high point lands with the cantus's high point at ${c.where(cpAt.start)}. Staggering them keeps the two lines distinct.`, tick: cpAt.start, noteIds: [cpAt.id, cfAt.id] });
  }
}

/** First species: one note against each note of the cantus. */
export function gradeFirstSpecies({ project, given, student }: GradeInput, above: boolean): Result {
  if (!given) return blocked("This exercise is missing its cantus firmus. Reload it from the Exercises menu.");
  const c = context(project);
  const cf = sorted(given.notes);
  const cp = sorted(student.notes);
  if (cp.length === 0) return blocked("Write your line in your lane: one whole note against each cantus note.");
  const overlap = hasOverlaps(cp);
  if (overlap) return blocked(`Two of your notes overlap at ${c.where(overlap.start)}. Write one note at a time.`);

  const pairs: Vertical[] = [];
  const wrong: string[] = [];
  for (const n of cf) {
    const mine = cp.filter((m) => m.start >= n.start && m.start < n.start + n.dur);
    if (mine.length !== 1 || mine[0].start !== n.start) wrong.push(c.where(n.start));
    else pairs.push(vertical(n, mine[0], above));
  }
  const stray = cp.filter((m) => !cf.some((n) => m.start >= n.start && m.start < n.start + n.dur));
  if (wrong.length || stray.length) {
    const list = wrong.slice(0, 4).join(", ") + (wrong.length > 4 ? "…" : "");
    return blocked(
      wrong.length
        ? `First species is one note against one: each bar needs exactly one note, starting with the cantus note. Check ${list}.`
        : `Some notes sit outside the cantus. Keep your line to the same bars.`,
    );
  }

  const issues: Issue[] = [];
  pairs.forEach((x, i) => {
    const k = cls(x.v);
    if (!CONSONANT.has(k)) {
      issues.push({ severity: "error", rule: "Dissonance", detail: `${c.name(x.cp.pitch)} against ${c.name(x.cf.pitch)} is a ${harmonicName(x.v)}. In first species every interval is consonant: unison, 3rd, 5th, 6th or octave. (A 4th counts as dissonant in two voices.)`, tick: x.tick, noteIds: [x.cf.id, x.cp.id] });
    } else if (x.v === 0 && i > 0 && i < pairs.length - 1) {
      issues.push({ severity: "error", rule: "Unison in the middle", detail: `Unisons are only for the first and last notes; in between, the two voices merge into one.`, tick: x.tick, noteIds: [x.cf.id, x.cp.id] });
    }
  });
  frameIssues(pairs, above, issues);
  voicePairIssues(pairs, c, issues, { parallelsAre: "error", directAre: "error", label: "Between your line and the cantus" });
  spacingIssues(pairs, c, issues);
  cadenceIssues(cp, cf, c, issues);
  styleIssues(pairs, issues);
  climaxClash(cp, cf, c, issues);
  issues.push(...melodyIssues(cp, c, { repeats: "allowOnce", cadenceLeadingTone: true, label: "line" }));
  return finish(issues);
}

/** Second species: two half notes against each cantus note (a half rest may open it). */
export function gradeSecondSpecies({ project, given, student }: GradeInput, above: boolean): Result {
  if (!given) return blocked("This exercise is missing its cantus firmus. Reload it from the Exercises menu.");
  const c = context(project);
  const cf = sorted(given.notes);
  const cp = sorted(student.notes);
  if (cp.length === 0) return blocked("Write your line in your lane: two half notes against each cantus note, and a whole note at the end.");
  const overlap = hasOverlaps(cp);
  if (overlap) return blocked(`Two of your notes overlap at ${c.where(overlap.start)}. Write one note at a time.`);

  const downs: Vertical[] = [];
  const ups: (Vertical | null)[] = [];
  const problems: string[] = [];
  cf.forEach((n, i) => {
    const half = n.start + n.dur / 2;
    const inBar = cp.filter((m) => m.start >= n.start && m.start < n.start + n.dur);
    const down = inBar.find((m) => m.start === n.start);
    const up = inBar.find((m) => m.start === half);
    const lastBar = i === cf.length - 1;
    const extra = inBar.filter((m) => m !== down && m !== up);
    if (extra.length) problems.push(c.where(extra[0].start));
    else if (lastBar && (!down || up)) problems.push(c.where(n.start));
    else if (!lastBar && (!up || (!down && i > 0))) problems.push(c.where(n.start));
    if (down) downs.push(vertical(n, down, above));
    ups.push(up && !lastBar ? vertical(n, up, above) : null);
  });
  if (problems.length) {
    return blocked(
      `Second species puts a half note on beat 1 and beat 3 of each bar (you may open with a half rest), and one whole note in the last bar. Check ${problems.slice(0, 4).join(", ")}${problems.length > 4 ? "…" : ""}.`,
    );
  }

  const issues: Issue[] = [];
  // Every vertical, in time order, for motion checks between adjacent notes.
  const all: Vertical[] = [];
  cf.forEach((_, i) => {
    const d = downs.find((x) => x.cf === cf[i]);
    if (d) all.push(d);
    const u = ups[i];
    if (u) all.push(u);
  });

  downs.forEach((x, i) => {
    const k = cls(x.v);
    if (!CONSONANT.has(k)) {
      issues.push({ severity: "error", rule: "Dissonance on the downbeat", detail: `${c.name(x.cp.pitch)} against ${c.name(x.cf.pitch)} is a ${harmonicName(x.v)} on beat 1. Downbeats must be consonant.`, tick: x.tick, noteIds: [x.cf.id, x.cp.id] });
    } else if (x.v === 0 && i > 0 && i < downs.length - 1) {
      issues.push({ severity: "error", rule: "Unison on a downbeat", detail: `Unisons on beat 1 are only for the start and the end.`, tick: x.tick, noteIds: [x.cf.id, x.cp.id] });
    }
  });

  // Offbeats may be dissonant only as passing tones: step in, step out, same direction.
  all.forEach((x, idx) => {
    if (x.cp.start === x.cf.start) return;
    if (CONSONANT.has(cls(x.v))) return;
    const prev = all[idx - 1];
    const next = all[idx + 1];
    const inStep = prev ? x.cp.pitch - prev.cp.pitch : 0;
    const outStep = next ? next.cp.pitch - x.cp.pitch : 0;
    const passing = prev && next && Math.abs(inStep) >= 1 && Math.abs(inStep) <= 2 && Math.abs(outStep) >= 1 && Math.abs(outStep) <= 2 && Math.sign(inStep) === Math.sign(outStep);
    if (!passing) {
      issues.push({
        severity: "error",
        rule: "Unprepared dissonance",
        detail: `${c.name(x.cp.pitch)} against ${c.name(x.cf.pitch)} is a ${harmonicName(x.v)} on beat 3. A dissonance there must be a passing tone: reached by step and left by step in the same direction.`,
        tick: x.tick,
        noteIds: [x.cf.id, x.cp.id],
      });
    }
  });

  // Openings: if there's an opening rest, the first sounding note is the one that must be perfect.
  const firstSounding = all[0];
  const frame = [firstSounding, ...downs.slice(firstSounding === downs[0] ? 1 : 0)];
  frameIssues(frame, above, issues);
  voicePairIssues(downs, c, issues, { parallelsAre: "error", directAre: null, label: "On consecutive downbeats" });
  // Offbeat to the next downbeat counts too.
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1];
    const b = all[i];
    if (a.cp.start === a.cf.start || b.cp.start !== b.cf.start) continue;
    const m = motion(a.cp.pitch, b.cp.pitch, a.cf.pitch, b.cf.pitch);
    if (PERFECT.has(cls(a.v)) && cls(a.v) === cls(b.v) && m !== "oblique") {
      issues.push({ severity: "error", rule: cls(b.v) === 7 ? "Parallel fifths" : "Parallel octaves", detail: `From beat 3 at ${c.where(a.tick)} into the next downbeat, ${harmonicName(a.v)} moves to ${harmonicName(b.v)}.`, tick: b.tick, noteIds: [a.cf.id, a.cp.id, b.cf.id, b.cp.id] });
    } else if (PERFECT.has(cls(b.v)) && m === "similar") {
      issues.push({ severity: "warning", rule: "Similar motion into a perfect interval", detail: `Both voices move the same way into the ${harmonicName(b.v)} at ${c.where(b.tick)}. Approach perfect intervals by contrary or oblique motion.`, tick: b.tick, noteIds: [a.cf.id, a.cp.id, b.cf.id, b.cp.id] });
    }
  }
  spacingIssues(all, c, issues);
  cadenceIssues(cp, cf, c, issues);
  styleIssues(downs, issues, all);
  climaxClash(cp, cf, c, issues);
  issues.push(...melodyIssues(cp, c, { repeats: "error", cadenceLeadingTone: true, label: "line" }));
  return finish(issues);
}
