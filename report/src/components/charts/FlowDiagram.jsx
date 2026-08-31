import { useState } from "react";
import { useInView, ENTER_MS, STAGGER_MS } from "../../lib/hooks.js";

/** 표본 설계 흐름. 각 단계에 마우스를 올리면 실측치가 나온다. */
export default function FlowDiagram({ steps }) {
  const [ref, seen] = useInView();
  const [active, setActive] = useState(0);
  return (
    <div ref={ref}>
      <ol
        className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2 lg:grid-cols-3"
        style={{ "--flow-steps": steps.length }}
      >
        {steps.map((s, i) => {
          const on = active === i;
          return (
            <li
              key={s.title}
              className="relative px-1 py-4 lg:py-2"
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? "none" : "translateY(10px)",
                transition: `opacity ${ENTER_MS}ms ease ${i * STAGGER_MS * 4}ms, transform ${ENTER_MS}ms ease ${i * STAGGER_MS * 4}ms`,
              }}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
            >
              <div className="mb-2 hidden items-center lg:flex">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "var(--gold)" : "var(--accent)" }} />
                {i < steps.length - 1 && <span className="ml-1 h-px flex-1" style={{ background: "var(--hairline-strong)" }} />}
              </div>
              <p className="t-eyebrow m-0">단계 {i + 1}</p>
              <p className="m-0 mt-1 text-[0.95rem] font-semibold" style={{ color: on ? "var(--accent)" : "var(--text-primary)" }}>
                {s.title}
              </p>
              <p className="t-small m-0 mt-1">{s.body}</p>
              <p className="num m-0 mt-2 text-[0.82rem] font-semibold" style={{ color: "var(--gold-text)" }}>{s.measured}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
