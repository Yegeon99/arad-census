# -*- coding: utf-8 -*-
"""그물 누락률 실측.

1차 조사는 한국어 두 글자 시드 36개를 이름 포함 검색에 넣어 표본을 모았다.
명성 방식으로 받은 캐릭터의 이름을 그 시드로 걸러 보면, 1차 조사의 그물에
걸렸을 캐릭터와 걸리지 않았을 캐릭터를 직접 가를 수 있다.

개인정보 (지침서 절대 규칙)
- 캐릭터 이름은 이 프로세스 메모리 안에서만 쓴다. 판정에 쓰고 즉시 버린다.
- 이름과 characterId 를 파일로 쓰는 경로가 이 스크립트에 없다. 저장하는 것은
  집계 수치뿐이다 (아래 result 딕셔너리가 전부다).
- 이름을 화면에 찍지 않는다.
"""

import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402

LIMIT = 200
FAME_TOP = 136_883
DENSE_FROM = 117_014
COARSE_STEP = 250
DENSE_STEP = 50
OUT = ROOT / "data" / "net_miss_2026-08.json"

BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
JOB_MAP = json.loads((ROOT / "config" / "job_map.json").read_text(encoding="utf-8"))["map"]
cfg = json.loads((ROOT / "config" / "seeds.json").read_text(encoding="utf-8"))
SEEDS = cfg["common"] + cfg["rare"]

HANGUL = re.compile(r"^[가-힣]+$")
cli = NeopleClient()
t0 = time.monotonic()


def bin_of(fame):
    for b in BINS:
        if fame >= b["min"] and (b["max"] is None or fame < b["max"]):
            return b["label"]
    return None


def classify(name: str):
    """이름을 세 갈래로 나눈다. 걸리면 어떤 시드에 걸렸는지도 돌려준다.
    이름 자체는 돌려주지 않는다."""
    hit = [s for s in SEEDS if s in name]
    if hit:
        return "걸림", hit
    return ("한글이지만 시드 없음" if HANGUL.match(name) else "한글 아닌 글자 포함"), []


labels = [b["label"] for b in BINS]
kinds = ["걸림", "한글이지만 시드 없음", "한글 아닌 글자 포함"]
by_bin = {b: {k: 0 for k in kinds} for b in labels}
jobs_caught, jobs_missed = {}, {}
weight_bin = {b: {k: 0.0 for k in kinds} for b in labels}
seed_hits, seed_job = {}, {}
total = 0

plan = [(f, COARSE_STEP) for f in range(1, DENSE_FROM, COARSE_STEP)]
plan += [(f, DENSE_STEP) for f in range(DENSE_FROM, FAME_TOP + 1, DENSE_STEP)]
print(f"[계획] 명성 지점 {len(plan):,}개, 시드 {len(SEEDS)}개로 판정", flush=True)

for i, (fame, w) in enumerate(plan):
    data = cli.get("/df/servers/all/characters-fame",
                   {"minFame": max(1, fame), "maxFame": fame, "limit": LIMIT})
    for r in data.get("rows", []):
        lab = bin_of(r["fame"])
        if lab is None:
            continue
        kind, hits = classify(r["characterName"])   # 이름은 여기서만 쓰이고 밖으로 나가지 않는다
        by_bin[lab][kind] += 1
        weight_bin[lab][kind] += w
        canon = JOB_MAP.get(r.get("jobGrowName", ""), {}).get("canonical")
        if canon:
            tgt = jobs_caught if kind == "걸림" else jobs_missed
            tgt[canon] = tgt.get(canon, 0) + 1
        for h in hits:
            seed_hits[h] = seed_hits.get(h, 0) + 1
            if canon:
                seed_job.setdefault(h, {})[canon] = seed_job.setdefault(h, {}).get(canon, 0) + 1
        total += 1
    if i % 150 == 0:
        print(f"  {i:>4}/{len(plan)}  누적 {total:,}명  호출 {cli.call_count}", flush=True)

# ── 집계 ──────────────────────────────────────────────────────────────
caught_n = sum(by_bin[b]["걸림"] for b in labels)
missed_n = total - caught_n

nc, nm = sum(jobs_caught.values()), sum(jobs_missed.values())
common = set(jobs_caught) | set(jobs_missed)
tvd = sum(abs(jobs_caught.get(j, 0) / nc * 100 - jobs_missed.get(j, 0) / nm * 100)
          for j in common) / 2
gap = sorted(
    ({"jobName": j,
      "caught": round(jobs_caught.get(j, 0) / nc * 100, 2),
      "missed": round(jobs_missed.get(j, 0) / nm * 100, 2),
      "diff": round(jobs_caught.get(j, 0) / nc * 100 - jobs_missed.get(j, 0) / nm * 100, 2)}
     for j in common),
    key=lambda x: -abs(x["diff"]))

result = {
    "meta": {
        "surveyed_at": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "purpose": "1차 조사의 시드 그물에 걸리지 않는 캐릭터의 규모와 성격을 실측",
        "seeds": len(SEEDS),
        "match_rule": "캐릭터 이름에 두 글자 시드가 들어 있으면 걸림 (1차 조사와 같은 포함 검색)",
        "sample_size": total,
        "api_calls": cli.call_count,
        "api_failures": cli.fail_count,
        "elapsed_sec": round(time.monotonic() - t0, 1),
        "id_policy": "캐릭터 이름은 메모리 안에서 판정에만 쓰고 저장하지 않는다. 이 파일에는 집계만 있다.",
    },
    "overall": {
        "caught": caught_n,
        "missed": missed_n,
        "miss_rate_pct": round(missed_n / total * 100, 2),
        "by_kind": {k: sum(by_bin[b][k] for b in labels) for k in kinds},
        "by_kind_pct": {k: round(sum(by_bin[b][k] for b in labels) / total * 100, 2) for k in kinds},
    },
    "by_bin": {
        b: {
            "n": sum(by_bin[b].values()),
            "counts": by_bin[b],
            "miss_rate_pct": round(
                (sum(by_bin[b].values()) - by_bin[b]["걸림"]) / max(1, sum(by_bin[b].values())) * 100, 2),
            "non_hangul_pct": round(
                by_bin[b]["한글 아닌 글자 포함"] / max(1, sum(by_bin[b].values())) * 100, 2),
        }
        for b in labels
    },
    "job_counts_caught": dict(sorted(jobs_caught.items(), key=lambda x: -x[1])),
    "job_counts_missed": dict(sorted(jobs_missed.items(), key=lambda x: -x[1])),
    "job_tvd_caught_vs_missed": round(tvd, 2),
    "job_gap_top": gap[:10],
    "job_compared": len(common),
    "seed_hits": dict(sorted(seed_hits.items(), key=lambda x: -x[1])),
    "seed_job": {k: dict(sorted(v.items(), key=lambda x: -x[1])[:6]) for k, v in seed_job.items()},
}
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

print()
print(f"총 {total:,}명 판정, 호출 {cli.call_count}회, 소요 {(time.monotonic() - t0) / 60:.1f}분")
print(f"그물에 걸림 {caught_n:,} / 안 걸림 {missed_n:,} (누락률 {missed_n / total * 100:.2f}%)")
print(f"걸린 집단과 안 걸린 집단의 직업 구성 총차이 {tvd:.2f}%p")
print(f"저장 {OUT.relative_to(ROOT)}")
