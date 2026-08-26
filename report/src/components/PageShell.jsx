import { useState } from "react";
import { PAGES } from "../lib/hooks.js";

/** 화면 진입 시 요소 순차 등장 (120밀리초 간격) */
export function Stagger({ index = 0, children, className = "", style }) {
  return (
    <div className={`rise ${className}`} style={{ animationDelay: `${index * 120}ms`, ...style }}>
      {children}
    </div>
  );
}

/** 접기 펼치기: 상자 없이 텍스트 링크로만 */
export function Disclose({ label, openLabel, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8">
      <hr className="rule mb-3" />
      <button type="button" className="disclose" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? (openLabel ?? "세부 데이터 접기") : label}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** 소제목 라벨을 단 본문 묶음. 한 문단은 두세 문장까지만 담는다. */
export function Prose({ sections }) {
  return (
    <div className="space-y-9">
      {sections.map((section, i) => {
        const label = typeof section === "string" ? null : section.label;
        const body = typeof section === "string" ? [section] : section.body;
        return (
          <div key={label ?? i}>
            {label && <p className="t-kicker m-0 mb-2">{label}</p>}
            <div className="prose">
              {body.map((para, j) => (
                <p key={j} className="t-body m-0">{para}</p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 화면 공통 뼈대: 리드, 메인 시각화, 해설, 세부 데이터, 이전 다음 */
export default function PageShell({
  id,
  question,
  statValue,
  statUnit,
  statLabel,
  statNote,
  visual,
  visualCaption,
  explain,
  details,
  detailsLabel = "세부 데이터 펼치기",
  children,
}) {
  const index = PAGES.findIndex((p) => p.id === id);
  const current = PAGES[index];
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];

  return (
    <article className="mx-auto w-full max-w-[1200px] px-5 pt-8 pb-16 lg:px-8 lg:pt-12">
      <Stagger index={0}>
        <p className="t-eyebrow m-0">
          화면 {index + 1} <span style={{ opacity: 0.5 }}>/</span> {PAGES.length}
        </p>
        <h1 className="t-title mt-1 mb-0">{current.label}</h1>
      </Stagger>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
        <Stagger index={1}>
          <p className="t-kicker m-0">이 페이지가 답하는 질문은 하나입니다.</p>
          <p className="t-lead m-0 mt-2 max-w-[680px]">{question}</p>
        </Stagger>
        {statValue && (
          <Stagger index={2}>
            <div className="lg:text-right">
              <div className="t-display" style={{ color: "var(--accent)" }}>
                {statValue}
                {statUnit && <span style={{ fontSize: "0.42em", marginLeft: "0.12em", letterSpacing: "-0.01em" }}>{statUnit}</span>}
              </div>
              <div className="t-body m-0 text-[0.92rem]">{statLabel}</div>
              {statNote && <div className="t-small m-0">{statNote}</div>}
            </div>
          </Stagger>
        )}
      </div>

      <hr className="rule mt-8 mb-8" />

      {visual && (
        <Stagger index={4}>
          <figure className="m-0">
            {visual}
            {visualCaption && <figcaption className="t-small prose mt-3">{visualCaption}</figcaption>}
          </figure>
        </Stagger>
      )}

      {explain && (
        <Stagger index={5}>
          <div className="mt-10">
            <Prose sections={explain} />
          </div>
        </Stagger>
      )}

      {children}

      {details && (
        <Stagger index={6}>
          <Disclose label={detailsLabel}>{details}</Disclose>
        </Stagger>
      )}

      <nav className="mt-12 flex items-center justify-between gap-4" aria-label="이전 다음 화면">
        {prev ? (
          <a href={`#${prev.id}`} className="no-underline">
            <span className="t-small block">이전 화면</span>
            <span className="text-[0.98rem]" style={{ color: "var(--accent)" }}>{prev.label}</span>
          </a>
        ) : <span />}
        {next ? (
          <a href={`#${next.id}`} className="text-right no-underline">
            <span className="t-small block">다음 화면</span>
            <span className="text-[0.98rem]" style={{ color: "var(--accent)" }}>{next.label}</span>
          </a>
        ) : <span />}
      </nav>
    </article>
  );
}
