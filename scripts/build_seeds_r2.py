# -*- coding: utf-8 -*-
"""2차 회차 시드 만들기.

명성 방식 표본에서 한글 두 글자 조합의 빈도를 세어 상위 1,000개를 시드로 쓴다.
1차는 절반을 일부러 희귀 조합으로 채웠는데, 그 판단이 커버리지를 크게 깎았다.
이번에는 빈도만 보고 고른다.

개인정보
- 캐릭터 이름은 메모리 안에서 조합을 세는 데만 쓰고 버린다.
- 저장하는 것은 두 글자 조각과 그 빈도뿐이다. 이름 원문과 characterId 는 저장하지 않는다.
"""

import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402

LIMIT = 200
FAME_TOP = 136_883
DENSE_FROM = 117_014
COARSE_STEP = 250
DENSE_STEP = 50
TOP_N = 1000
OUT = ROOT / "config" / "seeds_r2.json"

SYL = re.compile(r"[가-힣]")
cli = NeopleClient()
t0 = time.monotonic()

plan = [f for f in range(1, DENSE_FROM, COARSE_STEP)]
plan += [f for f in range(DENSE_FROM, FAME_TOP + 1, DENSE_STEP)]
print(f"[시드] 명성 지점 {len(plan):,}개에서 두 글자 조합을 센다", flush=True)

count = {}
names_seen = 0
for i, fame in enumerate(plan):
    data = cli.get("/df/servers/all/characters-fame",
                   {"minFame": max(1, fame), "maxFame": fame, "limit": LIMIT})
    for r in data.get("rows", []):
        nm = r["characterName"]
        for k in range(len(nm) - 1):
            pair = nm[k:k + 2]
            if SYL.match(pair[0]) and SYL.match(pair[1]):
                count[pair] = count.get(pair, 0) + 1
        names_seen += 1
        del nm
    if i % 200 == 0:
        print(f"  {i:>4}/{len(plan)}  이름 {names_seen:,}  조합 {len(count):,}", flush=True)

ranked = sorted(count.items(), key=lambda x: -x[1])
top = ranked[:TOP_N]
OUT.write_text(json.dumps({
    "rationale": ("2차 회차 시드. 명성 방식 표본에서 센 한글 두 글자 조합 빈도 상위 1,000개. "
                  "1차는 절반을 일부러 희귀 조합으로 채워 커버리지가 1.21%에 그쳤다. "
                  "이번에는 빈도만 보고 고른다. 저장물은 두 글자 조각과 빈도뿐이며 "
                  "캐릭터 이름 원문은 어디에도 남기지 않는다."),
    "built_at": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
    "source_sample": names_seen,
    "distinct_bigrams": len(count),
    "top_n": TOP_N,
    "min_count_in_top": top[-1][1],
    "seeds": [s for s, _ in top],
    "counts": {s: c for s, c in top},
}, ensure_ascii=False, indent=1), encoding="utf-8")

print()
print(f"이름 {names_seen:,}개에서 조합 {len(count):,}가지")
print(f"상위 {TOP_N}개 저장, 가장 낮은 빈도 {top[-1][1]}회 (1위 {top[0][1]}회)")
print(f"호출 {cli.call_count}회, 소요 {(time.monotonic() - t0) / 60:.1f}분 -> {OUT.relative_to(ROOT)}")
