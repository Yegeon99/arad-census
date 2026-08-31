import { useMemo, useState } from "react";
import BarChart from "./bar-chart.tsx";
import Bar from "./bar.tsx";
import BarYAxis from "./bar-y-axis.tsx";
import { BIN_ORDER } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { useReducedMotion } from "../../lib/hooks.js";

// 두 계열을 가르는 색. 한 계열 안의 명도 차가 아니라 색상 자체를 달리해
// 색약에서도 갈린다 (ΔE 27.5 protan / 31.2 정상 시야).
const LEFT_COLOR = "var(--accent)";
const RIGHT_COLOR = "var(--gold)";

const ROW_H = 46;
const M = { top: 6, right: 150, bottom: 26, left: 112 };

const pick = (bins, label) => bins.find((b) => (b.range ?? b.label) === label);

/**
 * 성장 단계 여섯 칸을 두 표본으로 나란히 견준다.
 * 같은 자(가로축)를 함께 쓰기 때문에 두 막대의 길이를 그대로 비교할 수 있다.
 */
export default function SampleStageBars({
  full, complete, fullNote, completeNote,
  fullLabel = "전체 표본", completeLabel = "쏠림 없는 표본",
}) {
  const FULL = fullLabel;
  const CLEAN = completeLabel;
  const [hovered, setHovered] = useState(null);
  // Bklit 차트는 움직임 최소화 설정을 스스로 보지 않는다. 여기서 꺼 준다.
  const reduced = useReducedMotion();

  // 높은 단계가 위로 오도록 뒤집는다 (피라미드에서 읽던 차례 그대로)
  const data = useMemo(
    () =>
      [...BIN_ORDER].reverse().map((label) => {
        const a = pick(full, label);
        const b = pick(complete, label);
        return {
          stage: label,
          [FULL]: a?.pct ?? 0,
          [CLEAN]: b?.pct ?? 0,
          fullCount: a?.count ?? 0,
          cleanCount: b?.count ?? 0,
        };
      }),
    [full, complete, FULL, CLEAN]
  );

  const height = data.length * ROW_H + M.top + M.bottom;
  const on = data.find((d) => d.stage === hovered);

  return (
    <div>
      <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
        {[[FULL, fullNote], [CLEAN, completeNote]].map(([name, note]) => (
          <li key={name} className="flex items-baseline gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[2px]"
              style={{ background: name === FULL ? LEFT_COLOR : RIGHT_COLOR }}
              aria-hidden="true"
            />
            <span className="m-0 text-[0.92rem] font-bold" style={{ color: "var(--text-primary)" }}>{name}</span>
            <span className="t-small m-0">{note}</span>
          </li>
        ))}
      </ul>

      <div className="scroll-x">
        <div className="relative" style={{ minWidth: 560 }}>
          <BarChart
            data={data}
            xDataKey="stage"
            orientation="horizontal"
            barGap={0.22}
            margin={M}
            animationDuration={reduced ? 0 : 1100}
            className="!aspect-auto"
            style={{ height }}
          >
            <Bar dataKey={FULL} fill="var(--accent)" lineCap={2} groupGap={4} fadedOpacity={0.3} animate={!reduced} />
            <Bar dataKey={CLEAN} fill="var(--gold)" lineCap={2} groupGap={4} fadedOpacity={0.3} animate={!reduced} />
            <BarYAxis />
          </BarChart>

          {/* 막대와 같은 높이로 나눈 칸이라 줄 위치가 정확히 맞는다. */}
          <div className="absolute inset-x-0" style={{ top: M.top, bottom: M.bottom }}>
            {data.map((d) => {
              const lit = hovered === d.stage;
              return (
                <div
                  key={d.stage}
                  className="flex items-center justify-end"
                  style={{ height: `${100 / data.length}%`, cursor: "pointer" }}
                  onMouseEnter={() => setHovered(d.stage)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="num flex gap-3 pl-3 text-right text-[0.84rem]" style={{ width: M.right }}>
                    <span style={{ width: "50%", color: "var(--accent)", fontWeight: lit ? 700 : 500 }}>
                      {fmtPct(d[FULL])}
                    </span>
                    <span style={{ width: "50%", color: "var(--gold-text)", fontWeight: lit ? 700 : 500 }}>
                      {fmtPct(d[CLEAN])}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="t-small mt-2 lg:hidden">차트를 좌우로 밀면 오른쪽 숫자까지 볼 수 있습니다.</p>

      <p className="t-body m-0 mt-4 min-h-[2.8rem] text-[0.92rem]">
        {on ? (
          <>
            <b style={{ color: "var(--text-primary)" }}>{on.stage}</b>
            <span className="num">
              {" "}{FULL} {fmtPct(on[FULL])} {fmtPeople(on.fullCount)} · {CLEAN} {fmtPct(on[CLEAN])} {fmtPeople(on.cleanCount)}
            </span>
          </>
        ) : (
          <span className="t-small">단계에 마우스를 올리면 두 표본의 인원이 함께 나옵니다. 두 막대는 같은 가로축을 씁니다.</span>
        )}
      </p>
    </div>
  );
}
