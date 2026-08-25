import { useMemo, useState } from "react";
import { arc as d3arc } from "d3-shape";
import { groupColor } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";

const TAU = Math.PI * 2;
const R0 = 58;
const R1 = 104;
const R2 = 166;

const innerArc = d3arc().innerRadius(R0).outerRadius(R1).padAngle(0.004).cornerRadius(1.5);
const outerArc = d3arc().innerRadius(R1 + 2).outerRadius(R2).padAngle(0.003).cornerRadius(1.5);

/** 직업군에서 전직으로 내려가는 2단 고리. 바깥 고리를 누르면 그 직업군만 펼친다. */
export default function Sunburst({ tree, focus, setFocus, hover, setHover }) {
  const groups = tree.groups;
  const shown = focus ? groups.filter((g) => g.group === focus) : groups;
  const total = shown.reduce((s, g) => s + g.count, 0);

  const arcs = useMemo(() => {
    const inner = [];
    const outer = [];
    let angle = 0;
    for (const g of shown) {
      const span = (g.count / total) * TAU;
      const gi = groups.findIndex((x) => x.group === g.group);
      inner.push({ key: g.group, group: g.group, a0: angle, a1: angle + span, count: g.count, colorIndex: gi });
      let sub = angle;
      g.children.forEach((c, ci) => {
        const cs = (c.count / total) * TAU;
        outer.push({
          key: `${g.group}/${c.job}`,
          group: g.group,
          job: c.job,
          count: c.count,
          a0: sub,
          a1: sub + cs,
          colorIndex: gi,
          light: Math.min(0.9, 0.12 + (ci / Math.max(1, g.children.length - 1)) * 0.72),
        });
        sub += cs;
      });
      angle += span;
    }
    return { inner, outer };
  }, [shown, total, groups]);

  const active = hover;
  const dim = (d) => active && active.job !== d.job && active.group !== d.group;

  return (
    <div className="relative">
      <svg viewBox="-190 -190 380 380" width="100%" style={{ maxWidth: 380, display: "block", margin: "0 auto" }}
        role="img" aria-label="직업군과 전직 2단계 분포">
        <g>
          {arcs.inner.map((d) => (
            <path
              key={d.key}
              d={innerArc({ startAngle: d.a0, endAngle: d.a1 })}
              fill={groupColor(d.colorIndex, 0)}
              opacity={dim(d) ? 0.3 : 1}
              onMouseEnter={() => setHover({ group: d.group, job: null, count: d.count })}
              onMouseLeave={() => setHover(null)}
              onClick={() => setFocus(focus === d.group ? null : d.group)}
              style={{ cursor: "pointer", transition: "opacity 0.18s" }}
            />
          ))}
          {arcs.outer.map((d) => (
            <path
              key={d.key}
              d={outerArc({ startAngle: d.a0, endAngle: d.a1 })}
              fill={groupColor(d.colorIndex, d.light)}
              opacity={dim(d) ? 0.28 : 1}
              onMouseEnter={() => setHover({ group: d.group, job: d.job, count: d.count })}
              onMouseLeave={() => setHover(null)}
              onClick={() => setFocus(focus === d.group ? null : d.group)}
              style={{ cursor: "pointer", transition: "opacity 0.18s" }}
            />
          ))}
        </g>
        <text textAnchor="middle" y={active ? -6 : 2} fontSize="13" fontWeight="700" fill="var(--text-primary)">
          {active ? (active.job ?? active.group) : focus ?? "직업군 18종"}
        </text>
        {active && (
          <text textAnchor="middle" y="14" fontSize="12" className="num" fill="var(--text-secondary)">
            {fmtPeople(active.count)} {fmtPct((active.count / tree.total) * 100)}
          </text>
        )}
      </svg>
      <p className="t-small mt-2 text-center">
        {focus
          ? `${focus} 직업군만 펼쳐 놓았습니다. 다시 누르면 전체로 돌아갑니다.`
          : "안쪽 고리는 직업군, 바깥 고리는 전직입니다. 눌러서 한 직업군만 펼칠 수 있습니다."}
      </p>
    </div>
  );
}
