# -*- coding: utf-8 -*-
"""상한이 가리고 있던 것의 규모와 성격.

쪼개기 전 200명과 쪼갠 뒤 드러난 인원을 견준다.
"""

import io
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CKPT = ROOT / "data" / "checkpoints"
BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
LABELS = [b["label"] for b in BINS]
JOB_MAP = json.loads((ROOT / "config" / "job_map.json").read_text(encoding="utf-8"))["map"]
out = io.StringIO()


def p(s=""):
    print(s, file=out)


def bin_of(f):
    if f is None:
        return None
    for b in BINS:
        if f >= b["min"] and (b["max"] is None or f < b["max"]):
            return b["label"]
    return None


# ── 원본 200명 (phase1) ──────────────────────────────────────────────
orig = {}
capped_all = []
with (CKPT / "r2_phase1.jsonl").open(encoding="utf-8") as f:
    for line in f:
        r = json.loads(line)
        if r["capped"]:
            capped_all.append((r["server"], r["seed"]))
            orig[(r["server"], r["seed"])] = r["rows"]

# ── 쪼갠 결과 (phase2) ───────────────────────────────────────────────
split = {}
split_capped = split_calls = 0
with (CKPT / "r2_phase2.jsonl").open(encoding="utf-8") as f:
    for line in f:
        r = json.loads(line)
        key = (r["server"], r["seed"])
        split.setdefault(key, {})
        for x in r["rows"]:
            split[key][x["h"]] = x
        split_calls += 1
        split_capped += 1 if r["capped"] else 0

done = [k for k in split if k in orig]
p("## 1. 상한 우회 표본")
p()
p(f"  상한 도달 조합 전체       {len(capped_all):,}개")
p(f"  쪼개 본 조합             {len(done):,}개")
p(f"  직업군 재호출            {split_calls:,}건")
p(f"  쪼갠 뒤에도 상한 도달     {split_capped:,}건 ({split_capped / max(1, split_calls) * 100:.1f}%)")

# ── 배수 ─────────────────────────────────────────────────────────────
mult = []
new_rows, old_rows = [], []
for k in done:
    o = {x["h"]: x for x in orig[k]}
    s = split[k]
    mult.append(len(s) / max(1, len(o)))
    for h, x in s.items():
        (old_rows if h in o else new_rows).append(x)

mean_m = sum(mult) / len(mult)
sd = math.sqrt(sum((m - mean_m) ** 2 for m in mult) / max(1, len(mult) - 1))
se = sd / math.sqrt(len(mult))
p()
p("## 2. 상한이 가리는 규모")
p()
p(f"  쪼개기 전 한 조합당      200명 (상한)")
p(f"  쪼갠 뒤 평균             {mean_m * 200:.0f}명")
p(f"  배수                    {mean_m:.2f}배  (95% {mean_m - 1.96 * se:.2f} ~ {mean_m + 1.96 * se:.2f})")
p(f"  표본 {len(mult)}개 조합 기준, 표준편차 {sd:.2f}")
p()
p(f"  전체 상한 도달 조합 {len(capped_all):,}개에 적용하면")
lo, hi = mean_m - 1.96 * se, mean_m + 1.96 * se
p(f"    가려진 인원(중복 포함) 약 {len(capped_all) * (mean_m - 1) * 200:,.0f}명")
p(f"    95% 구간 {len(capped_all) * (lo - 1) * 200:,.0f} ~ {len(capped_all) * (hi - 1) * 200:,.0f}명")
p("  중복 제거 전 수치이므로 고유 캐릭터 수는 이보다 적다.")

# ── 새로 드러난 쪽과 원래 있던 쪽 ────────────────────────────────────
def dist(rows):
    b = {l: 0 for l in LABELS}
    j = {}
    miss = 0
    for x in rows:
        lab = bin_of(x.get("fame"))
        if lab is None:
            miss += 1
        else:
            b[lab] += 1
        canon = JOB_MAP.get(x.get("jobGrowName", ""), {}).get("canonical")
        if canon:
            j[canon] = j.get(canon, 0) + 1
    tb = sum(b.values()) or 1
    tj = sum(j.values()) or 1
    return ({l: b[l] / tb * 100 for l in LABELS}, {k: v / tj * 100 for k, v in j.items()}, miss)


bo, jo, mo = dist(old_rows)
bn, jn, mn = dist(new_rows)
p()
p("## 3. 상한이 무엇을 가리고 있었나")
p()
p(f"  원래 200명 안          {len(old_rows):,}명")
p(f"  쪼개서 새로 드러남      {len(new_rows):,}명")
p()
p(f"{'구간':<14}{'원래 200명 안':>14}{'새로 드러남':>13}{'차이':>10}")
for l in LABELS:
    p(f"{l:<14}{bo[l]:>13.2f}%{bn[l]:>12.2f}%{bn[l] - bo[l]:>+9.2f}%p")
fame_tvd = sum(abs(bn[l] - bo[l]) for l in LABELS) / 2
p()
p(f"명성 분포 총차이 {fame_tvd:.2f}%p")

keys = set(jo) | set(jn)
job_tvd = sum(abs(jn.get(k, 0) - jo.get(k, 0)) for k in keys) / 2
p(f"직업 구성 총차이 {job_tvd:.2f}%p  (직업 {len(keys)}종)")
p()
p(f"{'직업':<14}{'원래 200명 안':>14}{'새로 드러남':>13}{'차이':>10}")
for k in sorted(keys, key=lambda x: -abs(jn.get(x, 0) - jo.get(x, 0)))[:8]:
    p(f"{k:<14}{jo.get(k, 0):>13.2f}%{jn.get(k, 0):>12.2f}%{jn.get(k, 0) - jo.get(k, 0):>+9.2f}%p")

res = {
    "sampled_combos": len(done), "capped_combos_total": len(capped_all),
    "split_calls": split_calls, "still_capped": split_capped,
    "still_capped_pct": round(split_capped / max(1, split_calls) * 100, 2),
    "multiplier_mean": round(mean_m, 3),
    "multiplier_ci95": [round(lo, 3), round(hi, 3)],
    "old_n": len(old_rows), "new_n": len(new_rows),
    "fame_tvd_new_vs_old": round(fame_tvd, 2),
    "job_tvd_new_vs_old": round(job_tvd, 2),
    "random_seed": 20260831,
}
(ROOT / "data" / "phase2_sample.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
(ROOT / "data" / "phase2_sample.txt").write_text(out.getvalue(), encoding="utf-8")
print(out.getvalue())
