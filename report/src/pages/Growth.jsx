import PageShell, { Stagger } from "../components/PageShell.jsx";
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
      question="이 페이지가 답하는 질문은 하나입니다. 캐릭터들은 성장 단계 어디쯤에 몰려 있습니까?"
      statValue={pct1(pyramidGap)}
      statUnit="%포인트"
      statLabel="레기온 입장 전 구간 비중의 차이"
      statNote="전체 표본과 완전 검색 표본 사이"
      visual={
        <MirrorPyramid bins={fameCompare} gapLabelBin={fameCompare[0].label} gapValue={pyramidGap} />
      }
      visualCaption={`슬라이더를 오른쪽으로 끌면 전체 표본 ${fmtPeople(fameSample)}에서 완전 검색 표본 ${fmtPeople(completeFameSample)}으로 바뀝니다. 명성값이 있는 캐릭터만 넣었습니다.`}
      explain={[
        "성장 단계는 명성값을 컨텐츠 입장 기준으로 여섯 구간에 나눈 것입니다. 구간 경계는 게임 안에서 실제로 입장선이 갈리는 지점을 그대로 썼습니다.",
        `전체 표본에서는 레기온 입장 전 구간이 ${fmtPct(fameCompare[0].full)}이고 레이드 진입 구간이 ${fmtPct(raidPct)}입니다. 그런데 완전 검색 표본만 보면 레기온 입장 전 구간이 ${fmtPct(fameCompare[0].complete)}로 뛰어오릅니다. 차이는 ${fmtPp(pyramidGap)}입니다.`,
        `이 차이는 검색 방식에서 옵니다. 검색이 200명 한도에 걸리면 어떤 200명이 돌아오는지 공개되어 있지 않은데, 실제로 받아 보면 성장이 앞선 쪽으로 크게 쏠립니다. 한도에 걸리지 않은 검색만 모으면 훨씬 아래쪽이 두껍습니다.`,
        `명성값이 없어 분포에서 뺀 캐릭터는 ${fmtPeople(meta.fameMissing)}입니다. 이 가운데 ${fmtPct(missingLowLevel.pct)}가 레벨 100 미만이라, 이들을 뺀 것만으로도 피라미드가 조금 더 위로 기울었을 가능성이 있습니다.`,
      ]}
      details={
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="t-eyebrow m-0 mb-2">구간 경계와 인원</p>
            <table className="plain">
              <thead>
                <tr><th>구간</th><th>기준</th><th className="text-right">전체 표본</th><th className="text-right">완전 검색</th></tr>
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
            <p className="t-eyebrow m-0 mb-2">명성값이 없는 캐릭터의 레벨 분포</p>
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
          <h2 className="t-title mb-1 text-[1.3rem]">구간 경계는 어디에서 왔습니까</h2>
          <p className="t-body m-0 mb-4 max-w-[46rem] text-[0.95rem]">
            아래는 명성값을 1만 단위로 끊어 센 히스토그램입니다. 세로 기준선은 여섯 구간을 나눌 때 쓴 컨텐츠 입장값입니다.
            가장 높은 막대는 명성 7만에서 8만 사이 구간이고, 아포칼립스 입장 기준선이 그 안을 지납니다.
          </p>
          <FameHistogram data={histogram.full} cuts={histogram.cuts} binWidth={histogram.binWidth} />
        </div>
      </Stagger>
    </PageShell>
  );
}
