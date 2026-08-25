// 화면이 쓰는 값을 한곳에서 만든다. 집계 파일의 수치를 그대로 쓰고
// 여기서 새로 만드는 값은 비율 계산뿐이다.
import census from "../data/census.json";
import seedYield from "../data/seed_yield.json";
import insights from "../derived/insights.json";
import histogram from "../derived/fame_histogram.json";
import jobTree from "../derived/job_tree.json";
import { BIN_ORDER } from "./palette.js";

export const meta = census.meta;
export const dist = census.distributions;
export const complete = census.completeSearch;
export const activity = census.activity;
export { insights, histogram, jobTree };

/** 파이프라인 실행 기록 (게이트 보고와 같은 실측치) */
export const MEASURED = {
  apiCalls: 933,
  llmCostUsd: 0.0890,
  llmBatches: 3,
  collectSec: 87,
  timelineSec: 181,
  surveyedAt: "2026년 8월 25일",
};

export const RAID_BINS = ["레이드 입장 구간", "레이드 권장 구간", "하드 권장 구간"];

export const fameSample = meta.sampleSize - meta.fameMissing;
export const completeFameSample = meta.completeSampleSize - meta.completeFameMissing;

const ETC_PREFIX = "표본이 적어";
export const namedJobs = dist.job.filter((j) => !j.jobName.startsWith(ETC_PREFIX));
export const etcJobs = dist.job.find((j) => j.jobName.startsWith(ETC_PREFIX));
export const topJobs = namedJobs.slice(0, 15);

/** 전체 표본과 완전 검색 표본의 6구간 비교 */
const completeByRange = Object.fromEntries(complete.fameBins.map((b) => [b.range, b]));
export const fameCompare = dist.fameBins.map((b) => ({
  label: b.range,
  full: b.pct,
  fullCount: b.count,
  complete: completeByRange[b.range]?.pct ?? 0,
  completeCount: completeByRange[b.range]?.count ?? 0,
}));

export const pyramidGap = fameCompare[0].complete - fameCompare[0].full;

/** 직업별 명성 구간 교차표 */
const byJob = new Map();
for (const cell of dist.jobByFame) {
  if (!byJob.has(cell.jobName)) byJob.set(cell.jobName, {});
  byJob.get(cell.jobName)[cell.bin] = cell.masked ? null : cell.count;
}
export const jobFame = byJob;
export const jobFameRows = dist.job
  .filter((j) => byJob.has(j.jobName))
  .slice(0, 20)
  .map((j) => j.jobName);

export const rowTotal = (job) =>
  Object.values(byJob.get(job) ?? {}).reduce((s, v) => s + (v ?? 0), 0);

export const cellCount = (job, bin) => byJob.get(job)?.[bin] ?? null;
export const cellShare = (job, bin) => {
  const total = rowTotal(job);
  const v = cellCount(job, bin);
  return total && v !== null ? v / total : 0;
};

/** 레이드 진입 구간 비중 지수 (전체 평균을 1.00으로 둔다) */
const totalFameCount = dist.fameBins.reduce((s, b) => s + b.count, 0);
export const overallRaidShare =
  dist.fameBins.filter((b) => RAID_BINS.includes(b.range)).reduce((s, b) => s + b.count, 0) /
  totalFameCount;

const indexRows = [];
for (const job of byJob.keys()) {
  const total = rowTotal(job);
  if (total < 300) continue;
  const raid = RAID_BINS.reduce((s, b) => s + (cellCount(job, b) ?? 0), 0);
  indexRows.push({ job, total, raidShare: raid / total, index: raid / total / overallRaidShare });
}
indexRows.sort((a, b) => b.index - a.index);
export const raidIndex = {
  rows: indexRows,
  top: indexRows.slice(0, 5),
  bottom: indexRows.slice(-5).reverse(),
};

/** 활성도 */
export const actOverall = Object.fromEntries(activity.overall.map((o) => [o.label, o]));
export const actAdjusted = activity.adjusted.pct;
export const dormantLabel = "90일 넘게 기록 없음";
export const weeklyLabel = "최근 7일 접속";

/** 시드 검색 실측 */
export const seedStats = (() => {
  const s = seedYield.seeds;
  return {
    seeds: s.length,
    common: s.filter((x) => x.class === "common").length,
    rare: s.filter((x) => x.class === "rare").length,
    calls: s.reduce((a, x) => a + x.calls, 0),
    limited: s.reduce((a, x) => a + x.limitedCalls, 0),
  };
})();
export const limitedRatio = (meta.searchCallsLimited / meta.searchCalls) * 100;

/** 명성값 결측 캐릭터 중 레벨 100 미만 비중 */
export const missingLowLevel = (() => {
  const rows = meta.fameMissingLevels;
  const low = rows.filter((r) => r.range === "1~49" || r.range === "50~99")
    .reduce((s, r) => s + r.count, 0);
  const total = rows.reduce((s, r) => s + r.count, 0);
  return { low, total, pct: (low / total) * 100 };
})();

export const binOrder = BIN_ORDER;
