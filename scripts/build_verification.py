# -*- coding: utf-8 -*-
"""검증 조사 결과를 리포트가 읽을 형태로 정리한다.

명성 점수로 훑은 표본을 각 회차와 나란히 놓는다. 회차 수치는 손대지 않는다.
1차와 2차를 각각 만들어 두 파일로 저장한다.

    python scripts/build_verification.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
probe = json.loads((ROOT / "data" / "fame_probe_2026-08.json").read_text(encoding="utf-8"))
BINS = [b["label"] for b in json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]]
meas_bin = probe["bin_share_pct"]


def build(census_path, activity_path):
    census = json.loads((ROOT / census_path).read_text(encoding="utf-8"))
    fs = census["distributions_final_stage"]
    if activity_path:
        raw = json.loads((ROOT / activity_path).read_text(encoding="utf-8"))
        act = {b: {"pct": v["pct"], "n": v["n"]} for b, v in raw["by_fame_bin"].items()}
    else:
        act = {b["bin"]: b for b in census["activity"]["by_fame_bin"]}
    first_bin = {x["range"]: x["pct"] for x in fs["fame_bins"]}

    # 1. 명성 구간 대조
    fame_rows = []
    for b in BINS:
        fame_rows.append({
            "bin": b,
            "first": round(first_bin[b], 2),
            "verified": round(meas_bin[b], 2),
            "diff": round(meas_bin[b] - first_bin[b], 2),
        })
    # 총차이는 반올림 전 값으로 더한다. 항목마다 두 자리로 깎아 더하면
    # 마지막 자리가 회차 대조표(compare_r2)와 어긋난다.
    fame_tvd = round(sum(abs(meas_bin[b] - first_bin[b]) for b in BINS) / 2, 2)

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
    job_tvd = round(sum(abs(pop / jtot * 100 - first_job[name])
                        for name, pop in jp.items() if name in first_job) / 2, 2)
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
    return {
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
        # 회차 대조에서 특정 직업을 집어 쓰려면 다섯 개로는 모자란다
        "jobs_all": sorted(job_all, key=lambda r: -abs(r["diff"])),
        "job_tvd": job_tvd,
        "job_group_tvd": group_tvd,
        "job_compared": len(job_all),
        "dormancy": dorm_rows,
    }


ROUNDS = [
    ("verification_2026-08.json", "data/census_2026-08.json", None),
    ("verification_2026-08-r2.json", "data/census_2026-08-r2.json", "data/activity_r2.json"),
]

for name, census_path, activity_path in ROUNDS:
    out = build(census_path, activity_path)
    (ROOT / "data" / name).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"검증 대조 저장: data/{name}")
    print(f"  명성 분포 총 차이 {out['fame_tvd']}%p, 직업 총 차이 {out['job_tvd']}%p, "
          f"직업군 {out['job_group_tvd']}%p, 부표본 {out['meta']['subsample_min']}~{out['meta']['subsample_max']}명")
