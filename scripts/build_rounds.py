# -*- coding: utf-8 -*-
"""두 회차를 나란히 놓는 대조 자료를 만든다.

리포트의 "처음 조사와 무엇이 달라졌는가" 화면이 이 파일 하나만 읽는다.
값은 전부 기존 산출물에서 가져오고 여기서 새로 재지 않는다.

    python scripts/build_rounds.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data"


def load(name):
    return json.loads((D / name).read_text(encoding="utf-8"))


c1, c2 = load("census_2026-08.json"), load("census_2026-08-r2.json")
v1, v2 = load("verification_2026-08.json"), load("verification_2026-08-r2.json")
n1, n2 = load("net_miss_2026-08.json"), load("net_miss_r2.json")
nk = load("name_kind_2026-08.json")
cap = load("cap_correct.json")
split = load("phase2_sample.json")

# 상한 도달률: 걸린 검색 / 전체 검색
def limited_pct(c):
    m = c["meta"]
    return round(m["search_calls_capped"] / m["search_calls"] * 100, 2)


def job_diff(v, name):
    """회차 분포와 명성 방식 분포의 차이. 양수면 회차 쪽이 더 많이 잡았다."""
    for row in v["jobs_all"]:
        if row["jobName"] == name:
            return round(row["first"] - row["verified"], 2)
    raise SystemExit(f"{name} 을(를) 대조 목록에서 찾지 못했습니다")


SEEDS_1 = json.loads((ROOT / "config" / "seeds.json").read_text(encoding="utf-8"))
SEED = "바람"
seed_jobs = n1["seed_job"][SEED]
top_job = max(seed_jobs, key=seed_jobs.get)

rounds = {
    "note": "1차와 2차를 나란히 놓기 위한 대조 자료. 두 회차 산출물은 그대로 둔다.",
    "first": {
        "label": "처음 조사",
        "surveyed_at": c1["meta"]["surveyed_at"],
        "sample_size": c1["meta"]["sample_size"],
        "final_stage_size": c1["distributions_final_stage"]["sample_size"],
        "seeds": n1["meta"]["seeds"],
        "seeds_common": len(SEEDS_1["common"]),
        "seeds_rare": len(SEEDS_1["rare"]),
        "coverage_pct": n1["overall"]["by_kind_pct"]["걸림"],
        "limited_pct": limited_pct(c1),
        "job_tvd": v1["job_tvd"],
        "fame_tvd": v1["fame_tvd"],
    },
    "second": {
        "label": "두 번째 조사",
        "surveyed_at": c2["meta"]["surveyed_at"],
        "sample_size": c2["meta"]["sample_size"],
        "final_stage_size": c2["distributions_final_stage"]["sample_size"],
        "seeds": c2["meta"]["seed_count"],
        "coverage_pct": n2["overall"]["by_kind_pct"]["걸림"],
        "limited_pct": limited_pct(c2),
        "job_tvd": v2["job_tvd"],
        "fame_tvd": v2["fame_tvd"],
    },
    # 처음 시드가 직업과 맞물려 있었다는 실측
    "seed_bias": {
        "probe_sample": n1["meta"]["sample_size"],
        "caught": n1["overall"]["caught"],
        "seed": SEED,
        "seed_hits": n1["seed_hits"][SEED],
        "top_job": top_job,
        "top_job_count": seed_jobs[top_job],
    },
    # 시드를 바꾸자 실제로 좁혀진 직업 세 개
    "job_gap": [
        {"jobName": name, "first": job_diff(v1, name), "second": job_diff(v2, name)}
        for name in ["스위프트 마스터", "다크템플러", "다크 랜서"]
    ],
    # 같은 개수라도 무엇을 고르는지에 따라 커버리지가 갈린다
    "coverage_by_seed_count": nk["coverage_holdout_pct"],
    # 상한을 걷어낼수록 명성 방식에서 멀어진다
    "fame_method_tvd": {
        "first_observed": cap["tvd_vs_fame_method"]["r1_observed"],
        "second_observed": cap["tvd_vs_fame_method"]["r2_observed"],
        "second_cap_corrected": cap["tvd_vs_fame_method"]["r2_cap_corrected"],
    },
    # 쪼개면 상한을 못 벗어날 것으로 봤던 예측이 틀린 대목
    "split_prediction": {
        "expected": "직업군으로 쪼개도 인기 직업군은 다시 상한에 걸린다",
        "still_limited_pct": split["still_capped_pct"],
    },
}

# 대조: 회차 표기가 실제 산출물과 맞는지
assert c1["meta"]["round"] == "2026-08" and c2["meta"]["round"] == "2026-08-r2"
for key in ("first", "second"):
    r = rounds[key]
    assert 0 < r["coverage_pct"] < 100 and 0 < r["limited_pct"] < 100

(D / "rounds.json").write_text(json.dumps(rounds, ensure_ascii=False, indent=2), encoding="utf-8")
f, s = rounds["first"], rounds["second"]
print("회차 대조 저장: data/rounds.json")
print(f"  표본 {f['sample_size']:,} -> {s['sample_size']:,}명")
print(f"  커버리지 {f['coverage_pct']} -> {s['coverage_pct']}%")
print(f"  상한 도달률 {f['limited_pct']} -> {s['limited_pct']}%")
print(f"  직업 구성 차이 {f['job_tvd']} -> {s['job_tvd']}%p")
print(f"  명성 방식과의 성장 단계 차이 {rounds['fame_method_tvd']}")
