import { useState } from "react";
import { area, curveMonotoneY } from "d3-shape";
import { ACT_ORDER, ACT_COLOR } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { useInView, useMediaQuery, ENTER_MS } from "../../lib/hooks.js";
import { ActLegend } from "./Legend.jsx";

/** 보정 전과 보정 후 사이를 오가며 모양이 바뀌는 4단 스택 바 */
export function ActivityMorph({ before, after, subsample }) {
  const [mode, setMode] = useState("before");
  const values = mode === "before" ? before : after;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {[["before", "보정 전"], ["after", "보정 후"]].map(([key, label]) => {
          const on = mode === key;
          return (
            <button key={key} type="button" className="disclose" onClick={() => setMode(key)}
              style={{ color: on ? "var(--text-primary)" : "var(--accent)", fontWeight: on ? 700 : 450, textDecoration: on ? "none" : "underline" }}>
              {label}
            </button>
          );
        })}
        <p className="t-small m-0">
          보정 후는 쏠림 없는 표본의 명성 분포를 기준으로 다시 계산한 값입니다.
        </p>
      </div>

      <div className="flex h-[54px] w-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
        {ACT_ORDER.map((k) => (
          <div
            key={k}
            style={{
              width: `${values[k]}%`,
              background: ACT_COLOR[k],
              transition: `width ${ENTER_MS}ms cubic-bezier(0.3,0.7,0.3,1)`,
            }}
            title={`${k} ${fmtPct(values[k])}`}
          />
        ))}
      </div>

      <div className="mt-1 flex justify-between text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        <span>왼쪽일수록 최근 접속</span>
        <span>오른쪽일수록 오래 미접속</span>
      </div>

      <ul className="mt-3 m-0 grid list-none gap-x-6 gap-y-1 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {ACT_ORDER.map((k) => (
          <li key={k} className="flex items-baseline gap-2 text-[0.86rem]">
            <span className="inline-block h-[9px] w-[9px] shrink-0" style={{ background: ACT_COLOR[k] }} />
            <span style={{ color: "var(--text-secondary)" }}>{k}</span>
            <b className="num ml-auto" style={{ color: "var(--text-primary)" }}>{fmtPct(values[k])}</b>
          </li>
        ))}
      </ul>
      <p className="t-small mt-2 m-0">
        활성도 조사 대상 {fmtPeople(subsample)}, 명성 구간에 비례해 뽑았습니다.
      </p>
    </div>
  );
}

const WIDE = { w: 900, row: 62, left: 128, right: 66, font: 13 };
const NARROW = { w: 380, row: 54, left: 114, right: 44, font: 13 };

/** 명성 구간을 아래에서 위로 쌓은 스트림. 위로 갈수록 최근 접속 비중이 짙어진다. */
export function ActivityStream({ bins }) {
  const [ref, seen] = useInView();
  const [hover, setHover] = useState(null);
  const narrow = useMediaQuery("(max-width: 760px)");
  const S = narrow ? NARROW : WIDE;
  const rows = [...bins].reverse();
  const H = rows.length * S.row + 40;
  const innerW = S.w - S.left - S.right;
  const yOf = (i) => 28 + i * S.row + S.row / 2;

  const bands = ACT_ORDER.map((k) => {
    const points = [];
    const push = (y, j) => {
      let left = 0;
      for (const kk of ACT_ORDER) {
        if (kk === k) break;
        left += rows[j].pct[kk];
      }
      points.push({ y, x0: S.left + (left / 100) * innerW, x1: S.left + ((left + rows[j].pct[k]) / 100) * innerW });
    };
    push(24, 0);
    rows.forEach((_, j) => push(yOf(j), j));
    push(H - 12, rows.length - 1);
    const gen = area().x0((d) => d.x0).x1((d) => d.x1).y((d) => d.y).curve(curveMonotoneY);
    return { key: k, d: gen(points) };
  });

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${S.w} ${H}`} width="100%" style={{ display: "block" }} role="img"
        aria-label="명성 구간별 접속 기록 구성">
        {/* 좁은 화면에서는 13픽셀로 키운 두 머리말이 가운데서 맞부딪는다. 짧게 줄여 쓴다. */}
        <text x={S.left} y={12} fontSize={13} fill="var(--text-muted)">
          {narrow ? "← 최근 접속" : "왼쪽일수록 최근 접속"}
        </text>
        <text x={S.w - S.right} y={12} textAnchor="end" fontSize={13} fill="var(--text-muted)">
          {narrow ? "오래 미접속 →" : "오른쪽일수록 오래 미접속"}
        </text>
        <g opacity={seen ? 1 : 0} style={{ transition: `opacity ${ENTER_MS}ms ease` }}>
          {bands.map((b) => (
            <path key={b.key} d={b.d} fill={ACT_COLOR[b.key]} stroke="var(--bg-base)" strokeWidth="0.8" />
          ))}
        </g>
        {rows.map((b, i) => (
          <g key={b.bin} onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)}>
            <rect x={0} y={28 + i * S.row} width={S.w} height={S.row} fill="transparent" />
            <text x={S.left - 10} y={yOf(i) + 4} textAnchor="end" fontSize={S.font} fontWeight={hover === b ? 700 : 500}
              fill="var(--text-primary)">
              {b.bin}
            </text>
            <text x={S.w - S.right + 8} y={yOf(i) + 4} fontSize={13} className="num" fill="var(--text-muted)">
              {fmtPeople(b.n)}
            </text>
            {b.smallSample && (
              <>
                <rect x={S.left - 4} y={28 + i * S.row + 5} width={innerW + 8} height={S.row - 10}
                  fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="5 4" />
                <text x={S.left - 10} y={yOf(i) + 23} textAnchor="end" fontSize={13}
                  fill="var(--gold-text)" fontWeight="700">
                  표본이 적어 참고용
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <ActLegend />
      <p className="t-small mt-1 min-h-[1.6rem]">
        {hover
          ? `${hover.bin} ${fmtPeople(hover.n)} 가운데 ${ACT_ORDER.map((k) => `${k} ${fmtPct(hover.pct[k])}`).join(", ")}`
          : "구간에 마우스를 올리면 네 가지 접속 상태의 비중이 나옵니다."}
      </p>
    </div>
  );
}
