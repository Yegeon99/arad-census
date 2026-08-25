# -*- coding: utf-8 -*-
"""검색 동작 추가 실험: 시드 길이 × wordType × limit."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient

c = NeopleClient()
SERVER = "cain"

seeds = ["가", "강", "다", "린", "가가"]
for seed in seeds:
    for wt in (None, "match", "full"):
        try:
            params = {"characterName": seed, "limit": 200}
            if wt:
                params["wordType"] = wt
            r = c.get(f"/df/servers/{SERVER}/characters", params)
            rows = r.get("rows", [])
            lv = [row.get("level") for row in rows]
            fm = [row.get("fame") for row in rows if row.get("fame") is not None]
            print(f"seed={seed!r} wt={wt}: {len(rows)}건"
                  + (f", level {min(lv)}~{max(lv)}, fame {min(fm) if fm else '-'}~{max(fm) if fm else '-'}" if rows else ""))
        except Exception as e:
            print(f"seed={seed!r} wt={wt}: 오류 {e}")

print(f"\n총 호출: {c.call_count}, 실패: {c.fail_count}")
