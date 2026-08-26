// 리포트 전용 파생 데이터 생성 (로컬 1회 실행, 산출물은 report/src/derived/에 커밋).
// 파이프라인 산출물을 읽기만 하고 고쳐 쓰지 않는다.
//   1) 명성 히스토그램 (1만 단위 구간) — 전체 표본 / 완전 검색 표본
//   2) 직업군 2단계 트리 (선버스트용)
// 체크포인트는 커밋 대상이 아니므로 빌드 시점이 아니라 로컬에서만 돌린다.
import { readFileSync, writeFileSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(here, "..", "src", "derived");

const jobMap = JSON.parse(readFileSync(join(root, "config", "job_map.json"), "utf-8")).map;
const BIN = 10000;
const MAX_BIN = 14; // 140,000 이상은 마지막 구간에 합산

const chars = new Map();
const rl = createInterface({ input: createReadStream(join(root, "data", "checkpoints", "calls.jsonl")), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const rec = JSON.parse(line);
  for (const row of rec.rows) {
    const id = row.cid_hash ?? row.characterId;
    const key = `${rec.server}\u0000${id}`;
    const m = jobMap[row.jobGrowName];
    if (!m) continue;
    const prev = chars.get(key);
    if (!prev) {
      chars.set(key, { group: row.jobName, job: m.canonical, fame: row.fame, complete: !rec.capped });
    } else if (!rec.capped) {
      prev.complete = true;
    }
  }
}

// 1) 명성 히스토그램
function hist(rows) {
  const counts = new Array(MAX_BIN + 1).fill(0);
  let n = 0;
  for (const c of rows) {
    if (c.fame === null || c.fame === undefined) continue;
    n += 1;
    counts[Math.min(MAX_BIN, Math.floor(c.fame / BIN))] += 1;
  }
  return { n, bins: counts.map((count, i) => ({ from: i * BIN, to: i === MAX_BIN ? null : (i + 1) * BIN, count, pct: +(count / n * 100).toFixed(2) })) };
}

const all = [...chars.values()];
const histogram = {
  binWidth: BIN,
  full: hist(all),
  complete: hist(all.filter((c) => c.complete)),
  cuts: [
    { fame: 73993, label: "아포칼립스 입장" },
    { fame: 91582, label: "상급 던전 구간" },
    { fame: 104292, label: "레이드 입장" },
    { fame: 117014, label: "레이드 권장" },
    { fame: 124000, label: "하드 권장" },
  ],
};

// 2) 직업군 2단계 트리
const tree = new Map();
for (const c of all) {
  if (!tree.has(c.group)) tree.set(c.group, new Map());
  const leaves = tree.get(c.group);
  leaves.set(c.job, (leaves.get(c.job) ?? 0) + 1);
}
// 집계 파일과 같은 규칙으로 묶는다. 표본 10명 미만과, 각성 이후 이름이
// 하나로 겹쳐 직업을 가릴 수 없는 캐릭터는 한 줄로 합친다 (조사 방법 화면에 설명).
const MIN_LEAF = 10;
const MERGED_NAME = "자각1";
const ETC = "따로 세지 않은 직업";

const total = all.length;
const jobTree = {
  total,
  groups: [...tree.entries()]
    .map(([group, leaves]) => {
      const kept = [];
      let etc = 0;
      for (const [job, count] of leaves) {
        if (job === MERGED_NAME || count < MIN_LEAF) etc += count;
        else kept.push({ job, count });
      }
      kept.sort((a, b) => b.count - a.count);
      if (etc) kept.push({ job: ETC, count: etc });
      return {
        group,
        count: [...leaves.values()].reduce((a, b) => a + b, 0),
        children: kept,
      };
    })
    .sort((a, b) => b.count - a.count),
};

writeFileSync(join(out, "fame_histogram.json"), JSON.stringify(histogram), "utf-8");
writeFileSync(join(out, "job_tree.json"), JSON.stringify(jobTree), "utf-8");
console.log(`derive: 고유 캐릭터 ${total.toLocaleString()} / 명성 보유 ${histogram.full.n.toLocaleString()} / 완전 검색 ${histogram.complete.n.toLocaleString()}`);
console.log(`직업군 ${jobTree.groups.length}개, 최상위 ${jobTree.groups[0].group} ${jobTree.groups[0].count}`);
