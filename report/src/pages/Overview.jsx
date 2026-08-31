import PageShell, { CountUp, Stagger } from "../components/PageShell.jsx";
import Chart from "../components/Chart.jsx";
import SearchExplainer from "../components/SearchExplainer.jsx";
import SampleStageBars from "../components/charts/SampleStageBars.jsx";
import { fmtInt, fmtPct, fmtPeople, fmtPp } from "../lib/format.js";
import {
  meta, dist, complete, MEASURED, fameCompare, fameSample, completeFameSample,
  topJobs, finalSample, verify,
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
    title: "보정값",
    body: "잘린 검색의 쏠림을 쏠림 없는 표본의 비율로 되돌려 다시 계산한 값입니다.",
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
  const fullNote = `강한 캐릭터 쪽으로 쏠림 있음, ${fmtPeople(fameSample)}`;
  const completeNote = `검색 한도에 안 걸려 전부 받은 ${fmtPeople(completeFameSample)}`;
  const pyramidProps = { full: dist.fameBins, complete: complete.fameBins, fullNote, completeNote };

  return (
    <PageShell
      id="overview"
      question="던파 캐릭터 3만 명은 지금 어디까지 성장해 있을까"
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
          so="쏠림 없는 표본은 열 명 중 여덟 명이 레이드 이전 단계입니다. 전체 표본에서는 열 명 중 네다섯 명입니다."
        >
          <SampleStageBars {...pyramidProps} />
        </Chart>
      }
      explain={[
        {
          label: "조사한 것",
          body: [
            `던전앤파이터 캐릭터 표본을 서버 ${meta.servers.length}곳에서 뽑아 직업과 성장 단계, 접속 기록을 살펴봤습니다.`,
            "표본은 캐릭터 이름에 한국어 두 글자를 넣어 검색하는 방식으로 모았습니다.",
          ],
        },
        {
          label: "표본을 둘로 나눈 이유",
          body: [
            "잘린 검색은 강한 캐릭터 쪽으로 쏠립니다. 그 쏠림이 얼마나 큰지 재려고 쏠림 없는 표본을 따로 집계했습니다.",
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
            href="#jobs"
            kicker="직업"
            title={`가장 많은 직업은 ${topJobs[0].jobName}입니다`}
            body={`성장을 마친 캐릭터 안에서 ${fmtPct(topJobs[0].pct)}를 차지합니다. 상위 5개 직업을 합치면 넷 중 하나에 가깝습니다.`}
          />
          <FindingCard
            index={1}
            href="#growth"
            kicker="성장 단계"
            title="잘린 검색을 빼면 레이드 이전 단계가 두 배로 뜁니다"
            body={`전체 표본에서는 ${fmtPct(fameCompare[0].full)}인데, 쏠림 없는 표본 보면 ${fmtPct(fameCompare[0].complete)}입니다.`}
          />
          <FindingCard
            index={2}
            href="#method"
            kicker="스스로 검증"
            title="같은 것을 두 방법으로 재봤습니다"
            body={`성장 단계 분포는 ${fmtPp(verify.fameTvd)} 차이로 거의 같았고, 직업 구성은 ${fmtPp(verify.jobTvd)} 갈렸습니다. 대신 활성도 판정에서 더 큰 문제를 찾았습니다.`}
          />
        </div>
      </Stagger>

      <Stagger index={7}>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          <BigNumber index={0} value={finalSample} suffix="명" label="성장을 마친 캐릭터" note="직업 순위는 이 기준으로 셉니다" />
          <BigNumber index={1} value={meta.servers.length} suffix="곳" label="조사한 서버" note="공개된 서버 전부" />
          <BigNumber index={2} value={meta.completeSampleSize} suffix="명" label="쏠림 없는 표본" note="200명에 걸리지 않은 검색에서 발견" />
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
                label: "성장 단계 분포",
                value: verify.fameTvd,
                verdict: "거의 같았습니다",
                body: "검색이 잘리는 문제가 이 축을 크게 왜곡하지는 않았습니다.",
                tone: "var(--accent)",
              },
              {
                label: "직업 구성",
                value: verify.jobTvd,
                verdict: "뚜렷이 갈렸습니다",
                body: "이름으로 뽑는 방식이 직업 쪽으로 치우칠 수 있다는 뜻입니다.",
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
            대신 활성도 판정에서 더 큰 문제를 찾았습니다.
            최근 기록이 없으면 조용한 캐릭터로 봤는데, 명성이 낮은 캐릭터는 접속해도 기록에 남는 행동을 잘 하지 않습니다.
            낮은 구간의 조용한 비중이 부풀었을 수 있습니다.
          </p>
          <p className="m-0 mt-4 text-[0.95rem]">
            <a href="#method">조사 방법과 한계 화면에서 자세히 보기</a>
          </p>
        </section>
      </Stagger>
    </PageShell>
  );
}
