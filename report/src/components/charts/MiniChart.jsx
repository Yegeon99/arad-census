import {
  topJobs, capBins, activity, dist, complete, jobFame, rowTotal, meta,
  limitedRatio, actOverall, actAdjusted, dormantLabel, weeklyLabel,
  capEvidence, rounds,
} from "../../lib/data.js";
import { ACT_ORDER, ACT_COLOR, BIN_COLOR, BIN_ORDER } from "../../lib/palette.js";
import { fmtPct, fmtPeople } from "../../lib/format.js";

function Row({ label, value, max, color, note, strong }) {
  return (
    <li className="flex items-center gap-2 py-[2px] text-[0.76rem]">
      <span className="w-[6.4rem] shrink-0 truncate" style={{ color: strong ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: strong ? 700 : 450 }}>
        {label}
      </span>
      <span className="relative h-[11px] flex-1" style={{ background: "var(--bg-sunken)" }}>
        <span className="absolute inset-y-0 left-0" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="num w-[7rem] shrink-0 text-right" style={{ color: "var(--text-muted)" }}>{note}</span>
    </li>
  );
}

function Stacked({ label, parts, order, colors }) {
  return (
    <div className="py-1">
      <p className="m-0 text-[0.76rem]" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <div className="mt-1 flex h-[16px] overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
        {order.map((k) => (
          <div key={k} style={{ width: `${parts[k]}%`, background: colors[k] }} title={`${k} ${fmtPct(parts[k])}`} />
        ))}
      </div>
    </div>
  );
}

function profileOf(job) {
  const total = rowTotal(job);
  const cells = jobFame.get(job) ?? {};
  return Object.fromEntries(BIN_ORDER.map((b) => [b, total ? ((cells[b] ?? 0) / total) * 100 : 0]));
}

/** 인사이트 카드를 펼치면 함께 뜨는 작은 차트 */
export default function MiniChart({ focus }) {
  if (focus === "topJobs") {
    const five = topJobs.slice(0, 5);
    const max = five[0].pct;
    return (
      <ul className="m-0 list-none p-0">
        {five.map((j, i) => (
          <Row key={j.jobName} label={j.jobName} value={j.pct} max={max} strong={i === 0}
            color={i === 0 ? "var(--gold)" : "var(--ink-4)"} note={`${fmtPct(j.pct)} ${fmtPeople(j.count)}`} />
        ))}
      </ul>
    );
  }

  if (focus === "capCorrection") {
    const max = Math.max(...capBins.map((b) => Math.max(b.observed, b.corrected)));
    return (
      <ul className="m-0 list-none p-0">
        {capBins.map((b, i) => (
          <li key={b.label} className="py-[3px]">
            <Row label={b.label} value={b.observed} max={max} color={i === 0 ? "var(--ink-6)" : "var(--ink-3)"}
              note={`관측 ${fmtPct(b.observed)}`} strong={i === 0} />
            <Row label="" value={b.corrected} max={max} color={i === 0 ? "var(--gold)" : "var(--ink-1)"}
              note={`상한 보정 ${fmtPct(b.corrected)}`} />
          </li>
        ))}
      </ul>
    );
  }

  if (focus === "activityByBin" || focus === "activityExtremes") {
    const key = focus === "activityByBin" ? dormantLabel : weeklyLabel;
    return (
      <ul className="m-0 list-none p-0">
        {[...activity.byFameBin].reverse().map((b) => (
          <Row key={b.bin} label={b.bin} value={b.pct[key]} max={100}
            color={b.smallSample ? "var(--gold)" : "var(--ink-5)"}
            note={`${key} ${fmtPct(b.pct[key])}`} />
        ))}
      </ul>
    );
  }

  if (focus === "roundCompare") {
    const rows = rounds.jobGap;
    const max = Math.max(...rows.map((r) => Math.abs(r.first)));
    return (
      <ul className="m-0 list-none p-0">
        {rows.map((r) => (
          <li key={r.jobName} className="py-[3px]">
            <Row label={r.jobName} value={Math.abs(r.first)} max={max} color="var(--ink-4)" strong
              note={`처음 ${fmtPct(r.first)}`} />
            <Row label="" value={Math.abs(r.second)} max={max} color="var(--gold)"
              note={`두 번째 ${fmtPct(r.second)}`} />
          </li>
        ))}
        <li className="pt-2">
          <p className="t-small m-0">명성 방식과의 차이입니다. 0에 가까울수록 맞아떨어집니다.</p>
        </li>
      </ul>
    );
  }

  if (focus === "jobFameProfile") {
    return (
      <div>
        {["크루세이더", "사령술사"].map((j) => (
          <Stacked key={j} label={j} parts={profileOf(j)} order={BIN_ORDER} colors={BIN_COLOR} />
        ))}
        <p className="t-small m-0 mt-1">왼쪽부터 레기온 입장 전, 오른쪽으로 갈수록 높은 구간입니다.</p>
      </div>
    );
  }

  if (focus === "activityAdjust") {
    const before = Object.fromEntries(ACT_ORDER.map((k) => [k, actOverall[k].pct]));
    return (
      <div>
        <Stacked label="보정 전" parts={before} order={ACT_ORDER} colors={ACT_COLOR} />
        <Stacked label="보정 후" parts={actAdjusted} order={ACT_ORDER} colors={ACT_COLOR} />
        <p className="t-small m-0 mt-1">
          {dormantLabel} {fmtPct(before[dormantLabel])}에서 {fmtPct(actAdjusted[dormantLabel])}로 커집니다.
        </p>
      </div>
    );
  }

  if (focus === "searchLimit") {
    const split = capEvidence.stageSplit[0];
    return (
      <ul className="m-0 list-none p-0">
        <Row label="한도에 걸린 검색" value={limitedRatio} max={100} color="var(--gold)"
          note={`${fmtPct(limitedRatio)}`} strong />
        <Row label="원래 200명 안" value={split.inside} max={100} color="var(--ink-3)"
          note={`레기온 입장 전 ${fmtPct(split.inside)}`} />
        <Row label="쪼개서 새로 드러남" value={split.revealed} max={100} color="var(--ink-6)"
          note={`레기온 입장 전 ${fmtPct(split.revealed)}`} strong />
      </ul>
    );
  }

  return null;
}
