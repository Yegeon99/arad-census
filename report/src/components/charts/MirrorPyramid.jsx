import { useState } from "react";
import { interpolateNumber } from "d3-interpolate";
import { BIN_COLOR } from "../../lib/palette.js";
import { fmtPct, fmtPeople, fmtPp } from "../../lib/format.js";
import { useInView, useReducedMotion } from "../../lib/hooks.js";

const W = 960;
const GUTTER = 168;        // 왼쪽 구간 이름 자리
const CX = GUTTER + (W - GUTTER) / 2;
const MAX_HALF = (W - GUTTER) / 2 - 74;
const ROW = 50;

/** 좌우 대칭 피라미드. 슬라이더를 끌면 전체 표본과 완전 검색 표본 사이를 오간다. */
export default function MirrorPyramid({ bins, gapLabelBin, gapValue }) {
  const [t, setT] = useState(0);
  const [ref, seen] = useInView();
  const reduced = useReducedMotion();
  const maxPct = Math.max(...bins.flatMap((b) => [b.full, b.complete]));
  const scale = MAX_HALF / maxPct;

  const rows = [...bins].reverse(); // 위가 높은 구간, 아래가 낮은 구간
  const H = rows.length * ROW + 54;

  const valueAt = (b) => interpolateNumber(b.full, b.complete)(t);
  const countAt = (b) => Math.round(interpolateNumber(b.fullCount, b.completeCount)(t));
  const ease = reduced ? "none" : "all 0.5s cubic-bezier(0.3,0.7,0.3,1)";

  return (
    <div ref={ref}>
      <div className="scroll-x">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 680, display: "block" }} role="img"
          aria-label="명성 구간 피라미드, 전체 표본과 완전 검색 표본 사이 전환">
          {rows.map((b, i) => {
            const y = 18 + i * ROW;
            const mid = y + (ROW - 14) / 2 + 4;
            const v = valueAt(b);
            const half = Math.max(seen ? v * scale : 0, 1);
            const isGap = b.label === gapLabelBin;
            return (
              <g key={b.label}>
                <text x={GUTTER - 16} y={mid} textAnchor="end" fontSize="13" fontWeight="600" fill="var(--text-primary)">
                  {b.label}
                </text>
                <rect x={CX - half} y={y} width={half * 2} height={ROW - 14} rx="2"
                  fill={BIN_COLOR[b.label]} style={{ transition: ease }} />
                <text x={CX - half - 10} y={mid} textAnchor="end" fontSize="12.5" className="num"
                  fill="var(--text-secondary)" style={{ transition: ease }}>
                  {fmtPct(v)}
                </text>
                <text x={CX + half + 10} y={mid} fontSize="12" className="num" fill="var(--text-muted)"
                  style={{ transition: ease }}>
                  {fmtPeople(countAt(b))}
                </text>
                {isGap && (
                  <g opacity={seen ? 1 : 0} style={{ transition: "opacity 0.9s ease 0.5s" }}>
                    <line x1={CX - b.full * scale} x2={CX - b.complete * scale} y1={y + ROW - 11} y2={y + ROW - 11}
                      stroke="var(--gold)" strokeWidth="2" />
                    <line x1={CX - b.full * scale} x2={CX - b.full * scale} y1={y + ROW - 16} y2={y + ROW - 6}
                      stroke="var(--gold)" strokeWidth="2" />
                    <line x1={CX - b.complete * scale} x2={CX - b.complete * scale} y1={y + ROW - 16} y2={y + ROW - 6}
                      stroke="var(--gold)" strokeWidth="2" />
                    <text x={CX - ((b.full + b.complete) / 2) * scale} y={y + ROW + 10} textAnchor="middle"
                      fontSize="12.5" fontWeight="700" className="num" fill="var(--gold-text)">
                      {`두 표본의 차이 ${fmtPp(gapValue)}`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <line x1={CX} y1={12} x2={CX} y2={rows.length * ROW + 14} stroke="var(--bg-base)" strokeWidth="1" />
        </svg>
      </div>

      <div className="mt-4 max-w-[46rem]">
        <label htmlFor="pyramid-slider" className="t-small m-0 flex justify-between">
          <span style={{ fontWeight: t < 0.5 ? 700 : 400, color: t < 0.5 ? "var(--text-primary)" : undefined }}>전체 표본</span>
          <span style={{ fontWeight: t >= 0.5 ? 700 : 400, color: t >= 0.5 ? "var(--text-primary)" : undefined }}>완전 검색 표본</span>
        </label>
        <input
          id="pyramid-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="전체 표본과 완전 검색 표본 사이 전환"
        />
        <div className="mt-1 flex gap-4">
          <button type="button" className="disclose" onClick={() => setT(0)}>전체 표본으로</button>
          <button type="button" className="disclose" onClick={() => setT(1)}>완전 검색 표본으로</button>
        </div>
      </div>
    </div>
  );
}
