// 커스텀 SVG/DIV 차트 — 단일 액센트 계열, 데이터 잉크 중심

const INKS = ["var(--ink-1)", "var(--ink-2)", "var(--ink-3)", "var(--ink-4)", "var(--ink-5)", "var(--ink-6)"];

export function inkScale(t) {
  // t: 0~1 → 잉크 6단계
  const i = Math.min(5, Math.floor(t * 6));
  return INKS[i];
}

/** 가로 바 리스트 (직업 분포 등) — 왼쪽 정렬 기준선 1px, 상위 accentCount개 액센트 */
export function HBarList({ items, max, valueFmt = (v) => `${v}%`, labelWidth = 130, accentCount = 0 }) {
  const m = max ?? Math.max(...items.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {items.map((d, i) => (
        <div key={d.label} className="flex items-center gap-2 text-[13px]">
          <div className="shrink-0 truncate text-right" style={{ width: labelWidth, color: "var(--text-secondary)" }} title={d.label}>
            {d.label}
          </div>
          <div className="relative h-[18px] flex-1" style={{ borderLeft: "1px solid var(--text-muted)" }}>
            <div
              className="h-full rounded-r-sm"
              style={{ width: `${(d.value / m) * 100}%`, background: d.color ?? (i < accentCount ? "var(--ink-5)" : "var(--ink-2)") }}
              title={`${d.label} ${valueFmt(d.value, d)}`}
            />
          </div>
          <div className="num w-[64px] shrink-0" style={{ color: "var(--text-primary)" }}>
            {valueFmt(d.value, d)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 두 분포 나란히 비교 (전체 vs 비상한) — 구간별 좌우 대칭 바 + 최대 격차 주석 */
export function CompareBars({ bins, leftKey, rightKey, leftLabel, rightLabel, annotate }) {
  const max = Math.max(...bins.flatMap((b) => [b[leftKey], b[rightKey]]));
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-semibold">
        <span style={{ color: "var(--ink-5)" }}>{leftLabel}</span>
        <span style={{ color: "var(--ink-3)" }}>{rightLabel}</span>
      </div>
      <div className="space-y-1.5">
        {bins.map((b) => (
          <div key={b.label}>
            <div className="grid items-center gap-1 text-[12.5px]" style={{ gridTemplateColumns: "1fr 110px 1fr" }}>
              <div className="flex items-center justify-end gap-1.5">
                <span className="num" style={{ color: "var(--text-secondary)" }}>{b[leftKey]}%</span>
                <div className="h-[16px] rounded-l-sm" style={{ width: `${(b[leftKey] / max) * 100}%`, background: "var(--ink-5)", minWidth: b[leftKey] > 0 ? 2 : 0 }} />
              </div>
              <div className="text-center" style={{ color: "var(--text-primary)", wordBreak: "keep-all" }}>{b.label}</div>
              <div className="flex items-center gap-1.5">
                <div className="h-[16px] rounded-r-sm" style={{ width: `${(b[rightKey] / max) * 100}%`, background: "var(--ink-3)", minWidth: b[rightKey] > 0 ? 2 : 0 }} />
                <span className="num" style={{ color: "var(--text-secondary)" }}>{b[rightKey]}%</span>
              </div>
            </div>
            {annotate && annotate.label === b.label && (
              <p className="num m-0 mt-0.5 text-center text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                {annotate.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 활성도 공통 범례 */
export function Legend({ entries }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
      {entries.map((e) => (
        <span key={e.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[10px] w-[10px] rounded-sm" style={{ background: e.color }} />
          {e.label}
        </span>
      ))}
    </div>
  );
}

/** 가로 100% 스택 바 — 좌측 라벨 + 세그먼트 내 % 직접 표기 (넓은 세그먼트만) */
export function StackBar100({ label, sub, parts, height = 26, minLabelPct = 7 }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex items-center gap-3 text-[12.5px]">
      <div className="w-[128px] shrink-0 text-right leading-tight" style={{ color: "var(--text-primary)", wordBreak: "keep-all" }}>
        <span className="font-semibold">{label}</span>
        {sub && <span className="num block text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</span>}
      </div>
      <div className="flex flex-1 overflow-hidden rounded-sm" style={{ height, gap: 2, background: "var(--bg-surface)" }}>
        {parts.map((p) => {
          const pct = total ? (p.value / total) * 100 : 0;
          return pct > 0 ? (
            <div key={p.label} className="num flex items-center justify-center"
                 style={{ width: `${pct}%`, background: p.color, color: p.dark ? "#fff" : "var(--text-primary)", fontSize: 11.5 }}
                 title={`${p.label} ${pct.toFixed(1)}%`}>
              {pct >= minLabelPct ? `${pct.toFixed(1)}%` : ""}
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

/** 스택 바 (구간별 활성 구성) — 세그먼트 간 2px 갭 */
export function StackBar({ parts, height = 16 }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex overflow-hidden rounded-sm" style={{ height, gap: 2 }}>
      {parts.map((p) =>
        p.value > 0 ? (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
               title={`${p.label} ${p.value}명 (${((p.value / total) * 100).toFixed(1)}%)`} />
        ) : null
      )}
    </div>
  );
}

/** 히트맵 색 스케일 범례 (0% → maxPct%) */
export function HeatScaleLegend({ maxPct = 100 }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
      <span>셀 색은 행(직업) 내 비중</span>
      <span className="num">0%</span>
      <div className="flex h-[10px] w-[96px] overflow-hidden rounded-sm">
        {INKS.map((c) => (
          <div key={c} style={{ flex: 1, background: c }} />
        ))}
      </div>
      <span className="num">{maxPct}%</span>
    </div>
  );
}

/** 히트맵 (직업 × 명성) — 행 내 비중 기준 잉크 농도, 마스킹 셀 표기.
    모바일: 첫 열 sticky + 우측 페이드로 가로 스크롤 힌트 */
export function Heatmap({ rows, cols, cell, rowTotal }) {
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--bg-base)] p-1 text-left font-semibold" style={{ color: "var(--text-secondary)", minWidth: 110 }}>직업</th>
              {cols.map((c) => (
                <th key={c} className="p-1 text-center font-medium" style={{ color: "var(--text-secondary)", minWidth: 64, wordBreak: "keep-all" }}>{c}</th>
              ))}
              <th className="p-1 text-right font-medium" style={{ color: "var(--text-muted)", minWidth: 52 }}>n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const total = rowTotal(r);
              return (
                <tr key={r}>
                  <td className="sticky left-0 z-10 bg-[var(--bg-base)] p-1 font-medium" style={{ color: "var(--text-primary)" }}>{r}</td>
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
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 md:hidden"
           style={{ background: "linear-gradient(to left, var(--bg-base), transparent)" }} />
      <p className="m-0 mt-1 text-center text-[11px] md:hidden" style={{ color: "var(--text-muted)" }}>← 좌우로 스크롤 →</p>
    </div>
  );
}

/** §6 표본 설계 흐름 다이어그램 — 자체 제작 SVG */
export function FlowDiagram() {
  const box = (x, y, w, h, title, sub, accent) => (
    <g key={title}>
      <rect x={x} y={y} width={w} height={h} rx={6}
            fill={accent ? "var(--accent-soft)" : "var(--bg-surface)"}
            stroke={accent ? "var(--accent)" : "var(--border)"} strokeWidth="1" />
      <text x={x + w / 2} y={y + (sub ? 20 : h / 2 + 4)} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-primary)">{title}</text>
      {sub && <text x={x + w / 2} y={y + 36} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">{sub}</text>}
    </g>
  );
  const arrow = (x1, y1, x2, y2) => (
    <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="var(--text-muted)" strokeWidth="1.2" markerEnd="url(#arr)" />
  );
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 720 190" width="100%" style={{ minWidth: 620 }} role="img"
           aria-label="표본 설계 흐름: 시드 36 × 서버 8 → 검색 288콜 → 표본 31,523 → 비상한 5,352 / 타임라인 600 → 집계 → 인사이트">
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--text-muted)" />
          </marker>
        </defs>
        {box(0, 45, 120, 48, "시드 36 × 서버 8", "한국어 음절 조합")}
        {arrow(120, 69, 148, 69)}
        {box(150, 45, 110, 48, "검색 288콜", "상한 도달 132")}
        {arrow(260, 69, 288, 69)}
        {box(290, 45, 120, 48, "표본 31,523", "중복 제거 후", true)}
        {arrow(410, 58, 438, 26)}
        {arrow(410, 80, 438, 112)}
        {box(440, 2, 130, 48, "비상한 5,352", "상한 미도달만")}
        {box(440, 88, 130, 48, "타임라인 600", "층화 서브샘플")}
        {arrow(570, 26, 598, 58)}
        {arrow(570, 112, 598, 80)}
        {box(600, 45, 50, 48, "집계")}
        {arrow(650, 69, 658, 69)}
        {box(660, 45, 60, 48, "인사이트")}
      </svg>
    </div>
  );
}
