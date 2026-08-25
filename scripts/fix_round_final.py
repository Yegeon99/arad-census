# -*- coding: utf-8 -*-
"""최종 게이트 검수 반영 — 숫자 정합성 교정 (A항목).

A-1/17. meta.round = "2026-08" 확정.
A-3. "자각1" 정리: /df/jobs 트리에서 외전 캐릭터 다크나이트·크리에이터가
     성장 단계명 "자각1"을 체인 첫 노드로 공유해 canonical이 "자각1"(전직명
     아님)로 합산되어 있었다. 원시 표본이 폐기되어 두 직업을 분리할 수 없으므로
     자각1(다크나이트 전 단계 + 眞 크리에이터)과 크리에이터(미전직)를 "기타"로
     합산하고 job_x_fame에서 해당 행을 제거한다. 사유는 bias_notes.md에 기록.
A-2. 인사이트 직업 n을 명성 표본 기준으로 통일 재대조:
     [1] 크루세이더 n=2373(전체) → n=2277(명성 표본), 7.53% → 7.57%,
         top5 24.33%(n=7670, 전체) → 24.84%(n=7472, 명성 표본)
     [5] 크루세이더 분모 2373 → 2277 (41.3%/58.7%),
         사령술사 분모 332 → 315 (64.4%/35.6%)
     [2] 분모(명성 표본 30,082) 문장 내 명시
A-4. [7] "96.15%(n=50)"가 구간 내 주간 활성 비율임을 문장에 명시.
수치·라벨만 교정, 해석 문장은 유지. (fix_insight1 → fix_insights2 → 본 파일)
"""

import json
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "data" / "census_2026-08.json"
c = json.loads(p.read_text(encoding="utf-8"))

# --- meta.round 확정 ---
c["meta"]["round"] = "2026-08"
print("meta.round =", c["meta"]["round"])

# --- 자각1 + 크리에이터 → 기타 합산 ---
def merge_others(job_list, total, removed_names, label):
    removed = [j for j in job_list if j["jobName"] in removed_names]
    assert len(removed) == len(removed_names), f"제거 대상 누락: {removed_names}"
    etc = [j for j in job_list if j["jobName"].startswith("기타")][0]
    add = sum(j["count"] for j in removed)
    etc["count"] += add
    etc["pct"] = round(etc["count"] / total * 100, 2)
    etc["jobName"] = label
    job_list[:] = [j for j in job_list if j["jobName"] not in removed_names]
    print(f"기타 합산 +{add} → {etc}")

merge_others(c["distributions"]["job"], c["meta"]["sample_size"],
             {"자각1", "크리에이터"}, "기타(외전 2종·표본<10 직업 14개 합산)")
merge_others(c["distributions_uncapped_only"]["job"], c["meta"]["uncapped_sample_size"],
             {"자각1", "크리에이터"}, "기타(외전 2종·표본<10 직업 12개 합산)")

before = len(c["distributions"]["job_x_fame"])
c["distributions"]["job_x_fame"] = [
    x for x in c["distributions"]["job_x_fame"] if x["jobName"] != "자각1"
]
print(f"job_x_fame 자각1 행 제거: {before} → {len(c['distributions']['job_x_fame'])}")

# --- 인사이트 교정 ---
ins = c["insights"]
fixes = [
    (0, "finding",
     "크루세이더(n=2373)가 전체 표본의 7.53%로 최다 직업이며",
     "크루세이더(n=2277, 명성 표본)가 명성 표본 30,082명의 7.57%로 최다 직업이며"),
    (0, "finding",
     "전체의 24.33%를 차지한다(n=7670).",
     "명성 표본의 24.84%를 차지한다(n=7472)."),
    (1, "finding",
     "명성 6구간 중 레기온 미만이 44.82%(n=13483)로",
     "명성 표본 30,082명 중 레기온 미만이 44.82%(n=13483)로"),
    (4, "finding",
     "크루세이더는 레기온 미만 n=941(전체 크루세이더의 39.7%), 아포칼립스 이상 n=1336(56.3%)로",
     "크루세이더는 명성 표본 n=2277 중 레기온 미만 941(41.3%), 아포칼립스 이상 1336(58.7%)로"),
    (4, "finding",
     "사령술사는 레기온 미만 n=203(61.1%), 아포칼립스 이상 n=112(33.7%, 10명 미만 마스킹 1셀 제외)로 저명성 편중이 뚜렷하다(n=332).",
     "사령술사는 명성 표본 n=315(10명 미만 마스킹 1셀 제외) 중 레기온 미만 203(64.4%), 아포칼립스 이상 112(35.6%)로 저명성 편중이 뚜렷하다."),
    (6, "finding",
     "미카엘라 권장 구간(n=52)에서도 96.15%(n=50)로 휴면이 0%다.",
     "미카엘라 권장 구간(n=52)에서도 구간 내 주간 활성 비율이 96.15%(52명 중 50명)이고 휴면이 0%다."),
]

for idx, field, old, new in fixes:
    t = ins[idx][field]
    assert old in t, f"[{idx + 1}] 예상 문자열 없음: {old!r}"
    ins[idx][field] = t.replace(old, new)
    print(f"[{idx + 1}] 교정: {old[:40]}... → {new[:40]}...")

p.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
print("저장 완료:", p)
