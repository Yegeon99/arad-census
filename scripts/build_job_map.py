# -*- coding: utf-8 -*-
"""직업 축 정규화 (게이트 1 응답 1항).

/df/jobs 1콜 → next 체인을 펼쳐 모든 jobGrowName을 최종 전직명(체인 첫
노드명)으로 매핑하고 각성 단계(0/1/2/眞)를 기록한다.

산출: config/job_map.json
{ "generated_at": ..., "map": { jobGrowName: {"canonical": ..., "stage": ..., "jobName": ...} } }

이름 충돌(같은 grow명이 다른 canonical로 매핑) 발견 시 보고.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "config" / "job_map.json"
STAGE_LABELS = ["0", "1", "2", "眞"]

c = NeopleClient()
jobs = c.get("/df/jobs")

mapping = {}
conflicts = []
for job in jobs.get("rows", []):
    job_name = job.get("jobName")
    for grow in job.get("rows", []):
        chain = []
        node = grow
        while node:
            chain.append(node.get("jobGrowName"))
            node = node.get("next")
        # 외전 캐릭터(다크나이트·크리에이터)는 체인 첫 노드가 전직명이 아닌
        # 공유 성장 단계명("자각1")이라 직업군명을 canonical로 사용
        canonical = job_name if chain[0] in ("자각1", "자각2") else chain[0]
        for i, name in enumerate(chain):
            stage = STAGE_LABELS[i] if i < len(STAGE_LABELS) else str(i)
            # 이름이 "眞 "으로 시작하면 단계 표기를 眞으로 강제
            if isinstance(name, str) and name.startswith("眞"):
                stage = "眞"
            entry = {"canonical": canonical, "stage": stage, "jobName": job_name}
            prev = mapping.get(name)
            if prev and prev["canonical"] != canonical:
                conflicts.append({"name": name, "kept": prev, "dropped": entry})
                continue
            mapping.setdefault(name, entry)

print(f"직업군 {len(jobs.get('rows', []))}개, 전직 체인 매핑 {len(mapping)}개 이름")
if conflicts:
    print(f"충돌 {len(conflicts)}건:")
    for x in conflicts:
        print(" ", x["name"], "→", x["kept"]["canonical"], "vs", x["dropped"]["canonical"])
else:
    print("이름 충돌 0건")

OUT.write_text(json.dumps({
    "generated_at": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"),
    "source": "/df/jobs",
    "map": mapping,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"저장: {OUT} (호출 {c.call_count}회)")

# 표본 프레임의 jobGrowName가 전부 매핑되는지 검증
calls_path = ROOT / "data" / "checkpoints" / "calls.jsonl"
unmapped = set()
if calls_path.exists():
    with calls_path.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            for row in rec["rows"]:
                g = row.get("jobGrowName")
                if g and g not in mapping:
                    unmapped.add(g)
if unmapped:
    # 미전직 캐릭터는 jobGrowName에 기본 직업명이 그대로 들어온다 —
    # 자기 자신을 canonical로, 단계는 "미전직"으로 매핑
    print(f"체인 밖 이름 {len(unmapped)}건 (미전직 기본 직업명) → 자기 자신 매핑: {sorted(unmapped)}")
    for name in unmapped:
        mapping[name] = {"canonical": name, "stage": "미전직", "jobName": name}
    OUT.write_text(json.dumps({
        "generated_at": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"),
        "source": "/df/jobs",
        "note": "미전직 캐릭터의 jobGrowName(기본 직업명)은 자기 자신으로 매핑, stage='미전직'",
        "map": mapping,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"재저장: {OUT} (총 {len(mapping)}개 이름)")
else:
    print("표본 내 jobGrowName 매핑 실패 0건")
