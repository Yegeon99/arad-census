import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import MiniChart from "../components/charts/MiniChart.jsx";
import { insights, MEASURED } from "../lib/data.js";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "데이터에서 확인됨", label: "데이터에서 확인됨" },
  { key: "추가 검증 필요", label: "추가 검증 필요" },
];

function Card({ item, open, onToggle, index }) {
  const confirmed = item.confidence === "데이터에서 확인됨";
  return (
    <Stagger index={index}>
      <div className="flex h-full min-w-0 flex-col py-5" style={{ borderTop: "1px solid var(--hairline-strong)" }}>
        <p className="t-eyebrow m-0" style={{ color: confirmed ? "var(--accent)" : "var(--gold-text)" }}>
          {item.confidence}
        </p>
        <h3 className="t-title m-0 mt-2 text-[1.08rem]">{item.title}</h3>
        <p className="t-body m-0 mt-3 text-[0.92rem]">{item.finding}</p>
        <p className="t-body m-0 mt-3 text-[0.92rem]" style={{ color: "var(--text-secondary)" }}>{item.interpretation}</p>

        {open && (
          <div className="mt-4">
            <hr className="rule mb-3" />
            <p className="m-0 text-[0.82rem] font-semibold" style={{ color: "var(--text-primary)" }}>이렇게 확인할 수 있습니다</p>
            <p className="t-body m-0 mt-1 text-[0.88rem]">{item.validation}</p>
            <p className="m-0 mt-3 text-[0.82rem] font-semibold" style={{ color: "var(--text-primary)" }}>다음 질문</p>
            <p className="m-0 mt-1 text-[0.88rem]" style={{ color: "var(--accent)" }}>{item.nextQuestion}</p>
            <div className="mt-4">
              <p className="t-eyebrow m-0 mb-1">관련 수치</p>
              <MiniChart focus={item.focus} />
            </div>
          </div>
        )}

        <button type="button" className="disclose mt-4 self-start" aria-expanded={open} onClick={onToggle}>
          {open ? "접기" : "확인 방법과 관련 차트 펼치기"}
        </button>
      </div>
    </Stagger>
  );
}

export default function Insights() {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(insights[0]?.id ?? null);
  const shown = filter === "all" ? insights : insights.filter((i) => i.confidence === filter);
  const confirmedCount = insights.filter((i) => i.confidence === "데이터에서 확인됨").length;

  return (
    <PageShell
      id="insights"
      question="이 페이지가 답하는 질문은 하나입니다. 집계에서 무엇을 읽어냈고 무엇을 아직 못 믿습니까?"
      statValue={String(insights.length)}
      statUnit="개"
      statLabel="생성한 인사이트 수"
      statNote={`데이터에서 확인됨 ${confirmedCount}개, 추가 검증 필요 ${insights.length - confirmedCount}개`}
      visual={
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button key={f.key} type="button" className="disclose" onClick={() => setFilter(f.key)}
                  style={{ color: on ? "var(--text-primary)" : "var(--accent)", fontWeight: on ? 700 : 450, textDecoration: on ? "none" : "underline" }}>
                  {f.label}
                </button>
              );
            })}
            <p className="t-small m-0">카드를 펼치면 확인 방법과 함께 관련 차트가 나옵니다.</p>
          </div>
          <div className="scroll-x">
            <div className="grid grid-flow-col gap-x-8" style={{ gridAutoColumns: "minmax(320px, 1fr)" }}>
              {shown.map((item, i) => (
                <Card
                  key={item.id}
                  item={item}
                  index={i}
                  open={openId === item.id}
                  onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                />
              ))}
            </div>
          </div>
        </div>
      }
      visualCaption="가로로 밀어서 다음 카드를 볼 수 있습니다."
      explain={[
        "인사이트는 집계 결과 전체와 편향 노트를 한 번에 넣어 언어 모델이 생성했습니다. 문장을 다시 쓸 때에도 새 숫자를 만들지 못하게 쓸 수 있는 수치를 미리 못 박았고, 생성 뒤에는 모든 숫자를 집계 원본과 하나씩 맞추어 보았습니다.",
        "데이터에서 확인됨은 집계 수치 자체를 그대로 옮긴 것이고, 추가 검증 필요는 그 수치에 대한 해석입니다. 해석은 단정하지 않고, 무엇을 더 보면 확인할 수 있는지를 함께 적었습니다.",
        `모델 호출은 배치로만 했고 지금까지 쓴 비용은 모두 합쳐 ${MEASURED.llmCostUsd.toFixed(4)}달러입니다. 호출 기록은 조사 방법과 한계 화면의 실측치 표에 있습니다.`,
      ]}
    />
  );
}
