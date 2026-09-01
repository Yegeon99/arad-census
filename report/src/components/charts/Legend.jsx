import { BIN_ORDER, BIN_COLOR, ACT_ORDER, ACT_COLOR } from "../../lib/palette.js";

function Swatches({ items, colors, note }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[0.8125rem]" style={{ color: "var(--text-secondary)" }}>
          <span className="inline-block h-[9px] w-[9px] shrink-0" style={{ background: colors[k] }} />
          {k}
        </span>
      ))}
      {note && <span className="t-small">{note}</span>}
    </div>
  );
}

export function BinLegend({ note }) {
  return <Swatches items={BIN_ORDER} colors={BIN_COLOR} note={note} />;
}

export function ActLegend({ note }) {
  return <Swatches items={ACT_ORDER} colors={ACT_COLOR} note={note} />;
}
