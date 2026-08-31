# -*- coding: utf-8 -*-
"""1차 회차 / 2차 회차 / 명성 방식 세 갈래 대조.

이번 회차의 핵심 지표는 하나다.
1차가 명성 방식과 벌린 차이(명성 분포 3.84%p, 직업 구성 9.54%p)가
시드를 바꾼 2차에서 얼마로 줄어드는가.
"""

import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BINS = [b["label"] for b in json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]]
r1 = json.loads((ROOT / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
r2 = json.loads((ROOT / "data" / "census_2026-08-r2.json").read_text(encoding="utf-8"))
probe = json.loads((ROOT / "data" / "fame_probe_2026-08.json").read_text(encoding="utf-8"))
out = io.StringIO()


def p(s=""):
    print(s, file=out)


def fame_share(census):
    fs = census["distributions_final_stage"]
    return {x["range"]: x["pct"] for x in fs["fame_bins"]}


def job_share(census):
    fs = census["distributions_final_stage"]
    return {x["jobName"]: x["pct"] for x in fs["job"]}


probe_fame = probe["bin_share_pct"]
jp = probe["job_population"]
tot = sum(jp.values())
probe_job = {k: v / tot * 100 for k, v in jp.items()}


def tvd(a, b):
    keys = set(a) | set(b)
    return sum(abs(a.get(k, 0.0) - b.get(k, 0.0)) for k in keys) / 2


f1, f2 = fame_share(r1), fame_share(r2)
j1, j2 = job_share(r1), job_share(r2)

# ── 표 1. 회차 규모 ──────────────────────────────────────────────────
m1, m2 = r1["meta"], r2["meta"]
p("## 표 1. 회차 규모")
p()
p(f"{'항목':<22}{'1차':>14}{'2차':>14}")
rows = [
    ("시드 수", 36, m2.get("seed_count", 1000)),
    ("검색 호출", m1["search_calls"], m2["search_calls"]),
    ("상한 도달 호출", m1["search_calls_capped"], m2["search_calls_capped"]),
    ("표본", m1["sample_size"], m2["sample_size"]),
    ("상한 미도달에서 발견", m1["uncapped_sample_size"], m2["uncapped_sample_size"]),
    ("명성 결측", m1["fame_missing"], m2["fame_missing"]),
    ("진 각성", r1["distributions_final_stage"]["sample_size"], r2["distributions_final_stage"]["sample_size"]),
]
for name, a, b in rows:
    p(f"{name:<22}{a:>14,}{b:>14,}")
p(f"{'상한 도달률':<22}{m1['search_calls_capped'] / m1['search_calls'] * 100:>13.1f}%"
  f"{m2['search_calls_capped'] / m2['search_calls'] * 100:>13.1f}%")

# ── 표 2. 명성 구간 비중 ─────────────────────────────────────────────
p()
p("## 표 2. 명성 구간 비중 (진 각성 기준)")
p()
p(f"{'구간':<14}{'1차':>9}{'2차':>9}{'명성 방식':>11}{'1차-명성':>11}{'2차-명성':>11}")
for b in BINS:
    p(f"{b:<14}{f1[b]:>8.2f}%{f2[b]:>8.2f}%{probe_fame[b]:>10.2f}%"
      f"{f1[b] - probe_fame[b]:>+10.2f}%p{f2[b] - probe_fame[b]:>+10.2f}%p")
t1f, t2f = tvd(f1, probe_fame), tvd(f2, probe_fame)
p()
p(f"명성 방식과의 총차이   1차 {t1f:.2f}%p  ->  2차 {t2f:.2f}%p")
p(f"1차와 2차 사이 총차이  {tvd(f1, f2):.2f}%p")

# ── 표 3. 직업 구성 ──────────────────────────────────────────────────
p()
p("## 표 3. 직업 구성 (진 각성 기준)")
p()
common = sorted(set(j1) & set(j2) & set(probe_job))
d1 = {j: j1[j] - probe_job[j] for j in common}
d2 = {j: j2[j] - probe_job[j] for j in common}
t1j = sum(abs(v) for v in d1.values()) / 2
t2j = sum(abs(v) for v in d2.values()) / 2
p(f"공통 직업 {len(common)}종 기준")
p(f"명성 방식과의 총차이   1차 {t1j:.2f}%p  ->  2차 {t2j:.2f}%p")
p(f"1차와 2차 사이 총차이  {tvd(j1, j2):.2f}%p")
p()
p(f"{'직업':<14}{'1차':>8}{'2차':>8}{'명성 방식':>10}{'1차-명성':>10}{'2차-명성':>10}")
for j in sorted(common, key=lambda x: -abs(d1[x]))[:10]:
    p(f"{j:<14}{j1[j]:>7.2f}%{j2[j]:>7.2f}%{probe_job[j]:>9.2f}%{d1[j]:>+9.2f}%p{d2[j]:>+9.2f}%p")

# ── 요약 ─────────────────────────────────────────────────────────────
p()
p("## 핵심 지표")
p()
p(f"  명성 분포 차이   {t1f:.2f}%p  ->  {t2f:.2f}%p   ({(t2f - t1f) / t1f * 100:+.0f}%)")
p(f"  직업 구성 차이   {t1j:.2f}%p  ->  {t2j:.2f}%p   ({(t2j - t1j) / t1j * 100:+.0f}%)")

(ROOT / "data" / "compare_r2.txt").write_text(out.getvalue(), encoding="utf-8")
json.dump({
    "fame_tvd_r1_vs_probe": round(t1f, 2), "fame_tvd_r2_vs_probe": round(t2f, 2),
    "job_tvd_r1_vs_probe": round(t1j, 2), "job_tvd_r2_vs_probe": round(t2j, 2),
    "fame_tvd_r1_vs_r2": round(tvd(f1, f2), 2), "job_tvd_r1_vs_r2": round(tvd(j1, j2), 2),
    "jobs_compared": len(common),
}, io.open(ROOT / "data" / "compare_r2.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(out.getvalue())
