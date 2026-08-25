# -*- coding: utf-8 -*-
"""최종 게이트 반영 후 숫자 정합성 assert."""

import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
c = json.loads((root / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
m = c["meta"]

# A-1: 표본 4개 값
assert m["sample_size"] == 31523
assert m["sample_size"] - m["fame_missing"] == 30082
assert m["uncapped_sample_size"] == 5352
assert m["uncapped_sample_size"] - m["uncapped_fame_missing"] == 4087
assert m["round"] == "2026-08"

# A-3: 자각1 부재, 기타 합산
names = [j["jobName"] for j in c["distributions"]["job"]]
assert "자각1" not in names and "크리에이터" not in names
assert not any(x["jobName"] == "자각1" for x in c["distributions"]["job_x_fame"])
etc = [j for j in c["distributions"]["job"] if j["jobName"].startswith("기타")][0]
assert etc["count"] == 416, etc

# 직업 합 = 전체 표본
assert sum(j["count"] for j in c["distributions"]["job"]) == m["sample_size"]
assert sum(j["count"] for j in c["distributions_uncapped_only"]["job"]) == m["uncapped_sample_size"]

# fame_bins 합 = 명성 표본
assert sum(b["count"] for b in c["distributions"]["fame_bins"]) == 30082
assert sum(b["count"] for b in c["distributions_uncapped_only"]["fame_bins"]) == 4087

# A-2: 인사이트 명성 표본 기준 수치 재대조
xt = {}
for x in c["distributions"]["job_x_fame"]:
    xt.setdefault(x["jobName"], {})[x["bin"]] = None if x.get("masked") else x["count"]
def fame_n(j):
    return sum(v for v in xt[j].values() if v)
assert fame_n("크루세이더") == 2277
top5 = sum(fame_n(j) for j in ["크루세이더", "다크템플러", "넨마스터", "브레이커", "스위프트 마스터"])
assert top5 == 7472 and round(top5 / 30082 * 100, 2) == 24.84
assert fame_n("사령술사") == 315
ins = c["insights"]
assert "n=2277, 명성 표본" in ins[0]["finding"] and "24.84%" in ins[0]["finding"]
assert "명성 표본 30,082명 중" in ins[1]["finding"]
assert "명성 표본 n=2277 중 레기온 미만 941(41.3%)" in ins[4]["finding"]
assert "명성 표본 n=315" in ins[4]["finding"] and "203(64.4%)" in ins[4]["finding"]
# A-4: #7 비율 정체 명시
assert "구간 내 주간 활성 비율이 96.15%(52명 중 50명)" in ins[6]["finding"]
# 자각1 인용 없음
for i in ins:
    assert "자각1" not in json.dumps(i, ensure_ascii=False)

# 리포트 번들 동기화 확인
bundle = json.loads((root / "report" / "src" / "data" / "census.json").read_text(encoding="utf-8"))
assert bundle == c, "report/src/data/census.json 미동기화"

print("정합성 assert 전체 통과")
