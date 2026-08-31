# -*- coding: utf-8 -*-
"""명성 방식 검증 조사 v2 — 계통표집.

v1 에서 배운 것 두 가지:
1) API 는 창 폭을 2,000 으로 자른다. minFame 을 아무리 낮춰도 maxFame-2000 아래는
   안 준다. 그래서 명성 커서로 구간을 훑으면 구간 상단에만 표본이 쌓인다
   (실측: 각 구간의 위쪽 0.1~0.7% 폭에 2,000명이 전부 몰렸다).
2) 반면 명성 한 점(minFame=maxFame)은 절대 포화되지 않는다(최대 47명).

그래서 커서를 버리고 계통표집으로 간다. 명성 축을 일정 간격으로 훑으며 그 점의
캐릭터를 전수로 받는다. 점마다 대표하는 명성 폭이 가중치가 된다.
구간별 비중과 구간별 직업 구성이 같은 표본에서 한 번에 나온다.

간격: 명성 117,014 미만은 250, 그 위(상위 두 구간)는 50.
개인정보: characterId 는 수신 즉시 회차 난수 소금으로 해시, 원본·이름 미저장.
"""

import hashlib
import json
import random
import secrets
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402

LIMIT = 200
FAME_TOP = 136_883          # v1 에서 확인한 실제 최고 명성
DENSE_FROM = 117_014        # 여기부터는 간격 50
COARSE_STEP = 250
DENSE_STEP = 50
REFINE_WINDOWS = 20
OUT = ROOT / "data" / "fame_probe_2026-08.json"

BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
JOB_MAP = json.loads((ROOT / "config" / "job_map.json").read_text(encoding="utf-8"))["map"]

SALT = secrets.token_bytes(16)
random.seed(20260831)
cli = NeopleClient()
t0 = time.monotonic()


def anon(cid):
    return hashlib.sha256(SALT + cid.encode()).hexdigest()[:16]


def bin_of(fame):
    for b in BINS:
        if fame >= b["min"] and (b["max"] is None or fame < b["max"]):
            return b["label"]
    return None


def point(fame):
    """명성 한 점의 캐릭터 전수. 식별 정보는 즉시 지운다."""
    data = cli.get("/df/servers/all/characters-fame",
                   {"minFame": max(1, fame), "maxFame": fame, "limit": LIMIT})
    out = []
    for r in data.get("rows", []):
        info = JOB_MAP.get(r.get("jobGrowName", ""), {})
        anon(r["characterId"])           # 해시만 하고 버린다 (점 안에서는 중복 불가)
        out.append({
            "level": r.get("level"),
            "server": r.get("serverId"),
            "group": r.get("jobName"),
            "canonical": info.get("canonical"),
            "stage": info.get("stage"),
        })
    return out


# ── 표집 계획: 서로 겹치지 않는 두 구역 ──────────────────────────────
plan = [(f, COARSE_STEP) for f in range(1, DENSE_FROM, COARSE_STEP)]
plan += [(f, DENSE_STEP) for f in range(DENSE_FROM, FAME_TOP + 1, DENSE_STEP)]
print(f"[계획] 점 {len(plan):,}개 (간격 250 구역 {sum(1 for _, w in plan if w == 250):,} / "
      f"간격 50 구역 {sum(1 for _, w in plan if w == 50):,})", flush=True)

density = {}
weight = {}
bin_pop = {b["label"]: 0.0 for b in BINS}
bin_jobs = {b["label"]: {} for b in BINS}
bin_groups = {b["label"]: {} for b in BINS}
bin_sample_n = {b["label"]: 0 for b in BINS}
bin_final = {b["label"]: 0 for b in BINS}
job_pop = {}
group_pop = {}
final_pop = 0.0
saturated = []
level_hist = {}

for i, (f, w) in enumerate(plan):
    rows = point(f)
    density[f] = len(rows)
    weight[f] = w
    if len(rows) >= LIMIT:
        saturated.append(f)
    lab = bin_of(f)
    if lab is None:
        continue
    bin_pop[lab] += len(rows) * w
    bin_sample_n[lab] += len(rows)
    for r in rows:
        if r["stage"] == "眞":
            bin_final[lab] += 1
            final_pop += w
        c, g = r["canonical"], r["group"]
        if c:
            bin_jobs[lab][c] = bin_jobs[lab].get(c, 0) + 1
            job_pop[c] = job_pop.get(c, 0.0) + w
        if g:
            bin_groups[lab][g] = bin_groups[lab].get(g, 0) + 1
            group_pop[g] = group_pop.get(g, 0.0) + w
        lv = r["level"]
        if lv is not None:
            level_hist[lv] = level_hist.get(lv, 0) + 1
    if i % 150 == 0:
        print(f"  {i:>4}/{len(plan)}  명성 {f:>7}  {len(rows):>3}명  호출 {cli.call_count}", flush=True)

print(f"[격자] 완료 — 표본 {sum(density.values()):,}명, 포화 {len(saturated)}점, 호출 {cli.call_count}",
      flush=True)

# ── 간격 검증: 간격 250 구역의 임의 20창을 간격 50으로 다시 ──────────
coarse_pts = [f for f, w in plan if w == COARSE_STEP and f + COARSE_STEP < DENSE_FROM]
picks = sorted(random.sample(coarse_pts, min(REFINE_WINDOWS, len(coarse_pts))))
coarse_sum = fine_sum = 0.0
refine_rows = []
for f in picks:
    vals = [density[f]]
    for g in range(f + DENSE_STEP, f + COARSE_STEP, DENSE_STEP):
        vals.append(len(point(g)))
    coarse = density[f] * COARSE_STEP
    fine = (sum(vals) / len(vals)) * COARSE_STEP
    coarse_sum += coarse
    fine_sum += fine
    refine_rows.append({"fame": f, "points": vals, "coarse": coarse, "fine": round(fine, 1)})

gap_pct = (coarse_sum - fine_sum) / fine_sum * 100 if fine_sum else 0.0
print(f"[검증] 거친 격자 {coarse_sum:,.0f} vs 촘촘한 격자 {fine_sum:,.0f} → {gap_pct:+.2f}% "
      f"({'통과' if abs(gap_pct) <= 5 else '초과'})", flush=True)

total_pop = sum(bin_pop.values())
elapsed = time.monotonic() - t0

result = {
    "meta": {
        "surveyed_at": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "purpose": "1차 조사(이름 검색) 편향 계량용 검증 표집. 재조사 아님, 전수 아님.",
        "method": "명성 축 계통표집 — 한 점 전수 수집, 점이 대표하는 명성 폭이 가중치",
        "endpoint": "/df/servers/all/characters-fame",
        "population": "레벨 110 이상 + 최근 90일 접속 (엔드포인트 제약)",
        "coarse_step": COARSE_STEP, "dense_step": DENSE_STEP, "dense_from": DENSE_FROM,
        "real_max_fame": FAME_TOP,
        "api_window_cap": 2000,
        "api_window_note": "minFame 과 무관하게 maxFame-2000 아래는 주지 않는다. 커서 훑기는 구간 상단에 쏠린다.",
        "sample_size": sum(density.values()),
        "api_calls": cli.call_count,
        "api_failures": cli.fail_count,
        "elapsed_sec": round(elapsed, 1),
        "saturated_points": saturated,
        "id_policy": "characterId 는 수신 즉시 회차 난수 소금으로 해시, 원본·이름 미저장",
    },
    "density": {str(k): density[k] for k in sorted(density)},
    "weight": {str(k): weight[k] for k in sorted(weight)},
    "grid_check": {"windows": refine_rows, "coarse_total": round(coarse_sum, 1),
                   "fine_total": round(fine_sum, 1), "gap_pct": round(gap_pct, 3),
                   "pass": abs(gap_pct) <= 5},
    "total_population": round(total_pop),
    "final_stage_population": round(final_pop),
    "bin_population": {k: round(v) for k, v in bin_pop.items()},
    "bin_share_pct": {k: round(v / total_pop * 100, 2) for k, v in bin_pop.items()},
    "bin_sample_n": bin_sample_n,
    "bin_final_stage_n": bin_final,
    "bin_jobs": bin_jobs,
    "bin_groups": bin_groups,
    "job_population": {k: round(v) for k, v in sorted(job_pop.items(), key=lambda x: -x[1])},
    "group_population": {k: round(v) for k, v in sorted(group_pop.items(), key=lambda x: -x[1])},
    "level_hist": {str(k): level_hist[k] for k in sorted(level_hist)},
}
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

print()
print(f"총 호출 {cli.call_count}회, 실패 {cli.fail_count}회, 소요 {elapsed / 60:.1f}분")
print(f"표본 {sum(density.values()):,}명 → 모집단 추정 {total_pop:,.0f}명 (활성 110+)")
print(f"저장 {OUT.relative_to(ROOT)}")
