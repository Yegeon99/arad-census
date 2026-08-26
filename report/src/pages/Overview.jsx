import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import ViewToggle from "../components/ViewToggle.jsx";
import Pyramid2D from "../components/charts/Pyramid2D.jsx";
import { LazySamplePyramid } from "../components/three/Lazy.jsx";
import { useCanRender3D, useCountUp, useIdleMount, useReducedMotion } from "../lib/hooks.js";
import { fmtInt, fmtPct, fmtPeople } from "../lib/format.js";
import {
  meta, dist, complete, MEASURED, fameCompare, fameSample, completeFameSample,
  actOverall, actAdjusted, dormantLabel, topJobs,
} from "../lib/data.js";

function BigNumber({ value, suffix, label, note, index }) {
  const reduced = useReducedMotion();
  const shown = useCountUp(value, { enabled: !reduced, duration: 1200 });
  return (
    <Stagger index={index}>
      <div>
        <p className="num m-0 text-[2.1rem] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
          {fmtInt(Math.round(shown))}<span className="text-[1.1rem] font-semibold" style={{ color: "var(--text-secondary)" }}>{suffix}</span>
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

  const fullBins = dist.fameBins;
  const completeBins = complete.fameBins;
  const fullNote = `명성값이 있는 ${fmtPeople(fameSample)} 기준`;
  const completeNote = `명성값이 있는 ${fmtPeople(completeFameSample)} 기준`;

  const pyramidProps = { full: fullBins, complete: completeBins, fullNote, completeNote };
  const flatPyramid = <Pyramid2D {...pyramidProps} />;

  return (
    <PageShell
      id="overview"
      question="이 조사는 무엇을 어떻게 보았습니까?"
      statValue={fmtInt(meta.sampleSize)}
      statUnit="명"
      statLabel="조사한 캐릭터 수"
      statNote={`서버 ${meta.servers.length}곳, ${MEASURED.surveyedAt} 수집`}
      visual={
        <div>
          <ViewToggle mode={effective === "solid" ? "solid" : "flat"} setMode={setMode} available={can3D} />
          {effective === "solid"
            ? <LazySamplePyramid {...pyramidProps} fallback={flatPyramid} />
            : flatPyramid}
        </div>
      }
      visualCaption={`왼쪽은 전체 표본, 오른쪽은 완전 검색 표본입니다. 두 피라미드의 밑동을 견주어 보십시오. 레기온 입장 전 구간이 전체 표본에서는 ${fmtPct(fameCompare[0].full)}, 완전 검색 표본에서는 ${fmtPct(fameCompare[0].complete)}입니다.`}
      explain={[
        {
          label: "무엇을 보았는가",
          body: [
            `던전앤파이터 캐릭터 표본을 서버 ${meta.servers.length}곳에서 뽑아 직업과 성장 단계, 접속 기록을 살펴본 조사입니다.`,
            "표본은 캐릭터 이름에 한국어 두 글자를 넣어 검색하는 방식으로 모았습니다.",
          ],
        },
        {
          label: "왜 표본을 둘로 나눠 보는가",
          body: [
            "검색 결과는 한 번에 200명까지만 돌아옵니다. 200명 한도에 걸린 검색을 한도 검색, 한도에 걸리지 않아 해당 글자가 들어간 캐릭터를 빠짐없이 가져온 검색을 완전 검색이라고 부릅니다.",
            `완전 검색으로만 모은 표본은 성장 단계가 훨씬 아래쪽에 몰려 있습니다. 위 피라미드에서 맨 아래층이 ${fmtPct(fameCompare[0].full)}에서 ${fmtPct(fameCompare[0].complete)}로 두꺼워지는 것이 그 차이입니다.`,
          ],
        },
        {
          label: "이 리포트가 하지 않는 것",
          body: [
            "이 조사는 게임 전체 인구를 추정하지 않습니다. 표본을 어떻게 뽑았고 그 표본이 어디로 기울어 있는지를 끝까지 드러내는 방법론 시연입니다.",
            "기울어진 방향과 크기는 조사 방법과 한계 화면에 그대로 적어 두었습니다.",
          ],
        },
      ]}
    >
      <Stagger index={5}>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <BigNumber index={0} value={fameSample} suffix="명" label="명성값이 있는 표본" note="성장 단계를 셀 수 있는 캐릭터" />
          <BigNumber index={1} value={meta.servers.length} suffix="곳" label="조사한 서버" note="공개된 서버 전부" />
          <BigNumber index={2} value={meta.completeSampleSize} suffix="명" label="완전 검색 표본" note="한도에 걸리지 않은 검색에서 발견" />
          <BigNumber index={3} value={MEASURED.apiCalls} suffix="회" label="주고받은 요청" note="실패 없이 마쳤습니다" />
        </div>
      </Stagger>

      <Stagger index={6}>
        <h2 className="t-title mt-14 mb-1 text-[1.3rem]">핵심 발견 세 가지</h2>
        <p className="t-small m-0 mb-2">각 항목을 누르면 해당 화면으로 갑니다.</p>
        <div className="grid gap-x-8 lg:grid-cols-3">
          <FindingCard
            index={0}
            href="#jobs"
            kicker="직업"
            title={`가장 많은 직업은 ${topJobs[0].jobName}입니다`}
            body={`표본 안에서 ${fmtPct(topJobs[0].pct)}를 차지합니다. 상위 5개 직업을 합치면 넷 중 하나에 가깝습니다.`}
          />
          <FindingCard
            index={1}
            href="#growth"
            kicker="성장 단계"
            title="발견 경로를 바꾸면 피라미드 밑동이 두 배 가까이 두꺼워집니다"
            body={`레기온 입장 전 구간 비중이 전체 표본 ${fmtPct(fameCompare[0].full)}에서 완전 검색 표본 ${fmtPct(fameCompare[0].complete)}로 커집니다.`}
          />
          <FindingCard
            index={2}
            href="#activity"
            kicker="활성도"
            title="편향을 보정하면 조용한 캐릭터가 훨씬 많아집니다"
            body={`90일 넘게 기록이 없는 비중이 보정 전 ${fmtPct(actOverall[dormantLabel].pct)}에서 보정 후 ${fmtPct(actAdjusted[dormantLabel])}로 올라갑니다.`}
          />
        </div>
      </Stagger>
    </PageShell>
  );
}
