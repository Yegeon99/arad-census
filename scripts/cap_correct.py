# -*- coding: utf-8 -*-
"""상한 보정 추정.

상한에 걸린 검색은 200명만 돌려준다. 그 조합을 직업군으로 쪼개면 평균 몇 배가
나오는지 400개 표본으로 쟀다. 그 구성을 상한에 걸린 조합 전체에 적용해
2차 표본의 명성 분포를 다시 잡는다.

가정: 쪼갠 400개 조합의 구성이 나머지 상한 도달 조합에도 통한다.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
L = [b["label"] for b in BINS]
JM = json.loads((ROOT / "config" / "job_map.json").read_text(encoding="utf-8"))["map"]
CK = ROOT / "data" / "checkpoints"
probe = json.loads((ROOT / "data" / "fame_probe_2026-08.json").read_text(encoding="utf-8"))
pf = probe["bin_share_pct"]
SAMPLED = 400


def bin_of(f):
    if f is None:
        return None
    for b in BINS:
        if f >= b["min"] and (b["max"] is None or f < b["max"]):
            return b["label"]
    return None


def final_rows(path, only_uncapped=None):
    seen, capped_keys = {}, set()
    with (CK / path).open(encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if "seed" in r and r.get("capped"):
                capped_keys.add((r["server"], r["seed"]))
            if only_uncapped is not None and r.get("capped") != (not only_uncapped):
                pass
            for x in r["rows"]:
                m = JM.get(x.get("jobGrowName", ""))
                if m and m["stage"] == "眞":
                    seen[(r["server"], x["h"])] = (x, r.get("capped", False))
    return seen, capped_keys


def dist(rows):
    b = {l: 0 for l in L}
    for x in rows:
        lab = bin_of(x.get("fame"))
        if lab:
            b[lab] += 1
    t = sum(b.values()) or 1
    return {l: b[l] / t * 100 for l in L}, sum(b.values())


p1, capped_keys = final_rows("r2_phase1.jsonl")
uncapped = [x for x, cap in p1.values() if not cap]
p2, _ = final_rows("r2_phase2.jsonl")
split = [x for x, _ in p2.values()]

du, nu = dist(uncapped)
ds, ns = dist(split)
w_capped = ns / SAMPLED * len(capped_keys)
mix = {l: (du[l] * nu + ds[l] * w_capped) / (nu + w_capped) for l in L}

r1 = json.loads((ROOT / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
r2 = json.loads((ROOT / "data" / "census_2026-08-r2.json").read_text(encoding="utf-8"))
sh = lambda d: {x["range"]: x["pct"] for x in d}
f1 = sh(r1["distributions_final_stage"]["fame_bins"])
f2 = sh(r2["distributions_final_stage"]["fame_bins"])
tvd = lambda a: sum(abs(a[l] - pf[l]) for l in L) / 2

out = {
    "note": ("상한에 걸린 조합 전체를 쪼갠 표본 400개의 구성으로 대치해 다시 잡은 추정치. "
             "쪼갠 표본의 구성이 나머지 상한 도달 조합에도 통한다는 가정 위에 있다."),
    "sampled_combos": SAMPLED,
    "capped_combos": len(capped_keys),
    "uncapped_final_stage": nu,
    "split_final_stage": ns,
    "bin_share_uncapped_only": {l: round(du[l], 2) for l in L},
    "bin_share_split_sample": {l: round(ds[l], 2) for l in L},
    "bin_share_cap_corrected": {l: round(mix[l], 2) for l in L},
    "tvd_vs_fame_method": {
        "r1_observed": round(tvd(f1), 2),
        "r2_observed": round(tvd(f2), 2),
        "r2_cap_corrected": round(tvd(mix), 2),
    },
}
(ROOT / "data" / "cap_correct.json").write_text(json.dumps(out, ensure_ascii=False, indent=2),
                                                encoding="utf-8")
print(f"{'구간':<14}{'1차 관측':>10}{'2차 관측':>10}{'2차 상한보정':>13}{'명성 방식':>11}")
for l in L:
    print(f"{l:<14}{f1[l]:>9.2f}%{f2[l]:>9.2f}%{mix[l]:>12.2f}%{pf[l]:>10.2f}%")
print()
print(f"명성 방식과의 총차이  1차 {tvd(f1):.2f}%p  2차 {tvd(f2):.2f}%p  2차 상한보정 {tvd(mix):.2f}%p")
print("저장 data/cap_correct.json")
