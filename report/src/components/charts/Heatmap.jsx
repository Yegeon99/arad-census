import { inkScale } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";

/** 직업 20종과 명성 6구간 교차표. 칸 색은 직업 안에서의 구간 비중이다. */
export default function Heatmap({ rows, cols, cellCount, cellShare, rowTotal, selected, setSelected }) {
  return (
    <div>
      <div className="scroll-x">
        <table className="border-collapse text-[0.76rem]" style={{ minWidth: 720, width: "100%" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 p-1 text-left font-semibold"
                style={{ background: "var(--bg-base)", color: "var(--text-secondary)", minWidth: 112 }}>
                직업
              </th>
              {cols.map((c) => (
                <th key={c} className="p-1 text-center font-medium"
                  style={{ color: "var(--text-secondary)", minWidth: 76 }}>{c}</th>
              ))}
              <th className="p-1 text-right font-medium" style={{ color: "var(--text-muted)", minWidth: 60 }}>표본</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const total = rowTotal(r);
              const on = selected === r;
              return (
                <tr key={r} onClick={() => setSelected(on ? null : r)} style={{ cursor: "pointer" }}>
                  <td className="sticky left-0 z-10 p-1 font-medium"
                    style={{ background: "var(--bg-base)", color: on ? "var(--accent)" : "var(--text-primary)", fontWeight: on ? 700 : 500 }}>
                    {r}
                  </td>
                  {cols.map((c) => {
                    const v = cellCount(r, c);
                    if (v === null) {
                      return (
                        <td key={c} className="p-[2px]">
                          <div className="flex h-[26px] items-center justify-center text-[0.62rem]"
                            style={{ background: "var(--masked)", color: "var(--text-muted)" }}
                            title="표본 10명 미만이라 공개하지 않습니다">
                            공개 안 함
                          </div>
                        </td>
                      );
                    }
                    const share = cellShare(r, c);
                    return (
                      <td key={c} className="p-[2px]">
                        <div className="num flex h-[26px] items-center justify-center"
                          style={{
                            background: inkScale(Math.min(0.999, share * 1.6)),
                            color: share >= 0.45 ? "#FFFFFF" : "var(--text-primary)",
                            opacity: selected && !on ? 0.35 : 1,
                            transition: "opacity 0.18s",
                          }}
                          title={`${r} ${c} ${fmtPeople(v)}, 직업 안에서 ${fmtPct(share * 100)}`}>
                          {fmtPct(share * 100)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="num p-1 text-right" style={{ color: "var(--text-muted)" }}>{total.toLocaleString("ko-KR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="t-small mt-2 lg:hidden">표를 좌우로 밀어서 나머지 구간을 볼 수 있습니다.</p>
    </div>
  );
}
