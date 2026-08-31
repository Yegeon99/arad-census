import { useState } from "react";
import { interpolateNumber } from "d3-interpolate";
import { BIN_COLOR, BIN_ORDER } from "../../lib/palette.js";
import { fmtPct, fmtPeople, fmtPp, asParticle } from "../../lib/format.js";
import { useInView, useMediaQuery, useReducedMotion, ENTER_MS } from "../../lib/hooks.js";

const WIDE = { w: 960, gutter: 168, row: 50, pad: 96, bar: 34, font: 13 };
const NARROW = { w: 380, gutter: 0, row: 70, pad: 10, bar: 20, font: 12 };

/** 좌우 대칭 피라미드. 반대쪽 표본은 점선 윤곽으로 겹쳐 보여 준다. */
export default function MirrorPyramid({
  bins, gapLabelBin, gapValue,
  leftLabel = "전체 표본 (쏠림 있음)", rightLabel = "쏠림 없는 표본", gapText = "두 표본의 차이",
}) {
  const [t, setT] = useState(0);
  const [ref, seen] = useInView();
  const reduced = useReducedMotion();
  const narrow = useMediaQuery("(max-width: 760px)");
  const S = narrow ? NARROW : WIDE;

  const cx = S.gutter + (S.w - S.gutter) / 2;
  const maxHalf = (S.w - S.gutter) / 2 - S.pad;
  const maxPct = Math.max(...bins.flatMap((b) => [b.full, b.complete]));
  const scale = maxHalf / maxPct;

  const rows = [...bins].reverse(); // 위가 높은 구간
  const height = rows.length * S.row + (narrow ? 22 : 54);
  const ease = reduced ? "none" : `all ${ENTER_MS}ms cubic-bezier(0.3,0.7,0.3,1)`;

  const solidAt = (b) => interpolateNumber(b.full, b.complete)(t);
  const ghostAt = (b) => interpolateNumber(b.complete, b.full)(t);
  const countAt = (b) => Math.round(interpolateNumber(b.fullCount, b.completeCount)(t));

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${S.w} ${height}`} width="100%" style={{ display: "block" }} role="img"
        aria-label={`성장 단계 피라미드, ${leftLabel}과 ${rightLabel} 비교`}>
        {rows.map((b, i) => {
          const top = (narrow ? 4 : 16) + i * S.row;
          const barY = narrow ? top + 20 : top;
          const mid = barY + S.bar / 2 + 4;
          const v = solidAt(b);
          const g = ghostAt(b);
          const half = Math.max(seen ? v * scale : 0, 1);
          const ghostHalf = Math.max(seen ? g * scale : 0, 1);
          const isGap = b.label === gapLabelBin;
          const wideEnough = half * 2 > (narrow ? 74 : 96);

          return (
            <g key={b.label}>
              {narrow ? (
                <>
                  <text x={4} y={top + 12} fontSize={S.font} fontWeight="600" fill="var(--text-primary)">
                    {b.label}
                  </text>
                  <text x={S.w - 4} y={top + 12} textAnchor="end" fontSize="11" className="num" fill="var(--text-muted)">
                    {fmtPeople(countAt(b))}
                  </text>
                </>
              ) : (
                <text x={S.gutter - 16} y={mid} textAnchor="end" fontSize={S.font} fontWeight="600" fill="var(--text-primary)">
                  {b.label}
                </text>
              )}

              <rect x={cx - half} y={barY} width={half * 2} height={S.bar} rx="2"
                fill={BIN_COLOR[b.label]} style={{ transition: ease }} />
              <rect x={cx - ghostHalf} y={barY} width={ghostHalf * 2} height={S.bar} rx="2"
                fill="none" stroke="var(--text-secondary)" strokeWidth="1.2" strokeDasharray="4 3"
                style={{ transition: ease }} />

              {wideEnough ? (
                <text x={cx} y={mid} textAnchor="middle" fontSize="12.5" className="num"
                  fill={BIN_ORDER.indexOf(b.label) >= 4 ? "#FFFFFF" : "var(--text-primary)"} style={{ transition: ease }}>
                  {fmtPct(v)}
                </text>
              ) : (
                <text x={cx + half + 8} y={mid} fontSize="12" className="num" fill="var(--text-secondary)"
                  style={{ transition: ease }}>
                  {fmtPct(v)}
                </text>
              )}

              {!narrow && (
                <text x={S.w - 6} y={mid} textAnchor="end" fontSize="12" className="num" fill="var(--text-muted)">
                  {fmtPeople(countAt(b))}
                </text>
              )}

              {isGap && (
                <g opacity={seen ? 1 : 0} style={{ transition: "opacity 0.3s ease 0.2s" }}>
                  <line x1={cx - half} x2={cx - ghostHalf} y1={barY + S.bar + 7} y2={barY + S.bar + 7}
                    stroke="var(--gold)" strokeWidth="2" style={{ transition: ease }} />
                  <text x={Math.max(4, cx - Math.max(half, ghostHalf))} y={barY + S.bar + 22}
                    fontSize="12" fontWeight="700" className="num" fill="var(--gold-text)" style={{ transition: ease }}>
                    {`${gapText} ${fmtPp(gapValue)}`}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <line x1={cx} y1={narrow ? 2 : 12} x2={cx} y2={rows.length * S.row + (narrow ? 2 : 12)}
          stroke="var(--bg-base)" strokeWidth="1" />
      </svg>

      <div className="mt-4 max-w-[680px]">
        <label htmlFor="pyramid-slider" className="t-small m-0 flex justify-between">
          <span style={{ fontWeight: t < 0.5 ? 700 : 400, color: t < 0.5 ? "var(--text-primary)" : undefined }}>{leftLabel}</span>
          <span style={{ fontWeight: t >= 0.5 ? 700 : 400, color: t >= 0.5 ? "var(--text-primary)" : undefined }}>{rightLabel}</span>
        </label>
        <input
          id="pyramid-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="전체 표본과 쏠림 없는 표본 사이 전환"
        />
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" className="disclose" onClick={() => setT(0)}>{asParticle(leftLabel)}</button>
          <button type="button" className="disclose" onClick={() => setT(1)}>{asParticle(rightLabel)}</button>
          <span className="t-small">채운 막대가 지금 고른 쪽, 점선 윤곽이 반대쪽입니다.</span>
        </div>
      </div>
    </div>
  );
}
