// 파이프라인 산출물(data/)을 리포트 번들로 옮기면서 화면 용어로 바꾼다.
// 원본 파일은 읽기만 한다. 내부 처리용 키 이름과 내부 용어는 여기서 전부
// 읽히는 말로 치환되므로, 빌드 산출물에는 내부 용어가 남지 않는다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dest = join(here, "..", "src", "data");
mkdirSync(dest, { recursive: true });

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
  distributions_uncapped_only: "completeSearch",
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
};

// 설명 문자열은 화면 문구를 따로 쓰므로 데이터에서 덜어낸다.
const DROP_KEYS = new Set(["note", "criteria", "method", "insights"]);

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
const ETC_LABEL = "따로 세지 않은 직업";
function etcLabel(raw) {
  // "기타(외전 2종·표본<10 직업 14개 합산)" 처럼 종수를 두 군데 나눠 적어 둔 라벨.
  // 마스킹 기준값 10은 종수가 아니므로 세지 않는다.
  const side = Number(raw.match(/외전\s*(\d+)\s*종/)?.[1] ?? 0);
  const small = Number(raw.match(/직업\s*(\d+)\s*개/)?.[1] ?? 0);
  const kinds = side + small;
  if (!kinds) throw new Error(`sync-data: 합산 항목의 종수를 읽지 못했습니다 ${raw}`);
  return `${ETC_LABEL} ${kinds}종`;
}

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
    if (node.startsWith("기타(")) return etcLabel(node);
    return VALUE_MAP[node] ?? node;
  }
  return node;
}

const FORBIDDEN = ["외전", "완전 검색", "한도 검색", "편향 보정값", "명성값",
  "\u2014", "\u2013", "\u3161", "\u00a7", "n=", "capped", "uncapped",
  "reweighted", "job_x_fame", "small_sample", "비상한", "레기온 미만", "가중 재추정"];

function guard(name, text) {
  const hits = FORBIDDEN.filter((t) => text.includes(t));
  if (hits.length) {
    throw new Error(`sync-data: ${name}에 화면에 쓰지 않는 표현이 남아 있습니다 ${JSON.stringify(hits)}`);
  }
}

const census = convert(JSON.parse(readFileSync(join(root, "data", "census_2026-08.json"), "utf-8")));
const seeds = convert(JSON.parse(readFileSync(join(root, "data", "seed_yield.json"), "utf-8")));

const censusText = JSON.stringify(census);
const seedText = JSON.stringify(seeds);
guard("census.json", censusText);
guard("seed_yield.json", seedText);

writeFileSync(join(dest, "census.json"), censusText, "utf-8");
writeFileSync(join(dest, "seed_yield.json"), seedText, "utf-8");
console.log(`sync-data: 표본 ${census.meta.sampleSize.toLocaleString()}명 기준 데이터 변환 완료`);
