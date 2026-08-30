import PageShell, { Stagger } from "../components/PageShell.jsx";
import Chart from "../components/Chart.jsx";
import MirrorPyramid from "../components/charts/MirrorPyramid.jsx";
import FameHistogram from "../components/charts/FameHistogram.jsx";
import { fmtPct, fmtPeople, fmtPp, pct1 } from "../lib/format.js";
import {
  fameCompare, pyramidGap, fameSample, completeFameSample, meta, histogram,
  missingLowLevel, dist,
} from "../lib/data.js";

const CUT_NOTE = [
  ["레기온 입장 전", "명성 0 이상 73,993 미만"],
  ["아포칼립스 입장", "명성 73,993 이상 91,582 미만"],
  ["상급 던전 구간", "명성 91,582 이상 104,292 미만"],
  ["레이드 입장 구간", "명성 104,292 이상 117,014 미만"],
  ["레이드 권장 구간", "명성 117,014 이상 124,000 미만"],
  ["하드 권장 구간", "명성 124,000 이상"],
];

export default function Growth() {
  const raidEntry = fameCompare.filter((b) => b.label.startsWith("레이드") || b.label.startsWith("하드"));
  const raidPct = raidEntry.reduce((s, b) => s + b.full, 0);

  return (
    <PageShell
      id="growth"
      question="레이드까지 온 캐릭터는 몇 명 중 한 명일까"
      statNumber={pyramidGap}
      statFormat={pct1}
      statUnit="%포인트"
      statLabel="레기온 입장 전 구간 비중의 차이"
      statNote="전체 표본과 쏠림 없는 표본 사이"
      visual={
        <Chart
          how="막대 하나가 성장 단계 하나입니다. 채운 막대가 지금 고른 표본, 점선 윤곽이 반대쪽 표본입니다. 막대가 길수록 그 단계의 캐릭터가 많습니다."
          so="레이드 구간까지 온 캐릭터는 전체 표본에서 넷 중 한 명꼴, 쏠림 없는 표본에서는 열여섯 중 한 명꼴입니다."
        >
          <MirrorPyramid bins={fameCompare} gapLabelBin={fameCompare[0].label} gapValue={pyramidGap} />
        </Chart>
      }
      visualCaption={`슬라이더를 오른쪽으로 끌면 전체 표본 ${fmtPeople(fameSample)}에서 쏠림 없는 표본 ${fmtPeople(completeFameSample)}으로 바뀝니다. 명성 점수가 있는 캐릭터만 넣었습니다.`}
      explain={[
        {
          label: "나눈 기준",
          body: [
            "성장 단계는 명성 점수를 컨텐츠 입장 기준으로 여섯 구간에 나눈 것입니다.",
            "구간 경계는 게임 안에서 실제로 입장선이 갈리는 지점을 그대로 썼습니다.",
          ],
        },
        {
          label: "결과",
          body: [
            `전체 표본에서는 레기온 입장 전 구간이 ${fmtPct(fameCompare[0].full)}이고 레이드 진입 구간이 ${fmtPct(raidPct)}입니다.`,
            `쏠림 없는 표본 보면 레기온 입장 전 구간이 ${fmtPct(fameCompare[0].complete)}로 뛰어오릅니다. 차이는 ${fmtPp(pyramidGap)}입니다.`,
          ],
        },
        {
          label: "차이가 나는 이유",
          body: [
            "검색이 200명 한도에 걸리면 어떤 200명이 돌아오는지 공개되어 있지 않은데, 실제로 받아 보면 성장이 앞선 쪽으로 크게 쏠립니다.",
            "한도에 걸리지 않은 검색만 모으면 훨씬 아래쪽이 두껍습니다.",
          ],
        },
        {
          label: "한계",
          body: [
            `명성 점수가 없어 분포에서 뺀 캐릭터는 ${fmtPeople(meta.fameMissing)}입니다.`,
            `이 가운데 ${fmtPct(missingLowLevel.pct)}가 레벨 100 미만이라, 이들을 뺀 것만으로도 피라미드가 조금 더 위로 기울었을 가능성이 있습니다.`,
          ],
        },
      ]}
      details={
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="t-eyebrow m-0 mb-2">구간 경계와 인원</p>
            <table className="plain">
              <thead>
                <tr><th>구간</th><th>기준</th><th className="text-right">전체 표본</th><th className="text-right">쏠림 없는 검색</th></tr>
              </thead>
              <tbody>
                {fameCompare.map((b, i) => (
                  <tr key={b.label}>
                    <td style={{ color: "var(--text-primary)" }}>{b.label}</td>
                    <td className="num text-[0.78rem]">{CUT_NOTE[i][1]}</td>
                    <td className="num text-right">{fmtPct(b.full)}<br /><span style={{ color: "var(--text-muted)" }}>{fmtPeople(b.fullCount)}</span></td>
                    <td className="num text-right">{fmtPct(b.complete)}<br /><span style={{ color: "var(--text-muted)" }}>{fmtPeople(b.completeCount)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="t-eyebrow m-0 mb-2">명성 점수가 없는 캐릭터의 레벨 분포</p>
            <table className="plain">
              <thead>
                <tr><th>레벨</th><th className="text-right">인원</th></tr>
              </thead>
              <tbody>
                {meta.fameMissingLevels.map((r) => (
                  <tr key={r.range}>
                    <td className="num">{r.range}</td>
                    <td className="num text-right">{fmtPeople(r.count)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ color: "var(--text-primary)" }}>합계</td>
                  <td className="num text-right" style={{ color: "var(--text-primary)" }}>{fmtPeople(meta.fameMissing)}</td>
                </tr>
              </tbody>
            </table>
            <p className="t-small mt-3">
              각성 단계별로 보면 진 각성이 {fmtPct(dist.stage.find((s) => s.stage === "眞").pct)}입니다.
              성장 단계 분포와 같은 방향으로 위쪽에 몰려 있습니다.
            </p>
          </div>
        </div>
      }
    >
      <Stagger index={6}>
        <div className="mt-14">
          <h2 className="t-title mb-1 text-[1.3rem]">구간 경계의 근거</h2>
          <p className="t-body m-0 mb-4 max-w-[46rem] text-[0.95rem]">
            명성 점수를 1만 단위로 끊어 세면 여섯 단계를 나눈 기준이 어디에 놓였는지 보입니다.
          </p>
          <Chart
            how="가로축은 명성 점수, 세로축은 그 점수대에 있는 캐릭터의 비중입니다. 점선은 여섯 단계를 나눌 때 쓴 콘텐츠 입장 기준입니다."
            so="캐릭터가 가장 많이 몰린 명성은 7만대이고, 레기온 입장선 바로 위입니다."
          >
            <FameHistogram data={histogram.full} cuts={histogram.cuts} binWidth={histogram.binWidth} />
          </Chart>
        </div>
      </Stagger>
    </PageShell>
  );
}
