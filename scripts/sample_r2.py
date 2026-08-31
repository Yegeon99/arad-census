# -*- coding: utf-8 -*-
"""2차 회차 표본 수집. 1차 데이터는 건드리지 않는다.

1차와 다른 점은 시드뿐이다. 명성 방식 표본에서 센 두 글자 조합 빈도 상위 1,000개를 쓴다.
검색 방식(wordType=full, 상한 200), 호출 간격, 재시도, 중복 제거 기준은 1차와 같다.

단계
  phase1  서버 8곳 x 시드 1,000개
  phase2  상한 200에 걸린 조합을 직업군으로 쪼개 다시 부른다 (상한 우회)

개인정보
- characterId 는 받는 즉시 회차 소금으로 해시한다. 원문은 체크포인트에도 남기지 않는다.
- characterName 은 아예 받아 두지 않는다.
- 체크포인트는 gitignore 된 data/checkpoints/ 아래에만 둔다.

사용: python scripts/sample_r2.py phase1 | phase2 [최대호출]
"""

import hashlib
import json
import logging
import secrets
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402

CKPT = ROOT / "data" / "checkpoints"
P1 = CKPT / "r2_phase1.jsonl"
P2 = CKPT / "r2_phase2.jsonl"
SALT_PATH = CKPT / "r2_salt.txt"
SEARCH_LIMIT = 200

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("r2")


def salt() -> bytes:
    CKPT.mkdir(parents=True, exist_ok=True)
    if not SALT_PATH.exists():
        SALT_PATH.write_text(secrets.token_hex(16), encoding="utf-8")
    return bytes.fromhex(SALT_PATH.read_text(encoding="utf-8").strip())


SALT = salt()


def anon(cid: str) -> str:
    return hashlib.sha256(SALT + cid.encode()).hexdigest()[:16]


def seeds():
    return json.loads((ROOT / "config" / "seeds_r2.json").read_text(encoding="utf-8"))["seeds"]


def slim(rows):
    """식별 정보를 즉시 지운 행."""
    return [{
        "h": anon(r["characterId"]),
        "jobName": r.get("jobName"),
        "jobGrowName": r.get("jobGrowName"),
        "level": r.get("level"),
        "fame": r.get("fame"),
    } for r in rows]


def done_keys(path, key):
    out = set()
    if path.exists():
        with path.open(encoding="utf-8") as f:
            for line in f:
                try:
                    out.add(key(json.loads(line)))
                except Exception:
                    continue
    return out


def phase1():
    c = NeopleClient()
    servers = [r["serverId"] for r in c.servers()["rows"]]
    sd = seeds()
    done = done_keys(P1, lambda r: (r["server"], r["seed"]))
    total = len(servers) * len(sd)
    log.info("phase1 서버 %d x 시드 %d = %d건 (완료 %d건)", len(servers), len(sd), total, len(done))
    t0 = time.monotonic()
    n = len(done)
    with P1.open("a", encoding="utf-8") as out:
        for server in servers:
            for seed in sd:
                if (server, seed) in done:
                    continue
                try:
                    r = c.search_characters(server, seed, word_type="full", limit=SEARCH_LIMIT)
                    rows = r.get("rows", [])
                except Exception as exc:
                    log.warning("%s/%s 실패: %s", server, seed, exc)
                    continue
                out.write(json.dumps({
                    "server": server, "seed": seed,
                    "capped": len(rows) >= SEARCH_LIMIT,
                    "rows": slim(rows),
                }, ensure_ascii=False) + "\n")
                out.flush()
                n += 1
                if n % 200 == 0:
                    el = time.monotonic() - t0
                    rate = (n - len(done)) / max(el, 1)
                    left = (total - n) / max(rate, 0.001) / 60
                    log.info("진행 %d/%d (%.1f%%) 경과 %.0f분 남은 %.0f분", n, total, n / total * 100, el / 60, left)
    log.info("phase1 완료: 이번 실행 호출 %d, 실패 %d", c.call_count, c.fail_count)


def phase2(max_calls=None):
    c = NeopleClient()
    jobs = [j["jobId"] for j in c.get("/df/jobs")["rows"]]
    capped = []
    with P1.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec["capped"]:
                capped.append((rec["server"], rec["seed"]))
    done = done_keys(P2, lambda r: (r["server"], r["seed"], r["jobId"]))
    planned = len(capped) * len(jobs)
    log.info("phase2 상한 도달 조합 %d x 직업군 %d = %d건 (완료 %d건)",
             len(capped), len(jobs), planned, len(done))
    if max_calls:
        log.info("이번 실행 상한 %d건", max_calls)
    t0 = time.monotonic()
    n = len(done)
    used = 0
    with P2.open("a", encoding="utf-8") as out:
        for server, seed in capped:
            for jid in jobs:
                if (server, seed, jid) in done:
                    continue
                if max_calls and used >= max_calls:
                    log.info("이번 실행 상한 도달, 중단 (재실행하면 이어서 진행)")
                    log.info("phase2 중단: 호출 %d, 실패 %d", c.call_count, c.fail_count)
                    return
                try:
                    r = c.get(f"/df/servers/{server}/characters",
                              {"characterName": seed, "wordType": "full",
                               "jobId": jid, "limit": SEARCH_LIMIT})
                    rows = r.get("rows", [])
                except Exception as exc:
                    log.warning("%s/%s/%s 실패: %s", server, seed, jid[:8], exc)
                    continue
                out.write(json.dumps({
                    "server": server, "seed": seed, "jobId": jid,
                    "capped": len(rows) >= SEARCH_LIMIT,
                    "rows": slim(rows),
                }, ensure_ascii=False) + "\n")
                out.flush()
                n += 1
                used += 1
                if n % 500 == 0:
                    el = time.monotonic() - t0
                    log.info("진행 %d/%d (%.1f%%) 경과 %.0f분", n, planned, n / planned * 100, el / 60)
    log.info("phase2 완료: 호출 %d, 실패 %d", c.call_count, c.fail_count)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "phase1"
    if what == "phase1":
        phase1()
    elif what == "phase2":
        phase2(int(sys.argv[2]) if len(sys.argv) > 2 else None)
    else:
        print("사용: python scripts/sample_r2.py phase1 | phase2 [최대호출]")
