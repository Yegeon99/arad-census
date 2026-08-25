# -*- coding: utf-8 -*-
"""재생성 인사이트 인용 수치 대조 (2차)."""

import json
from pathlib import Path

c = json.loads((Path(__file__).resolve().parent.parent / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
job = {j["jobName"]: j for j in c["distributions"]["job"]}
fame = {b["range"]: b for b in c["distributions"]["fame_bins"]}
xt = c["distributions"]["job_x_fame"]

top5 = ["크루세이더", "다크템플러", "넨마스터", "브레이커", "스위프트 마스터"]
n5 = sum(job[j]["count"] for j in top5)
print("[1] top5 n:", n5, "pct:", round(n5 / c["meta"]["sample_size"] * 100, 2))

print("[2] 레기온 미만:", fame["레기온 미만"]["count"], fame["레기온 미만"]["pct"])
upper = ["상급 던전권", "미카엘라 입장", "미카엘라 권장", "하드 권장 이상"]
nu = sum(fame[b]["count"] for b in upper)
print("[2] 상급 이상 누적 n:", nu, "pct:", round(sum(fame[b]["pct"] for b in upper), 2))

def cells(j):
    return {x["bin"]: x["count"] for x in xt if x["jobName"] == j}

cru = cells("크루세이더")
above = sum(v for k, v in cru.items() if k != "레기온 미만" and v)
print("[5] 크루세이더 셀:", cru, "| 레기온 초과 합:", above,
      "| 941/2373 =", round(941 / 2373 * 100, 1), "| above/2373 =", round(above / 2373 * 100, 1))
nec = cells("사령술사")
nec_above = sum(v for k, v in nec.items() if k != "레기온 미만" and v)
nec_total_fame = (nec.get("레기온 미만") or 0) + nec_above
print("[5] 사령술사 셀:", nec, "| 레기온 203?:", nec.get("레기온 미만"),
      "| above 합:", nec_above, "| fame 보유 합:", nec_total_fame,
      "| 203/332 =", round(203 / 332 * 100, 1))
ujob = {j["jobName"]: j for j in c["distributions_uncapped_only"]["job"]}
print("[4] 크루세이더 비상한:", ujob.get("크루세이더"))
