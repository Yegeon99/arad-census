# -*- coding: utf-8 -*-
"""Phase 0 파일럿: full 검색 특성 + 시드 10개 수확량 + 타임라인 검증.

개인정보: 이름·ID는 메모리 내 판정에만 사용, 출력·저장 금지.
"""

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient

c = NeopleClient()
SERVER = "cain"
OUT = Path(__file__).resolve().parent.parent / "data" / "probe_pilot.json"
results = {}

print("=== A. full 검색 매칭 방식 (접두 vs 포함) ===")
r = c.search_characters(SERVER, "가가", word_type="full", limit=200)
rows = r["rows"]
starts = sum(1 for row in rows if row["characterName"].startswith("가가"))
contains = sum(1 for row in rows if "가가" in row["characterName"])
results["match_mode"] = {"n": len(rows), "startswith": starts, "contains": contains}
print(f"200건 중 접두일치 {starts}, 포함일치 {contains}")

print("\n=== B. limit 상한 (300 요청) ===")
try:
    r2 = c.search_characters(SERVER, "가가", word_type="full", limit=300)
    results["limit_300"] = {"count": len(r2.get("rows", []))}
    print(f"limit=300: {results['limit_300']['count']}건")
except Exception as e:
    results["limit_300"] = {"error": str(e)}
    print(f"limit=300: 오류 {e}")

print("\n=== C. 시드 10개 파일럿 (cain, full, limit=200) ===")
SEEDS = ["하늘", "바람", "검은", "붉은", "작은", "라라", "루나", "블랙", "천상", "마루"]
seen = set()
per_seed = []
all_levels = []
all_fames = []
fame_none = 0
job_counter = Counter()
for seed in SEEDS:
    try:
        r = c.search_characters(SERVER, seed, word_type="full", limit=200)
        rows = r.get("rows", [])
        new = 0
        for row in rows:
            cid = row["characterId"]
            if cid not in seen:
                seen.add(cid)
                new += 1
                all_levels.append(row.get("level"))
                f = row.get("fame")
                if f is None:
                    fame_none += 1
                else:
                    all_fames.append(f)
                job_counter[row.get("jobGrowName")] += 1
        per_seed.append({"seed": seed, "rows": len(rows), "new": new})
        print(f"{seed}: {len(rows)}건 (신규 {new})")
    except Exception as e:
        per_seed.append({"seed": seed, "error": str(e)})
        print(f"{seed}: 오류 {e}")

all_fames.sort()


def pct(p):
    return all_fames[min(len(all_fames) - 1, int(len(all_fames) * p))] if all_fames else None


results["pilot"] = {
    "seeds": per_seed,
    "unique_total": len(seen),
    "dup_rate": round(1 - len(seen) / max(1, sum(s.get("rows", 0) for s in per_seed)), 4),
    "level_min": min(all_levels) if all_levels else None,
    "level_max": max(all_levels) if all_levels else None,
    "level_under_100": sum(1 for l in all_levels if l and l < 100),
    "fame_none_count": fame_none,
    "fame_p10": pct(0.10), "fame_p50": pct(0.50), "fame_p90": pct(0.90),
    "fame_min": all_fames[0] if all_fames else None,
    "fame_max": all_fames[-1] if all_fames else None,
    "distinct_jobs": len(job_counter),
    "top_jobs": job_counter.most_common(5),
}
p = results["pilot"]
print(f"\n고유 {p['unique_total']}명, 중복률 {p['dup_rate']*100:.1f}%")
print(f"level {p['level_min']}~{p['level_max']} (100 미만 {p['level_under_100']}명), fame 결측 {fame_none}")
print(f"fame p10/p50/p90 = {p['fame_p10']}/{p['fame_p50']}/{p['fame_p90']}, min~max {p['fame_min']}~{p['fame_max']}")
print(f"전직 종류 {p['distinct_jobs']}, 상위: {p['top_jobs']}")

print("\n=== D. 타임라인 (파일럿 중 fame 중간·낮은 캐릭터 2명) ===")
# 파일럿 마지막 검색 결과에서 2명 선택
sample_rows = sorted((row for row in rows if row.get("fame")), key=lambda x: x["fame"])
picks = [sample_rows[0], sample_rows[len(sample_rows) // 2]] if len(sample_rows) >= 2 else sample_rows
tl_results = []
for i, row in enumerate(picks):
    cid = row["characterId"]
    entry = {"fame": row.get("fame"), "level": row.get("level")}
    try:
        tl = c.character_timeline(SERVER, cid, limit=50)
        trows = tl.get("timeline", {}).get("rows", [])
        codes = Counter((t.get("code"), t.get("name")) for t in trows)
        entry["no_range"] = {
            "count": len(trows),
            "codes": [{"code": k[0], "name": k[1], "n": v} for k, v in codes.most_common()],
            "newest": trows[0]["date"] if trows else None,
            "oldest": trows[-1]["date"] if trows else None,
        }
        print(f"[{i}] fame={entry['fame']}: {len(trows)}건, {entry['no_range']['oldest']} ~ {entry['no_range']['newest']}")
        print(f"    codes: {[(x['code'], x['name'], x['n']) for x in entry['no_range']['codes'][:8]]}")
    except Exception as e:
        entry["no_range"] = {"error": str(e)}
        print(f"[{i}] 타임라인 오류: {e}")
    # 기간 파라미터 (90일)
    for fmt_name, s, e_ in (("space", "2026-05-27 00:00", "2026-08-25 00:00"),
                            ("T", "20260527T0000", "20260825T0000")):
        try:
            tl2 = c.character_timeline(SERVER, cid, limit=50, startDate=s, endDate=e_)
            n2 = len(tl2.get("timeline", {}).get("rows", []))
            entry[f"range_{fmt_name}"] = {"count": n2}
            print(f"    기간지정({fmt_name}): {n2}건")
            break
        except Exception as ex:
            entry[f"range_{fmt_name}"] = {"error": str(ex)[:120]}
            print(f"    기간지정({fmt_name}): 오류 {str(ex)[:120]}")
    tl_results.append(entry)
results["timeline"] = tl_results

results["calls"] = {"total": c.call_count, "failed": c.fail_count}
print(f"\n총 호출: {c.call_count}, 실패: {c.fail_count}")
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"저장: {OUT}")
