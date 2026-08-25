# -*- coding: utf-8 -*-
"""인사이트가 인용한 수치를 집계 원본과 대조 (스팟 체크)."""

import json
from pathlib import Path

c = json.loads((Path(__file__).resolve().parent.parent / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
xt = c["distributions"]["job_x_fame"]
job = {j["jobName"]: j for j in c["distributions"]["job"]}
ujob = {j["jobName"]: j for j in c["distributions_uncapped_only"]["job"]}
stage = {s["stage"]: s for s in c["distributions"]["stage"]}


def cell(j, b):
    return next((x["count"] for x in xt if x["jobName"] == j and x["bin"] == b), "없음")


print("眞 비중:", stage.get("眞"))
print("미전직~2단계 합:", sum(s["count"] for k, s in stage.items() if k != "眞"))
print("브레이커 셀: 레기온 미만", cell("브레이커", "레기온 미만"),
      "/ 아포칼립스", cell("브레이커", "아포칼립스 입장"),
      "/ 상급 던전권", cell("브레이커", "상급 던전권"))
print("크루세이더 레기온 미만:", cell("크루세이더", "레기온 미만"), "/ 전체", job["크루세이더"]["count"])
print("크루세이더 전체 pct:", job["크루세이더"]["pct"], "/ 비상한 pct:", ujob.get("크루세이더", {}).get("pct"))
print("미스트리스 전체:", job.get("미스트리스", {}).get("pct"), "/ 비상한:", ujob.get("미스트리스", {}).get("pct"))
print("사령술사 전체:", job.get("사령술사", {}).get("pct"), "/ 비상한:", ujob.get("사령술사", {}).get("pct"))
act = {a["bin"]: a for a in c["activity"]["by_fame_bin"]}
lm = act["레기온 미만"]
print("레기온 미만 활성:", lm["counts"], "→ 휴면율", round(lm["counts"]["휴면"] / lm["n"] * 100, 1))
mi = act["미카엘라 입장"]
print("미카엘라 입장 주간:", round(mi["counts"]["주간 활성"] / mi["n"] * 100, 1))
