import { useState } from "react";
import PageShell, { CountUp, Stagger } from "../components/PageShell.jsx";
import Chart from "../components/Chart.jsx";
import SearchExplainer from "../components/SearchExplainer.jsx";
import ViewToggle from "../components/ViewToggle.jsx";
import Pyramid2D from "../components/charts/Pyramid2D.jsx";
import { LazySamplePyramid } from "../components/three/Lazy.jsx";
import { useCanRender3D, useIdleMount } from "../lib/hooks.js";
import { fmtInt, fmtPct, fmtPeople } from "../lib/format.js";
import {
  meta, dist, complete, MEASURED, fameCompare, fameSample, completeFameSample,
  actOverall, actAdjusted, dormantLabel, topJobs, finalSample,
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
  const can3D = useCanRender3D();
  const idle = useIdleMount();
  const [mode, setMode] = useState("solid");
  const effective = can3D && idle && mode === "solid" ? "solid" : "flat";

  const fullNote = `강한 캐릭터 쪽으로 쏠림 있음, ${fmtPeople(fameSample)}`;
  const completeNote = `검색 한도에 안 걸려 전부 받은 ${fmtPeople(completeFameSample)}`;
  const pyramidProps = { full: dist.fameBins, complete: complete.fameBins, fullNote, completeNote };
  const flatPyramid = <Pyramid2D {...pyramidProps} />;

  return (
    <PageShell
      id="overview"
      question="던파 캐릭터 3만 명은 지금 어디까지 성장해 있을까"
      visualFocus={effective === "solid"}
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
          how="한 층이 성장 단계 하나입니다. 층이 두꺼울수록 그 단계에 있는 캐릭터가 많습니다. 두 피라미드는 밑변과 전체 높이가 같고, 자른 위치만 다릅니다."
          so="쏠림 없는 표본은 열 명 중 여덟 명이 레이드 이전 단계입니다. 전체 표본에서는 열 명 중 네다섯 명입니다."
        >
          <ViewToggle mode={effective} setMode={setMode} available={can3D} />
          {effective === "solid"
            ? <LazySamplePyramid {...pyramidProps} fallback={flatPyramid} />
            : flatPyramid}
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
            href="#activity"
            kicker="활성도"
            title="보정하면 조용한 캐릭터가 훨씬 많아집니다"
            body={`90일 넘게 기록이 없는 비중이 ${fmtPct(actOverall[dormantLabel].pct)}에서 ${fmtPct(actAdjusted[dormantLabel])}로 올라갑니다.`}
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
    </PageShell>
  );
}
