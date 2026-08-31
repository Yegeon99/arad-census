import { useEffect, useRef } from "react";
import { fmtPp } from "../../lib/format.js";
import { countOnScroll } from "../../lib/reveal.js";

/**
 * 처음 조사 수치와 두 번째 조사 수치를 나란히 놓는 줄.
 * 화면에 들어오면 오른쪽 숫자가 처음 값에서 두 번째 값으로 옮겨 간다.
 * 두 값 모두 처음부터 화면에 있고, 옮겨 가는 것은 오른쪽 숫자뿐이다.
 *
 * 숫자는 글자만 직접 갈아 끼운다. 상태로 바꾸면 매 프레임 화면 전체를 다시 그린다.
 */
function MovingNumber({ from, to, format, className, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    return countOnScroll(el, {
      from,
      to,
      duration: 800,
      onValue: (v) => { el.textContent = format(v); },
    });
  }, [from, to, format]);
  // 자바스크립트가 아직 안 돌았을 때도 끝값이 보이게 둔다
  return <span ref={ref} className={className} style={style}>{format(to)}</span>;
}

export default function RoundCompare({ rows }) {
  return (
    <ul className="m-0 grid list-none gap-x-10 gap-y-5 p-0 sm:grid-cols-2">
      {rows.map((r) => {
        const better = r.better === undefined ? null : r.better;
        const tone = better === null ? "var(--text-primary)" : better ? "var(--accent)" : "var(--gold-text)";
        return (
          <li key={r.label} className="pt-3" style={{ borderTop: "1px solid var(--hairline)" }}>
            <p className="t-small m-0">{r.label}</p>
            <p className="m-0 mt-1 flex items-baseline gap-2">
              <span className="num text-[1.15rem]" style={{ color: "var(--text-muted)" }}>
                {r.format(r.from)}
              </span>
              <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>&rarr;</span>
              <MovingNumber
                from={r.from}
                to={r.to}
                format={r.format}
                className="num text-[1.55rem] font-bold leading-none"
                style={{ color: tone }}
              />
            </p>
            {r.note && <p className="t-small m-0 mt-1">{r.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** 세 값을 한 줄에 놓는 대조 (관측 두 개와 보정 하나) */
export function TvdRow({ rows }) {
  return (
    <table className="plain" style={{ maxWidth: 520 }}>
      <thead>
        <tr><th>기준</th><th className="text-right">명성 방식과의 차이</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ color: "var(--text-primary)" }}>{r.label}</td>
            <td className="num text-right" style={{ color: r.tone ?? "var(--text-secondary)", fontWeight: r.tone ? 700 : 400 }}>
              {fmtPp(r.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
