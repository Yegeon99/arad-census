import PageShell, { CountUp, Stagger } from "../components/PageShell.jsx";
import Chart from "../components/Chart.jsx";
import SearchExplainer from "../components/SearchExplainer.jsx";
import SampleStageBars from "../components/charts/SampleStageBars.jsx";
import { fmtInt, fmtPct, fmtPeople, fmtPp } from "../lib/format.js";
import {
  meta, MEASURED, capBins, capLowest, capGap, capEvidence,
  topJobs, finalSample, verify, rounds,
} from "../lib/data.js";

const ICON = {
  common: { width: 30, height: 30, viewBox: "0 0 30 30", fill: "none", stroke: "var(--accent)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" },
};

function FameIcon() {
  return (
    <svg {...ICON.common} aria-hidden="true">
      <path d="M4 22h22" />
      <path d="M7 22v-5M13 22v-9M19 22v-13" />
      <circle cx="19" cy="6" r="2.2" />
    </svg>
  );
}
function StageIcon() {
  return (
    <svg {...ICON.common} aria-hidden="true">
      <path d="M11 7h8M8 13h14M5 19h20M3 25h24" />
    </svg>
  );
}
function CutIcon() {
  return (
    <svg {...ICON.common} aria-hidden="true">
      <path d="M5 7h20M5 12h20M5 17h20" />
      <path d="M3 21.5h24" strokeDasharray="3 3" />
      <path d="M9 26l12-4" opacity="0.55" />
    </svg>
  );
}
function AdjustIcon() {
  return (
    <svg {...ICON.common} aria-hidden="true">
      <path d="M15 4v22" />
      <path d="M6 11h18" />
      <path d="M9 18l-3-3 3-3" />
      <path d="M21 24l3-3-3-3" />
      <path d="M24 21H6" />
    </svg>
  );
}

const BASICS = [
  {
    icon: <FameIcon />,
    title: "명성",
    body: "캐릭터가 얼마나 강한지 게임이 매기는 점수입니다. 장비가 좋을수록 높습니다.",
  },
  {
    icon: <StageIcon />,
    title: "성장 단계",
    body: "명성 점수를 게임 콘텐츠 입장 조건에 맞춰 여섯 단계로 나눈 것입니다. 가장 낮은 단계가 레기온 입장 전, 가장 높은 단계가 하드 권장 구간입니다.",
  },
  {
    icon: <AdjustIcon />,
    title: "상한 보정값",
    body: "검색이 200명에서 잘리며 가려진 몫을 되돌려 다시 계산한 값입니다. 실제로 쪼개 재본 결과를 근거로 삼았습니다.",
  },
];

function BigNumber({ value, suffix, label, note, index }) {
  return (
    <Stagger index={index}>
      <div>
        <p className="num m-0 text-[2.1rem] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
          <CountUp value={value} format={(v) => fmtInt(Math.round(v))} />
          <span className="text-[1.1rem] font-semibold" style={{ color: "var(--text-secondary)" }}>{suffix}</span>
        </p>
        <p className="m-0 text-[0.9rem] font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="t-small m-0">{note}</p>
      </div>
    </Stagger>
  );
}

function FindingCard({ href, kicker, title, body, index }) {
  return (
    <a href={href} className="block no-underline" style={{ color: "inherit" }}>
      <Stagger index={index}>
        <div className="py-4" style={{ borderTop: "1px solid var(--hairline-strong)" }}>
          <p className="t-eyebrow m-0" style={{ color: "var(--accent)" }}>{kicker}</p>
          <p className="m-0 mt-1.5 text-[1.02rem] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          <p className="t-body m-0 mt-1.5 text-[0.9rem]">{body}</p>
          <p className="m-0 mt-2 text-[0.84rem]" style={{ color: "var(--accent)" }}>이 화면으로 이동</p>
        </div>
      </Stagger>
    </a>
  );
}

export default function Overview() {
  const observedBins = capBins.map((b) => ({ range: b.label, pct: b.observed, count: b.observedCount }));
  const correctedBins = capBins.map((b) => ({
    range: b.label,
    pct: b.corrected,
    count: Math.round((b.corrected / 100) * finalSample),
  }));
  const pyramidProps = {
    full: observedBins,
    complete: correctedBins,
    fullLabel: "관측값",
    completeLabel: "상한 보정값",
    fullNote: `실제로 받아 센 값, 성장을 마친 ${fmtPeople(finalSample)}`,
    completeNote: "검색이 잘리며 가려진 몫을 되돌린 값",
  };

  return (
    <PageShell
      id="overview"
      question="던파 캐릭터 130만 명은 지금 어디까지 성장해 있을까"
      notice="이 리포트는 두 번째 조사 기준입니다. 처음 조사와 무엇이 달라졌는지는 조사 방법 화면에 있습니다."
      statNumber={meta.sampleSize}
      statFormat={(v) => fmtInt(Math.round(v))}
      statUnit="명"
      statLabel="조사한 캐릭터 수"
      statNote={`서버 ${meta.servers.length}곳, ${MEASURED.surveyedAt} 수집`}
      intro={
        <section className="mb-12">
          <h2 className="t-kicker m-0 mb-4">먼저 알아둘 것 네 가지</h2>
          <ul className="m-0 grid list-none gap-x-10 gap-y-6 p-0 lg:grid-cols-3">
            {BASICS.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className="mt-0.5 shrink-0">{b.icon}</span>
                <span>
                  <span className="block text-[0.98rem] font-bold" style={{ color: "var(--text-primary)" }}>{b.title}</span>
                  <span className="t-body mt-1 block text-[0.9rem]">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-4">
            <span className="mt-0.5 shrink-0"><CutIcon /></span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[0.98rem] font-bold" style={{ color: "var(--text-primary)" }}>
                잘린 검색과 쏠림 없는 표본
              </p>
              <div className="mt-3">
                <SearchExplainer />
              </div>
            </div>
          </div>
        </section>
      }
      visual={
        <Chart
          how="줄 하나가 성장 단계 하나입니다. 위가 높은 단계, 아래가 낮은 단계이고, 두 막대가 같은 가로축을 써서 길이를 그대로 견줄 수 있습니다."
          so={`상한을 되돌리면 가장 낮은 단계가 ${fmtPct(capLowest.observed)}에서 ${fmtPct(capLowest.corrected)}로 올라갑니다. 실제 유저는 관측값이 보여주는 것보다 아래쪽에 몰려 있습니다.`}
        >
          <SampleStageBars {...pyramidProps} />
        </Chart>
      }
      explain={[
        {
          label: "조사한 것",
          body: [
            `던전앤파이터 캐릭터 표본을 서버 ${meta.servers.length}곳에서 뽑아 직업과 성장 단계, 접속 기록을 살펴봤습니다.`,
            `표본은 캐릭터 이름에 한국어 두 글자를 넣어 검색하는 방식으로 모았습니다. 두 글자 조합 ${fmtInt(meta.seedCount)}개를 써서 ${fmtPeople(meta.sampleSize)}을 모았고, 이름에 한글이 든 캐릭터의 ${fmtPct(rounds.second.coveragePct)}에 닿았습니다.`,
          ],
        },
        {
          label: "관측값과 보정값을 나란히 두는 이유",
          body: [
            "잘린 검색은 강한 캐릭터 쪽으로 쏠립니다. 관측값만 보여 주면 그 쏠림을 그대로 사실처럼 읽게 됩니다.",
            "그래서 잘린 검색을 쪼개 다시 받아 무엇이 가려져 있었는지 직접 재고, 그 몫을 되돌린 값을 옆에 함께 두었습니다.",
          ],
        },
        {
          label: "주의할 점",
          body: [
            "이 조사는 게임 전체 인구를 추정하지 않습니다. 표본을 어떻게 뽑았고 그 표본이 어디로 기울었는지를 끝까지 드러내는 방법론 시연입니다.",
            "기울어진 방향과 크기는 조사 방법과 한계 화면에 그대로 적어 두었습니다.",
          ],
        },
      ]}
    >
      <Stagger index={6}>
        <h2 className="t-title mt-14 mb-1 text-[1.3rem]">핵심 발견 세 가지</h2>
        <p className="t-small m-0 mb-2">각 항목을 누르면 해당 화면으로 갑니다.</p>
        <div className="grid gap-x-8 lg:grid-cols-3">
          <FindingCard
            index={0}
            href="#growth"
            kicker="성장 단계"
            title="실제 유저는 보이는 것보다 아래쪽에 몰려 있습니다"
            body={`레기온 입장 전 구간이 관측값으로는 ${fmtPct(capLowest.observed)}이지만, 검색이 가린 몫을 되돌리면 ${fmtPct(capLowest.corrected)}입니다.`}
          />
          <FindingCard
            index={1}
            href="#growth"
            kicker="검색 상한"
            title="검색이 200명에서 잘릴 때 낮은 명성 캐릭터가 먼저 잘립니다"
            body={`잘린 검색 ${fmtInt(capEvidence.sampledCombos)}개를 쪼개 다시 받아 보니, 새로 드러난 캐릭터의 ${fmtPct(capEvidence.stageSplit[0].revealed)}가 가장 낮은 단계였습니다.`}
          />
          <FindingCard
            index={2}
            href="#method"
            kicker="처음 조사와의 차이"
            title="처음 조사는 이름 짓는 습관 때문에 직업 구성이 틀어져 있었습니다"
            body={`시드 낱말이 직업과 맞물려 있었습니다. 시드를 바꿔 다시 모으자 직업 구성 차이가 ${fmtPp(rounds.first.jobTvd)}에서 ${fmtPp(rounds.second.jobTvd)}로 좁혀졌습니다.`}
          />
        </div>
      </Stagger>

      <Stagger index={7}>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          <BigNumber index={0} value={finalSample} suffix="명" label="성장을 마친 캐릭터" note="직업 순위는 이 기준으로 셉니다" />
          <BigNumber index={1} value={meta.servers.length} suffix="곳" label="조사한 서버" note="공개된 서버 전부" />
          <BigNumber index={2} value={meta.completeSampleSize} suffix="명" label="쏠림 없는 표본" note="200명에 걸리지 않은 검색에서 발견, 참고용" />
        </div>
      </Stagger>

      <Stagger index={8}>
        <section
          className="mt-14 px-6 py-7 lg:px-8 lg:py-8"
          style={{ background: "var(--gold-soft)", borderLeft: "3px solid var(--gold)" }}
        >
          <p className="t-eyebrow m-0" style={{ color: "var(--gold-text)" }}>스스로 검증</p>
          <h2 className="t-title m-0 mt-2 text-[1.3rem]">다른 방법으로 다시 재봤습니다</h2>
          <p className="t-body m-0 mt-3 max-w-[52rem] text-[0.95rem]">
            이름으로 찾는 방식은 결과가 200명에서 잘리고, 잘린 자리에 어떤 캐릭터가 있었는지 알 수 없습니다.
            명성 점수로 직접 훑는 다른 방법으로 캐릭터 {fmtPeople(verify.meta.sampleSize)}을 다시 재서 두 결과를 맞춰 봤습니다.
          </p>

          <div className="mt-7 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[
              {
                label: "직업 구성",
                value: verify.jobTvd,
                verdict: "좁혀졌습니다",
                body: `처음 조사에서는 ${fmtPp(rounds.first.jobTvd)} 갈렸습니다. 시드를 바꾸자 이만큼으로 줄었습니다.`,
                tone: "var(--accent)",
              },
              {
                label: "성장 단계 분포",
                value: verify.fameTvd,
                verdict: "오히려 벌어졌습니다",
                body: `처음 조사에서는 ${fmtPp(rounds.first.fameTvd)}로 잘 맞아 보였습니다. 잘 맞아서가 아니었습니다.`,
                tone: "var(--gold-text)",
              },
            ].map((c) => (
              <div key={c.label} style={{ borderTop: "1px solid var(--hairline-strong)" }} className="pt-4">
                <p className="t-small m-0">{c.label}</p>
                <p className="num m-0 mt-1 text-[1.9rem] font-bold leading-none" style={{ color: c.tone }}>
                  {fmtPp(c.value)}
                </p>
                <p className="m-0 mt-2 text-[0.95rem] font-bold" style={{ color: "var(--text-primary)" }}>
                  {c.verdict}
                </p>
                <p className="t-body m-0 mt-1 text-[0.9rem]">{c.body}</p>
              </div>
            ))}
          </div>

          <p className="t-body m-0 mt-6 max-w-[52rem] text-[0.95rem]">
            성장 단계는 상한을 걷어낼수록 명성 방식에서 더 멀어집니다.
            {" "}{fmtPp(rounds.fameMethodTvd.firstObserved)}에서 {fmtPp(rounds.fameMethodTvd.secondObserved)},
            상한을 보정하면 {fmtPp(rounds.fameMethodTvd.secondCapCorrected)}입니다.
            명성 방식도 90일 넘게 접속하지 않은 캐릭터를 못 보는데, 검색 상한이 가리던 것이 바로 그 층이기 때문입니다.
            처음 조사에서 잘 맞아 보이던 수치는 두 편향이 서로 상쇄된 결과였습니다.
          </p>
          <p className="m-0 mt-4 text-[0.95rem]">
            <a href="#method">조사 방법 화면에서 처음 조사와 무엇이 달라졌는지 보기</a>
          </p>
        </section>
      </Stagger>
    </PageShell>
  );
}
