import { fmtPct, fmtPeople, fmtX } from "../../lib/format.js";
import { useInView, ENTER_MS, STAGGER_MS } from "../../lib/hooks.js";

/** 레이드 진입 비중 지수. 1.00을 가운데 두고 좌우 편차로 읽는다. */
export default function IndexBars({ title, rows, maxDeviation = 1.0 }) {
  const [ref, seen] = useInView();
  return (
    <div ref={ref}>
      <p className="t-eyebrow m-0 mb-1">{title}</p>
      <div className="mb-1 flex items-center gap-3 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
        <span className="w-[9.4rem] shrink-0" />
        <span className="relative flex-1 text-center">표본 평균 1.00</span>
        <span className="w-[3.6rem] shrink-0" />
        <span className="w-[7.8rem] shrink-0" />
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((r, i) => {
          const dev = r.index - 1;
          const w = Math.min(50, (Math.abs(dev) / maxDeviation) * 50);
          const right = dev >= 0;
          return (
            <li key={r.job} className="flex items-center gap-3 py-[3px] text-[0.84rem]">
              <span className="w-[9.4rem] shrink-0 truncate" style={{ color: "var(--text-primary)" }}>{r.job}</span>
              <span className="relative h-[15px] flex-1" style={{ background: "var(--bg-sunken)" }}>
                <span className="absolute inset-y-0" style={{ left: "50%", width: 1, background: "var(--hairline-strong)" }} />
                <span
                  className="absolute inset-y-0"
                  style={{
                    left: right ? "50%" : `${50 - (seen ? w : 0)}%`,
                    width: `${seen ? w : 0}%`,
                    background: right ? "var(--ink-5)" : "var(--gold)",
                    transition: `width ${ENTER_MS}ms cubic-bezier(0.22,0.68,0.31,1) ${i * STAGGER_MS}ms, left ${ENTER_MS}ms cubic-bezier(0.22,0.68,0.31,1) ${i * STAGGER_MS}ms`,
                  }}
                />
              </span>
              <span className="num w-[3.6rem] shrink-0 text-right font-semibold"
                style={{ color: right ? "var(--ink-5)" : "var(--gold-text)" }}>{fmtX(r.index)}</span>
              <span className="num w-[7.8rem] shrink-0 text-right" style={{ color: "var(--text-muted)" }}>
                {fmtPct(r.raidShare * 100)} · {fmtPeople(r.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
