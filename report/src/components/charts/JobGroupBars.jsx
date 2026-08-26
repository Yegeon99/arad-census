import { groupColor, onGroupColor } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { useInView, ENTER_MS, STAGGER_MS } from "../../lib/hooks.js";

const LABEL_MIN_PX = 52; // 이보다 좁은 칸에는 이름을 넣지 않는다

/**
 * 직업군 한 줄에 그 직업군의 전직을 이어 붙인 막대.
 * 줄 길이는 직업군 크기, 칸 길이는 그 안에서 전직이 차지하는 몫이다.
 */
export default function JobGroupBars({ tree, hover, setHover }) {
  const [ref, seen] = useInView();
  const groups = tree.groups;
  const n = groups.length;
  const max = groups[0].count;

  return (
    <div ref={ref}>
      <ol className="m-0 list-none p-0">
        {groups.map((g, gi) => {
          const rowPct = (g.count / max) * 100;
          const onGroup = hover && hover.group === g.group;
          return (
            <li key={g.group} className="flex items-center gap-3 py-[3px]">
              <span
                className="w-[6.4rem] shrink-0 truncate text-[0.82rem]"
                style={{ color: onGroup ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: onGroup ? 700 : 500 }}
                title={g.group}
              >
                {g.group}
              </span>
              <span className="relative h-[22px] flex-1" style={{ background: "var(--bg-sunken)" }}>
                <span
                  className="absolute inset-y-0 left-0 flex overflow-hidden"
                  style={{
                    width: seen ? `${rowPct}%` : 0,
                    transition: `width ${ENTER_MS}ms cubic-bezier(0.22,0.68,0.31,1) ${gi * STAGGER_MS}ms`,
                  }}
                >
                  {g.children.map((c, ci) => {
                    const light = Math.min(1, 0.2 + (ci / Math.max(1, g.children.length - 1)) * 0.8);
                    const share = (c.count / g.count) * 100;
                    const onJob = hover && hover.job === c.job && hover.group === g.group;
                    const wide = (share / 100) * rowPct >= (LABEL_MIN_PX / 320) * 100;
                    return (
                      <span
                        key={c.job}
                        className="flex h-full shrink-0 items-center justify-center overflow-hidden px-1"
                        style={{
                          width: `${share}%`,
                          background: groupColor(gi, n, light),
                          outline: onJob ? "2px solid var(--gold)" : "none",
                          outlineOffset: "-2px",
                        }}
                        onMouseEnter={() => setHover({ group: g.group, job: c.job, count: c.count })}
                        onMouseLeave={() => setHover(null)}
                        title={`${c.job} ${fmtPeople(c.count)}`}
                      >
                        {wide && (
                          <span className="truncate text-[0.66rem] font-semibold" style={{ color: onGroupColor(gi, n, light) }}>
                            {c.job}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </span>
              </span>
              <span className="num w-[7.6rem] shrink-0 text-right text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                {fmtPeople(g.count)} {fmtPct((g.count / tree.total) * 100)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="t-small mt-2 min-h-[1.5rem]">
        {hover && hover.job
          ? `${hover.group} 안의 ${hover.job}, ${fmtPeople(hover.count)} 전체의 ${fmtPct((hover.count / tree.total) * 100)}`
          : "칸에 마우스를 올리면 전직 이름과 인원이 나옵니다. 좁은 칸은 이름을 접었습니다."}
      </p>
    </div>
  );
}
