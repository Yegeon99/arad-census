# -*- coding: utf-8 -*-
"""문서에 적은 수치를 데이터 파일과 대조한다.

docs/findings.md 와 README.md 가 인용하는 값을 여기서 다시 계산해 맞춰 본다.
불일치가 하나라도 있으면 실패로 끝난다.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data"


def load(name):
    return json.loads((D / name).read_text(encoding="utf-8"))


r1 = load("census_2026-08.json")
r2 = load("census_2026-08-r2.json")
probe = load("fame_probe_2026-08.json")
cmp2 = load("compare_r2.json")
p2 = load("phase2_sample.json")
cap = load("cap_correct.json")
nm1 = load("net_miss_2026-08.json")
nm2 = load("net_miss_r2.json")
nk = load("name_kind_2026-08.json")
act2 = load("activity_r2.json")
llm = json.loads((D / "llm_costs.json").read_text(encoding="utf-8-sig"))
seeds2 = json.loads((ROOT / "config" / "seeds_r2.json").read_text(encoding="utf-8"))

L = [b["label"] for b in json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]]
sh = lambda d: {x["range"]: x["pct"] for x in d}
f1, f2 = sh(r1["distributions_final_stage"]["fame_bins"]), sh(r2["distributions_final_stage"]["fame_bins"])

# 직업 기준을 성장 완료로 좁히면 검색 방식 차이가 사라지는지
jall = {x["jobName"]: x["pct"] for x in r1["distributions"]["job"]}
jall_u = {x["jobName"]: x["pct"] for x in r1["distributions_uncapped_only"]["job"]}
jfin = {x["jobName"]: x["pct"] for x in r1["distributions_final_stage"]["job"]}
jfin_u = {x["jobName"]: x["pct"] for x in r1["distributions_final_stage"]["uncapped_job"]}
tvd = lambda a, b: sum(abs(a.get(k, 0) - b.get(k, 0)) for k in set(a) | set(b)) / 2

CLAIMS = [
    # (문서에 적을 값, 실제 값, 설명)
    (1_301_990, r2["meta"]["sample_size"], "2차 표본"),
    (1_228_491, r2["distributions_final_stage"]["sample_size"], "2차 진 각성"),
    (1000, len(seeds2["seeds"]), "2차 시드 수"),
    (8, len(r2["meta"]["servers"]), "서버 수"),
    (31_523, r1["meta"]["sample_size"], "1차 표본"),
    (29_527, r1["distributions_final_stage"]["sample_size"], "1차 진 각성"),
    (18_552, probe["meta"]["sample_size"], "명성 방식 표본"),
    (947, probe["meta"]["api_calls"], "명성 방식 호출"),
    (1.21, nm1["overall"]["miss_rate_pct"] and round(100 - nm1["overall"]["miss_rate_pct"], 2), "1차 커버리지"),
    (50.66, round(100 - nm2["overall"]["miss_rate_pct"], 2), "2차 커버리지"),
    (45.8, round(r1["meta"]["search_calls_capped"] / r1["meta"]["search_calls"] * 100, 1), "1차 상한 도달률"),
    (90.5, round(r2["meta"]["search_calls_capped"] / r2["meta"]["search_calls"] * 100, 1), "2차 상한 도달률"),
    (3.84, cmp2["fame_tvd_r1_vs_probe"], "1차 명성 분포 차이"),
    (10.26, cmp2["fame_tvd_r2_vs_probe"], "2차 명성 분포 차이"),
    (9.54, cmp2["job_tvd_r1_vs_probe"], "1차 직업 구성 차이"),
    (5.24, cmp2["job_tvd_r2_vs_probe"], "2차 직업 구성 차이"),
    (29.97, cap["tvd_vs_fame_method"]["r2_cap_corrected"], "2차 상한보정 명성 차이"),
    (3.41, p2["multiplier_mean"], "상한 배수"),
    (3.13, p2["multiplier_ci95"][0], "배수 신뢰구간 하한"),
    (3.69, p2["multiplier_ci95"][1], "배수 신뢰구간 상한"),
    (5.2, p2["still_capped_pct"], "쪼갠 뒤 상한 잔존율"),
    (400, p2["sampled_combos"], "쪼갠 조합 수"),
    (48.78, f2["레기온 미만"], "2차 관측 레기온 입장 전"),
    (42.36, f1["레기온 미만"], "1차 관측 레기온 입장 전"),
    (68.49, cap["bin_share_cap_corrected"]["레기온 미만"], "상한보정 레기온 입장 전"),
    (38.52, probe["bin_share_pct"]["레기온 미만"], "명성 방식 레기온 입장 전"),
    (13.11, nk["coverage_holdout_pct"]["36"], "흔한 조합 36개 커버리지"),
    (45.91, nk["coverage_holdout_pct"]["1000"], "흔한 조합 1000개 커버리지 예측"),
    (42.2, act2["overall"]["휴면"]["pct"], "2차 휴면율"),
    (40.2, round(next(x["pct"] for x in r1["activity"]["overall"] if x["label"] == "휴면"), 1), "1차 휴면율"),
]

# 모델 비용은 인사이트를 다시 만들 때마다 바뀐다. 상수로 박아 두면 곧 어긋나므로
# 문서에 적힌 값을 그대로 읽어 산출물과 맞춘다.
FINDINGS = (ROOT / "docs" / "findings.md").read_text(encoding="utf-8")
m_cost = re.search(r"모델 비용 누적 \| ([\d.]+)달러 \(배치 (\d+)회\)", FINDINGS)
if not m_cost:
    raise SystemExit("findings.md 에서 모델 비용 줄을 찾지 못했습니다")
CLAIMS.append((float(m_cost.group(1)), llm["total_cost_usd"], "LLM 누적 비용"))
CLAIMS.append((int(m_cost.group(2)), len(llm["calls"]), "LLM 배치 횟수"))

# 새로 드러난 캐릭터의 레기온 입장 전 비중은 phase2_sample.txt 에 있다
txt = (D / "phase2_sample.txt").read_text(encoding="utf-8")
m = re.search(r"레기온 미만\s+([\d.]+)%\s+([\d.]+)%", txt)
CLAIMS.append((87.20, float(m.group(2)), "새로 드러난 캐릭터의 레기온 입장 전 비중"))
CLAIMS.append((48.25, float(m.group(1)), "원래 200명 안 레기온 입장 전 비중"))

# 바람 시드
CLAIMS.append((38, nm1["seed_hits"]["바람"], "바람 시드로 걸린 인원"))
CLAIMS.append((24, nm1["seed_job"]["바람"]["스위프트 마스터"], "그중 스위프트 마스터"))

# 직업 기준 변경 효과 (모든 캐릭터 기준 -> 성장 완료 기준)
CLAIMS.append((15.48, round(tvd(jall, jall_u), 2), "검색 방식 차이, 모든 캐릭터 기준"))
CLAIMS.append((13.31, round(tvd(jfin, jfin_u), 2), "검색 방식 차이, 성장 완료 기준"))
CLAIMS.append((2.56, round(jall_u["사령술사"] / jall["사령술사"], 2), "사령술사 배수, 모든 캐릭터"))
CLAIMS.append((1.16, round(jfin_u["사령술사"] / jfin["사령술사"], 2), "사령술사 배수, 성장 완료"))
CLAIMS.append((4.92, round(jfin["스위프트 마스터"] / jfin_u["스위프트 마스터"], 2), "스위프트 마스터 배수, 성장 완료"))

print(f"{'항목':<34}{'문서':>14}{'데이터':>14}  판정")
bad = 0
for claimed, actual, label in CLAIMS:
    if isinstance(claimed, float):
        # 문서는 소수 한두 자리로 적으므로 같은 자리로 반올림해 견준다
        digits = len(str(claimed).split(".")[1])
        ok = round(float(actual), digits) == claimed
    else:
        ok = claimed == actual
    if not ok:
        bad += 1
    print(f"{label:<34}{claimed:>14}{actual:>14}  {'일치' if ok else '불일치'}")

print()
print("직업 기준을 성장 완료로 좁혔을 때 검색 방식 차이")
print(f"  모든 캐릭터 기준     총차이 {tvd(jall, jall_u):.2f}%p")
print(f"  성장 완료 기준       총차이 {tvd(jfin, jfin_u):.2f}%p")
for j in ("크루세이더", "사령술사"):
    print(f"    {j}: 전체 {jfin.get(j, 0):.1f}% / 상한 미도달 {jfin_u.get(j, 0):.1f}%")

print()
print(f"대조 {len(CLAIMS)}건, 불일치 {bad}건")
sys.exit(1 if bad else 0)
