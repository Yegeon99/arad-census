# -*- coding: utf-8 -*-
"""Phase 0 — API 실호출 검증.

확인 항목 (지침서 Phase 0):
1. 서버 목록
2. 캐릭터 검색: wordType=match vs full 동작, 결과 상한(limit), 응답 필드,
   노출 조건 단서(레벨 하한·fame 존재 여부)
3. 캐릭터 기본 정보: 필드(직업·명성·모험단 등), 캐릭터당 필요 호출 수
4. 타임라인: code 종류, 조회 기간 파라미터(startDate/endDate) 동작

개인정보: 캐릭터명·characterId·모험단명은 화면 출력 시 마스킹.
결과는 data/probe_phase0.json에 저장하되 식별 정보는 저장하지 않는다.
"""

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient

OUT = Path(__file__).resolve().parent.parent / "data" / "probe_phase0.json"

results = {}
c = NeopleClient()


def mask(s):
    if not s:
        return s
    return s[0] + "*" * (len(s) - 1)


print("=== 1. 서버 목록 ===")
servers = c.servers()
rows = servers.get("rows", [])
results["servers"] = rows
print(f"서버 {len(rows)}개: {[r['serverId'] for r in rows]}")

SERVER = "cain"  # 파일럿 서버

print("\n=== 2. 검색: wordType 비교 (시드 '가') ===")
search_summary = {}
for wt in ("match", "full"):
    try:
        r = c.search_characters(SERVER, "가", word_type=wt, limit=200)
        n = len(r.get("rows", []))
        levels = [row.get("level") for row in r.get("rows", [])]
        fames = [row.get("fame") for row in r.get("rows", [])]
        fields = sorted(r["rows"][0].keys()) if n else []
        search_summary[wt] = {
            "count": n,
            "fields": fields,
            "level_min": min(levels) if levels else None,
            "level_max": max(levels) if levels else None,
            "fame_present": any(f is not None for f in fames),
            "fame_min": min((f for f in fames if f is not None), default=None),
            "fame_max": max((f for f in fames if f is not None), default=None),
        }
        print(f"wordType={wt}: {n}건, level {search_summary[wt]['level_min']}~{search_summary[wt]['level_max']}, "
              f"fame_min={search_summary[wt]['fame_min']}, fields={fields}")
    except Exception as e:
        search_summary[wt] = {"error": str(e)}
        print(f"wordType={wt}: 오류 {e}")

# limit 상한 확인 (300 요청 시 동작)
try:
    r = c.search_characters(SERVER, "가", word_type="full", limit=300)
    search_summary["limit_300"] = {"count": len(r.get("rows", []))}
    print(f"limit=300 요청: {search_summary['limit_300']['count']}건 반환")
except Exception as e:
    search_summary["limit_300"] = {"error": str(e)}
    print(f"limit=300 요청: 오류 {e}")

results["search"] = search_summary

print("\n=== 3. 기본 정보 (검색 결과 1명) ===")
r = c.search_characters(SERVER, "가", word_type="full", limit=10)
first = r["rows"][0]
cid = first["characterId"]
basic = c.character_basic(SERVER, cid)
basic_fields = sorted(basic.keys())
results["basic_fields"] = basic_fields
results["basic_sample_masked"] = {
    k: (mask(v) if k in ("characterId", "characterName", "adventureName", "guildId", "guildName") and isinstance(v, str) else v)
    for k, v in basic.items()
}
print(f"기본 정보 필드: {basic_fields}")
print(f"직업={basic.get('jobName')}/{basic.get('jobGrowName')}, level={basic.get('level')}, fame={basic.get('fame')}")

# 검색 rows에 이미 있는 필드로 기본 정보 호출 생략 가능한지 판단
search_fields = set(first.keys())
need_basic = not {"jobName", "level", "fame"}.issubset(search_fields)
results["search_row_fields"] = sorted(search_fields)
results["basic_call_needed"] = need_basic
print(f"검색 row 필드: {sorted(search_fields)}")
print(f"기본 정보 별도 호출 필요 여부: {need_basic}")

print("\n=== 4. 타임라인 ===")
tl_summary = {}
try:
    tl = c.character_timeline(SERVER, cid, limit=50)
    rows_tl = tl.get("timeline", {}).get("rows", [])
    codes = Counter((row.get("code"), row.get("name")) for row in rows_tl)
    tl_summary["no_range"] = {
        "count": len(rows_tl),
        "codes": [{"code": k[0], "name": k[1], "n": v} for k, v in codes.most_common()],
        "date_first": rows_tl[0]["date"] if rows_tl else None,
        "date_last": rows_tl[-1]["date"] if rows_tl else None,
        "next_present": bool(tl.get("timeline", {}).get("next")),
    }
    print(f"기간 미지정: {len(rows_tl)}건, 기간 {tl_summary['no_range']['date_last']} ~ {tl_summary['no_range']['date_first']}")
    print(f"code 종류: {tl_summary['no_range']['codes']}")
except Exception as e:
    tl_summary["no_range"] = {"error": str(e)}
    print(f"타임라인 오류: {e}")

# startDate/endDate 동작 확인 (최근 90일 요청)
try:
    tl2 = c.character_timeline(SERVER, cid, limit=50,
                               startDate="2026-05-27 00:00", endDate="2026-08-25 00:00")
    rows2 = tl2.get("timeline", {}).get("rows", [])
    tl_summary["range_90d"] = {"count": len(rows2),
                               "date_first": rows2[0]["date"] if rows2 else None,
                               "date_last": rows2[-1]["date"] if rows2 else None}
    print(f"90일 범위 지정: {len(rows2)}건")
except Exception as e:
    tl_summary["range_90d"] = {"error": str(e)}
    print(f"90일 범위 오류: {e}")

results["timeline"] = tl_summary

print(f"\n총 호출: {c.call_count}, 실패: {c.fail_count}")
results["calls"] = {"total": c.call_count, "failed": c.fail_count}

# 식별 정보 제거 후 저장 (basic_sample_masked는 마스킹됨, search 요약엔 원문 없음)
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"저장: {OUT}")
