# -*- coding: utf-8 -*-
"""검증 조사 결과를 리포트가 읽을 형태로 정리한다.

1차 조사 수치는 손대지 않는다. 나란히 놓을 값만 만든다.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
census = json.loads((ROOT / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
probe = json.loads((ROOT / "data" / "fame_probe_2026-08.json").read_text(encoding="utf-8"))
BINS = [b["label"] for b in json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]]

fs = census["distributions_final_stage"]
act = {b["bin"]: b for b in census["activity"]["by_fame_bin"]}
first_bin = {x["range"]: x["pct"] for x in fs["fame_bins"]}
meas_bin = probe["bin_share_pct"]

# 1. 명성 구간 대조
fame_rows = []
for b in BINS:
    fame_rows.append({
        "bin": b,
        "first": round(first_bin[b], 2),
        "verified": round(meas_bin[b], 2),
        "diff": round(meas_bin[b] - first_bin[b], 2),
    })
fame_tvd = round(sum(abs(r["diff"]) for r in fame_rows) / 2, 2)

# 2. 직업 대조
jp = probe["job_population"]
jtot = sum(jp.values())
first_job = {x["jobName"]: x["pct"] for x in fs["job"]}
job_all = []
for name, pop in jp.items():
    if name in first_job:
        m = pop / jtot * 100
        job_all.append({"jobName": name, "first": round(first_job[name], 2),
                        "verified": round(m, 2), "diff": round(m - first_job[name], 2)})
job_tvd = round(sum(abs(r["diff"]) for r in job_all) / 2, 2)
job_rows = sorted(job_all, key=lambda r: -abs(r["diff"]))[:5]

gp = probe["group_population"]
gtot = sum(gp.values())
first_grp = {x["jobName"]: x["pct"] for x in fs["job_group"]}
grp_all = []
for name, pop in gp.items():
    if name in first_grp:
        m = pop / gtot * 100
        grp_all.append(abs(m - first_grp[name]))
group_tvd = round(sum(grp_all) / 2, 2)

# 3. 휴면 판정 역산 (조건부 진단)
ratio = {b: meas_bin[b] / first_bin[b] for b in BINS}
mx = max(ratio.values())
dorm_rows = []
for b in BINS:
    a = act[b]
    timeline = a["pct"].get("휴면", 0.0)
    implied = (1 - ratio[b] / mx) * 100
    dorm_rows.append({
        "bin": b,
        "timeline": round(timeline, 1),
        "subsampleN": a["n"],
        "implied": round(max(0.0, implied), 1),
        "diff": round(max(0.0, implied) - timeline, 1),
    })

sub_ns = [r["subsampleN"] for r in dorm_rows]
out = {
    "meta": {
        "surveyed_at": probe["meta"]["surveyed_at"],
        "api_calls": probe["meta"]["api_calls"],
        "sample_size": probe["meta"]["sample_size"],
        "population": probe["total_population"],
        "coarse_step": probe["meta"]["coarse_step"],
        "dense_step": probe["meta"]["dense_step"],
        "grid_check_pct": probe["grid_check"]["gap_pct"],
        "window_cap": probe["meta"]["api_window_cap"],
        "subsample_min": min(sub_ns),
        "subsample_max": max(sub_ns),
    },
    "fame_bins": fame_rows,
    "fame_tvd": fame_tvd,
    "jobs": job_rows,
    "job_tvd": job_tvd,
    "job_group_tvd": group_tvd,
    "job_compared": len(job_all),
    "dormancy": dorm_rows,
}

dest = ROOT / "data" / "verification_2026-08.json"
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"검증 대조 저장: {dest.relative_to(ROOT)}")
print(f"  명성 분포 총 차이 {fame_tvd}%p, 직업 총 차이 {job_tvd}%p, 직업군 {group_tvd}%p")
print(f"  부표본 {min(sub_ns)}~{max(sub_ns)}명, 표본 {out['meta']['sample_size']:,}명, 호출 {out['meta']['api_calls']}회")
