// 화면이 쓰는 값을 한곳에서 만든다. 집계 파일의 수치를 그대로 쓰고
// 여기서 새로 만드는 값은 비율 계산뿐이다.
//
// 화면에 나오는 수치는 모두 두 번째 조사 기준이다. 처음 조사 수치는 회차 대조
// 자료(rounds)를 통해서만 들어오고, 조사 방법 화면의 회차 비교에서만 쓴다.
import census from "../data/census.json";
import verification from "../data/verification.json";
import capCorrect from "../data/cap_correct.json";
import roundsData from "../data/rounds.json";
import costs from "../data/costs.json";
import insights from "../derived/insights.json";
import { BIN_ORDER } from "./palette.js";

export const meta = census.meta;
export const dist = census.distributions;
/** 직업 순위와 직업별 성장 구성은 마지막 전직을 마친 캐릭터만 센다 */
export const finalStage = census.finalStage;
export const complete = census.completeSearch;
export const activity = census.activity;
export { insights };

/** 명성 점수로 다시 재본 검증 조사. 회차 수치는 손대지 않고 나란히만 놓는다. */
export const verify = verification;

/** 상한이 가린 몫을 되돌려 다시 잡은 성장 단계 분포 */
export const cap = capCorrect;

/** 처음 조사와 두 번째 조사를 나란히 놓는 대조 자료 */
export const rounds = roundsData;

/** 파이프라인 실행 기록 (게이트 보고와 같은 실측치)
 *
 * 이번 판 조사는 여섯 항목 18,462회다. 처음 조사와 명성 방식 검증은 이번 판
 * 이전에 쓴 것이라 합계에 넣지 않고 따로 적는다. */
export const MEASURED = {
  roundCalls: [
    ["처음 조사 커버리지 측정", 867],
    ["시드 고르기", 867],
    ["커버리지 측정", 867],
    ["표본 수집", 8001],
    ["상한 우회", 7200],
    ["활성도 조사", 660],
  ],
  earlierCalls: [
    ["처음 조사", 933],
    ["명성 방식 검증", 947],
  ],
  roundMinutes: 95,
  failures: 0,
  llmCostUsd: costs.totalUsd,
  llmBatches: costs.batches,
  surveyedAt: "2026년 8월 31일",
  firstSurveyedAt: "2026년 8월 26일",
};
MEASURED.roundTotal = MEASURED.roundCalls.reduce((s, [, v]) => s + v, 0);
MEASURED.earlierTotal = MEASURED.earlierCalls.reduce((s, [, v]) => s + v, 0);
MEASURED.grandTotal = MEASURED.roundTotal + MEASURED.earlierTotal;

export const RAID_BINS = ["레이드 입장 구간", "레이드 권장 구간", "하드 권장 구간"];

export const fameSample = meta.sampleSize - meta.fameMissing;
export const completeFameSample = meta.completeSampleSize - meta.completeFameMissing;

const ETC_PREFIX = "따로 세지 않은 캐릭터";
export const finalSample = finalStage.sampleSize;
export const finalFameSample = finalStage.sampleSize - finalStage.fameMissing;
export const namedJobs = finalStage.job.filter((j) => !j.jobName.startsWith(ETC_PREFIX));
export const etcJobs = finalStage.job.find((j) => j.jobName.startsWith(ETC_PREFIX));
export const topJobs = namedJobs.slice(0, 15);
export const allJobs = dist.job;

/** 관측한 성장 단계 분포와 상한 보정 분포 */
export const capBins = cap.bins;
export const capLowest = cap.lowest;
export const capGap = capLowest.corrected - capLowest.observed;
export const capEvidence = cap.evidence;

/** 전체 표본과 쏠림 없는 표본의 6구간 비교 */
const completeByRange = Object.fromEntries(complete.fameBins.map((b) => [b.range, b]));
export const fameCompare = dist.fameBins.map((b) => ({
  label: b.range,
  full: b.pct,
  fullCount: b.count,
  complete: completeByRange[b.range]?.pct ?? 0,
  completeCount: completeByRange[b.range]?.count ?? 0,
}));

export const pyramidGap = fameCompare[0].complete - fameCompare[0].full;

/** 직업별 명성 구간 교차표 (마지막 전직을 마친 캐릭터 기준) */
const byJob = new Map();
for (const cell of finalStage.jobByFame) {
  if (!byJob.has(cell.jobName)) byJob.set(cell.jobName, {});
  byJob.get(cell.jobName)[cell.bin] = cell.masked ? null : cell.count;
}
export const jobFame = byJob;
export const jobFameRows = finalStage.job
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

/** 레이드 진입 구간 비중 지수 (마지막 전직을 마친 캐릭터의 평균을 1.00으로 둔다) */
const totalFameCount = finalStage.fameBins.reduce((s, b) => s + b.count, 0);
export const overallRaidShare =
  finalStage.fameBins.filter((b) => RAID_BINS.includes(b.range)).reduce((s, b) => s + b.count, 0) /
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

/** 검색이 상한에 걸린 비중 */
export const limitedRatio = (meta.searchCallsLimited / meta.searchCalls) * 100;

/** 명성 점수 결측 캐릭터 중 레벨 100 미만 비중 */
export const missingLowLevel = (() => {
  const rows = meta.fameMissingLevels;
  const low = rows.filter((r) => r.range === "1~49" || r.range === "50~99")
    .reduce((s, r) => s + r.count, 0);
  const total = rows.reduce((s, r) => s + r.count, 0);
  return { low, total, pct: (low / total) * 100 };
})();

export const binOrder = BIN_ORDER;

/** 검증 조사에서 휴면 판정 차이가 가장 큰 구간 (역산 기준) */
export const dormGap = [...verify.dormancy].sort((a, b) => a.diff - b.diff)[0];
