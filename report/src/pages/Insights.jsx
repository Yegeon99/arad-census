import { useState } from "react";
import PageShell, { Stagger } from "../components/PageShell.jsx";
import MiniChart from "../components/charts/MiniChart.jsx";
import { insights, MEASURED } from "../lib/data.js";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "데이터에서 확인됨", label: "데이터에서 확인됨" },
  { key: "추가 검증 필요", label: "추가 검증 필요" },
];

function Block({ label, children, accent }) {
  return (
    <div className="mt-4">
      <p className="t-kicker m-0" style={{ fontSize: "0.72rem", letterSpacing: "0.14em" }}>{label}</p>
      <p className="t-body m-0 mt-2 text-[0.9rem]" style={accent ? { color: "var(--accent)" } : undefined}>
        {children}
      </p>
    </div>
  );
}

function Card({ item, open, onToggle, index }) {
  const confirmed = item.confidence === "데이터에서 확인됨";
  return (
    <Stagger index={index}>
      <div className="flex h-full min-w-0 flex-col py-6" style={{ borderTop: "1px solid var(--hairline-strong)" }}>
        <p className="t-eyebrow m-0" style={{ color: confirmed ? "var(--accent)" : "var(--gold-text)" }}>
          <span className="term" title={confirmed ? "집계 수치 그대로" : "해석이라 더 확인이 필요함"}>
            {item.confidence}
          </span>
        </p>
        <h3 className="t-title m-0 mt-2 text-[1.12rem]">{item.title}</h3>
        <p className="num m-0 mt-1 text-[1.05rem] font-bold" style={{ color: "var(--accent)" }}>{item.keyNumber}</p>

        <Block label="발견">{item.finding}</Block>
        <Block label="해석">{item.interpretation}</Block>

        {open && (
          <>
            <Block label="이렇게 확인할 수 있습니다">{item.validation}</Block>
            <Block label="다음 질문" accent>{item.nextQuestion}</Block>
            <div className="mt-5">
              <p className="t-kicker m-0 mb-2" style={{ fontSize: "0.72rem", letterSpacing: "0.14em" }}>관련 수치</p>
              <MiniChart focus={item.focus} />
            </div>
          </>
        )}

        <button type="button" className="disclose mt-5 self-start" aria-expanded={open} onClick={onToggle}>
          {open ? "접기" : "확인 방법과 관련 차트 펼치기"}
        </button>
      </div>
    </Stagger>
  );
}

export default function Insights() {
  const [filter, setFilter] = useState("all");
  const [openIds, setOpenIds] = useState([]);
  const shown = filter === "all" ? insights : insights.filter((i) => i.confidence === filter);
  const confirmedCount = insights.filter((i) => i.confidence === "데이터에서 확인됨").length;
  const toggle = (id) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <PageShell
      id="insights"
      question="숫자에서 무엇을 읽어냈고, 무엇은 아직 못 믿을까"
      statValue={String(insights.length)}
      statUnit="개"
      statLabel="생성한 인사이트 수"
      statNote={`데이터에서 확인됨 ${confirmedCount}개, 추가 검증 필요 ${insights.length - confirmedCount}개`}
      visual={
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1">
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
          <div className="grid gap-x-10 lg:grid-cols-2">
            {shown.map((item, i) => (
              <Card
                key={item.id}
                item={item}
                index={i}
                open={openIds.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </div>
        </div>
      }
      explain={[
        {
          label: "만든 방법",
          body: [
            "집계 결과 전체와 편향 노트를 한 번에 넣어 언어 모델이 생성했습니다. 모델 호출은 배치로만 했습니다.",
            "문장을 다시 쓸 때에는 항목마다 쓸 수 있는 수치를 미리 못 박아 두었습니다. 그 밖의 숫자가 들어오면 저장이 멈춥니다.",
          ],
        },
        {
          label: "읽는 법",
          body: [
            "데이터에서 확인됨은 집계 수치 자체를 그대로 옮긴 것입니다. 추가 검증 필요는 그 수치에 대한 해석입니다.",
            "해석은 단정하지 않습니다. 대신 무엇을 더 보면 확인할 수 있는지를 카드마다 적어 두었습니다.",
          ],
        },
        {
          label: "비용",
          body: [
            `지금까지 쓴 모델 비용은 모두 합쳐 ${MEASURED.llmCostUsd.toFixed(4)}달러입니다. 호출 기록은 조사 방법과 한계 화면의 실측치 표에 있습니다.`,
          ],
        },
      ]}
    />
  );
}
