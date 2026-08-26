import {
  topJobs, fameCompare, activity, dist, complete, jobFame, rowTotal, meta,
  limitedRatio, actOverall, actAdjusted, dormantLabel, weeklyLabel,
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

  if (focus === "famePyramid") {
    const max = Math.max(...fameCompare.map((b) => Math.max(b.full, b.complete)));
    return (
      <ul className="m-0 list-none p-0">
        {fameCompare.map((b, i) => (
          <li key={b.label} className="py-[3px]">
            <Row label={b.label} value={b.full} max={max} color={i === 0 ? "var(--ink-6)" : "var(--ink-3)"}
              note={`전체 ${fmtPct(b.full)}`} strong={i === 0} />
            <Row label="" value={b.complete} max={max} color={i === 0 ? "var(--gold)" : "var(--ink-1)"}
              note={`빠짐없이 모은 검색 ${fmtPct(b.complete)}`} />
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

  if (focus === "jobCompare") {
    const byName = Object.fromEntries(dist.job.map((j) => [j.jobName, j]));
    const inComplete = Object.fromEntries(complete.job.map((j) => [j.jobName, j]));
    const picks = ["사령술사", "크루세이더"];
    const max = Math.max(...picks.flatMap((p) => [byName[p]?.pct ?? 0, inComplete[p]?.pct ?? 0]));
    return (
      <ul className="m-0 list-none p-0">
        {picks.map((p) => (
          <li key={p} className="py-[3px]">
            <Row label={p} value={byName[p].pct} max={max} color="var(--ink-4)" strong
              note={`전체 ${fmtPct(byName[p].pct)}`} />
            <Row label="" value={inComplete[p]?.pct ?? 0} max={max} color="var(--gold)"
              note={`빠짐없이 모은 검색 ${fmtPct(inComplete[p]?.pct ?? 0)}`} />
          </li>
        ))}
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
    const d = activity.byDiscovery;
    return (
      <ul className="m-0 list-none p-0">
        <Row label="한도에 걸린 검색" value={limitedRatio} max={100} color="var(--gold)"
          note={`${meta.searchCallsLimited}회 ${fmtPct(limitedRatio)}`} strong />
        <Row label="잘린 검색에서만" value={(d.limited.n / activity.subsampleSize) * 100} max={100}
          color="var(--ink-5)" note={`${fmtPeople(d.limited.n)}`} />
        <Row label="빠짐없이 모은 검색에서도" value={(d.complete.n / activity.subsampleSize) * 100} max={100}
          color="var(--ink-3)" note={`${fmtPeople(d.complete.n)}`} />
      </ul>
    );
  }

  return null;
}
