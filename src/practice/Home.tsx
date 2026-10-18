import { DRILLS, type Drill } from "./drills/catalog";
import { EXERCISES, ROADMAP } from "./exercises/catalog";
import { progress, type Progress } from "./exercises/state";
import { go, type Route } from "./route";
import { intervalsUsed, intervalShort, MELODIES } from "./transcription/melodies";
import { intervalStats, weakestIntervals } from "./transcription/state";
import { useSignal } from "../model/ui";

interface Item {
  route: Route;
  number: string;
  title: string;
  summary: string;
  kind: string;
  extra?: string[];
}

const written = DRILLS.filter((d) => !d.ear);
const ear = DRILLS.filter((d) => d.ear);
const drillItem = (d: Drill, kind: string): Item => ({ route: { kind: "drill", id: d.id }, number: d.number, title: d.title, summary: d.summary, kind });
const UNITS: { title: string; blurb: string; items: Item[] }[] = [
  {
    title: "Foundations: reading and theory",
    blurb: "Timed drills for notes, keys, scales, intervals and triads, each graded on accuracy and speed.",
    items: written.map((d) => drillItem(d, "Reading drill")),
  },
  {
    title: "Foundations: ear training",
    blurb: "Intervals, chord qualities and scale degrees by ear, played on your chosen piano sound.",
    items: ear.map((d) => drillItem(d, "Ear drill")),
  },
  {
    title: "Transcription",
    blurb: "Write down melodies by ear. Each one adds only an interval or two, so you can build up a few at a time.",
    items: MELODIES.map((m) => ({ route: { kind: "transcribe", id: m.id }, number: m.number, title: m.title, summary: m.summary, kind: "Transcription", extra: intervalsUsed(m) })),
  },
  {
    title: "Counterpoint essentials",
    blurb: "Write lines against a given melody in the strict style of Fux, graded against the classic rules.",
    items: EXERCISES.map((e) => ({ route: { kind: "exercise", id: e.id }, number: e.number, title: e.title, summary: e.summary, kind: "Counterpoint" })),
  },
];

const routeId = (r: Route) => (r.kind === "home" ? "" : r.id);

function Status({ p }: { p?: Progress }) {
  if (!p) return <span className="pr-status">Not started</span>;
  return <span className={`pr-status${p.passed ? " is-pass" : ""}`}>{p.passed ? "Passed" : `Best ${p.best}`}</span>;
}

export function Home() {
  const prog = useSignal(progress);
  const stats = useSignal(intervalStats);
  const weak = weakestIntervals(stats);

  // Up next: the first unpassed item in each of the first three tracks, plus counterpoint once reading is underway.
  const upNext = UNITS.slice(0, 3)
    .map((u) => u.items.find((it) => !prog[routeId(it.route)]?.passed))
    .filter((x): x is Item => !!x);

  const passed = UNITS.flatMap((u) => u.items).filter((it) => prog[routeId(it.route)]?.passed).length;
  const total = UNITS.reduce((n, u) => n + u.items.length, 0);

  return (
    <main className="pr-home">
      <section className="pr-hero">
        <h1>Practice Room</h1>
        <p>Drills, ear training, transcription and graded exercises for the foundations of tonal music. Ten to twenty minutes a day goes a long way.</p>
        <div className="pr-overall" aria-label="Overall progress">
          <div className="pr-overall-bar">
            <div style={{ width: `${(passed / total) * 100}%` }} />
          </div>
          <span>
            {passed} of {total} passed
          </span>
        </div>
      </section>

      {upNext.length > 0 && (
        <section>
          <h2 className="pr-h2">Up next</h2>
          <div className="pr-next">
            {upNext.map((it) => (
              <button key={routeId(it.route)} className="pr-next-card" onClick={() => go(it.route)}>
                <span className="pr-kind">{it.kind}</span>
                <span className="pr-next-title">
                  {it.number} {it.title}
                </span>
                <span className="pr-next-summary">{it.summary}</span>
                <Status p={prog[routeId(it.route)]} />
              </button>
            ))}
          </div>
        </section>
      )}

      {weak.length > 0 && (
        <section className="pr-weak">
          <h2 className="pr-h2">Intervals to work on</h2>
          <p className="pr-blurb">From your transcriptions so far. Drills 0.8 and 0.9 practice them on their own.</p>
          <div className="pr-weak-list">
            {weak.map((w) => (
              <span key={w.semitones} className="pr-weak-item">
                {w.semitones > 0 ? "up" : "down"} {intervalShort(w.semitones)}: {Math.round(w.rate * 100)}% of {w.ok + w.miss}
              </span>
            ))}
          </div>
        </section>
      )}

      {UNITS.map((u) => (
        <section key={u.title} className="pr-unit">
          <h2 className="pr-h2">{u.title}</h2>
          <p className="pr-blurb">{u.blurb}</p>
          <ul className="pr-list">
            {u.items.map((it) => (
              <li key={routeId(it.route)}>
                <button className="pr-row" onClick={() => go(it.route)}>
                  <span className="pr-num">{it.number}</span>
                  <span className="pr-row-main">
                    <span className="pr-row-title">{it.title}</span>
                    <span className="pr-row-summary">{it.summary}</span>
                  </span>
                  {it.extra && (
                    <span className="tr-chips">
                      {it.extra.map((x) => (
                        <span key={x} className="tr-chip">
                          {x}
                        </span>
                      ))}
                    </span>
                  )}
                  <Status p={prog[routeId(it.route)]} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="pr-unit">
        <h2 className="pr-h2">Coming next</h2>
        <ul className="pr-list">
          {ROADMAP.map((r) => (
            <li key={r.unit}>
              <div className="pr-row is-disabled">
                <span className="pr-row-main">
                  <span className="pr-row-title">{r.unit}</span>
                  <span className="pr-row-summary">{r.topics}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
