import { useInView, ENTER_MS, STAGGER_MS } from "../../lib/hooks.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";

/** 상위 직업 가로 바. 마우스를 올린 줄만 도드라진다. */
export default function TopBars({ items, hover, setHover }) {
  const [ref, seen] = useInView();
  const max = Math.max(...items.map((d) => d.pct));
  return (
    <ol ref={ref} className="m-0 list-none p-0">
      {items.map((d, i) => {
        const on = hover && hover.job === d.jobName;
        return (
          <li
            key={d.jobName}
            className="flex items-center gap-3 py-[3px]"
            onMouseEnter={() => setHover({ job: d.jobName, count: d.count })}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          >
            <span className="num w-5 shrink-0 text-right text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
            <span className="w-[7.2rem] shrink-0 truncate text-[0.86rem]"
              style={{ color: on ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: on ? 700 : 450 }}>
              {d.jobName}
            </span>
            <span className="relative h-[13px] flex-1" style={{ background: "var(--bg-sunken)" }}>
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: seen ? `${(d.pct / max) * 100}%` : 0,
                  background: on ? "var(--gold)" : "var(--ink-5)",
                  transition: `width ${ENTER_MS}ms cubic-bezier(0.22,0.68,0.31,1) ${i * STAGGER_MS}ms, background-color 0.18s`,
                }}
              />
            </span>
            <span className="num w-[9.5rem] shrink-0 text-right text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
              {fmtPct(d.pct)} <span style={{ color: "var(--text-muted)" }}>{fmtPeople(d.count)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
