# -*- coding: utf-8 -*-
"""식별 정보 폐기 (게이트 1 응답 5항).

타임라인 조사 완료 후 checkpoints/calls.jsonl의 characterId 원문을
sha256 16자 해시(cid_hash)로 치환한다. 치환 후 전 체크포인트를 스캔해
32자리 hex(characterId 원문 패턴)·식별 키 잔존 여부를 보고한다.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CKPT = ROOT / "data" / "checkpoints"
CALLS = CKPT / "calls.jsonl"


def cid_hash(cid: str) -> str:
    return hashlib.sha256(cid.encode()).hexdigest()[:16]


def purge():
    tmp = CALLS.with_suffix(".tmp")
    n = 0
    with CALLS.open(encoding="utf-8") as f, tmp.open("w", encoding="utf-8") as out:
        for line in f:
            rec = json.loads(line)
            for row in rec["rows"]:
                if "characterId" in row:
                    row["cid_hash"] = cid_hash(row.pop("characterId"))
                    n += 1
                # jobId/jobGrowId는 직업 UUID(개인 식별 아님)지만 32hex 스캔과
                # 겹치고 이름 기준 정규화로 불필요 — 함께 제거
                row.pop("jobId", None)
                row.pop("jobGrowId", None)
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
    tmp.replace(CALLS)
    print(f"characterId 원문 {n}건 → cid_hash 치환 완료")


def scan():
    hits = 0
    for p in sorted(CKPT.glob("*.jsonl")):
        text = p.read_text(encoding="utf-8")
        ids = re.findall(r"[0-9a-f]{32}", text)
        keys = [k for k in ("characterId", "characterName", "adventureName", "guildName")
                if f'"{k}"' in text]
        if ids or keys:
            hits += len(ids) + len(keys)
            print(f"{p.name}: 32hex {len(ids)}건, 식별 키 {keys}")
        else:
            print(f"{p.name}: 잔존 0건")
    return hits


if __name__ == "__main__":
    if "--scan-only" not in sys.argv:
        purge()
    total = scan()
    print(f"식별 정보 잔존 스캔: {'0건 통과' if total == 0 else f'{total}건 — 실패'}")
    sys.exit(0 if total == 0 else 1)
