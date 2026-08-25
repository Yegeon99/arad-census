# -*- coding: utf-8 -*-
"""2차 인사이트 인용 수치 교정 (verify_insights2.py 대조 결과).

- [1] top5 24.29% → 24.33%
- [2] 상급 이상 누적 35.52%(n=11084) → 36.52%(n=10984)
- [4] 크루세이더 라벨 오류("전체 6.69%") → 비상한 표본 수치임을 명시
- [5] 크루세이더 아포칼립스 이상 1292(54.5%) → 1336(56.3%),
      사령술사 129(38.9%) → 112(33.7%, 마스킹 1셀 제외)
수치·라벨만 교정, 해석 문장은 유지.
"""

import json
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "data" / "census_2026-08.json"
c = json.loads(p.read_text(encoding="utf-8"))
ins = c["insights"]

fixes = [
    (0, "finding", "24.29%를 차지한다(n=7670)", "24.33%를 차지한다(n=7670)"),
    (1, "finding", "누적 35.52%(n=11084)", "누적 36.52%(n=10984)"),
    (3, "finding",
     "반면 크루세이더는 전체 6.69%(n=358) → 전체 7.53%(n=2373) 대비 1.13배 증가다.",
     "반면 크루세이더는 비상한 표본에서 6.69%(n=358)로 전체 표본의 7.53%(n=2373)보다 오히려 낮다."),
    (4, "finding",
     "아포칼립스 이상 n=1292(54.5%)로 상위 명성 구간에 집중되어 있다",
     "아포칼립스 이상 n=1336(56.3%)로 상위 명성 구간에 집중되어 있다"),
    (4, "finding",
     "사령술사는 레기온 미만 n=203(61.1%), 아포칼립스 이상 n=129(38.9%)로 저명성 편중이 뚜렷하다(n=332)",
     "사령술사는 레기온 미만 n=203(61.1%), 아포칼립스 이상 n=112(33.7%, 10명 미만 마스킹 1셀 제외)로 저명성 편중이 뚜렷하다(n=332)"),
]

for idx, field, old, new in fixes:
    t = ins[idx][field]
    assert old in t, f"[{idx}] 예상 문자열 없음: {old!r}"
    ins[idx][field] = t.replace(old, new)
    print(f"[{idx + 1}] 교정: {old} → {new}")

p.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
print("저장 완료")
