import { useSignal } from "../model/ui";
import { COURSE, displayNumber, prereqsOf, routeId, SKILLS, skillClass, skillSlug, stageCode, unmetPrereqs, type Item, type Topic } from "./course";
import { progress } from "./exercises/state";
import { gradeName } from "./levels";
import { TUCKED_UNITS } from "./plan";
import { go } from "./route";

/**
 * Skill trees: one per skill, its stages laid out by level (top to bottom) in a column per
 * topic, so each topic is a branch. Lines join a stage to what it builds on, and light up
 * in the skill's color once that's passed. Prerequisites from other skills show as a note
 * under the stage.
 */

const COL_W = 150;
const ROW_H = 96;
const GUTTER = 92; // level labels on the left
const HEAD = 44; // topic titles across the top
const R = 21; // node radius

interface Node {
  it: Item;
  x: number;
  y: number;
}

function layout(skill: string) {
  const rows = COURSE.filter((r) => r.unit.kind === skill);
  const unit = rows[0]?.unit;
  const topics: Topic[] = unit ? unit.topics.filter((t) => rows.some((r) => t.items.includes(r.it))) : [];
  const grades = [...new Set(rows.map((r) => r.grade))].sort((a, b) => a - b);
  // Each level's band is as tall as its most crowded topic.
  const bandStart = new Map<number, number>();
  const bandSize = new Map<number, number>();
  let y = 0;
  for (const g of grades) {
    bandStart.set(g, y);
    bandSize.set(g, Math.max(...topics.map((t) => rows.filter((r) => r.grade === g && t.items.includes(r.it)).length)));
    y += bandSize.get(g)!;
  }
  const nodes = new Map<string, Node>();
  for (const [c, t] of topics.entries()) {
    const seen = new Map<number, number>();
    for (const r of rows.filter((r) => t.items.includes(r.it))) {
      const k = seen.get(r.grade) ?? 0;
      seen.set(r.grade, k + 1);
      nodes.set(r.it.number, { it: r.it, x: GUTTER + c * COL_W + COL_W / 2, y: HEAD + (bandStart.get(r.grade)! + k) * ROW_H + ROW_H / 2 - 14 });
    }
  }
  return { rows, topics, grades, bandStart, bandSize, nodes, width: GUTTER + topics.length * COL_W + 16, height: HEAD + y * ROW_H + 8 };
}

/** A stage's short label: the part after "Topic: ", else its title. */
const shortLabel = (it: Item) => it.title.split(": ").slice(1).join(": ") || it.title;

export default function SkillTrees({ skill: slug }: { skill: string }) {
  const prog = useSignal(progress);
  const skill = SKILLS.find((s) => skillSlug(s) === slug) ?? SKILLS[0];
  const { rows, topics, grades, bandStart, bandSize, nodes, width, height } = layout(skill);
  const passedOf = (it: Item) => !!prog[routeId(it.route)]?.passed;
  const tucked = (s: string) => COURSE.some((r) => r.unit.kind === s && TUCKED_UNITS.includes(r.unit.title));

  const edges: { from: Node; to: Node; lit: boolean }[] = [];
  for (const n of nodes.values()) {
    for (const p of prereqsOf(n.it)) {
      const from = nodes.get(p);
      if (from) edges.push({ from, to: n, lit: passedOf(from.it) });
    }
  }
  const done = rows.filter((r) => passedOf(r.it)).length;

  return (
    <section className={`skills ${skillClass(skill)}`} aria-label="Skill trees">
      <div className="drill-head">
        <div>
          <div className="drill-number">Practice Room</div>
          <h2 className="drill-title">Skill trees</h2>
        </div>
        <button className="btn" onClick={() => go({ kind: "home" })}>
          Back to the Practice Room
        </button>
      </div>

      <div className="skills-tabs" role="tablist">
        {SKILLS.map((s) => {
          const all = COURSE.filter((r) => r.unit.kind === s);
          const n = all.filter((r) => passedOf(r.it)).length;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={s === skill}
              className={`skills-tab ${skillClass(s)}${s === skill ? " is-active" : ""}${tucked(s) ? " is-tucked" : ""}`}
              onClick={() => go({ kind: "skills", id: skillSlug(s) })}
              title={tucked(s) ? "Composition track, for later" : undefined}
            >
              {s} <span className="skills-tab-count">{n}/{all.length}</span>
            </button>
          );
        })}
      </div>

      <div className="skills-summary">
        <div className="skills-bar">
          <div style={{ width: `${(done / Math.max(1, rows.length)) * 100}%` }} />
        </div>
        <span className="pr-dim">
          {done} of {rows.length} passed
        </span>
      </div>

      <div className="skills-scroll">
        <div className="skills-tree" style={{ width, height }}>
          <svg width={width} height={height} aria-hidden="true">
            {grades.map((g, i) => (
              <rect key={g} x={0} y={HEAD + bandStart.get(g)! * ROW_H} width={width} height={bandSize.get(g)! * ROW_H} className={i % 2 ? "skills-band is-alt" : "skills-band"} />
            ))}
            {edges.map(({ from, to, lit }, i) => {
              const y1 = from.y + R;
              const y2 = to.y - R;
              const mid = (y1 + y2) / 2;
              return <path key={i} d={`M ${from.x} ${y1} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${y2}`} className={lit ? "skills-edge is-lit" : "skills-edge"} />;
            })}
          </svg>
          {topics.map((t, c) => (
            <div key={t.title} className="skills-col" style={{ left: GUTTER + c * COL_W, width: COL_W }}>
              {t.title}
            </div>
          ))}
          {grades.map((g) => (
            <div key={g} className="skills-level" style={{ top: HEAD + bandStart.get(g)! * ROW_H + 6, width: GUTTER - 8 }}>
              {gradeName(g)}
            </div>
          ))}
          {[...nodes.values()].map(({ it, x, y }) => {
            const p = prog[routeId(it.route)];
            const unmet = p ? [] : unmetPrereqs(it, prog);
            const state = p?.passed ? "is-pass" : p ? "is-tried" : unmet.length ? "is-later" : "is-ready";
            const outside = prereqsOf(it).filter((n) => !nodes.has(n));
            return (
              <button
                key={it.number}
                className={`skills-node ${state}`}
                style={{ left: x - COL_W / 2, top: y - R }}
                onClick={() => go(it.route)}
                title={`${displayNumber(it.number)} ${it.title} (${stageCode(routeId(it.route))})\n${it.summary}\nTo pass: ${it.pass}.${p && !p.passed ? `\nBest so far: ${p.best}%.` : ""}`}
              >
                <span className="skills-dot">{displayNumber(it.number)}</span>
                <span className="skills-label">{shortLabel(it)}</span>
                {outside.length > 0 && <span className="skills-after">after {outside.map(displayNumber).join(", ")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
