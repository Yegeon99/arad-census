import PageShell, { Stagger } from "../components/PageShell.jsx";
import Chart from "../components/Chart.jsx";
import { ActivityMorph, ActivityStream } from "../components/charts/Activity.jsx";
import { ACT_ORDER } from "../lib/palette.js";
import { fmtPct, fmtPeople, fmtPp, pct1 } from "../lib/format.js";
import { activity, actOverall, actAdjusted, dormantLabel, weeklyLabel, verify, capBins, capLowest } from "../lib/data.js";

export default function Activity() {
  const before = Object.fromEntries(ACT_ORDER.map((k) => [k, actOverall[k].pct]));
  const after = actAdjusted;
  const lowest = activity.byFameBin[0];
  const highest = activity.byFameBin[activity.byFameBin.length - 1];

  return (
    <PageShell
      id="activity"
      question="최근 일주일 안에 접속한 캐릭터는 얼마나 될까"
      statNumber={after[dormantLabel]}
      statFormat={pct1}
      statUnit="%"
      statLabel="90일 넘게 기록이 없는 비중, 보정값"
      statNote={`10명 중 6~7명은 90일 넘게 기록이 없습니다(보정값). 보정 전에는 ${fmtPct(before[dormantLabel])}입니다.`}
      intro={
        <aside
          className="mb-10 px-5 py-4"
          style={{ background: "var(--gold-soft)", borderLeft: "3px solid var(--gold)" }}
        >
          <p className="m-0 text-[0.95rem] font-bold" style={{ color: "var(--text-primary)" }}>
            이 화면의 숫자는 나중에 다시 재보고 의심이 생겼습니다
          </p>
          <p className="t-body m-0 mt-2 text-[0.92rem]">
            이 화면의 90일 넘게 기록 없음 비중은 실제보다 부풀었을 수 있습니다.
            명성 점수로 훑는 다른 방법으로 캐릭터 {fmtPeople(verify.meta.sampleSize)}을 다시 재본 결과,
            특히 명성이 낮은 구간에서 그렇습니다. 관측값은 고치지 않고 그대로 두었습니다.{" "}
            <a href="#method">조사 방법과 한계 화면</a>에 자세히 적었습니다.
          </p>
        </aside>
      }
      visual={
        <Chart
          how="막대 하나를 네 칸으로 나눈 것입니다. 왼쪽 칸일수록 최근에 접속한 캐릭터, 오른쪽 칸일수록 오래 접속하지 않은 캐릭터입니다."
          so={`보정하면 최근 7일 안에 접속한 캐릭터가 ${fmtPct(before[weeklyLabel])}에서 ${fmtPct(after[weeklyLabel])}로 줄어듭니다.`}
        >
          <ActivityMorph before={before} after={after} subsample={activity.subsampleSize} />
        </Chart>
      }
      visualCaption="보정 전과 보정 후를 눌러 보면 네 칸의 폭이 바뀝니다."
      explain={[
        {
          label: "판정 기준",
          body: [
            `활성도는 최근 ${activity.lookbackDays}일 사이의 행동 기록으로 판정했습니다.`,
            "마지막 기록이 7일 안이면 최근 7일 접속, 30일 안이면 최근 30일 접속, 90일 안이면 최근 90일 접속, 기록이 하나도 없으면 90일 넘게 기록 없음입니다.",
          ],
        },
        {
          label: "결과",
          body: [
            `보정 전 수치로는 90일 넘게 기록이 없는 캐릭터가 ${fmtPct(before[dormantLabel])}이고 최근 7일 접속이 ${fmtPct(before[weeklyLabel])}입니다.`,
            `보정값으로 바꾸면 각각 ${fmtPct(after[dormantLabel])}와 ${fmtPct(after[weeklyLabel])}가 됩니다. 조용한 쪽이 ${fmtPp(after[dormantLabel] - before[dormantLabel])} 늘어납니다.`,
          ],
        },
        {
          label: "보정한 이유",
          body: [
            "접속 비율은 성장 단계마다 크게 다릅니다. 그래서 어느 단계가 얼마나 많은지가 전체 수치를 좌우합니다.",
            `이 조사가 관측한 구간 비중은 검색 상한 때문에 위쪽으로 기울어 있습니다. 성장 단계 화면의 상한 보정값으로 구간 비중만 바꿔 다시 더한 것이 보정값입니다. 가장 낮은 구간이 ${fmtPct(capLowest.observed)}에서 ${fmtPct(capLowest.corrected)}로 커지면서, 조용한 쪽이 함께 늘어납니다.`,
          ],
        },
        {
          label: "한계",
          body: [
            "두 수치 모두 두 가지 흔들림을 걷어내지 못합니다. 첫째 행동 기록이 남는 빈도가 성장 단계마다 다를 수 있고, 둘째 검색 결과에 최근 접속 여부가 걸려 있는지 확인할 수 없습니다.",
            "접속만 하고 기록을 남기지 않은 캐릭터는 조용한 쪽으로 분류됩니다.",
          ],
        },
      ]}
      details={
        <>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="t-eyebrow m-0 mb-2">보정 전과 보정 후</p>
            <table className="plain">
              <thead>
                <tr><th>접속 상태</th><th className="text-right">보정 전</th><th className="text-right">보정 후</th></tr>
              </thead>
              <tbody>
                {ACT_ORDER.map((k) => (
                  <tr key={k}>
                    <td style={{ color: "var(--text-primary)" }}>{k}</td>
                    <td className="num text-right">
                      {fmtPct(before[k])}
                      <span className="block text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
                        {fmtPeople(actOverall[k].count)}
                      </span>
                    </td>
                    <td className="num text-right" style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtPct(after[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-small mt-3">
              보정값은 구간별 접속 비율에 상한 보정 구간 비중을 곱해 더한 값입니다.
              검색 한도 편향을 아래쪽으로 되돌린 방향의 추정입니다.
            </p>
          </div>
          <div>
            <p className="t-eyebrow m-0 mb-2">보정에 쓴 구간 비중</p>
            <table className="plain">
              <thead>
                <tr><th>성장 단계</th><th className="text-right">관측 비중</th><th className="text-right">상한 보정 비중</th></tr>
              </thead>
              <tbody>
                {capBins.map((b) => (
                  <tr key={b.label}>
                    <td style={{ color: "var(--text-primary)" }}>{b.label}</td>
                    <td className="num text-right">{fmtPct(b.observed)}</td>
                    <td className="num text-right" style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtPct(b.corrected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-small mt-3">
              구간별 접속 비율은 그대로 두고 이 비중만 바꿔 다시 더했습니다.
            </p>
          </div>
        </div>

        {/* 열이 여섯이라 반폭 칸에 넣으면 글자가 잘려 줄바꿈된다. 전체 폭으로 뺀다. */}
        <div className="mt-10">
          <p className="t-eyebrow m-0 mb-2">구간별 인원과 접속 상태</p>
          <div className="scroll-x">
            <table className="plain" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>구간</th><th className="text-right">인원</th>
                  {ACT_ORDER.map((k) => <th key={k} className="text-right">{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {activity.byFameBin.map((b) => (
                  <tr key={b.bin}>
                    <td style={{ color: "var(--text-primary)" }}>
                      {b.bin}
                      {b.smallSample && <span className="t-small" style={{ color: "var(--gold-text)" }}> 표본이 적어 참고용</span>}
                    </td>
                    <td className="num text-right">{fmtPeople(b.n)}</td>
                    {ACT_ORDER.map((k) => <td key={k} className="num text-right">{fmtPct(b.pct[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      }
    >
      <Stagger index={6}>
        <div className="mt-14">
          <h2 className="t-title mb-1 text-[1.3rem]">성장 단계가 올라갈수록 기록이 촘촘해집니다</h2>
          <p className="t-body m-0 mb-4 max-w-[46rem] text-[0.95rem]">
            아래는 여섯 구간을 아래에서 위로 쌓은 그림입니다. 왼쪽으로 갈수록 최근 접속이고 오른쪽으로 갈수록 조용한 쪽입니다.
            맨 아래 {lowest.bin}은 {fmtPeople(lowest.n)} 가운데 {fmtPct(lowest.pct[dormantLabel])}가 90일 넘게 기록이 없고,
            맨 위 {highest.bin}은 {fmtPeople(highest.n)} 전원이 최근 7일 안에 기록을 남겼습니다.
            다만 맨 위 구간은 표본이 적어 참고용으로 봐야 합니다.
          </p>
          <Chart
            how="아래에서 위로 갈수록 높은 성장 단계입니다. 띠가 왼쪽으로 두꺼울수록 최근에 접속한 캐릭터가 많습니다."
            so="성장 단계가 한 칸 오를 때마다 최근 접속 비중이 눈에 띄게 늘어납니다."
          >
            <ActivityStream bins={activity.byFameBin} />
          </Chart>
        </div>
      </Stagger>
    </PageShell>
  );
}
