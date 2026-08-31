import { BIN_COLOR, BIN_ORDER } from "../../lib/palette.js";

/**
 * 성장 단계 여섯 구간 범례.
 * 색만으로 구간을 가리지 않도록 이름을 항상 함께 적는다.
 * 옅은 두 단계는 바탕과 대비가 낮아, 색 조각에 헤어라인을 둘러 경계를 살린다.
 */
export default function StageLegend({ active, onHover, className = "" }) {
  return (
    <ul className={`m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 ${className}`}>
      {BIN_ORDER.map((bin, i) => {
        const on = active === bin;
        return (
          <li
            key={bin}
            className="flex items-center gap-1.5"
            onMouseEnter={onHover ? () => onHover(bin) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
            style={{ cursor: onHover ? "pointer" : undefined }}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: BIN_COLOR[bin], boxShadow: "inset 0 0 0 1px rgba(27,33,48,0.16)" }}
              aria-hidden="true"
            />
            <span
              className="t-small m-0 whitespace-nowrap"
              style={{ color: on ? "var(--text-primary)" : undefined, fontWeight: on ? 700 : undefined }}
            >
              {i === 0 ? `낮은 단계 · ${bin}` : i === BIN_ORDER.length - 1 ? `${bin} · 높은 단계` : bin}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
