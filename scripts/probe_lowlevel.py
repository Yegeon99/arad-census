# -*- coding: utf-8 -*-
"""레기온 입장 전 구간(저레벨)을 다른 수단으로 잴 수 있는지 탐색. 조사 실행 아님.

확인할 것
1. characters-fame 에 레벨 하한을 낮출 파라미터가 실제로 먹는지
2. 캐릭터 검색에 레벨 범위 필터가 먹는지
3. wordType 이 영문·숫자·특수문자 시드를 받는지, 받으면 어떤 레벨대가 걸리는지

호출 30회 이내. 이름은 레벨 분포 집계에만 쓰고 저장하지 않는다.
"""

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402

BUDGET = 30
cli = NeopleClient()
t0 = time.monotonic()
log = []


def call(label, path, params):
    if cli.call_count >= BUDGET:
        log.append((label, "예산 초과", None))
        return None
    try:
        r = cli.get(path, params)
        return r
    except RuntimeError as e:
        msg = str(e)
        log.append((label, "오류 " + msg[:90], None))
        return None


def levels(rows):
    if not rows:
        return "-"
    lv = sorted(r.get("level", 0) for r in rows)
    return f"최소 {lv[0]} 중앙 {lv[len(lv) // 2]} 최대 {lv[-1]}"


print("=" * 72)
print("1. characters-fame 에 레벨 파라미터가 먹는가")
base = call("fame 기준", "/df/servers/all/characters-fame", {"minFame": 90000, "maxFame": 90000, "limit": 200})
n0 = len(base.get("rows", [])) if base else 0
print(f"  기준 (명성 90000 한 점)            {n0:>4}명  {levels(base.get('rows') if base else None)}")
for name, extra in [
    ("minLevel=100", {"minLevel": 100}),
    ("maxLevel=109", {"maxLevel": 109}),
    ("level=105", {"level": 105}),
    ("minLevel=1&maxLevel=109", {"minLevel": 1, "maxLevel": 109}),
]:
    r = call(name, "/df/servers/all/characters-fame",
             {"minFame": 90000, "maxFame": 90000, "limit": 200, **extra})
    if r is None:
        print(f"  {name:<32} 거부")
        continue
    rows = r.get("rows", [])
    same = "기준과 동일 (무시됨)" if len(rows) == n0 else "결과 달라짐"
    print(f"  {name:<32} {len(rows):>4}명  {levels(rows)}  {same}")

print()
print("=" * 72)
print("2. 캐릭터 검색에 레벨 범위 필터가 먹는가")
b2 = call("검색 기준", "/df/servers/all/characters",
          {"characterName": "바람", "wordType": "full", "limit": 200})
m0 = len(b2.get("rows", [])) if b2 else 0
print(f"  기준 (바람, 포함 검색)             {m0:>4}명  {levels(b2.get('rows') if b2 else None)}")
for name, extra in [
    ("minLevel=1&maxLevel=109", {"minLevel": 1, "maxLevel": 109}),
    ("level=100", {"level": 100}),
]:
    r = call(name, "/df/servers/all/characters",
             {"characterName": "바람", "wordType": "full", "limit": 200, **extra})
    if r is None:
        print(f"  {name:<32} 거부")
        continue
    rows = r.get("rows", [])
    same = "기준과 동일 (무시됨)" if len(rows) == m0 else "결과 달라짐"
    print(f"  {name:<32} {len(rows):>4}명  {levels(rows)}  {same}")

print()
print("=" * 72)
print("3. wordType 과 한글 아닌 시드")
for wt in ("match", "front", "full"):
    r = call(f"wordType={wt}", "/df/servers/all/characters",
             {"characterName": "ab", "wordType": wt, "limit": 200})
    if r is None:
        print(f"  wordType={wt:<8} ab        거부")
        continue
    rows = r.get("rows", [])
    print(f"  wordType={wt:<8} ab        {len(rows):>4}명  {levels(rows)}")

print()
print("  영문·숫자·특수문자 시드 (포함 검색, 상한 200)")
seeds = ["ab", "ka", "st", "zz", "xo", "11", "00", "77", "..", "ㅋㅋ"]
tot, low = 0, 0
for s in seeds:
    r = call(f"seed {s}", "/df/servers/all/characters",
             {"characterName": s, "wordType": "full", "limit": 200})
    if r is None:
        print(f"    {s:<6} 거부")
        continue
    rows = r.get("rows", [])
    tot += len(rows)
    lo = sum(1 for x in rows if x.get("level", 0) < 110)
    low += lo
    capped = "상한 도달" if len(rows) >= 200 else ""
    print(f"    {s:<6} {len(rows):>4}명  110 미만 {lo:>3}명  {levels(rows)}  {capped}")

print()
if tot:
    print(f"  영문·숫자 시드 합계 {tot}명 중 레벨 110 미만 {low}명 ({low / tot * 100:.1f}%)")
print()
print(f"총 호출 {cli.call_count}회, 실패 {cli.fail_count}회, 소요 {time.monotonic() - t0:.1f}초")
for x in log:
    print("  기록:", x[0], x[1])
