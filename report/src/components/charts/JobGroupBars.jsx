import { groupColor } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";
import { useInView, ENTER_MS, STAGGER_MS } from "../../lib/hooks.js";

/**
 * 직업군 한 줄에 그 직업군의 인원을 그린 막대.
 * 줄 길이가 직업군 크기다.
 *
 * 전직을 칸으로 쪼개 그리지 않는 이유는 집계에 있다. 남녀가 나뉜 직업군은
 * 전직 이름이 같아서, 집계 파일만으로는 어느 쪽 직업군의 전직인지 가릴 수 없다.
 * 원본 표본은 이미 폐기해 뒤늦게 나눌 방법도 없다. 나눌 수 없는 것을 나눠
 * 그리는 대신 직업군 크기만 그린다.
 */
export default function JobGroupBars({ groups, total }) {
  const [ref, seen] = useInView();
  const n = groups.length;
  const max = groups[0].count;

  return (
    <div ref={ref}>
      <ol className="m-0 list-none p-0">
        {groups.map((g, gi) => {
          const rowPct = (g.count / max) * 100;
          return (
            <li key={g.jobName} className="flex items-center gap-3 py-[3px]">
              <span
                className="w-[6.4rem] shrink-0 truncate text-[0.82rem]"
                style={{ color: "var(--text-secondary)" }}
                title={g.jobName}
              >
                {g.jobName}
              </span>
              <span className="relative h-[22px] flex-1" style={{ background: "var(--bg-sunken)" }}>
                <span
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: seen ? `${rowPct}%` : 0,
                    background: groupColor(gi, n, 0.25),
                    transition: `width ${ENTER_MS}ms cubic-bezier(0.22,0.68,0.31,1) ${gi * STAGGER_MS}ms`,
                  }}
                />
              </span>
              <span className="num w-[7.6rem] shrink-0 text-right text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {fmtPeople(g.count)} {fmtPct((g.count / total) * 100)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
