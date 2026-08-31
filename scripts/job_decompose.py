# -*- coding: utf-8 -*-
"""직업 구성 차이의 원인 분해. 추가 호출 없이 기존 산출물만 쓴다.

전체 직업 구성 차이가
  (가) 구간 안에서 표집 방식이 직업 쪽으로 치우쳐 생긴 것인지
  (나) 두 방법이 보는 모집단의 성장 단계 구성이 달라 생긴 것인지
를 가른다.

직업 j 의 전체 비중은 구간 가중 평균이다.
  전체_j = 시그마_b (구간비중_b x 구간안직업비중_j|b)
따라서 두 방법의 차이는 다음 둘로 정확히 쪼개진다.
  구성효과_j = 시그마_b (구간비중차_b x 1차의 구간안직업비중_j|b)
  내부효과_j = 시그마_b (명성쪽 구간비중_b x 구간안직업비중차_j|b)
  차이_j = 구성효과_j + 내부효과_j
"""

import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
census = json.loads((ROOT / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
probe = json.loads((ROOT / "data" / "fame_probe_2026-08.json").read_text(encoding="utf-8"))
BINS = [b["label"] for b in json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]]

fs = census["distributions_final_stage"]
out = io.StringIO()


def p(s=""):
    print(s, file=out)


# ── 1차 조사: 구간 안 직업 구성 ───────────────────────────────────────
first_cell = {}
masked = 0
for r in fs["job_x_fame"]:
    if r["count"] is None:
        masked += 1
        continue
    first_cell[(r["jobName"], r["bin"])] = r["count"]

first_bin_total = {b: sum(v for (j, bb), v in first_cell.items() if bb == b) for b in BINS}
pF = {b: {j: v / first_bin_total[b] * 100 for (j, bb), v in first_cell.items() if bb == b} for b in BINS}

# ── 명성 방식: 구간 안 직업 구성 ─────────────────────────────────────
pP = {}
for b in BINS:
    tot = sum(probe["bin_jobs"][b].values())
    pP[b] = {j: v / tot * 100 for j, v in probe["bin_jobs"][b].items()}

# ── 구간 비중 ────────────────────────────────────────────────────────
wF = {x["range"]: x["pct"] / 100 for x in fs["fame_bins"]}
wP = {b: probe["bin_share_pct"][b] / 100 for b in BINS}

jobs = sorted(set(j for b in BINS for j in pF[b]) & set(j for b in BINS for j in pP[b]))

p("## 1. 구간 비중 (두 방법)")
p()
p(f"{'구간':<14}{'1차':>9}{'명성 방식':>11}{'차이':>10}{'1차 표본':>10}{'명성 표본':>10}")
for b in BINS:
    p(f"{b:<14}{wF[b] * 100:>8.2f}%{wP[b] * 100:>10.2f}%{(wP[b] - wF[b]) * 100:>+9.2f}%p"
      f"{first_bin_total[b]:>10,}{probe['bin_sample_n'][b]:>10,}")

# ── 2. 구간별 직업 총차이 ────────────────────────────────────────────
p()
p("## 2. 구간 안 직업 구성의 총차이 (TVD)")
p()
p(f"{'구간':<14}{'구간 TVD':>10}{'견준 직업':>10}{'가림 칸':>9}")
bin_tvd = {}
for b in BINS:
    keys = set(pF[b]) | set(pP[b])
    t = sum(abs(pP[b].get(j, 0.0) - pF[b].get(j, 0.0)) for j in keys) / 2
    bin_tvd[b] = t
    hidden = sum(1 for r in fs["job_x_fame"] if r["bin"] == b and r["count"] is None)
    p(f"{b:<14}{t:>9.2f}%p{len(keys):>10}{hidden:>9}")

wavg = sum(wP[b] * bin_tvd[b] for b in BINS)
p()
p(f"구간 TVD 의 명성쪽 비중 가중 평균 = {wavg:.2f}%p")

# ── 3. 분해 ──────────────────────────────────────────────────────────
mix, within, diff = {}, {}, {}
for j in jobs:
    m = sum((wP[b] - wF[b]) * pF[b].get(j, 0.0) for b in BINS)
    w = sum(wP[b] * (pP[b].get(j, 0.0) - pF[b].get(j, 0.0)) for b in BINS)
    mix[j], within[j], diff[j] = m, w, m + w

tvd_total = sum(abs(diff[j]) for j in jobs) / 2
tvd_mix = sum(abs(mix[j]) for j in jobs) / 2
tvd_within = sum(abs(within[j]) for j in jobs) / 2

p()
p("## 3. 차이의 분해")
p()
p(f"  전체 차이 (TVD)            {tvd_total:>7.2f}%p")
p(f"  구성효과 (구간 비중 차이)  {tvd_mix:>7.2f}%p   {tvd_mix / tvd_total * 100:>5.1f}%")
p(f"  내부효과 (구간 안 차이)    {tvd_within:>7.2f}%p   {tvd_within / tvd_total * 100:>5.1f}%")
p()
p("두 효과는 직업마다 방향이 달라 단순히 더해지지 않는다. 위 비율은 크기 비교용이다.")

# ── 4. 차이가 큰 직업의 구간별 내역 ──────────────────────────────────
top = sorted(jobs, key=lambda j: -abs(diff[j]))[:5]
p()
p("## 4. 차이가 큰 직업 다섯, 구간별로 어디서 벌어지는가")
p()
p(f"{'직업':<12}{'전체차이':>9}{'구성효과':>9}{'내부효과':>9}   구간 안 직업비중 차이 (1차 -> 명성)")
for j in top:
    cells = "  ".join(f"{b[:4]} {pP[b].get(j, 0.0) - pF[b].get(j, 0.0):+.1f}" for b in BINS)
    p(f"{j:<12}{diff[j]:>+8.2f}%p{mix[j]:>+8.2f}%p{within[j]:>+8.2f}%p   {cells}")
p()
p("구간 이름은 앞 네 글자만 적었다. 값은 그 구간 안에서 그 직업이 차지하는 비중의 차이다.")

# ── 5. 판정 ──────────────────────────────────────────────────────────
p()
p("## 5. 판정")
p()
ratio = tvd_within / tvd_total
if wavg >= tvd_total * 0.8:
    verdict = "표집 방식 자체가 직업 쪽으로 치우침"
elif wavg <= tvd_total * 0.4:
    verdict = "두 방법이 보는 모집단 구성 차이"
else:
    verdict = "두 요인이 함께 작용"
p(f"  구간 TVD 가중 평균 {wavg:.2f}%p 대 전체 TVD {tvd_total:.2f}%p")
p(f"  내부효과가 전체의 {ratio * 100:.0f}%")
p(f"  => {verdict}")

(ROOT / "data" / "job_decompose.txt").write_text(out.getvalue(), encoding="utf-8")
summary = {
    "bin_tvd": {b: round(bin_tvd[b], 2) for b in BINS},
    "bin_tvd_weighted_mean": round(wavg, 2),
    "tvd_total": round(tvd_total, 2),
    "tvd_mix": round(tvd_mix, 2),
    "tvd_within": round(tvd_within, 2),
    "within_share_pct": round(ratio * 100, 1),
    "masked_cells": masked,
    "top_jobs": [{"jobName": j, "diff": round(diff[j], 2), "mix": round(mix[j], 2),
                  "within": round(within[j], 2)} for j in top],
}
(ROOT / "data" / "job_decompose.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(out.getvalue())
