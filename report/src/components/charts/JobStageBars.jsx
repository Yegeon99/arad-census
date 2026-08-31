import { useMemo, useState } from "react";
import BarChart from "./bar-chart.tsx";
import Bar from "./bar.tsx";
import BarYAxis from "./bar-y-axis.tsx";
import { BIN_COLOR, BIN_ORDER } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { useReducedMotion, CHART_MS } from "../../lib/hooks.js";

// 레이드 진입으로 치는 구간 (위 세 단계)
const RAID_BINS = BIN_ORDER.slice(3);
const ROW_H = 30;
const M = { top: 4, right: 92, bottom: 30, left: 104 };

/**
 * 직업 20종의 성장 단계 구성. 한 줄이 직업 하나이고, 줄 전체가 그 직업의 100%다.
 * 줄은 레이드 진입 비중 순으로 세워 두어 위아래를 그냥 훑기만 해도 순서가 읽힌다.
 */
export default function JobStageBars({ rows, cellCount, cellShare, selected, setSelected }) {
  const [hovered, setHovered] = useState(null);
  // Bklit 차트는 움직임 최소화 설정을 스스로 보지 않는다. 여기서 꺼 준다.
  const reduced = useReducedMotion();

  const data = useMemo(() => {
    const built = rows.map((job) => {
      const row = { job };
      BIN_ORDER.forEach((bin) => { row[bin] = cellShare(job, bin) * 100; });
      row.raid = RAID_BINS.reduce((s, bin) => s + row[bin], 0);
      row.masked = BIN_ORDER.some((bin) => cellCount(job, bin) === null);
      return row;
    });
    return built.sort((a, b) => b.raid - a.raid);
  }, [rows, cellCount, cellShare]);

  const height = data.length * ROW_H + M.top + M.bottom;
  const active = hovered ?? selected;
  const activeRow = data.find((d) => d.job === active);

  return (
    <div>
      <div className="scroll-x">
        <div className="relative" style={{ minWidth: 640 }}>
          <BarChart
            data={data}
            xDataKey="job"
            orientation="horizontal"
            stacked
            stackGap={2}
            barGap={0.24}
            margin={M}
            animationDuration={reduced ? 0 : CHART_MS}
            className="!aspect-auto"
            style={{ height }}
          >
            {BIN_ORDER.map((bin) => (
              <Bar key={bin} dataKey={bin} fill={BIN_COLOR[bin]} lineCap="butt" fadedOpacity={0.28} animate={!reduced} />
            ))}
            <BarYAxis />
          </BarChart>

          {/* 막대와 같은 높이로 나눈 칸이라 줄 위치가 정확히 맞는다.
              왼쪽은 눌러서 고르는 자리, 오른쪽은 레이드 진입 비중이다. */}
          <div className="absolute inset-x-0" style={{ top: M.top, bottom: M.bottom }}>
            {data.map((d) => {
              const on = active === d.job;
              return (
                <div
                  key={d.job}
                  className="flex items-center justify-between"
                  style={{ height: `${100 / data.length}%`, cursor: "pointer" }}
                  onMouseEnter={() => setHovered(d.job)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(selected === d.job ? null : d.job)}
                >
                  <span style={{ width: M.left }} aria-hidden="true" />
                  <span
                    className="num pl-3 text-[0.82rem]"
                    style={{
                      width: M.right,
                      color: on ? "var(--accent)" : "var(--text-secondary)",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {fmtPct(d.raid)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="t-small mt-2 lg:hidden">차트를 좌우로 밀면 오른쪽 숫자까지 볼 수 있습니다.</p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="t-small m-0" style={{ color: "var(--text-muted)" }}>오른쪽 숫자</span>
        <span className="t-small m-0">레이드 진입 세 단계를 합한 비중입니다. 큰 순서로 세워 두었습니다.</span>
      </div>

      <p className="t-body m-0 mt-4 min-h-[3.4rem] text-[0.92rem]">
        {activeRow ? (
          <>
            <b style={{ color: "var(--text-primary)" }}>{activeRow.job}</b>
            <span className="num">
              {" "}레이드 진입 {fmtPct(activeRow.raid)} ·{" "}
              {BIN_ORDER.map((bin) => {
                const v = cellCount(activeRow.job, bin);
                return `${bin} ${v === null ? "공개 안 함" : fmtPeople(v)}`;
              }).join(", ")}
            </span>
          </>
        ) : (
          <span className="t-small">줄에 마우스를 올리면 그 직업의 구간별 인원이 나옵니다. 누르면 그 줄만 남습니다.</span>
        )}
      </p>
    </div>
  );
}
