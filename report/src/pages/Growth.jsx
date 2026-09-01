import PageShell, { Stagger } from "../components/PageShell.jsx";
import Chart from "../components/Chart.jsx";
import MirrorPyramid from "../components/charts/MirrorPyramid.jsx";
import { fmtInt, fmtPct, fmtPeople, fmtPp, pct1 } from "../lib/format.js";
import {
  capBins, capLowest, capGap, capEvidence, fameCompare, finalSample, meta,
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

const OBSERVED = "관측값";
const CORRECTED = "상한 보정값";

export default function Growth() {
  // 보정값의 인원은 비중을 표본에 되돌려 곱한 값이다. 따로 센 인원이 아니다.
  const bins = capBins.map((b) => ({
    label: b.label,
    full: b.observed,
    complete: b.corrected,
    fullCount: b.observedCount,
    completeCount: Math.round((b.corrected / 100) * finalSample),
  }));
  const raidPct = capBins
    .filter((b) => b.label.startsWith("레이드") || b.label.startsWith("하드"))
    .reduce((s, b) => s + b.observed, 0);
  const raidCorrected = capBins
    .filter((b) => b.label.startsWith("레이드") || b.label.startsWith("하드"))
    .reduce((s, b) => s + b.corrected, 0);
  const revealed = capEvidence.stageSplit[0];

  return (
    <PageShell
      id="growth"
      question="레이드까지 온 캐릭터는 몇 명 중 한 명일까"
      statNumber={capLowest.corrected}
      statFormat={pct1}
      statUnit="%"
      statLabel="레기온 입장 전 구간, 상한 보정값"
      statNote={`관측값은 ${fmtPct(capLowest.observed)}입니다. 검색 상한이 가린 몫을 되돌리면 ${fmtPct(capLowest.corrected)}가 됩니다.`}
      intro={
        <section
          className="mb-10 px-6 py-6 lg:px-8"
          style={{ background: "var(--gold-soft)", borderLeft: "3px solid var(--gold)" }}
        >
          <p className="t-eyebrow m-0" style={{ color: "var(--gold-text)" }}>이 화면의 결론</p>
          <p className="t-title m-0 mt-2 text-[1.24rem]">
            실제 유저는 이 조사가 보여주는 것보다 훨씬 아래쪽에 몰려 있습니다.
          </p>
          <p className="t-body m-0 mt-3 max-w-[52rem] text-[0.95rem]">
            검색이 200명에서 잘릴 때 무엇이 잘려 나가는지 직접 재봤습니다.
            잘려 나간 쪽은 거의 전부 성장 초기 캐릭터였습니다.
            그 몫을 되돌리면 레기온 입장 전 구간이 {fmtPct(capLowest.observed)}에서 {fmtPct(capLowest.corrected)}로 올라갑니다.
          </p>
        </section>
      }
      visual={
        <Chart
          how="막대 하나가 성장 단계 하나입니다. 채운 막대가 지금 고른 쪽, 점선 윤곽이 반대쪽입니다. 막대가 길수록 그 단계의 캐릭터가 많습니다."
          so={`관측값으로는 레이드 구간까지 온 캐릭터가 넷 중 한 명꼴이지만, 상한 보정값으로는 여덟 중 한 명꼴로 줄어듭니다.`}
        >
          <MirrorPyramid
            bins={bins}
            gapLabelBin={capLowest.label}
            gapValue={capGap}
            leftLabel={OBSERVED}
            rightLabel={CORRECTED}
            gapText="보정으로 늘어난 몫"
          />
        </Chart>
      }
      visualCaption={`슬라이더를 오른쪽으로 끌면 관측값에서 상한 보정값으로 바뀝니다. 성장을 마친 캐릭터 ${fmtPeople(finalSample)} 기준이고, 보정값의 인원은 비중을 이 표본에 곱해 되돌린 값입니다.`}
      explain={[
        {
          label: "나눈 기준",
          body: [
            "성장 단계는 명성 점수를 컨텐츠 입장 기준으로 여섯 구간에 나눈 것입니다.",
            "구간 경계는 게임 안에서 실제로 입장선이 갈리는 지점을 그대로 썼습니다.",
          ],
        },
        {
          label: "관측값",
          body: [
            `실제로 받아 센 값입니다. 레기온 입장 전 구간이 ${fmtPct(capLowest.observed)}이고 레이드 진입 구간이 ${fmtPct(raidPct)}입니다.`,
            "이 값은 검색이 200명에서 잘린 결과를 그대로 담고 있습니다.",
          ],
        },
        {
          label: "상한 보정값",
          body: [
            `잘린 검색이 가리고 있던 몫을 되돌려 다시 잡은 값입니다. 레기온 입장 전 구간이 ${fmtPct(capLowest.corrected)}로 오르고 레이드 진입 구간은 ${fmtPct(raidCorrected)}로 내려갑니다.`,
            `차이는 ${fmtPp(capGap)}입니다. 이 조사에서 가장 큰 편향이 어느 방향으로 얼마나 작용했는지를 보여 주는 값입니다.`,
          ],
        },
        {
          label: "한계",
          body: [
            `보정값은 검색 조합 ${fmtInt(capEvidence.sampledCombos)}개에서 잰 배수를 상한에 걸린 조합 ${fmtInt(capEvidence.limitedCombosTotal)}개 전체에 적용한 추정입니다. 표본 밖의 조합도 같은 구성일 것으로 두고 계산했습니다.`,
            `쪼갠 뒤에도 ${fmtPct(capEvidence.stillLimitedPct)}는 여전히 상한에 걸려 있었습니다. 그만큼은 보정 뒤에도 실제보다 적게 잡혔을 수 있습니다.`,
            `명성 점수가 없어 분포에서 뺀 캐릭터 ${fmtPeople(meta.fameMissing)} 가운데 ${fmtPct(missingLowLevel.pct)}가 레벨 100 미만입니다. 아래쪽이 더 많이 빠졌습니다.`,
          ],
        },
      ]}
      details={
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="t-eyebrow m-0 mb-2">구간 경계와 인원</p>
            <div className="scroll-x">
              <table className="plain" style={{ minWidth: 460 }}>
                <thead>
                  <tr><th>구간</th><th>기준</th><th className="text-right">관측값</th><th className="text-right">상한 보정값</th></tr>
                </thead>
                <tbody>
                  {capBins.map((b, i) => (
                    <tr key={b.label}>
                      <td style={{ color: "var(--text-primary)" }}>{b.label}</td>
                      <td className="num text-[0.8125rem]">{CUT_NOTE[i][1]}</td>
                      <td className="num text-right">{fmtPct(b.observed)}<br /><span style={{ color: "var(--text-muted)" }}>{fmtPeople(b.observedCount)}</span></td>
                      <td className="num text-right" style={{ color: "var(--gold-text)", fontWeight: 600 }}>{fmtPct(b.corrected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="t-small mt-3">
              한 번도 상한에 걸리지 않은 검색에서만 모은 캐릭터로 따로 세면 레기온 입장 전 구간이 {fmtPct(fameCompare[0].complete)}입니다.
              이 값도 같은 방향을 가리킵니다.
            </p>
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
          <h2 className="t-title mb-1 text-[1.3rem]">보정값의 근거</h2>
          <p className="t-body m-0 mb-6 max-w-[46rem] text-[0.95rem]">
            상한에 걸린 검색 {fmtInt(capEvidence.sampledCombos)}개를 골라 직업군으로 쪼개 다시 받아 봤습니다.
            한 번에 {fmtInt(capEvidence.limit)}명까지만 오던 검색을 열여덟 갈래로 나누어 부르면 상한을 넘겨 받을 수 있습니다.
          </p>

          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
            {[
              {
                value: `${fmtInt(capEvidence.avgAfterSplit)}명`,
                label: "쪼갠 뒤 한 조합당 평균",
                note: `쪼개기 전에는 ${fmtInt(capEvidence.limit)}명에서 멈췄습니다. ${capEvidence.multiplier.toFixed(2)}배이고 95% 구간은 ${capEvidence.multiplierLow.toFixed(2)}에서 ${capEvidence.multiplierHigh.toFixed(2)}입니다.`,
              },
              {
                value: fmtPct(revealed.revealed),
                label: "새로 드러난 캐릭터 중 레기온 입장 전",
                note: `원래 ${fmtInt(capEvidence.limit)}명 안에서는 ${fmtPct(revealed.inside)}였습니다. 가려져 있던 쪽이 어디에 몰려 있었는지 그대로 보여 줍니다.`,
              },
              {
                value: fmtPct(capEvidence.stillLimitedPct),
                label: "쪼갠 뒤에도 상한에 걸린 비율",
                note: "쪼개도 상한을 못 벗어날 것으로 봤는데 실제로는 이만큼만 남았습니다. 예측이 틀렸습니다.",
              },
            ].map((c) => (
              <div key={c.label} className="pt-4" style={{ borderTop: "1px solid var(--hairline-strong)" }}>
                <p className="num m-0 text-[1.9rem] font-bold leading-none" style={{ color: "var(--gold-text)" }}>{c.value}</p>
                <p className="m-0 mt-2 text-[0.95rem] font-bold" style={{ color: "var(--text-primary)" }}>{c.label}</p>
                <p className="t-body m-0 mt-1 text-[0.9rem]">{c.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <p className="t-eyebrow m-0 mb-2">원래 잡히던 캐릭터와 새로 드러난 캐릭터</p>
            <div className="scroll-x">
              <table className="plain" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th>성장 단계</th>
                    <th className="text-right">원래 {fmtInt(capEvidence.limit)}명 안</th>
                    <th className="text-right">새로 드러남</th>
                    <th className="text-right">차이</th>
                  </tr>
                </thead>
                <tbody>
                  {capEvidence.stageSplit.map((r) => (
                    <tr key={r.label}>
                      <td style={{ color: "var(--text-primary)" }}>{r.label}</td>
                      <td className="num text-right">{fmtPct(r.inside)}</td>
                      <td className="num text-right">{fmtPct(r.revealed)}</td>
                      <td className="num text-right" style={{ color: Math.abs(r.diff) >= 2 ? "var(--gold-text)" : "var(--text-secondary)" }}>
                        {r.diff > 0 ? "+" : ""}{fmtPp(r.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="t-small mt-3 max-w-[46rem]">
              원래 잡히던 캐릭터 {fmtPeople(capEvidence.oldCount)}과 새로 드러난 캐릭터 {fmtPeople(capEvidence.newCount)}을 견준 것입니다.
              검색이 잘릴 때 낮은 명성 캐릭터가 먼저 잘린다는 뜻입니다.
            </p>
          </div>
        </div>
      </Stagger>
    </PageShell>
  );
}
