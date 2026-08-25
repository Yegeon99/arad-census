import { useState } from "react";
import { BIN_COLOR } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { BinLegend } from "./Legend.jsx";

/** 층별 반지름: 해당 층과 그 위층 비중의 합을 넓이로 읽히게 만든다. */
export function radii(pcts) {
  const out = [];
  for (let i = 0; i < pcts.length; i += 1) {
    const cum = pcts.slice(i).reduce((s, v) => s + v, 0);
    out.push(Math.sqrt(Math.max(cum, 0) / 100));
  }
  out.push(0);
  return out;
}

function OnePyramid({ title, note, bins, x, baseY, halfWidth, layerH, onHover, hovered }) {
  const r = radii(bins.map((b) => b.pct));
  return (
    <g>
      <text x={x} y={baseY + 30} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">{title}</text>
      <text x={x} y={baseY + 48} textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">{note}</text>
      {bins.map((b, i) => {
        const yb = baseY - i * layerH;
        const yt = baseY - (i + 1) * layerH;
        const rb = r[i] * halfWidth;
        const rt = r[i + 1] * halfWidth;
        const on = hovered === b.range;
        return (
          <polygon
            key={b.range}
            points={`${x - rb},${yb} ${x + rb},${yb} ${x + rt},${yt} ${x - rt},${yt}`}
            fill={BIN_COLOR[b.range]}
            stroke="var(--bg-base)"
            strokeWidth={on ? 2.4 : 1.2}
            opacity={hovered && !on ? 0.45 : 1}
            onMouseEnter={() => onHover(b.range)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "pointer", transition: "opacity 0.18s" }}
          />
        );
      })}
    </g>
  );
}

/** 표본 피라미드 평면 화면: 전체 표본과 완전 검색 표본을 나란히 세운다. */
export default function Pyramid2D({ full, complete, fullNote, completeNote }) {
  const [hovered, setHovered] = useState(null);
  const W = 900;
  const H = 380;
  const layerH = 44;
  const baseY = 300;
  const info = hovered
    ? {
        label: hovered,
        full: full.find((b) => b.range === hovered),
        complete: complete.find((b) => b.range === hovered),
      }
    : null;

  return (
    <div>
      <div className="scroll-x">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 620, display: "block" }} role="img"
          aria-label="전체 표본과 완전 검색 표본의 명성 구간 피라미드 비교">
          <OnePyramid title="전체 표본" note={fullNote} bins={full} x={250} baseY={baseY}
            halfWidth={190} layerH={layerH} onHover={setHovered} hovered={hovered} />
          <OnePyramid title="완전 검색 표본" note={completeNote} bins={complete} x={650} baseY={baseY}
            halfWidth={190} layerH={layerH} onHover={setHovered} hovered={hovered} />
          <line x1={450} y1={20} x2={450} y2={330} stroke="var(--hairline)" strokeWidth="1" />
        </svg>
      </div>
      <BinLegend note="아래층이 레기온 입장 전, 위로 갈수록 높은 구간입니다." />
      <div className="mt-2 min-h-[3.2rem]">
        {info ? (
          <p className="t-body m-0 text-[0.92rem]">
            <b style={{ color: "var(--text-primary)" }}>{info.label}</b>
            <span className="num"> 전체 표본 {fmtPct(info.full.pct)} {fmtPeople(info.full.count)}</span>
            <span style={{ opacity: 0.5 }}> · </span>
            <span className="num">완전 검색 표본 {fmtPct(info.complete.pct)} {fmtPeople(info.complete.count)}</span>
          </p>
        ) : (
          <p className="t-small m-0">층에 마우스를 올리면 구간 이름과 비중이 나옵니다.</p>
        )}
      </div>
    </div>
  );
}
