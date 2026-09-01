import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PAGES } from "../lib/hooks.js";
import { isAdmitted, onAdmit, takeSeat } from "../lib/admit.js";
import {
  countUpOnScroll, dimAroundOnScroll, drawRuleOnScroll, revealOnScroll, MAX_STEPS, STEP_MS,
} from "../lib/reveal.js";

/**
 * 화면에 들어오면 차례로 뜬다.
 * 제목이 먼저, 그다음 핵심 수치, 그다음 본문 순서가 되도록 index를 준다.
 *
 * 그리는 차례도 여기서 갈린다. 한 화면을 한 번에 다 그리지 않고 묶음 하나씩
 * 한 프레임에 들여보낸다. 까닭은 lib/admit.js 에 적어 두었다.
 *
 * `noReveal` 을 주면 등장 연출을 걸지 않는다. 그리는 차례는 그대로 기다린다.
 *
 * 등장 연출은 요소를 먼저 투명하게 만들어 두고 화면에 들 때 380밀리초에 걸쳐
 * 띄운다. 화면 하나가 통째로 그런 요소로만 차 있으면, 빠르게 내리는 순간
 * 그 화면이 잠깐 비어 보인다. 인사이트 화면이 그 자리였다. 카드 여덟 장이
 * 화면을 가득 채우는데 여덟 장 모두 연출 대상이라, 스크롤 첫 걸음에서
 * 화면 안 글자가 전부 투명한 순간이 생겼다 (40회 중 15회, 실측).
 *
 * 그래서 이런 자리는 연출에서 뺀다. 임계값을 늘리는 쪽은 같은 일이 다른
 * 화면에서 또 생길 뿐이라 쓰지 않았다.
 */
export function Stagger({ index = 0, children, className = "", style, noReveal = false }) {
  const ref = useRef(null);
  const seat = useRef(null);
  if (seat.current === null) seat.current = takeSeat();
  const [open, setOpen] = useState(() => isAdmitted(seat.current));

  useEffect(() => {
    if (open) return undefined;
    return onAdmit(seat.current, () => setOpen(true));
  }, [open]);
  useEffect(() => {
    if (!open || noReveal) return undefined;
    return revealOnScroll(ref.current, { delay: Math.min(index, MAX_STEPS) * STEP_MS });
  }, [open, index, noReveal]);

  return (
    <div ref={ref} className={className} style={style}>
      {open ? children : null}
    </div>
  );
}

/** 화면에 들어올 때 0에서 실제 값까지 세어 올라가는 숫자. 최초 1회만 돈다. */
export function CountUp({ value, format, className, style }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);
  useEffect(() => countUpOnScroll(ref.current, value, setShown), [value]);
  return (
    <span ref={ref} className={className} style={style}>
      {format(shown)}
    </span>
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.28, ease: [0.22, 0.68, 0.31, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
  notice,
  statValue,
  statNumber,
  statFormat,
  statUnit,
  statLabel,
  statNote,
  intro,
  visual,
  visualCaption,
  visualFocus = false,
  // 시각화 덩어리가 화면보다 클 때 참으로 준다. 화면보다 큰 덩어리를 통째로
  // 투명하게 만들었다 띄우면, 띄우는 동안 화면에 아무것도 없는 순간이 생긴다.
  visualNoReveal = false,
  explain,
  details,
  detailsLabel = "세부 데이터 펼치기",
  children,
}) {
  const index = PAGES.findIndex((p) => p.id === id);
  const current = PAGES[index];
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];

  const ruleRef = useRef(null);
  const figureRef = useRef(null);
  const articleRef = useRef(null);

  useEffect(() => drawRuleOnScroll(ruleRef.current), []);

  // 입체 시각화가 있는 화면에서만: 시각화가 화면 가운데 오면 주변 글을 살짝 죽인다
  useEffect(() => {
    if (!visualFocus) return undefined;
    const around = articleRef.current?.querySelectorAll("[data-around-visual]");
    return dimAroundOnScroll(figureRef.current, around);
  }, [visualFocus]);

  return (
    <article ref={articleRef} className="mx-auto w-full max-w-[1200px] px-5 pt-8 pb-16 lg:px-8 lg:pt-12">
      <Stagger index={0}>
        <p className="t-eyebrow m-0">
          화면 {index + 1} <span style={{ opacity: 0.5 }}>/</span> {PAGES.length}
        </p>
        <h1 className="t-title mt-1 mb-0">{current.label}</h1>
        {notice && <p className="t-small m-0 mt-3 max-w-[46rem]">{notice}</p>}
      </Stagger>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
        <Stagger index={1}>
          <p className="t-lead m-0 max-w-[680px]">{question}</p>
        </Stagger>
        {(statValue || statNumber !== undefined) && (
          <Stagger index={2}>
            <div className="lg:text-right">
              <div className="t-display" style={{ color: "var(--accent)" }}>
                {statNumber !== undefined
                  ? <CountUp value={statNumber} format={statFormat} />
                  : statValue}
                {statUnit && <span style={{ fontSize: "0.42em", marginLeft: "0.12em", letterSpacing: "-0.01em" }}>{statUnit}</span>}
              </div>
              <div className="t-body m-0 text-[0.92rem]">{statLabel}</div>
              {statNote && <div className="t-small m-0 max-w-[22rem] lg:ml-auto">{statNote}</div>}
            </div>
          </Stagger>
        )}
      </div>

      <hr ref={ruleRef} className="rule mt-8 mb-8" />

      {intro && (
        <Stagger index={3}>
          <div data-around-visual>{intro}</div>
        </Stagger>
      )}

      {visual && (
        <Stagger index={4} noReveal={visualNoReveal}>
          <figure ref={figureRef} className="m-0">
            {visual}
            {visualCaption && <figcaption className="t-small prose mt-3">{visualCaption}</figcaption>}
          </figure>
        </Stagger>
      )}

      {explain && (
        <Stagger index={5}>
          <div className="mt-10" data-around-visual>
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
