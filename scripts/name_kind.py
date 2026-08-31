# -*- coding: utf-8 -*-
"""이름 종류와 성장도의 관계, 그리고 시드를 늘렸을 때의 커버리지.

두 가지를 한 번의 스윕으로 잰다.
1. 이름 종류(한글만 / 영문 포함 / 숫자 포함 / 그 외)별 명성 분포
   차이가 작으면 이름으로 뽑는 방식의 명성 분포를 조심스럽게 일반화할 근거가 된다.
2. 한글 두 글자 조합 상위 N개를 시드로 썼을 때의 커버리지
   같은 표본에서 상위 조합을 뽑아 같은 표본에 적용하면 과대평가되므로,
   표본을 반으로 갈라 한쪽에서 고른 조합을 다른 쪽에 적용해 함께 잰다.

개인정보
- 캐릭터 이름은 이 프로세스 메모리 안에서만 쓴다. 판정과 조합 세기에만 쓰고 버린다.
- 이름과 characterId 를 파일로 쓰는 경로가 없다. 저장하는 것은 집계 수치뿐이다.
- 두 글자 조합은 이름 조각이라 저장하지 않는다. 개수와 커버리지만 남긴다.
"""

import json
import random
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
OUT = ROOT / "data" / "name_kind_2026-08.json"

BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
LABELS = [b["label"] for b in BINS]
HANGUL_ONLY = re.compile(r"^[가-힣]+$")
LATIN = re.compile(r"[A-Za-z]")
DIGIT = re.compile(r"[0-9]")
SYL = re.compile(r"[가-힣]")

random.seed(20260831)
cli = NeopleClient()
t0 = time.monotonic()

KINDS = ["한글만", "영문 포함", "숫자 포함", "그 외"]


def kind_of(name):
    if LATIN.search(name):
        return "영문 포함"
    if DIGIT.search(name):
        return "숫자 포함"
    if HANGUL_ONLY.match(name):
        return "한글만"
    return "그 외"


def bin_of(fame):
    for b in BINS:
        if fame >= b["min"] and (b["max"] is None or fame < b["max"]):
            return b["label"]
    return None


def bigrams(name):
    """이름 안의 한글 두 글자 조합. 이름 자체는 남기지 않는다."""
    out = set()
    for i in range(len(name) - 1):
        pair = name[i:i + 2]
        if SYL.match(pair[0]) and SYL.match(pair[1]):
            out.add(pair)
    return out


plan = [(f, COARSE_STEP) for f in range(1, DENSE_FROM, COARSE_STEP)]
plan += [(f, DENSE_STEP) for f in range(DENSE_FROM, FAME_TOP + 1, DENSE_STEP)]
print(f"[계획] 명성 지점 {len(plan):,}개", flush=True)

by_kind_bin = {k: {b: 0 for b in LABELS} for k in KINDS}
by_kind_weight = {k: {b: 0.0 for b in LABELS} for k in KINDS}
fames = {k: [] for k in KINDS}
gram_count = {}
per_char_grams = []          # 커버리지 계산용, 이름이 아니라 조합 집합
total = 0

for i, (fame, w) in enumerate(plan):
    data = cli.get("/df/servers/all/characters-fame",
                   {"minFame": max(1, fame), "maxFame": fame, "limit": LIMIT})
    for r in data.get("rows", []):
        lab = bin_of(r["fame"])
        if lab is None:
            continue
        nm = r["characterName"]
        k = kind_of(nm)
        by_kind_bin[k][lab] += 1
        by_kind_weight[k][lab] += w
        fames[k].append(r["fame"])
        g = bigrams(nm)
        per_char_grams.append(g)
        for x in g:
            gram_count[x] = gram_count.get(x, 0) + 1
        total += 1
        del nm
    if i % 150 == 0:
        print(f"  {i:>4}/{len(plan)}  누적 {total:,}명  호출 {cli.call_count}", flush=True)

print(f"[수집] {total:,}명, 호출 {cli.call_count}", flush=True)


def stats(vals):
    if not vals:
        return {"n": 0, "mean": None, "median": None}
    s = sorted(vals)
    return {"n": len(s), "mean": round(sum(s) / len(s)), "median": s[len(s) // 2]}


# ── 이름 종류별 명성 분포 ────────────────────────────────────────────
share = {}
for k in KINDS:
    tw = sum(by_kind_weight[k].values())
    share[k] = {b: (by_kind_weight[k][b] / tw * 100 if tw else 0.0) for b in LABELS}

base = share["한글만"]
tvd = {k: round(sum(abs(share[k][b] - base[b]) for b in LABELS) / 2, 2) for k in KINDS}

# ── 시드 커버리지 ────────────────────────────────────────────────────
ranked = [g for g, _ in sorted(gram_count.items(), key=lambda x: -x[1])]
Ns = [36, 100, 300, 1000]

cover_in = {}
for n in Ns:
    top = set(ranked[:n])
    cover_in[n] = round(sum(1 for g in per_char_grams if g & top) / total * 100, 2)

# 반으로 갈라 한쪽에서 고른 조합을 다른 쪽에 적용 (과대평가 걷어내기)
idx = list(range(total))
random.shuffle(idx)
half = total // 2
a, b = idx[:half], idx[half:]
count_a = {}
for i in a:
    for g in per_char_grams[i]:
        count_a[g] = count_a.get(g, 0) + 1
ranked_a = [g for g, _ in sorted(count_a.items(), key=lambda x: -x[1])]
cover_out = {}
for n in Ns:
    top = set(ranked_a[:n])
    cover_out[n] = round(sum(1 for i in b if per_char_grams[i] & top) / len(b) * 100, 2)

result = {
    "meta": {
        "surveyed_at": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "purpose": "이름 종류와 성장도의 관계, 시드 확대 시 커버리지 추정",
        "sample_size": total,
        "api_calls": cli.call_count,
        "api_failures": cli.fail_count,
        "elapsed_sec": round(time.monotonic() - t0, 1),
        "population": "레벨 110 이상 + 최근 90일 접속",
        "id_policy": "이름과 이름 조각은 저장하지 않는다. 이 파일에는 집계 수치만 있다.",
    },
    "kind_counts": {k: sum(by_kind_bin[k].values()) for k in KINDS},
    "kind_pct": {k: round(sum(by_kind_bin[k].values()) / total * 100, 2) for k in KINDS},
    "kind_fame": {k: stats(fames[k]) for k in KINDS},
    "kind_bin_share_pct": {k: {b: round(share[k][b], 2) for b in LABELS} for k in KINDS},
    "kind_tvd_vs_hangul": tvd,
    "distinct_bigrams": len(gram_count),
    "coverage_in_sample_pct": cover_in,
    "coverage_holdout_pct": cover_out,
}
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print()
print(f"총 {total:,}명, 호출 {cli.call_count}회, 소요 {(time.monotonic() - t0) / 60:.1f}분")
print(f"저장 {OUT.relative_to(ROOT)}")
