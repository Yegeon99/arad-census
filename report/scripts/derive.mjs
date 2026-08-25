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
  // 다크나이트·크리에이터는 각성 직업명이 하나로 공유되어 집계상 한 이름으로 합쳐진다.
  // 본문에서는 소속 직업군을 붙여 읽히게 표기한다 (조사 방법 화면에 설명).
  const label = c.job === "자각1" ? `${c.group} 각성 이후` : c.job;
  leaves.set(label, (leaves.get(label) ?? 0) + 1);
}
const total = all.length;
const jobTree = {
  total,
  groups: [...tree.entries()]
    .map(([group, leaves]) => ({
      group,
      count: [...leaves.values()].reduce((a, b) => a + b, 0),
      children: [...leaves.entries()].map(([job, count]) => ({ job, count })).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count),
};

writeFileSync(join(out, "fame_histogram.json"), JSON.stringify(histogram), "utf-8");
writeFileSync(join(out, "job_tree.json"), JSON.stringify(jobTree), "utf-8");
console.log(`derive: 고유 캐릭터 ${total.toLocaleString()} / 명성 보유 ${histogram.full.n.toLocaleString()} / 완전 검색 ${histogram.complete.n.toLocaleString()}`);
console.log(`직업군 ${jobTree.groups.length}개, 최상위 ${jobTree.groups[0].group} ${jobTree.groups[0].count}`);
