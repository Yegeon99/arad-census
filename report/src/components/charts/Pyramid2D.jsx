import { useState } from "react";
import { BIN_COLOR } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { bands, spreadLabels } from "../../lib/pyramid.js";

const W = 480;
const H = 380;
const APEX_X = 130;
const BASE_HALF = 116;
const BASE_Y = 322;
const TOTAL_H = 282;
const LABEL_X = 266;

function Panel({ title, note, bins, hovered, onHover }) {
  const rows = bands(bins);
  const top = [...rows].reverse(); // 위에서 아래 차례
  const desired = top.map((b) => BASE_Y - b.mid * TOTAL_H + 4);
  const ys = spreadLabels(desired, 22, 32, BASE_Y + 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img"
      aria-label={`${title}의 명성 구간 피라미드`}>
      {rows.map((b) => {
        const yBottom = BASE_Y - b.from * TOTAL_H;
        const yTop = BASE_Y - b.to * TOTAL_H;
        const hb = b.halfFrom * BASE_HALF;
        const ht = b.halfTo * BASE_HALF;
        const on = hovered === b.bin;
        return (
          <polygon
            key={b.bin}
            points={`${APEX_X - hb},${yBottom} ${APEX_X + hb},${yBottom} ${APEX_X + ht},${yTop} ${APEX_X - ht},${yTop}`}
            fill={BIN_COLOR[b.bin]}
            stroke="var(--bg-base)"
            strokeWidth={on ? 2 : 0.9}
            opacity={hovered && !on ? 0.42 : 1}
            onMouseEnter={() => onHover(b.bin)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "pointer", transition: "opacity 0.18s" }}
          />
        );
      })}

      {top.map((b, i) => {
        const y = ys[i];
        const bandY = BASE_Y - b.mid * TOTAL_H;
        const edge = APEX_X + (1 - b.mid) * BASE_HALF;
        const on = hovered === b.bin;
        return (
          <g key={b.bin} onMouseEnter={() => onHover(b.bin)} onMouseLeave={() => onHover(null)}
            style={{ cursor: "pointer" }}>
            <polyline
              points={`${edge + 4},${bandY} ${LABEL_X - 12},${bandY} ${LABEL_X - 5},${y - 4}`}
              fill="none" stroke="var(--hairline-strong)" strokeWidth="0.9" />
            <text x={LABEL_X} y={y} fontSize="13" fontWeight={on ? 700 : 500} fill="var(--text-primary)">
              {b.bin}
            </text>
            <text x={LABEL_X} y={y + 15} fontSize="12.5" className="num" fill="var(--text-secondary)">
              {fmtPct(b.pct)}
              <tspan fill="var(--text-muted)" fontSize="11.5" dx="6">{fmtPeople(b.count)}</tspan>
            </text>
          </g>
        );
      })}

      <line x1={APEX_X - BASE_HALF} x2={APEX_X + BASE_HALF} y1={BASE_Y} y2={BASE_Y}
        stroke="var(--hairline-strong)" strokeWidth="1" />
      <text x={APEX_X} y={BASE_Y + 26} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)">
        {title}
      </text>
      <text x={APEX_X} y={BASE_Y + 44} textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        {note}
      </text>
    </svg>
  );
}

/** 표본 피라미드 평면 화면. 층 높이가 그 구간의 비중이다. */
export default function Pyramid2D({ full, complete, fullNote, completeNote }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <Panel title="전체 표본" note={fullNote} bins={full} hovered={hovered} onHover={setHovered} />
      <Panel title="완전 검색 표본" note={completeNote} bins={complete} hovered={hovered} onHover={setHovered} />
    </div>
  );
}
