# -*- coding: utf-8 -*-
"""검색 결과 정렬 기준 + 저수확 시드의 레벨 분포 확인 (편향 판정용)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient

c = NeopleClient()
SERVER = "cain"


def order_check(rows, key):
    vals = [r.get(key) for r in rows if r.get(key) is not None]
    desc = all(vals[i] >= vals[i + 1] for i in range(len(vals) - 1))
    asc = all(vals[i] <= vals[i + 1] for i in range(len(vals) - 1))
    return "desc" if desc else "asc" if asc else "none"


for seed in ("하늘", "블랙"):
    r = c.search_characters(SERVER, seed, word_type="full", limit=200)
    rows = r["rows"]
    fames = [x.get("fame") for x in rows[:10]]
    print(f"{seed}: n={len(rows)}, fame 정렬={order_check(rows, 'fame')}, level 정렬={order_check(rows, 'level')}")
    print(f"  앞 10명 fame: {fames}")

# 200 미만이 나올 법한 드문 시드 → 상한 미도달 시 자연 분포 확인
for seed in ("햄찌", "돈까", "쿼크", "찹쌀"):
    try:
        r = c.search_characters(SERVER, seed, word_type="full", limit=200)
        rows = r["rows"]
        lv = [x.get("level") for x in rows]
        fm = [x.get("fame") for x in rows if x.get("fame") is not None]
        print(f"{seed}: {len(rows)}건" + (f", level {min(lv)}~{max(lv)}, fame {min(fm) if fm else '-'}~{max(fm) if fm else '-'}, fame 정렬={order_check(rows, 'fame')}" if rows else ""))
    except Exception as e:
        print(f"{seed}: 오류 {e}")

print(f"\n총 호출: {c.call_count}, 실패: {c.fail_count}")
