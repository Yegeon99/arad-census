# -*- coding: utf-8 -*-
"""인사이트 [1]의 잘못된 인용 수치를 집계 실측값으로 교정 (1,139명/3.6% → 1,996명/6.3%).

검증 스크립트(verify_insights.py)가 잡아낸 유일한 불일치. 수치 외 문장은 유지.
"""

import json
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "data" / "census_2026-08.json"
c = json.loads(p.read_text(encoding="utf-8"))
f = c["insights"][0]["finding"]
assert "1,139명(3.6%)" in f, f"예상 문자열 없음: {f}"
c["insights"][0]["finding"] = f.replace("1,139명(3.6%)", "1,996명(6.3%)")
p.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
print("교정 완료:", c["insights"][0]["finding"])
