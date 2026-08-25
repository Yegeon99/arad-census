import PageShell, { Stagger } from "../components/PageShell.jsx";
import { ActivityMorph, ActivityStream } from "../components/charts/Activity.jsx";
import { ACT_ORDER } from "../lib/palette.js";
import { fmtPct, fmtPeople, fmtPp, pct1 } from "../lib/format.js";
import { activity, actOverall, actAdjusted, dormantLabel, weeklyLabel } from "../lib/data.js";

export default function Activity() {
  const before = Object.fromEntries(ACT_ORDER.map((k) => [k, actOverall[k].pct]));
  const after = actAdjusted;
  const discovery = activity.byDiscovery;
  const lowest = activity.byFameBin[0];
  const highest = activity.byFameBin[activity.byFameBin.length - 1];

  return (
    <PageShell
      id="activity"
      question="이 페이지가 답하는 질문은 하나입니다. 캐릭터들은 최근에 얼마나 접속했습니까?"
      statValue={pct1(after[dormantLabel])}
      statUnit="%"
      statLabel="90일 넘게 기록이 없는 비중, 편향 보정값"
      statNote={`보정 전에는 ${fmtPct(before[dormantLabel])}입니다`}
      visual={<ActivityMorph before={before} after={after} subsample={activity.subsampleSize} />}
      visualCaption="보정 전과 보정 후를 눌러 보면 네 칸의 폭이 바뀝니다. 칸 하나하나가 접속 상태 한 가지입니다."
      explain={[
        `활성도는 최근 ${activity.lookbackDays}일 사이의 행동 기록으로 판정했습니다. 마지막 기록이 7일 안이면 최근 7일 접속, 30일 안이면 최근 30일 접속, 90일 안이면 최근 90일 접속, 기록이 하나도 없으면 90일 넘게 기록 없음입니다.`,
        `보정 전 수치로는 90일 넘게 기록이 없는 캐릭터가 ${fmtPct(before[dormantLabel])}이고 최근 7일 접속이 ${fmtPct(before[weeklyLabel])}입니다. 편향 보정값으로 바꾸면 각각 ${fmtPct(after[dormantLabel])}와 ${fmtPct(after[weeklyLabel])}가 됩니다. 조용한 쪽이 ${fmtPp(after[dormantLabel] - before[dormantLabel])} 늘어납니다.`,
        `보정의 근거는 발견 경로 차이입니다. 완전 검색에서도 발견된 ${fmtPeople(discovery.complete.n)} 가운데 90일 넘게 기록이 없는 비중은 ${fmtPct(discovery.complete.pct[dormantLabel])}인데, 한도 검색에서만 발견된 ${fmtPeople(discovery.limited.n)}에서는 ${fmtPct(discovery.limited.pct[dormantLabel])}입니다.`,
        "두 수치 모두 두 가지 흔들림을 걷어내지 못합니다. 첫째 행동 기록이 남는 빈도가 성장 단계마다 다를 수 있고, 둘째 검색 결과에 최근 접속 여부가 걸려 있는지 확인할 수 없습니다. 접속만 하고 기록을 남기지 않은 캐릭터는 조용한 쪽으로 분류됩니다.",
      ]}
      details={
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
                      {fmtPct(before[k])} <span style={{ color: "var(--text-muted)" }}>{fmtPeople(actOverall[k].count)}</span>
                    </td>
                    <td className="num text-right" style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtPct(after[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-small mt-3">
              보정값은 명성 구간별 접속 비율에 완전 검색 표본의 구간 비중을 곱해 더한 값입니다.
              검색 한도 편향을 아래쪽으로 되돌린 방향의 추정입니다.
            </p>
          </div>
          <div>
            <p className="t-eyebrow m-0 mb-2">발견 경로별 비교</p>
            <table className="plain">
              <thead>
                <tr><th>발견 경로</th><th className="text-right">인원</th><th className="text-right">90일 넘게 기록 없음</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: "var(--text-primary)" }}>완전 검색에서도 발견</td>
                  <td className="num text-right">{fmtPeople(discovery.complete.n)}</td>
                  <td className="num text-right">{fmtPct(discovery.complete.pct[dormantLabel])}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-primary)" }}>한도 검색에서만 발견</td>
                  <td className="num text-right">{fmtPeople(discovery.limited.n)}</td>
                  <td className="num text-right">{fmtPct(discovery.limited.pct[dormantLabel])}</td>
                </tr>
              </tbody>
            </table>

            <p className="t-eyebrow m-0 mb-2 mt-8">구간별 인원과 접속 상태</p>
            <div className="scroll-x">
              <table className="plain">
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
        </div>
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
          <ActivityStream bins={activity.byFameBin} />
        </div>
      </Stagger>
    </PageShell>
  );
}
