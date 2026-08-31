import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import FlowDiagram from "../components/charts/FlowDiagram.jsx";
import { fmtInt, fmtPct, fmtPeople, fmtPp, pct1 } from "../lib/format.js";
import {
  meta, activity, seedStats, limitedRatio, MEASURED, fameCompare, missingLowLevel, verify, dormGap,
} from "../lib/data.js";

const TABS = [
  { key: "design", label: "표본 설계" },
  { key: "verify", label: "다시 재본 결과" },
  { key: "bias", label: "편향과 확인 불가 항목" },
  { key: "ethics", label: "개인정보와 실측치" },
];

/** 두 방법을 나란히 놓는 대조표. 1차 조사 수치는 그대로 두고 옆에 붙이기만 한다. */
function CompareTable({ head, rows, labelKey }) {
  return (
    <div className="scroll-x">
      <table className="plain" style={{ minWidth: 460 }}>
        <thead>
          <tr>
            <th>{head}</th>
            <th className="text-right">이름으로 찾은 조사</th>
            <th className="text-right">명성으로 훑은 조사</th>
            <th className="text-right">차이</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[labelKey]}>
              <td style={{ color: "var(--text-primary)" }}>{r[labelKey]}</td>
              <td className="num text-right">{fmtPct(r.first)}</td>
              <td className="num text-right">{fmtPct(r.verified)}</td>
              <td className="num text-right" style={{ color: Math.abs(r.diff) >= 2 ? "var(--gold-text)" : "var(--text-secondary)" }}>
                {r.diff > 0 ? "+" : ""}{fmtPp(r.diff)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h3 className="t-title m-0 mb-3 text-[1.12rem]">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="m-0 list-none p-0">
      {items.map(([head, body]) => (
        <li key={head} className="py-3" style={{ borderTop: "1px solid var(--hairline)" }}>
          <p className="m-0 text-[0.95rem] font-semibold" style={{ color: "var(--text-primary)" }}>{head}</p>
          <p className="t-body m-0 mt-1 text-[0.92rem]">{body}</p>
        </li>
      ))}
    </ul>
  );
}

export default function Method() {
  const [tab, setTab] = useState("design");
  const smallestBin = Math.min(...activity.byFameBin.map((b) => b.n));

  const steps = [
    {
      title: "시드 검색",
      body: `한국어 두 글자 ${seedStats.seeds}개를 서버 ${meta.servers.length}곳의 캐릭터 이름 포함 검색에 넣었습니다. 절반은 흔한 조합, 절반은 드문 조합입니다.`,
      measured: `검색 ${fmtInt(seedStats.calls)}회`,
    },
    {
      title: "한도 판정",
      body: "검색 결과가 200명 한도에 걸렸는지 매 호출마다 기록했습니다. 한도에 걸린 검색은 일부만 받은 것입니다.",
      measured: `잘린 검색 ${fmtInt(meta.searchCallsLimited)}회, ${fmtPct(limitedRatio)}`,
    },
    {
      title: "중복 제거",
      body: "서버와 캐릭터 기준으로 겹치는 결과를 하나로 정리해 표본을 확정했습니다. 검색 응답에 직업과 레벨, 명성이 함께 오므로 캐릭터마다 따로 묻지 않았습니다.",
      measured: `표본 ${fmtPeople(meta.sampleSize)}`,
    },
    {
      title: "쏠림 없는 표본 분리",
      body: "한도에 걸리지 않은 검색에서 한 번이라도 나온 캐릭터를 따로 모아 별도 분포를 냈습니다. 검색 한도가 만드는 기울기를 재는 잣대입니다.",
      measured: `쏠림 없는 표본 ${fmtPeople(meta.completeSampleSize)}`,
    },
    {
      title: "활성도 조사",
      body: `명성 여섯 구간에 비례해 뽑은 캐릭터의 최근 ${activity.lookbackDays}일 기록을 확인했습니다. 캐릭터마다 요청 한 번입니다.`,
      measured: `조사 ${fmtPeople(activity.subsampleSize)}`,
    },
  ];

  return (
    <PageShell
      id="method"
      question="이 숫자를 어디까지 믿어도 될까"
      statNumber={limitedRatio}
      statFormat={pct1}
      statUnit="%"
      statLabel="200명 한도에 걸린 검색의 비중"
      statNote="이 조사에서 가장 큰 편향의 출처입니다"
      visual={
        <div>
          <div className="mb-6 flex flex-wrap gap-5">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button key={t.key} type="button" className="disclose" onClick={() => setTab(t.key)}
                  style={{ color: on ? "var(--text-primary)" : "var(--accent)", fontWeight: on ? 700 : 450, textDecoration: on ? "none" : "underline" }}>
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "design" && (
            <Stagger index={0}>
              <FlowDiagram steps={steps} />
              <Section title="직업 이름을 맞춘 방법">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">직업 이름은 전직 단계를 하나로 합쳐 최종 전직명으로 맞추었습니다.</p>
                  <p className="m-0">
                    다크나이트와 크리에이터는 각성 이후 이름이 같은 값으로 돌아오기 때문에 어느 쪽 캐릭터인지 가릴 수 없습니다.
                    원본 표본을 이미 폐기해 뒤늦게 나눌 방법도 없어, 이 두 직업은 직업별 분석에서 빼고 합산 항목에 넣었습니다.
                  </p>
                  <p className="m-0">
                    표본이 10명이 되지 않는 직업도 같은 항목으로 묶었습니다.
                    교차표에서 표본이 10명이 되지 않는 칸은 공개하지 않습니다.
                  </p>
                </div>
              </Section>
              <Section title="인사이트를 만든 방법">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">집계 결과 전체와 편향 노트를 한 번에 넣어 배치로 생성했습니다.</p>
                  <p className="m-0">
                    문장을 다시 쓸 때에는 각 항목이 쓸 수 있는 수치를 미리 정해 두고, 그 밖의 숫자가 들어오면 저장을 멈추게 했습니다.
                  </p>
                  <p className="m-0">생성 뒤에는 모든 숫자를 집계 원본과 하나씩 맞추어 보았습니다.</p>
                </div>
              </Section>
              <Section title="직업 순위를 성장 완료 캐릭터로 좁힌 이유">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    직업 순위와 직업별 성장 구성은 마지막 전직을 마친 캐릭터만 세었습니다.
                    막 만들어 아직 전직 중인 캐릭터가 섞이면 지금 실제로 플레이되는 직업이 가려지기 때문입니다.
                  </p>
                  <p className="m-0">
                    이 기준으로 좁히면 검색 방식에 따른 직업 구성 차이도 거의 사라집니다.
                    앞서 커 보이던 차이의 상당 부분이 성장 단계가 섞여 있던 탓일 수 있습니다.
                  </p>
                  <p className="m-0">모든 캐릭터를 포함한 수치는 직업 화면의 세부 데이터에 함께 두었습니다.</p>
                </div>
              </Section>
            </Stagger>
          )}

          {tab === "verify" && (
            <Stagger index={0}>
              <Section title="다른 방법으로 다시 재봤습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    이름으로 찾는 방식은 결과가 200명에서 잘리고, 잘린 자리에 어떤 캐릭터가 있었는지 알 수 없습니다.
                    명성 점수로 직접 훑는 다른 방법이 따로 있어서, 같은 것을 두 번 재보고 결과를 맞춰 봤습니다.
                  </p>
                  <p className="m-0">
                    명성 점수를 낮은 쪽부터 높은 쪽까지 일정한 간격으로 훑으면서 그 지점에 있는 캐릭터를 전부 받았습니다.
                    요청 {fmtInt(verify.meta.apiCalls)}번, 캐릭터 {fmtPeople(verify.meta.sampleSize)}입니다.
                  </p>
                  <p className="m-0">
                    이 방법은 레벨 110 이상이면서 최근 90일 안에 접속한 캐릭터만 보여 줍니다.
                    그래서 1차 조사를 대신하지 못하고, 겹치는 부분만 견줄 수 있습니다.
                  </p>
                </div>
              </Section>

              <Section title="성장 단계 분포는 거의 같았습니다">
                <CompareTable head="성장 단계" rows={verify.fameBins} labelKey="bin" />
                <p className="t-body m-0 mt-3 text-[0.94rem]">
                  두 분포를 맞추려면 {fmtPp(verify.fameTvd)}만 옮기면 됩니다.
                  검색이 잘리는 문제가 명성 분포를 크게 왜곡하지는 않았습니다.
                </p>
              </Section>

              <Section title="직업 구성은 뚜렷이 갈렸습니다">
                <CompareTable head="직업" rows={verify.jobs} labelKey="jobName" />
                <p className="t-body m-0 mt-3 text-[0.94rem]">
                  차이가 큰 다섯 직업만 옮겼습니다. 공통으로 견준 {verify.jobCompared}개 직업 전체로 보면
                  두 분포를 맞추는 데 {fmtPp(verify.jobTvd)}가 필요합니다.
                  직업 구성은 두 방법이 뚜렷이 갈립니다. 이름으로 뽑는 방식이 직업 쪽으로 치우칠 수 있다는 뜻입니다.
                </p>
              </Section>

              <Section title="재보는 과정에서 더 큰 문제를 찾았습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    이 조사는 최근 기록이 없으면 조용한 캐릭터로 봤습니다.
                    그런데 명성이 낮은 캐릭터는 접속해도 기록에 남는 행동을 잘 하지 않습니다.
                  </p>
                  <p className="m-0">
                    명성으로 훑은 결과를 놓고 거꾸로 계산하면, 낮은 구간에서 90일 넘게 기록 없음으로 잡힌 비중이
                    실제보다 크게 부풀었을 가능성이 나옵니다.
                    가장 낮은 구간은 이 조사에서 {fmtPct(dormGap.timeline)}였는데 거꾸로 계산한 값은 {fmtPct(dormGap.implied)}입니다.
                  </p>
                  <p className="m-0">
                    이 값은 확정이 아닙니다. 거꾸로 계산하려면 1차 조사의 표본이 명성 쪽으로 치우치지 않았다고 먼저 두어야 하는데,
                    그 점이 바로 지금 재보고 있는 것이라 논리가 제자리를 돕니다.
                    조용한 비중을 잰 표본도 구간마다 {verify.meta.subsampleMin}명에서 {verify.meta.subsampleMax}명으로 작습니다.
                    그래서 실측이 예상을 벗어난 까닭이 1차 조사의 표본 치우침 때문인지, 조용한 비중을 잰 방식의 오차 때문인지
                    이 자료만으로는 갈라낼 수 없습니다.
                  </p>
                </div>
              </Section>

              <Section title="처음 시도했다가 버린 방법">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    처음에는 구간마다 위에서부터 차례로 받아 오려 했습니다.
                    그런데 이 조회는 한 번에 명성 폭 {fmtInt(verify.meta.windowCap)}만큼만 돌려줍니다.
                    구간 하나가 그보다 훨씬 넓어서, 받아 온 캐릭터가 구간 맨 위쪽에만 쌓이고 구간 전체를 대표하지 못했습니다.
                  </p>
                  <p className="m-0">
                    그래서 일정한 간격으로 훑는 방식으로 바꿨습니다.
                    간격을 {fmtInt(verify.meta.coarseStep)}으로 두었을 때 곡선을 놓치는지 확인하려고,
                    임의로 고른 스무 곳을 간격 {fmtInt(verify.meta.denseStep)}으로 다시 재서 값이 어긋나지 않는 것을 보았습니다.
                  </p>
                </div>
              </Section>
            </Stagger>
          )}

          {tab === "bias" && (
            <Stagger index={0}>
              <Section title="실측 근거가 있는 편향">
                <Bullets
                  items={[
                    ["검색 한도가 성장이 앞선 쪽으로 기울입니다",
                      `한도에 걸리면 어떤 200명이 돌아오는지 공개되어 있지 않습니다. 레기온 입장 전 구간 비중이 전체 표본 ${fmtPct(fameCompare[0].full)}인 반면 쏠림 없는 표본에서는 ${fmtPct(fameCompare[0].complete)}입니다. 이 조사에서 가장 큰 편향입니다.`],
                    ["명성 점수가 없는 캐릭터를 뺀 것도 위로 기울입니다",
                      `분포에서 뺀 ${fmtPeople(meta.fameMissing)} 가운데 ${fmtPct(missingLowLevel.pct)}가 레벨 100 미만입니다. 아래쪽이 더 많이 빠졌습니다.`],
                    ["한글 이름만 표본에 들어옵니다",
                      "한국어 두 글자를 넣어 찾는 방식이라 영문과 숫자, 특수문자로 지은 이름은 구조적으로 빠집니다. 어떤 낱말을 골랐는지도 표본 구성에 영향을 줍니다."],
                    ["행동 기록이 없으면 조용한 쪽으로 분류됩니다",
                      "활성도 판정은 레벨 상승과 아이템 획득 같은 행동 기록으로만 합니다. 접속만 하고 기록을 남기지 않는 캐릭터는 90일 넘게 기록 없음으로 잡힙니다."],
                    ["성장 단계와 접속의 관계에는 흔들림이 둘 남아 있습니다",
                      "첫째 성장 단계마다 행동 기록이 남는 빈도가 다를 수 있습니다. 둘째 검색 결과에 최근 접속 여부가 걸려 있는지 확인할 수 없습니다. 활성도 화면의 기울기는 이 둘과 분리되지 않았습니다."],
                    ["조사 단위는 캐릭터이지 유저가 아닙니다",
                      "같은 사람이 여러 캐릭터를 가지고 있어도 각각 표본에 들어옵니다. 모험단 이름을 수집하지 않기 때문에 사람 단위로 묶을 수 없습니다."],
                  ]}
                />
              </Section>
              <Section title="확인할 수 없었던 것">
                <Bullets
                  items={[
                    ["검색 결과에 최근 접속 조건이 걸려 있는지", "문서에도 없고 실제로 호출해 봐도 확인할 수 없었습니다."],
                    ["한도에 걸렸을 때 200명을 고르는 기준", "명성순도 레벨순도 아니라는 점까지만 실제 호출로 확인했습니다."],
                    ["서버별 전체 캐릭터 수", "알 수 없으므로 표본이 전체의 몇 퍼센트인지 계산할 수 없습니다."],
                  ]}
                />
              </Section>
              <Section title="말할 수 있는 범위">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    이 결과는 한글 이름을 쓰고 검색에 노출되는 캐릭터 집단에 대한 기술 통계입니다.
                    전체 유저로 넓혀 읽을 수는 없습니다.
                  </p>
                  <p className="m-0">
                    다만 직업끼리의 상대 비교와 구간 사이의 기울기처럼 같은 조건에서 뽑힌 것끼리의 비교는 편향의 영향을 덜 받습니다.
                  </p>
                </div>
              </Section>
            </Stagger>
          )}

          {tab === "ethics" && (
            <Stagger index={0}>
              <Section title="개인정보 원칙">
                <Bullets
                  items={[
                    ["이름을 수집하지 않습니다", "캐릭터 이름과 모험단 이름, 길드 이름은 저장하지 않습니다."],
                    ["식별자를 남기지 않습니다", "캐릭터 식별자는 활성도 조사 직후 되돌릴 수 없는 형태로 바꾸어 폐기했습니다. 공개 산출물에는 집계 수치만 들어 있습니다."],
                    ["특정 캐릭터를 지목하지 않습니다", "표본이 10명이 되지 않는 칸은 공개하지 않습니다."],
                    ["요청 예절을 지킵니다", "호출 사이에 0.3초를 쉬고 재시도는 한 번까지만 합니다. 상시로 돌리지 않고 한 번만 모았습니다."],
                  ]}
                />
              </Section>
              <Section title="실측치">
                <table className="plain" style={{ maxWidth: 720 }}>
                  <tbody>
                    {[
                      ["표본 크기", `${fmtPeople(meta.sampleSize)}, 쏠림 없는 표본 ${fmtPeople(meta.completeSampleSize)}, 명성 점수 없음 ${fmtPeople(meta.fameMissing)}`],
                      ["활성도 조사", `${fmtPeople(activity.subsampleSize)}, 구간 비례로 뽑았고 가장 작은 구간이 ${fmtPeople(smallestBin)}`],
                      ["주고받은 요청", `약 ${fmtInt(MEASURED.apiCalls)}회, 사전 검증 43회와 직업 목록 1회, 검색 ${fmtInt(seedStats.calls + 1)}회, 활성도 조사 ${fmtInt(activity.subsampleSize)}회, 실패 0회`],
                      ["모델 비용", `${MEASURED.llmCostUsd.toFixed(4)}달러, 배치 ${MEASURED.llmBatches}회 누적`],
                      ["수집에 걸린 시간", `검색 ${MEASURED.collectSec}초, 활성도 조사 ${MEASURED.timelineSec}초`],
                      ["식별 정보 검사", "공개 산출물과 중간 기록 모두 0건"],
                      ["조사일", MEASURED.surveyedAt],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: "var(--text-primary)", width: "10rem" }}>{k}</td>
                        <td className="num">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </Stagger>
          )}
        </div>
      }
      explain={[
        {
          label: "화면 구성",
          body: [
            "세 갈래로 나누어 두었습니다. 표본을 어떻게 뽑았는지, 어디로 얼마나 기울어 있는지, 개인정보를 어떻게 다루었고 실제로 얼마나 썼는지입니다.",
          ],
        },
        {
          label: "적은 방식",
          body: [
            "숫자를 예쁘게 만들기보다 어디가 흔들리는지 그대로 적는 쪽을 택했습니다.",
            "같은 방법을 다시 돌리면 같은 결과가 나오도록 코드와 설정을 모두 공개해 두었습니다.",
          ],
        },
      ]}
    />
  );
}
