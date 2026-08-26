import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { fmtFame, fmtPct, fmtPeople } from "../../lib/format.js";
import { useInView, useMediaQuery } from "../../lib/hooks.js";

const WIDE = { w: 960, h: 356, left: 46, right: 18, bottom: 104, tickEvery: 1 };
const NARROW = { w: 380, h: 260, left: 30, right: 8, bottom: 40, tickEvery: 2 };

/** 명성 히스토그램. 세로 기준선은 구간 경계로 쓴 컨텐츠 입장값이다. */
export default function FameHistogram({ data, cuts, binWidth }) {
  const [hover, setHover] = useState(null);
  const [ref, seen] = useInView();
  const narrow = useMediaQuery("(max-width: 760px)");
  const S = narrow ? NARROW : WIDE;

  // 뒤쪽 빈 구간은 잘라 낸다
  const last = data.bins.reduce((acc, b, i) => (b.count > 0 ? i : acc), 0);
  const bins = data.bins.slice(0, last + 1);
  const maxFame = bins.length * binWidth;
  const x = scaleLinear().domain([0, maxFame]).range([S.left, S.w - S.right]);
  const y = scaleLinear().domain([0, Math.max(...bins.map((b) => b.pct))]).range([S.h - S.bottom, 18]);
  const bw = x(binWidth) - x(0);
  const baseY = y(0);
  const ticks = [];
  for (let v = 0; v <= maxFame; v += binWidth * 2 * S.tickEvery) ticks.push(v);

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${S.w} ${S.h}`} width="100%" style={{ display: "block" }} role="img"
        aria-label="명성 히스토그램과 컨텐츠 입장 기준선">
        {y.ticks(4).map((tv) => (
          <g key={tv}>
            <line x1={S.left} x2={S.w - S.right} y1={y(tv)} y2={y(tv)} stroke="var(--hairline)" strokeWidth="1" />
            <text x={S.left - 6} y={y(tv) + 4} textAnchor="end" fontSize={narrow ? 9 : 11} className="num" fill="var(--text-muted)">
              {tv}%
            </text>
          </g>
        ))}

        {bins.map((b, i) => {
          const h = Math.max(0, baseY - y(b.pct));
          const on = hover === i;
          return (
            <rect
              key={b.from}
              x={x(b.from) + 1}
              width={bw - 2}
              y={seen ? y(b.pct) : baseY}
              height={seen ? h : 0}
              fill={on ? "var(--gold)" : "var(--ink-4)"}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: `height 0.7s cubic-bezier(0.22,0.68,0.31,1) ${i * 30}ms, y 0.7s cubic-bezier(0.22,0.68,0.31,1) ${i * 30}ms, fill 0.15s` }}
            />
          );
        })}

        {cuts.map((c, i) => {
          const cx = x(c.fame);
          if (narrow) {
            return (
              <g key={c.fame}>
                <line x1={cx} x2={cx} y1={10} y2={baseY} stroke="var(--gold)" strokeWidth="1.1" strokeDasharray="4 4" />
                <circle cx={cx} cy={9} r="7" fill="var(--gold)" />
                <text x={cx} y={12.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#FFFFFF">{i + 1}</text>
              </g>
            );
          }
          const labelY = baseY + 40 + (i % 3) * 21;
          return (
            <g key={c.fame}>
              <line x1={cx} x2={cx} y1={10} y2={labelY - 12} stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="4 4" />
              <text x={cx} y={labelY} textAnchor="middle" fontSize="11.5" fill="var(--gold-text)" fontWeight="600">
                {c.label}
                <tspan className="num" fill="var(--text-muted)" fontWeight="400" dx="5">{fmtFame(c.fame)}</tspan>
              </text>
            </g>
          );
        })}

        <line x1={S.left} x2={S.w - S.right} y1={baseY} y2={baseY} stroke="var(--hairline-strong)" strokeWidth="1" />
        {ticks.map((v) => (
          <g key={`tick-${v}`}>
            <line x1={x(v)} x2={x(v)} y1={baseY} y2={baseY + 4} stroke="var(--hairline-strong)" strokeWidth="1" />
            <text x={x(v)} y={baseY + (narrow ? 15 : 16)} textAnchor="middle" fontSize={narrow ? 9 : 11}
              className="num" fill="var(--text-muted)">
              {fmtFame(v)}
            </text>
          </g>
        ))}
      </svg>

      {narrow && (
        <ol className="m-0 mt-2 list-none p-0">
          {cuts.map((c, i) => (
            <li key={c.fame} className="flex items-center gap-2 text-[0.76rem]" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                style={{ background: "var(--gold)", color: "#FFFFFF" }}>{i + 1}</span>
              {c.label}
              <span className="num" style={{ color: "var(--text-muted)" }}>{fmtFame(c.fame)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="t-small m-0">
          {hover !== null
            ? `${fmtFame(bins[hover].from)} 이상 ${bins[hover].to === null ? "위쪽 전부" : `${fmtFame(bins[hover].to)} 미만`}, ${fmtPeople(bins[hover].count)} ${fmtPct(bins[hover].pct)}`
            : "막대에 마우스를 올리면 구간별 인원이 나옵니다."}
        </p>
        <p className="t-small m-0">가로축은 명성값, 세로축은 표본 안 비중입니다.</p>
      </div>
    </div>
  );
}
