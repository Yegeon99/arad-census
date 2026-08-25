// 커스텀 SVG/DIV 차트 — 단일 액센트 계열, 데이터 잉크 중심

const INKS = ["var(--ink-1)", "var(--ink-2)", "var(--ink-3)", "var(--ink-4)", "var(--ink-5)", "var(--ink-6)"];

export function inkScale(t) {
  // t: 0~1 → 잉크 6단계
  const i = Math.min(5, Math.floor(t * 6));
  return INKS[i];
}

/** 가로 바 리스트 (직업 분포 등) */
export function HBarList({ items, max, valueFmt = (v) => `${v}%`, labelWidth = 130 }) {
  const m = max ?? Math.max(...items.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {items.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-[13px]">
          <div className="shrink-0 truncate text-right" style={{ width: labelWidth, color: "var(--text-secondary)" }} title={d.label}>
            {d.label}
          </div>
          <div className="relative h-[18px] flex-1 rounded-sm" style={{ background: "var(--accent-soft)" }}>
            <div
              className="h-full rounded-sm"
              style={{ width: `${(d.value / m) * 100}%`, background: d.color ?? "var(--ink-5)" }}
            />
          </div>
          <div className="num w-[88px] shrink-0" style={{ color: "var(--text-primary)" }}>
            {valueFmt(d.value, d)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 두 분포 나란히 비교 (전체 vs 비상한) — 구간별 좌우 대칭 바 */
export function CompareBars({ bins, leftKey, rightKey, leftLabel, rightLabel }) {
  const max = Math.max(...bins.flatMap((b) => [b[leftKey], b[rightKey]]));
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-semibold">
        <span style={{ color: "var(--ink-5)" }}>{leftLabel}</span>
        <span style={{ color: "var(--ink-3)" }}>{rightLabel}</span>
      </div>
      <div className="space-y-1.5">
        {bins.map((b) => (
          <div key={b.label} className="grid items-center gap-1 text-[12.5px]" style={{ gridTemplateColumns: "1fr 110px 1fr" }}>
            <div className="flex items-center justify-end gap-1.5">
              <span className="num" style={{ color: "var(--text-secondary)" }}>{b[leftKey]}%</span>
              <div className="h-[16px] rounded-l-sm" style={{ width: `${(b[leftKey] / max) * 100}%`, background: "var(--ink-5)", minWidth: b[leftKey] > 0 ? 2 : 0 }} />
            </div>
            <div className="text-center" style={{ color: "var(--text-primary)" }}>{b.label}</div>
            <div className="flex items-center gap-1.5">
              <div className="h-[16px] rounded-r-sm" style={{ width: `${(b[rightKey] / max) * 100}%`, background: "var(--ink-3)", minWidth: b[rightKey] > 0 ? 2 : 0 }} />
              <span className="num" style={{ color: "var(--text-secondary)" }}>{b[rightKey]}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 도넛 (활성도) */
export function Donut({ parts, size = 168, thickness = 30, centerTitle, centerSub }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerTitle}>
      {parts.map((p) => {
        const frac = p.value / total;
        const dash = frac * C;
        const el = (
          <circle
            key={p.label}
            cx={cx} cy={cy(size)} r={r} fill="none"
            stroke={p.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-acc * C + C / 4}
          />
        );
        acc += frac;
        return el;
      })}
      <text x={cx} y={cx - 4} textAnchor="middle" className="num" fontSize="22" fontWeight="700" fill="var(--text-primary)">{centerTitle}</text>
      <text x={cx} y={cx + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{centerSub}</text>
    </svg>
  );
}
function cy(size) { return size / 2; }

/** 히트맵 (직업 × 명성) — 행 내 비중 기준 잉크 농도, 마스킹 셀 표기 */
export function Heatmap({ rows, cols, cell, rowTotal }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--bg-surface)] p-1 text-left font-semibold" style={{ color: "var(--text-secondary)", minWidth: 110 }}>직업</th>
            {cols.map((c) => (
              <th key={c} className="p-1 text-center font-medium" style={{ color: "var(--text-secondary)", minWidth: 64 }}>{c}</th>
            ))}
            <th className="p-1 text-right font-medium" style={{ color: "var(--text-muted)", minWidth: 52 }}>n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = rowTotal(r);
            return (
              <tr key={r}>
                <td className="sticky left-0 z-10 bg-[var(--bg-surface)] p-1 font-medium" style={{ color: "var(--text-primary)" }}>{r}</td>
                {cols.map((c) => {
                  const v = cell(r, c);
                  if (v === null) {
                    return (
                      <td key={c} className="p-0.5">
                        <div className="flex h-[26px] items-center justify-center rounded-sm text-[10px]"
                             style={{ background: "var(--masked)", color: "var(--text-muted)" }}
                             title="표본 10명 미만 — 마스킹">표본 부족</div>
                      </td>
                    );
                  }
                  const share = total ? v / total : 0;
                  const dark = share >= 0.45;
                  return (
                    <td key={c} className="p-0.5">
                      <div className="num flex h-[26px] items-center justify-center rounded-sm"
                           style={{ background: inkScale(Math.min(0.999, share * 1.6)), color: dark ? "#fff" : "var(--text-primary)" }}
                           title={`${r} · ${c}: ${v}명 (직업 내 ${(share * 100).toFixed(1)}%)`}>
                        {(share * 100).toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
                <td className="num p-1 text-right" style={{ color: "var(--text-muted)" }}>{total.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 스택 바 (구간별 활성 구성) */
export function StackBar({ parts, height = 16 }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex overflow-hidden rounded-sm" style={{ height, background: "var(--accent-soft)" }}>
      {parts.map((p) =>
        p.value > 0 ? (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
               title={`${p.label} ${p.value}명 (${((p.value / total) * 100).toFixed(1)}%)`} />
        ) : null
      )}
    </div>
  );
}
