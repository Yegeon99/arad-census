// 파이프라인 산출물(data/)을 리포트 번들로 옮기면서 화면 용어로 바꾼다.
// 원본 파일은 읽기만 한다. 내부 처리용 키 이름과 내부 용어는 여기서 전부
// 읽히는 말로 치환되므로, 빌드 산출물에는 내부 용어가 남지 않는다.
//
// 화면 기준은 두 번째 조사(census_2026-08-r2)다. 처음 조사 수치는 회차 대조
// 자료(rounds.json)를 통해서만 들어오고, 본문 수치로는 쓰지 않는다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dest = join(here, "..", "src", "data");
mkdirSync(dest, { recursive: true });

const read = (...p) => JSON.parse(readFileSync(join(root, ...p), "utf-8"));

const KEY_MAP = {
  surveyed_at: "surveyedAt",
  sample_size: "sampleSize",
  fame_missing: "fameMissing",
  fame_missing_level_dist: "fameMissingLevels",
  uncapped_sample_size: "completeSampleSize",
  uncapped_fame_missing: "completeFameMissing",
  search_calls: "searchCalls",
  search_calls_capped: "searchCallsLimited",
  timeline_subsample: "timelineSubsample",
  method_version: "methodVersion",
  min_cell: "minCell",
  seed_count: "seedCount",
  distributions_uncapped_only: "completeSearch",
  distributions_final_stage: "finalStage",
  uncapped_job: "completeJob",
  fame_bins: "fameBins",
  job_group: "jobGroup",
  job_x_fame: "jobByFame",
  jobName: "jobName",
  subsample_size: "subsampleSize",
  lookback_days: "lookbackDays",
  small_n_threshold: "smallSampleThreshold",
  by_fame_bin: "byFameBin",
  by_fame_bin_uncapped: "byFameBinComplete",
  by_capped: "byDiscovery",
  capped_only: "limited",
  uncapped: "complete",
  reweighted_by_uncapped: "adjusted",
  small_sample: "smallSample",
  capped_calls: "limitedCalls",
  generated_at: "generatedAt",
  api_calls: "apiCalls",
  grid_check_pct: "gridCheckPct",
  coarse_step: "coarseStep",
  dense_step: "denseStep",
  window_cap: "windowCap",
  subsample_min: "subsampleMin",
  subsample_max: "subsampleMax",
  fame_tvd: "fameTvd",
  job_tvd: "jobTvd",
  job_group_tvd: "jobGroupTvd",
  job_compared: "jobCompared",
  jobs_all: "jobsAll",
  subsampleN: "subsampleN",
  final_stage_size: "finalStageSize",
  coverage_pct: "coveragePct",
  limited_pct: "limitedPct",
  seeds_common: "seedsCommon",
  seeds_rare: "seedsRare",
  seed_bias: "seedBias",
  probe_sample: "probeSample",
  seed_hits: "seedHits",
  top_job: "topJob",
  top_job_count: "topJobCount",
  job_gap: "jobGap",
  coverage_by_seed_count: "coverageBySeedCount",
  fame_method_tvd: "fameMethodTvd",
  first_observed: "firstObserved",
  second_observed: "secondObserved",
  second_cap_corrected: "secondCapCorrected",
  split_prediction: "splitPrediction",
  still_limited_pct: "stillLimitedPct",
};

// 설명 문자열은 화면 문구를 따로 쓰므로 데이터에서 덜어낸다.
const DROP_KEYS = new Set(["note", "criteria", "method", "insights", "caveat", "expected", "id_policy", "match_rule", "purpose"]);

const VALUE_MAP = {
  "레기온 미만": "레기온 입장 전",
  "상급 던전권": "상급 던전 구간",
  "미카엘라 입장": "레이드 입장 구간",
  "미카엘라 권장": "레이드 권장 구간",
  "하드 권장 이상": "하드 권장 구간",
  "주간 활성": "최근 7일 접속",
  "월간 활성": "최근 30일 접속",
  "저활성": "최근 90일 접속",
  "휴면": "90일 넘게 기록 없음",
};

// 따로 세지 않고 한 줄로 합친 직업 항목. 안에 든 숫자를 더해 종수로 적는다.
const ETC_LABEL = "따로 세지 않은 캐릭터";

function convert(node) {
  if (Array.isArray(node)) return node.map(convert);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROP_KEYS.has(k)) continue;
      out[KEY_MAP[k] ?? VALUE_MAP[k] ?? k] = convert(v);
    }
    return out;
  }
  if (typeof node === "string") {
    if (node.startsWith("기타(")) return ETC_LABEL;
    return VALUE_MAP[node] ?? node;
  }
  return node;
}

const FORBIDDEN = ["외전", "빠짐없이 모은", "완전 검색", "한도 검색", "편향 보정값", "명성값",
  "—", "–", "ㅡ", "§", "n=", "capped", "uncapped",
  "reweighted", "job_x_fame", "small_sample", "비상한", "레기온 미만", "가중 재추정"];

function guard(name, text) {
  const hits = FORBIDDEN.filter((t) => text.includes(t));
  if (hits.length) {
    throw new Error(`sync-data: ${name}에 화면에 쓰지 않는 표현이 남아 있습니다 ${JSON.stringify(hits)}`);
  }
}

const ACT_ORDER = ["최근 7일 접속", "최근 30일 접속", "최근 90일 접속", "90일 넘게 기록 없음"];

const census = convert(read("data", "census_2026-08-r2.json"));
const verification = convert(read("data", "verification_2026-08-r2.json"));
const rounds = convert(read("data", "rounds.json"));
const rawCap = read("data", "cap_correct.json");
const rawSplit = read("data", "phase2_sample.json");
const rawActivity = read("data", "activity_r2.json");
const rawCosts = read("data", "llm_costs.json");

/* 활성도 -------------------------------------------------------------------
   두 번째 회차는 활성도를 따로 다시 쟀다. 집계 파일이 표 모양이 아니라
   묶음 모양이라 화면이 쓰는 줄 목록으로 편다. */
const actBins = Object.entries(rawActivity.by_fame_bin).map(([bin, v]) => ({
  bin: VALUE_MAP[bin] ?? bin,
  n: v.n,
  pct: Object.fromEntries(Object.entries(v.pct).map(([k, p]) => [VALUE_MAP[k] ?? k, p])),
  smallSample: v.n < 30,
}));

// 상한 보정 구간 비중으로 다시 잡은 활성도.
// 구간별 접속 비율은 그대로 두고, 구간이 차지하는 비중만 보정값으로 바꾼다.
const correctedShare = Object.fromEntries(
  Object.entries(rawCap.bin_share_cap_corrected).map(([k, v]) => [VALUE_MAP[k] ?? k, v]));
const byBin = Object.fromEntries(actBins.map((b) => [b.bin, b]));
const adjustedPct = Object.fromEntries(ACT_ORDER.map((state) => {
  const sum = Object.entries(correctedShare)
    .reduce((s, [bin, share]) => s + (share / 100) * (byBin[bin]?.pct[state] ?? 0), 0);
  return [state, Math.round(sum * 100) / 100];
}));

census.activity = {
  subsampleSize: rawActivity.meta.subsample_size,
  apiCalls: rawActivity.meta.api_calls,
  lookbackDays: 90,
  smallSampleThreshold: 30,
  overall: ACT_ORDER.map((label) => ({
    label,
    count: rawActivity.overall[Object.keys(VALUE_MAP).find((k) => VALUE_MAP[k] === label)].count,
    pct: rawActivity.overall[Object.keys(VALUE_MAP).find((k) => VALUE_MAP[k] === label)].pct,
  })),
  byFameBin: actBins,
  adjusted: { pct: adjustedPct },
};

/* 상한 보정 ----------------------------------------------------------------
   관측한 성장 단계 분포와, 상한이 가린 몫을 되돌려 다시 잡은 분포를 나란히 둔다.
   기준은 둘 다 마지막 전직을 마친 캐릭터다. */
const observed = census.finalStage.fameBins;
const capCorrect = {
  bins: observed.map((b) => ({
    label: b.range,
    observed: b.pct,
    observedCount: b.count,
    corrected: correctedShare[b.range],
  })),
  evidence: {
    limit: 200,
    sampledCombos: rawSplit.sampled_combos,
    limitedCombosTotal: rawSplit.capped_combos_total,
    splitCalls: rawSplit.split_calls,
    // 상한 200명에 배수를 곱한 값이 쪼갠 뒤 한 조합당 평균 인원이다
    avgAfterSplit: Math.round(200 * rawSplit.multiplier_mean),
    multiplier: rawSplit.multiplier_mean,
    multiplierLow: rawSplit.multiplier_ci95[0],
    multiplierHigh: rawSplit.multiplier_ci95[1],
    stillLimitedPct: rawSplit.still_capped_pct,
    oldCount: rawSplit.old_n,
    newCount: rawSplit.new_n,
    stageSplit: rawSplit.bin_old_vs_new.map((r) => ({
      label: VALUE_MAP[r.bin] ?? r.bin,
      inside: r.old,
      revealed: r.new,
      diff: r.diff,
    })),
  },
  fameMethodTvd: rounds.fameMethodTvd,
};
capCorrect.lowest = capCorrect.bins[0];
capCorrect.revealedLowest = capCorrect.evidence.stageSplit[0].revealed;

/* 모델 비용 -----------------------------------------------------------------
   인사이트를 다시 만들면 이 값이 바뀐다. 화면에 박아 두지 않고 매번 옮겨 담는다. */
const costs = {
  totalUsd: rawCosts.total_cost_usd,
  batches: rawCosts.calls.length,
  lastAt: rawCosts.calls[rawCosts.calls.length - 1].at,
};

const files = {
  "census.json": census,
  "costs.json": costs,
  "verification.json": verification,
  "rounds.json": rounds,
  "cap_correct.json": capCorrect,
};

for (const [name, value] of Object.entries(files)) {
  const text = JSON.stringify(value);
  guard(name, text);
  writeFileSync(join(dest, name), text, "utf-8");
}

console.log(`sync-data: 표본 ${census.meta.sampleSize.toLocaleString()}명 (${census.meta.round}) 기준 데이터 변환 완료`);
console.log(`  성장을 마친 캐릭터 ${census.finalStage.sampleSize.toLocaleString()}명`);
console.log(`  레기온 입장 전 관측 ${capCorrect.lowest.observed}% -> 상한 보정 ${capCorrect.lowest.corrected}%`);
console.log(`  활성도 ${census.activity.subsampleSize}명, 90일 넘게 기록 없음 관측 ${census.activity.overall[3].pct}% -> 보정 ${adjustedPct["90일 넘게 기록 없음"]}%`);
