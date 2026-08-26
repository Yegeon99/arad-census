import { useMemo, useState } from "react";
import { arc as d3arc } from "d3-shape";
import { groupColor, onGroupColor } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";

const TAU = Math.PI * 2;
const R0 = 50;
const R1 = 116;
const R2 = 176;
const LABEL_R = 55;
const LABEL_MIN_ANGLE = 0.19; // 이보다 좁은 조각은 이름을 생략한다

const innerArc = d3arc().innerRadius(R0).outerRadius(R1).padAngle(0.004).cornerRadius(1.5);
const outerArc = d3arc().innerRadius(R1 + 2).outerRadius(R2).padAngle(0.003).cornerRadius(1.5);

/** 직업군에서 전직으로 내려가는 2단 고리. 바깥 고리를 누르면 그 직업군만 펼친다. */
export default function Sunburst({ tree, focus, setFocus, hover, setHover }) {
  const groups = tree.groups;
  const shown = focus ? groups.filter((g) => g.group === focus) : groups;
  const total = shown.reduce((s, g) => s + g.count, 0);
  const n = groups.length;

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
          light: Math.min(1, 0.24 + (ci / Math.max(1, g.children.length - 1)) * 0.76),
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
    <div>
      <svg viewBox="-196 -196 392 392" width="100%" style={{ maxWidth: 392, display: "block", margin: "0 auto" }}
        role="img" aria-label="직업군과 전직 2단계 분포">
        {arcs.inner.map((d) => (
          <path
            key={d.key}
            d={innerArc({ startAngle: d.a0, endAngle: d.a1 })}
            fill={groupColor(d.colorIndex, n, 0)}
            opacity={dim(d) ? 0.28 : 1}
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
            fill={groupColor(d.colorIndex, n, d.light)}
            opacity={dim(d) ? 0.26 : 1}
            onMouseEnter={() => setHover({ group: d.group, job: d.job, count: d.count })}
            onMouseLeave={() => setHover(null)}
            onClick={() => setFocus(focus === d.group ? null : d.group)}
            style={{ cursor: "pointer", transition: "opacity 0.18s" }}
          />
        ))}

        {arcs.inner.map((d) => {
          if (d.a1 - d.a0 < LABEL_MIN_ANGLE) return null;
          const mid = (d.a0 + d.a1) / 2;
          const deg = (mid * 180) / Math.PI - 90;
          const flip = mid > Math.PI;
          return (
            <text
              key={`t/${d.key}`}
              transform={`rotate(${deg}) translate(${flip ? R1 - 6 : LABEL_R},0) rotate(${flip ? 180 : 0})`}
              textAnchor={flip ? "end" : "start"}
              dominantBaseline="middle"
              fontSize="9.5"
              fontWeight="600"
              fill={onGroupColor(d.colorIndex, n, 0)}
              style={{ pointerEvents: "none" }}
            >
              {d.group}
            </text>
          );
        })}

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

/** 직업군 18개 범례. 화면 폭을 다 쓰도록 고리 바깥에 따로 놓는다. */
export function GroupLegend({ tree, focus, setFocus, hover, setHover }) {
  const groups = tree.groups;
  const n = groups.length;
  return (
    <ul className="mt-4 m-0 grid list-none gap-x-6 gap-y-[3px] p-0 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g, i) => {
        const on = hover && hover.group === g.group;
        return (
          <li
            key={g.group}
            className="flex items-center gap-2 text-[0.78rem]"
            onMouseEnter={() => setHover({ group: g.group, job: null, count: g.count })}
            onMouseLeave={() => setHover(null)}
            onClick={() => setFocus(focus === g.group ? null : g.group)}
            style={{ cursor: "pointer", color: on ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: on ? 700 : 400 }}
          >
            <span className="inline-block h-[9px] w-[9px] shrink-0" style={{ background: groupColor(i, n, 0) }} />
            <span className="truncate">{g.group}</span>
            <span className="num ml-auto shrink-0" style={{ color: "var(--text-muted)" }}>
              {fmtPeople(g.count)} {fmtPct((g.count / tree.total) * 100)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
