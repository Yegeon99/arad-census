import { motion } from "motion/react";
import { PAGES } from "../lib/hooks.js";

// 지금 보는 화면 표시가 눌린 자리로 미끄러져 옮겨 간다 (Motion 담당).
const SLIDE = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 };

/** 상단 고정 내비 (좁은 화면에서는 하단 탭바로 내려간다) */
export function TopNav({ page }) {
  return (
    <header
      className="sticky top-0 z-40 hidden lg:block"
      style={{ background: "rgba(250,250,248,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--hairline)" }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3">
        <a href="#overview" className="no-underline" style={{ color: "var(--text-primary)" }}>
          <span className="t-wordmark" style={{ color: "var(--accent)" }}>DNF CENSUS</span>
        </a>
        <nav className="flex flex-1 items-center gap-1" aria-label="화면 이동">
          {PAGES.map((p) => {
            const on = p.id === page;
            return (
              <motion.a
                key={p.id}
                href={`#${p.id}`}
                aria-current={on ? "page" : undefined}
                className="relative rounded-full px-3 py-1.5 text-[0.86rem] no-underline"
                style={{ color: on ? "var(--bg-surface)" : "var(--text-secondary)", fontWeight: on ? 600 : 450 }}
                whileHover={on ? undefined : { color: "var(--accent)", y: -1 }}
                whileTap={{ y: 0 }}
                transition={{ duration: 0.16 }}
              >
                {on && (
                  <motion.span
                    layoutId="nav-current"
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--accent)" }}
                    transition={SLIDE}
                  />
                )}
                <span className="relative">{p.label}</span>
              </motion.a>
            );
          })}
        </nav>
        <span className="t-small num">2026년 8월 조사</span>
      </div>
    </header>
  );
}

/** 좁은 화면 하단 탭바 */
export function BottomNav({ page }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      aria-label="화면 이동"
      style={{ background: "rgba(250,250,248,0.96)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--hairline)" }}
    >
      <div className="scroll-x flex">
        {PAGES.map((p) => {
          const on = p.id === page;
          return (
            <a
              key={p.id}
              href={`#${p.id}`}
              aria-current={on ? "page" : undefined}
              className="relative shrink-0 px-3.5 py-3 text-center text-[0.78rem] no-underline"
              style={{
                color: on ? "var(--accent)" : "var(--text-muted)",
                fontWeight: on ? 700 : 450,
                borderTop: "2px solid transparent",
              }}
            >
              {on && (
                <motion.span
                  layoutId="nav-current-mobile"
                  className="absolute inset-x-0 top-0"
                  style={{ height: 2, background: "var(--accent)" }}
                  transition={SLIDE}
                />
              )}
              {p.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
