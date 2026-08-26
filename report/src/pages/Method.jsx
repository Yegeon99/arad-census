import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import FlowDiagram from "../components/charts/FlowDiagram.jsx";
import { fmtInt, fmtPct, fmtPeople, pct1 } from "../lib/format.js";
import {
  meta, activity, seedStats, limitedRatio, MEASURED, fameCompare, missingLowLevel,
} from "../lib/data.js";

const TABS = [
  { key: "design", label: "표본 설계" },
  { key: "bias", label: "편향과 확인 불가 항목" },
  { key: "ethics", label: "개인정보와 실측치" },
];

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

  const steps = [
    {
      title: "시드 검색",
      body: `한국어 두 글자 ${seedStats.seeds}개를 서버 ${meta.servers.length}곳의 캐릭터 이름 포함 검색에 넣었습니다. 절반은 흔한 조합, 절반은 드문 조합입니다.`,
      measured: `검색 ${fmtInt(seedStats.calls)}회`,
    },
    {
      title: "한도 판정",
      body: "검색 결과가 200명 한도에 걸렸는지 매 호출마다 기록했습니다. 한도에 걸린 검색은 일부만 받은 것입니다.",
      measured: `한도 검색 ${fmtInt(meta.searchCallsLimited)}회, ${fmtPct(limitedRatio)}`,
    },
    {
      title: "중복 제거",
      body: "서버와 캐릭터 기준으로 겹치는 결과를 하나로 정리해 표본을 확정했습니다. 검색 응답에 직업과 레벨, 명성이 함께 오므로 캐릭터마다 따로 묻지 않았습니다.",
      measured: `표본 ${fmtPeople(meta.sampleSize)}`,
    },
    {
      title: "완전 검색 표본 분리",
      body: "한도에 걸리지 않은 검색에서 한 번이라도 나온 캐릭터를 따로 모아 별도 분포를 냈습니다. 검색 한도가 만드는 기울기를 재는 잣대입니다.",
      measured: `완전 검색 표본 ${fmtPeople(meta.completeSampleSize)}`,
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
      question="이 숫자들은 어떻게 만들었고 어디까지 믿을 수 있습니까?"
      statValue={pct1(limitedRatio)}
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
            </Stagger>
          )}

          {tab === "bias" && (
            <Stagger index={0}>
              <Section title="실측 근거가 있는 편향">
                <Bullets
                  items={[
                    ["검색 한도가 성장이 앞선 쪽으로 기울입니다",
                      `한도에 걸리면 어떤 200명이 돌아오는지 공개되어 있지 않습니다. 레기온 입장 전 구간 비중이 전체 표본 ${fmtPct(fameCompare[0].full)}인 반면 완전 검색 표본에서는 ${fmtPct(fameCompare[0].complete)}입니다. 이 조사에서 가장 큰 편향입니다.`],
                    ["명성값이 없는 캐릭터를 뺀 것도 위로 기울입니다",
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
              <Section title="어디까지 말할 수 있습니까">
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
                      ["표본 크기", `${fmtPeople(meta.sampleSize)}, 완전 검색 표본 ${fmtPeople(meta.completeSampleSize)}, 명성값 없음 ${fmtPeople(meta.fameMissing)}`],
                      ["활성도 조사", `${fmtPeople(activity.subsampleSize)}, 구간 비례로 뽑았고 가장 작은 구간이 ${fmtPeople(11)}`],
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
          label: "이 화면의 구성",
          body: [
            "세 갈래로 나누어 두었습니다. 표본을 어떻게 뽑았는지, 어디로 얼마나 기울어 있는지, 개인정보를 어떻게 다루었고 실제로 얼마나 썼는지입니다.",
          ],
        },
        {
          label: "왜 이렇게 적었는가",
          body: [
            "숫자를 예쁘게 만들기보다 어디가 흔들리는지 그대로 적는 쪽을 택했습니다.",
            "같은 방법을 다시 돌리면 같은 결과가 나오도록 코드와 설정을 모두 공개해 두었습니다.",
          ],
        },
      ]}
    />
  );
}
