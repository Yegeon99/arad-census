import { fmtPp } from "../../lib/format.js";

/**
 * 처음 조사 수치와 두 번째 조사 수치를 나란히 놓는 줄.
 * 왼쪽이 처음, 오른쪽이 두 번째다. 화살표는 방향만 알려 주고 좋고 나쁨은 말하지 않는다.
 */
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
              <span className="num text-[1.15rem]" style={{ color: "var(--text-muted)" }}>{r.first}</span>
              <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>&rarr;</span>
              <span className="num text-[1.55rem] font-bold leading-none" style={{ color: tone }}>{r.second}</span>
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
