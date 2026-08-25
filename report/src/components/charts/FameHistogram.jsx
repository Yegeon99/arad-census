import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { fmtFame, fmtPct, fmtPeople } from "../../lib/format.js";
import { useInView } from "../../lib/hooks.js";

const W = 960;
const H = 340;
const PAD = { top: 18, right: 18, bottom: 92, left: 46 };

/** 명성 히스토그램. 세로 기준선은 구간 경계로 쓴 컨텐츠 입장값이다. */
export default function FameHistogram({ data, cuts, binWidth }) {
  const [hover, setHover] = useState(null);
  const [ref, seen] = useInView();
  // 뒤쪽 빈 구간은 잘라 낸다
  const last = data.bins.reduce((acc, b, i) => (b.count > 0 ? i : acc), 0);
  const bins = data.bins.slice(0, last + 1);
  const maxFame = bins.length * binWidth;
  const x = scaleLinear().domain([0, maxFame]).range([PAD.left, W - PAD.right]);
  const y = scaleLinear().domain([0, Math.max(...bins.map((b) => b.pct))]).range([H - PAD.bottom, PAD.top]);
  const bw = x(binWidth) - x(0);
  const baseY = y(0);

  return (
    <div ref={ref}>
      <div className="scroll-x">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 680, display: "block" }} role="img"
          aria-label="명성 히스토그램과 컨텐츠 입장 기준선">
          {y.ticks(4).map((tv) => (
            <g key={tv}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tv)} y2={y(tv)} stroke="var(--hairline)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tv) + 4} textAnchor="end" fontSize="11" className="num" fill="var(--text-muted)">
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
            const step = i % 3;
            const labelY = baseY + 20 + step * 22;
            return (
              <g key={c.fame}>
                <line x1={x(c.fame)} x2={x(c.fame)} y1={PAD.top - 8} y2={labelY - 12}
                  stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="4 4" />
                <text x={x(c.fame)} y={labelY} textAnchor="middle" fontSize="11.5" fill="var(--gold-text)" fontWeight="600">
                  {c.label}
                  <tspan className="num" fill="var(--text-muted)" fontWeight="400"> {fmtFame(c.fame)}</tspan>
                </text>
              </g>
            );
          })}

          <line x1={PAD.left} x2={W - PAD.right} y1={baseY} y2={baseY} stroke="var(--hairline-strong)" strokeWidth="1" />
        </svg>
      </div>
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
