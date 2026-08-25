import { PAGES } from "../lib/hooks.js";

/** 상단 고정 내비 (좁은 화면에서는 하단 탭바로 내려간다) */
export function TopNav({ page }) {
  return (
    <header
      className="sticky top-0 z-40 hidden lg:block"
      style={{ background: "rgba(250,250,248,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--hairline)" }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3">
        <a href="#overview" className="no-underline" style={{ color: "var(--text-primary)" }}>
          <span className="t-eyebrow" style={{ color: "var(--accent)" }}>ARAD CENSUS</span>
        </a>
        <nav className="flex flex-1 items-center gap-1" aria-label="화면 이동">
          {PAGES.map((p) => {
            const on = p.id === page;
            return (
              <a
                key={p.id}
                href={`#${p.id}`}
                aria-current={on ? "page" : undefined}
                className="rounded-full px-3 py-1.5 text-[0.86rem] no-underline transition-colors"
                style={{
                  color: on ? "var(--bg-surface)" : "var(--text-secondary)",
                  background: on ? "var(--accent)" : "transparent",
                  fontWeight: on ? 600 : 450,
                }}
              >
                {p.label}
              </a>
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
              className="shrink-0 px-3.5 py-3 text-center text-[0.78rem] no-underline"
              style={{
                color: on ? "var(--accent)" : "var(--text-muted)",
                fontWeight: on ? 700 : 450,
                borderTop: `2px solid ${on ? "var(--accent)" : "transparent"}`,
              }}
            >
              {p.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
