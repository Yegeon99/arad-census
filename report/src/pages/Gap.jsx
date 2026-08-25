import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import ViewToggle from "../components/ViewToggle.jsx";
import Heatmap from "../components/charts/Heatmap.jsx";
import IndexBars from "../components/charts/IndexBars.jsx";
import { LazyJobTerrain } from "../components/three/Lazy.jsx";
import { BIN_ORDER } from "../lib/palette.js";
import { useCanRender3D, useIdleMount } from "../lib/hooks.js";
import { fmtPct, fmtPeople, fmtX, topicParticle, withParticle } from "../lib/format.js";
import {
  jobFameRows, cellCount, cellShare, rowTotal, raidIndex, overallRaidShare, meta,
} from "../lib/data.js";

export default function Gap() {
  const can3D = useCanRender3D();
  const idle = useIdleMount();
  const [mode, setMode] = useState("solid");
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const effective = can3D && idle && mode === "solid" ? "solid" : "flat";

  const best = raidIndex.top[0];
  const worst = raidIndex.bottom[0];

  const flatHeatmap = (
    <Heatmap
      rows={jobFameRows}
      cols={BIN_ORDER}
      cellCount={cellCount}
      cellShare={cellShare}
      rowTotal={rowTotal}
      selected={selected}
      setSelected={setSelected}
    />
  );

  return (
    <PageShell
      id="gap"
      question="이 페이지가 답하는 질문은 하나입니다. 직업에 따라 성장 단계 구성이 얼마나 다릅니까?"
      statValue={(best.index / worst.index).toFixed(2)}
      statUnit="배"
      statLabel="레이드 진입 비중이 가장 높은 직업과 가장 낮은 직업의 배수"
      statNote={`${withParticle(best.job)} ${worst.job} 사이`}
      visual={
        <div>
          <ViewToggle mode={effective} setMode={setMode} available={can3D} />
          {effective === "solid" ? (
            <LazyJobTerrain
              rows={jobFameRows}
              cellCount={cellCount}
              cellShare={cellShare}
              selected={selected}
              setSelected={setSelected}
              hovered={hovered}
              onHover={setHovered}
              fallback={flatHeatmap}
            />
          ) : flatHeatmap}
        </div>
      }
      visualCaption={`인원이 많은 직업 20종을 가로로, 성장 단계 여섯 구간을 세로로 놓았습니다. 막대 높이와 칸 색은 그 직업 안에서 해당 구간이 차지하는 비중입니다. ${selected ? `${selected}만 골라 놓았습니다. 다시 누르면 전체로 돌아갑니다.` : "직업을 누르면 그 줄만 남습니다."}`}
      explain={[
        "같은 표본 안에서도 직업마다 성장 단계 구성이 크게 다릅니다. 어떤 직업은 레이드 진입 구간에 몰려 있고, 어떤 직업은 레기온 입장 전 구간에 몰려 있습니다.",
        `레이드 진입 구간은 레이드 입장 구간, 레이드 권장 구간, 하드 권장 구간을 합친 것입니다. 표본 전체 평균은 ${fmtPct(overallRaidShare * 100)}이고, 이 값을 1.00으로 두고 직업별 비중을 나눈 값이 아래 지수입니다.`,
        `가장 높은 ${topicParticle(best.job)} ${fmtX(best.index)}로 평균보다 높고, 가장 낮은 ${topicParticle(worst.job)} ${fmtX(worst.index)}로 평균보다 낮습니다. 명성값이 있는 표본이 300명 이상인 직업만 지수를 냈습니다.`,
        `표본이 10명이 되지 않는 칸은 공개하지 않으므로, 그 칸이 있는 직업의 합계는 실제보다 작게 잡힌 하한값입니다. 전체 표본 ${fmtPeople(meta.sampleSize)}을 기준으로 한 표본 안의 비교이며, 게임 전체 인구의 직업별 성장 수준이 아닙니다.`,
      ]}
      details={
        <div>
          <p className="t-eyebrow m-0 mb-2">직업 20종과 구간별 인원</p>
          <div className="scroll-x">
            <table className="plain" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>직업</th>
                  {BIN_ORDER.map((b) => <th key={b} className="text-right">{b}</th>)}
                  <th className="text-right">합계</th>
                </tr>
              </thead>
              <tbody>
                {jobFameRows.map((job) => (
                  <tr key={job}>
                    <td style={{ color: "var(--text-primary)" }}>{job}</td>
                    {BIN_ORDER.map((b) => {
                      const v = cellCount(job, b);
                      return (
                        <td key={b} className="num text-right">
                          {v === null ? <span style={{ color: "var(--text-muted)" }}>공개 안 함</span> : v.toLocaleString("ko-KR")}
                        </td>
                      );
                    })}
                    <td className="num text-right">{rowTotal(job).toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-small mt-3">
            표본이 10명이 되지 않는 칸은 공개하지 않습니다. 합계는 공개한 칸만 더한 값입니다.
          </p>
        </div>
      }
    >
      <Stagger index={6}>
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <IndexBars title={`레이드 진입 비중이 평균보다 높은 직업 다섯`} rows={raidIndex.top} />
          <IndexBars title={`레이드 진입 비중이 평균보다 낮은 직업 다섯`} rows={raidIndex.bottom} />
        </div>
        <p className="t-small mt-3 max-w-[46rem]">
          가운데 선이 표본 평균 {fmtPct(overallRaidShare * 100)}입니다. 오른쪽으로 뻗으면 평균보다 높고 왼쪽으로 뻗으면 평균보다 낮습니다.
          오른쪽 끝 숫자는 그 직업의 레이드 진입 비중과 명성값이 있는 표본 인원입니다.
        </p>
      </Stagger>
    </PageShell>
  );
}
