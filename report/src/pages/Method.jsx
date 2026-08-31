import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import FlowDiagram from "../components/charts/FlowDiagram.jsx";
import RoundCompare, { TvdRow } from "../components/charts/RoundCompare.jsx";
import { fmtInt, fmtPct, fmtPeople, fmtPp, pct1 } from "../lib/format.js";
import {
  meta, activity, limitedRatio, MEASURED, capBins, capLowest, capGap, capEvidence,
  missingLowLevel, verify, dormGap, rounds, finalSample,
} from "../lib/data.js";

const TABS = [
  { key: "design", label: "표본 설계" },
  { key: "rounds", label: "처음 조사와 달라진 점" },
  { key: "verify", label: "다시 재본 결과" },
  { key: "bias", label: "편향과 확인 불가 항목" },
  { key: "ethics", label: "개인정보와 실측치" },
];

/** 두 방법을 나란히 놓는 대조표. 회차 수치는 그대로 두고 옆에 붙이기만 한다. */
function CompareTable({ head, rows, labelKey }) {
  return (
    <div className="scroll-x">
      <table className="plain" style={{ minWidth: 460, maxWidth: 720 }}>
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
      <h3 className="t-title m-0 mb-4 text-[1.12rem]">{title}</h3>
      {children}
    </section>
  );
}

/** 이야기 순서대로 읽는 회차 비교. 번호가 곧 읽는 차례다. */
function Step({ n, title, children }) {
  return (
    <section className="mt-10 first:mt-0">
      <p className="t-eyebrow m-0" style={{ color: "var(--accent)" }}>{n}단계</p>
      <h3 className="t-title m-0 mt-1 mb-4 text-[1.12rem]">{title}</h3>
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
  const first = rounds.first;
  const second = rounds.second;
  const bias = rounds.seedBias;
  const revealed = capEvidence.stageSplit[0];

  const steps = [
    {
      title: "시드 고르기",
      body: "명성 점수로 훑어 받은 캐릭터 이름에서 두 글자 조합의 빈도를 세고, 많이 쓰이는 차례로 골랐습니다.",
      measured: `조합 ${fmtInt(meta.seedCount)}개`,
    },
    {
      title: "표본 수집",
      body: `고른 조합을 서버 ${meta.servers.length}곳의 캐릭터 이름 포함 검색에 넣었습니다. 검색 응답에 직업과 레벨, 명성이 함께 옵니다.`,
      measured: `검색 ${fmtInt(meta.searchCalls)}회`,
    },
    {
      title: "한도 판정",
      body: "검색 결과가 200명 한도에 걸렸는지 매 호출마다 기록했습니다. 한도에 걸린 검색은 일부만 받은 것입니다.",
      measured: `잘린 검색 ${fmtInt(meta.searchCallsLimited)}회, ${fmtPct(limitedRatio)}`,
    },
    {
      title: "상한 우회",
      body: `한도에 걸린 검색 가운데 ${fmtInt(capEvidence.sampledCombos)}개를 골라 직업군 열여덟 갈래로 쪼개 다시 불렀습니다. 상한이 무엇을 가리는지 재려는 것입니다.`,
      measured: `재호출 ${fmtInt(capEvidence.splitCalls)}회`,
    },
    {
      title: "커버리지 측정",
      body: "명성 점수로 훑어 받은 캐릭터의 이름을 시드로 걸러, 이 그물이 실제로 몇 퍼센트에 닿는지 쟀습니다.",
      measured: `${fmtPct(second.coveragePct)}`,
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
          {/* 회차 비교가 이 판에서 제일 중요한 내용이라 탭 위에 한 줄로 먼저 알린다 */}
          {tab !== "rounds" && (
            <button
              type="button"
              onClick={() => setTab("rounds")}
              className="mb-5 flex w-full items-center gap-4 rounded-lg px-5 py-4 text-left"
              style={{ background: "var(--gold-soft)", borderLeft: "3px solid var(--gold)", cursor: "pointer" }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-bold" style={{ color: "var(--text-primary)" }}>
                  이 리포트는 두 번째 조사 기준입니다
                </span>
                <span className="t-small m-0 mt-1 block">
                  처음 조사에서 무엇이 잘못돼 있었고 무엇을 어떻게 고쳤는지, 고치면서 대신 무엇이 나빠졌는지 순서대로 적었습니다.
                </span>
              </span>
              <span className="shrink-0 text-[0.9rem] font-bold" style={{ color: "var(--gold-text)" }}>보러 가기</span>
            </button>
          )}

          <div
            className="mb-8 flex flex-wrap gap-1.5 rounded-full p-1.5"
            style={{ background: "var(--bg-sunken)" }}
            aria-label="조사 방법 항목"
          >
            {TABS.map((t) => {
              const on = tab === t.key;
              const flag = t.key === "rounds";
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTab(t.key)}
                  className="flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[0.95rem]"
                  style={{
                    background: on ? "var(--accent)" : "transparent",
                    color: on ? "var(--bg-surface)" : flag ? "var(--gold-text)" : "var(--text-secondary)",
                    fontWeight: on || flag ? 700 : 500,
                    cursor: "pointer",
                    transition: "background 0.18s, color 0.18s",
                  }}
                >
                  {flag && (
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: on ? "var(--bg-surface)" : "var(--gold)" }}
                      aria-hidden="true"
                    />
                  )}
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
                  <p className="m-0">
                    직업군 막대를 전직 칸으로 쪼개 그리지 않는 것도 같은 이유입니다.
                    남녀가 나뉜 직업군은 전직 이름이 같아서, 집계만으로는 어느 쪽 직업군의 전직인지 가릴 수 없습니다.
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
                    처음에는 이 조정으로 검색 방식에 따른 직업 구성 차이가 거의 사라진다고 적었는데, 다시 재 보니 일부만 사실이었습니다.
                    차이는 15.48에서 13.31%포인트로 줄어드는 정도였습니다.
                  </p>
                  <p className="m-0">모든 캐릭터를 포함한 수치는 직업 화면의 세부 데이터에 함께 두었습니다.</p>
                </div>
              </Section>
            </Stagger>
          )}

          {tab === "rounds" && (
            <Stagger index={0}>
              <p className="t-body m-0 max-w-[52rem] text-[0.95rem]">
                같은 조사를 두 번 했습니다. 처음 조사를 검증해 보니 두 가지가 잘못돼 있었고, 고쳤더니 대신 다른 것이 나빠졌습니다.
                순서대로 적습니다.
              </p>

              <Step n={1} title="처음에는 이렇게 했습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    한글 두 글자 {fmtInt(first.seeds)}개로 검색해 캐릭터 {fmtPeople(first.sampleSize)}을 모았습니다.
                  </p>
                  <p className="m-0">
                    검색이 200명에서 잘리는 것을 피하려고 절반을 드문 조합으로 채웠습니다.
                    흔한 낱말은 금방 상한에 걸리니, 드문 낱말을 쓰면 잘리지 않은 결과를 더 많이 받을 수 있다고 봤습니다.
                  </p>
                </div>
              </Step>

              <Step n={2} title="검증해 보니 두 가지가 잘못돼 있었습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    첫째, 그물이 너무 성겼습니다. 이름에 한글이 든 캐릭터 가운데 이 시드에 걸리는 비율은 {fmtPct(first.coveragePct)}뿐이었습니다.
                    명성 점수로 훑어 받은 캐릭터 {fmtPeople(bias.probeSample)}의 이름을 시드로 걸러 직접 쟀습니다.
                  </p>
                  <p className="m-0">
                    둘째, 시드로 고른 낱말이 직업과 맞물려 있었습니다.
                    걸린 캐릭터는 {fmtPeople(bias.caught)}뿐이었는데, 그 가운데 {bias.seed}으로 걸린 {fmtPeople(bias.seedHits)} 중 {fmtPeople(bias.topJobCount)}이 {bias.topJob}였습니다.
                  </p>
                  <p className="m-0">
                    이름을 짓는 습관이 직업마다 다르기 때문입니다. 낱말을 고르는 순간 직업 구성이 함께 기울어집니다.
                    그 결과 직업 구성이 명성 방식과 {fmtPp(first.jobTvd)} 갈렸습니다.
                  </p>
                </div>
              </Step>

              <Step n={3} title="그래서 이렇게 고쳤습니다">
                <p className="t-body m-0 mb-5 max-w-[52rem] text-[0.94rem]">
                  드문 낱말을 버리고, 실제로 많이 쓰이는 두 글자 조합 {fmtInt(second.seeds)}개로 다시 모았습니다.
                </p>
                <RoundCompare
                  rows={[
                    {
                      label: "표본",
                      first: `${fmtInt(first.sampleSize)}명`,
                      second: `${fmtInt(second.sampleSize)}명`,
                      better: true,
                    },
                    {
                      label: "이름에 한글이 든 캐릭터 중 닿은 비율",
                      first: fmtPct(first.coveragePct),
                      second: fmtPct(second.coveragePct),
                      better: true,
                    },
                    {
                      label: "명성 방식과의 직업 구성 차이",
                      first: fmtPp(first.jobTvd),
                      second: fmtPp(second.jobTvd),
                      better: true,
                    },
                    {
                      label: `${bias.topJob} 한 직업의 치우침`,
                      first: fmtPp(rounds.jobGap[0].first),
                      second: fmtPp(rounds.jobGap[0].second),
                      better: true,
                    },
                  ]}
                />
                <p className="t-small mt-5 max-w-[52rem]">
                  시드를 바꾸자 가장 크게 벌어져 있던 직업들이 거의 맞아떨어졌습니다.
                  {rounds.jobGap.map((j) => ` ${j.jobName} ${fmtPp(j.first)}에서 ${fmtPp(j.second)}.`).join("")}
                </p>
              </Step>

              <Step n={4} title="대신 다른 것이 나빠졌습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    흔한 낱말일수록 그 낱말이 든 캐릭터가 많고, 많으면 200명에서 잘립니다.
                  </p>
                </div>
                <div className="mt-5">
                  <RoundCompare
                    rows={[
                      {
                        label: "200명 한도에 걸린 검색의 비중",
                        first: fmtPct(first.limitedPct),
                        second: fmtPct(second.limitedPct),
                        better: false,
                        note: "넓게 긁는 것과 잘리지 않는 것은 맞바꾸는 관계입니다.",
                      },
                    ]}
                  />
                </div>
                <p className="t-body m-0 mt-5 max-w-[52rem] text-[0.94rem]">
                  드문 조합을 쓰면 상한은 피하지만 닿는 캐릭터가 적고, 흔한 조합을 쓰면 널리 닿지만 거의 모든 검색이 잘립니다.
                  둘을 한꺼번에 가질 수는 없습니다.
                </p>
              </Step>

              <Step n={5} title="그래서 상한이 무엇을 가리는지 직접 재봤습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    상한에 걸린 검색 {fmtInt(capEvidence.sampledCombos)}개를 직업군 열여덟 갈래로 쪼개 다시 불렀습니다.
                    한 조합당 {fmtInt(capEvidence.limit)}명에서 멈추던 것이 평균 {fmtInt(capEvidence.avgAfterSplit)}명까지 나왔습니다. {capEvidence.multiplier.toFixed(2)}배입니다.
                  </p>
                  <p className="m-0">
                    새로 드러난 캐릭터의 {fmtPct(revealed.revealed)}가 레기온 입장 전 구간이었습니다.
                    원래 {fmtInt(capEvidence.limit)}명 안에서는 {fmtPct(revealed.inside)}였습니다. 잘릴 때 낮은 명성 캐릭터가 먼저 잘린다는 뜻입니다.
                  </p>
                  <p className="m-0">
                    이 배수를 상한에 걸린 조합 전체에 적용하면 레기온 입장 전 구간이 {fmtPct(capLowest.observed)}에서 {fmtPct(capLowest.corrected)}가 됩니다.
                    차이는 {fmtPp(capGap)}입니다.
                  </p>
                  <p className="m-0">
                    여기서 예측이 하나 틀렸습니다. 상한에 걸린 검색이 이미 200명을 채우고 있으니 열여덟로 나눠도 인기 직업군은 다시 상한에 걸릴 것으로 봤습니다.
                    실제로 쪼갠 뒤에도 상한에 걸린 비율은 {fmtPct(capEvidence.stillLimitedPct)}뿐이었습니다. 직업군 분할은 상한을 잘 벗어납니다.
                  </p>
                </div>
              </Step>

              <Step n={6} title="처음 조사에서 잘 맞아 보이던 수치를 다시 읽었습니다">
                <div className="prose t-body text-[0.94rem]">
                  <p className="m-0">
                    처음 조사는 명성 점수로 훑는 방법과 성장 단계 분포가 {fmtPp(rounds.fameMethodTvd.firstObserved)}밖에 차이 나지 않아 잘 맞아 보였습니다.
                    그런데 상한을 걷어낼수록 오히려 멀어집니다.
                  </p>
                </div>
                <div className="mt-5">
                  <TvdRow
                    rows={[
                      { label: "처음 조사 관측값", value: rounds.fameMethodTvd.firstObserved },
                      { label: "두 번째 조사 관측값", value: rounds.fameMethodTvd.secondObserved },
                      { label: "두 번째 조사 상한 보정값", value: rounds.fameMethodTvd.secondCapCorrected, tone: "var(--gold-text)" },
                    ]}
                  />
                </div>
                <div className="prose t-body mt-5 text-[0.94rem]">
                  <p className="m-0">
                    까닭은 이렇습니다. 검색 상한은 낮은 명성 캐릭터를 깎습니다.
                    명성 방식도 90일 넘게 접속하지 않은 캐릭터와 레벨 110 미만을 못 보는데, 그 층이 바로 상한이 깎던 층입니다.
                  </p>
                  <p className="m-0">
                    두 가지가 같은 방향으로 틀려 있어서 서로 상쇄됐던 것입니다.
                    잘 맞아 보이던 {fmtPp(rounds.fameMethodTvd.firstObserved)}는 정확해서 나온 값이 아니었습니다.
                  </p>
                  <p className="m-0">
                    여기서 예측이 하나 더 틀렸습니다. 처음에는 명성 방식을 이름 검색의 정답지로 두려 했습니다.
                    같은 층을 못 보는 방법을 정답지로 쓸 수는 없습니다. 성장 단계에서는 기준이 될 수 없고, 겹치는 부분에서만 견줄 수 있습니다.
                  </p>
                </div>
              </Step>

              <Section title="회차 자료는 둘 다 남깁니다">
                <p className="t-body m-0 max-w-[52rem] text-[0.94rem]">
                  처음 조사 결과를 지우지 않았습니다. 두 회차의 집계 파일을 모두 저장소에 두고 회차 표기를 붙여 두었습니다.
                  틀린 쪽을 지우면 무엇이 어떻게 틀렸는지 다시 볼 수 없기 때문입니다.
                </p>
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
                    그래서 이 조사를 대신하지 못하고, 겹치는 부분만 견줄 수 있습니다.
                  </p>
                </div>
              </Section>

              <Section title="직업 구성은 좁혀졌습니다">
                <CompareTable head="직업" rows={verify.jobs} labelKey="jobName" />
                <p className="t-body m-0 mt-3 text-[0.94rem]">
                  차이가 큰 다섯 직업만 옮겼습니다. 공통으로 견준 {verify.jobCompared}개 직업 전체로 보면
                  두 분포를 맞추는 데 {fmtPp(verify.jobTvd)}가 필요합니다.
                  처음 조사에서는 {fmtPp(rounds.first.jobTvd)}였습니다. 시드를 바꾼 효과가 그대로 나타났습니다.
                </p>
              </Section>

              <Section title="성장 단계 분포는 오히려 벌어졌습니다">
                <CompareTable head="성장 단계" rows={verify.fameBins} labelKey="bin" />
                <p className="t-body m-0 mt-3 text-[0.94rem]">
                  두 분포를 맞추려면 {fmtPp(verify.fameTvd)}를 옮겨야 합니다. 처음 조사에서는 {fmtPp(rounds.first.fameTvd)}였습니다.
                  벌어진 것이 나빠진 신호는 아닙니다. 두 방법이 서로 다른 층을 못 보기 때문에 생기는 차이입니다.
                  자세한 내용은 처음 조사와 달라진 점 항목의 여섯 번째 단계에 적었습니다.
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
                    이 값은 확정이 아닙니다. 거꾸로 계산하려면 표본이 명성 쪽으로 치우치지 않았다고 먼저 두어야 하는데,
                    그 점이 바로 지금 재보고 있는 것이라 논리가 제자리를 돕니다.
                    조용한 비중을 잰 표본도 구간마다 {verify.meta.subsampleMin}명에서 {verify.meta.subsampleMax}명으로 작습니다.
                    그래서 실측이 예상을 벗어난 까닭이 표본 치우침 때문인지, 조용한 비중을 잰 방식의 오차 때문인지
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
                    ["검색 상한이 낮은 성장 단계를 먼저 걸러냅니다",
                      `이 조사에서 가장 큰 편향입니다. 상한에 걸린 검색 ${fmtInt(capEvidence.sampledCombos)}개를 쪼개 다시 받아 보니 한 조합당 ${fmtInt(capEvidence.limit)}명이 평균 ${fmtInt(capEvidence.avgAfterSplit)}명으로 늘었고(${capEvidence.multiplier.toFixed(2)}배), 새로 드러난 캐릭터의 ${fmtPct(revealed.revealed)}가 레기온 입장 전 구간이었습니다. 되돌리면 그 구간이 ${fmtPct(capLowest.observed)}에서 ${fmtPct(capLowest.corrected)}가 됩니다.`],
                    ["상한 보정값도 아래쪽을 다 담지는 못합니다",
                      `보정은 표본 ${fmtInt(capEvidence.sampledCombos)}개에서 잰 배수를 상한 도달 조합 ${fmtInt(capEvidence.limitedCombosTotal)}개 전체에 적용한 추정입니다. 쪼갠 뒤에도 ${fmtPct(capEvidence.stillLimitedPct)}는 여전히 상한에 걸려 있어, 보정 후에도 실제보다 적게 잡혔을 수 있습니다.`],
                    ["처음 조사는 시드 낱말이 직업과 맞물려 있었습니다",
                      `${bias.seed}으로 걸린 ${fmtPeople(bias.seedHits)} 가운데 ${fmtPeople(bias.topJobCount)}이 ${bias.topJob}였습니다. 이 회차는 흔한 조합 ${fmtInt(second.seeds)}개로 시드를 바꿔 직업 구성 차이를 ${fmtPp(first.jobTvd)}에서 ${fmtPp(second.jobTvd)}로 줄였습니다.`],
                    ["넓게 긁는 것과 잘리지 않는 것은 맞바꾸는 관계입니다",
                      `시드를 바꿔 닿는 비율은 ${fmtPct(first.coveragePct)}에서 ${fmtPct(second.coveragePct)}로 올랐지만, 상한에 걸린 검색은 ${fmtPct(first.limitedPct)}에서 ${fmtPct(second.limitedPct)}로 늘었습니다.`],
                    ["명성 방식은 성장 단계의 기준이 될 수 없습니다",
                      `상한을 걷어낼수록 명성 방식에서 멀어집니다(${fmtPp(rounds.fameMethodTvd.firstObserved)}, ${fmtPp(rounds.fameMethodTvd.secondObserved)}, ${fmtPp(rounds.fameMethodTvd.secondCapCorrected)}). 명성 방식도 90일 넘게 접속하지 않은 캐릭터를 못 보는데 그 층이 바로 상한이 깎던 층이라, 두 편향이 서로 상쇄돼 잘 맞아 보였던 것입니다.`],
                    ["레벨 110 미만은 이름 없이 조회할 방법이 없습니다",
                      `문서에 있는 엔드포인트를 전부 훑고 실제로 불러 확인했습니다. 레벨 범위를 넣어도 조용히 무시됩니다. 분포에서 뺀 ${fmtPeople(meta.fameMissing)} 가운데 ${fmtPct(missingLowLevel.pct)}가 레벨 100 미만입니다.`],
                    ["한글 이름만 표본에 들어옵니다",
                      "한국어 두 글자를 넣어 찾는 방식이라 영문과 숫자, 특수문자로만 지은 이름은 구조적으로 빠집니다."],
                    ["행동 기록이 없으면 조용한 쪽으로 분류됩니다",
                      "활성도 판정은 레벨 상승과 아이템 획득 같은 행동 기록으로만 합니다. 접속만 하고 기록을 남기지 않는 캐릭터는 90일 넘게 기록 없음으로 잡힙니다. 이 과대집계는 명성이 낮은 구간에서 특히 큽니다."],
                    ["조사 단위는 캐릭터이지 유저가 아닙니다",
                      "같은 사람이 여러 캐릭터를 가지고 있어도 각각 표본에 들어옵니다. 모험단 이름을 수집하지 않기 때문에 사람 단위로 묶을 수 없습니다."],
                  ]}
                />
              </Section>
              <Section title="예측이 빗나간 곳">
                <Bullets
                  items={[
                    ["직업군으로 쪼개도 상한을 못 벗어날 것으로 봤습니다",
                      `상한에 걸린 검색이 이미 200명을 채우고 있으니 열여덟로 나눠도 인기 직업군은 다시 걸릴 것으로 예상했습니다. 실제로는 ${fmtPct(capEvidence.stillLimitedPct)}만 남았습니다.`],
                    ["명성 방식을 정답지로 삼으려 했습니다",
                      "같은 층을 못 보는 방법이라 성장 단계에서는 기준이 될 수 없습니다. 겹치는 부분에서만 견줄 수 있습니다."],
                    ["처음 설계에서 커버리지 손실을 계산하지 않았습니다",
                      `상한을 피하려고 시드 절반을 드문 조합으로 채웠는데, 그 선택이 닿는 범위를 얼마나 깎는지는 계산하지 않았습니다. 실측은 ${fmtPct(first.coveragePct)}였습니다.`],
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
              <Section title="주고받은 요청">
                <div className="scroll-x">
                  <table className="plain" style={{ minWidth: 420, maxWidth: 620 }}>
                    <thead>
                      <tr><th>항목</th><th className="text-right">요청</th></tr>
                    </thead>
                    <tbody>
                      {MEASURED.roundCalls.map(([k, v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td className="num text-right">{fmtInt(v)}회</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ color: "var(--text-primary)", fontWeight: 700 }}>이번 판 합계</td>
                        <td className="num text-right" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                          {fmtInt(MEASURED.roundTotal)}회
                        </td>
                      </tr>
                      {MEASURED.earlierCalls.map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ color: "var(--text-muted)" }}>{k} (이번 판 이전)</td>
                          <td className="num text-right" style={{ color: "var(--text-muted)" }}>{fmtInt(v)}회</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ color: "var(--text-primary)" }}>모두 합치면</td>
                        <td className="num text-right" style={{ color: "var(--text-primary)" }}>{fmtInt(MEASURED.grandTotal)}회</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="t-small mt-3 max-w-[46rem]">
                  이번 판 합계는 약 {MEASURED.roundMinutes}분이 걸렸고 실패는 {MEASURED.failures}회입니다.
                  요청 사이에 0.3초를 쉬었고, 실패하면 한 번만 다시 걸었습니다.
                </p>
              </Section>
              <Section title="실측치">
                <table className="plain" style={{ maxWidth: 720 }}>
                  <tbody>
                    {[
                      ["표본 크기", `${fmtPeople(meta.sampleSize)}, 성장을 마친 캐릭터 ${fmtPeople(finalSample)}, 명성 점수 없음 ${fmtPeople(meta.fameMissing)}`],
                      ["시드", `두 글자 조합 ${fmtInt(meta.seedCount)}개, 닿은 비율 ${fmtPct(second.coveragePct)}`],
                      ["검색", `${fmtInt(meta.searchCalls)}회, 이 가운데 ${fmtInt(meta.searchCallsLimited)}회가 200명 한도에 걸림 (${fmtPct(limitedRatio)})`],
                      ["상한 우회", `상한 도달 조합 ${fmtInt(capEvidence.limitedCombosTotal)}개 가운데 ${fmtInt(capEvidence.sampledCombos)}개를 쪼개 재호출 ${fmtInt(capEvidence.splitCalls)}회`],
                      ["활성도 조사", `${fmtPeople(activity.subsampleSize)}, 구간 비례로 뽑았고 가장 작은 구간이 ${fmtPeople(smallestBin)}`],
                      ["모델 비용", `${MEASURED.llmCostUsd.toFixed(4)}달러, 배치 ${MEASURED.llmBatches}회 누적`],
                      ["식별 정보 검사", "공개 산출물과 중간 기록 모두 0건"],
                      ["집계일", MEASURED.surveyedAt],
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
            "다섯 갈래로 나누어 두었습니다. 표본을 어떻게 뽑았는지, 처음 조사와 무엇이 달라졌는지, 다른 방법으로 재보니 어땠는지, 어디로 얼마나 기울어 있는지, 개인정보를 어떻게 다루었고 실제로 얼마나 썼는지입니다.",
          ],
        },
        {
          label: "적은 방식",
          body: [
            "숫자를 예쁘게 만들기보다 어디가 흔들리는지 그대로 적는 쪽을 택했습니다. 틀렸던 예측도 지우지 않고 남겼습니다.",
            "같은 방법을 다시 돌리면 같은 결과가 나오도록 코드와 설정을 모두 공개해 두었습니다.",
          ],
        },
      ]}
    />
  );
}
