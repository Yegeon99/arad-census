# -*- coding: utf-8 -*-
"""CS-1 표본 수집기.

시드(config/seeds.json) × 전 서버를 wordType=full로 검색해 표본 프레임을 만든다.

- 중복 제거: (serverId, characterId) 기준. 여러 시드에서 발견된 캐릭터는
  1명으로 세되, 비상한(uncapped) 호출에서 한 번이라도 발견되면
  found_uncapped=True로 기록한다 (상한 편향 비교 집계용).
- capped: 해당 시드·서버 검색이 상한(200)에 도달했는지 호출 단위로 기록.
- 체크포인트: (server, seed) 호출 단위로 저장, 중단 후 재개 가능.
- 개인정보: characterName은 저장하지 않는다. characterId 원문은 타임라인
  조사(Phase 2)에 필요해 gitignore된 checkpoints/ 아래에만 두고, Phase 2
  완료 후 폐기한다. 커밋 대상 산출물에는 어떤 식별 정보도 넣지 않는다.
"""

import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
CKPT_DIR = ROOT / "data" / "checkpoints"
CALLS_PATH = CKPT_DIR / "calls.jsonl"      # 호출 단위 체크포인트 (row 원본 포함, gitignored)
YIELD_PATH = ROOT / "data" / "seed_yield.json"  # 시드별 수확량 표 (식별 정보 없음, 커밋 가능)

SEARCH_LIMIT = 200

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("sample")


def load_seeds():
    cfg = json.loads((ROOT / "config" / "seeds.json").read_text(encoding="utf-8"))
    seeds = [(s, "common") for s in cfg["common"]] + [(s, "rare") for s in cfg["rare"]]
    return seeds


def load_checkpoint():
    done = {}
    if CALLS_PATH.exists():
        with CALLS_PATH.open(encoding="utf-8") as f:
            for line in f:
                rec = json.loads(line)
                done[(rec["server"], rec["seed"])] = rec
    return done


def collect():
    seeds = load_seeds()
    c = NeopleClient()
    servers = [r["serverId"] for r in c.servers()["rows"]]
    done = load_checkpoint()
    total_pairs = len(servers) * len(seeds)
    log.info("서버 %d × 시드 %d = 호출 %d건 예정 (체크포인트 %d건 완료됨)",
             len(servers), len(seeds), total_pairs, len(done))

    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.monotonic()
    n_done = len(done)
    with CALLS_PATH.open("a", encoding="utf-8") as out:
        for server in servers:
            for seed, seed_class in seeds:
                if (server, seed) in done:
                    continue
                try:
                    r = c.search_characters(server, seed, word_type="full", limit=SEARCH_LIMIT)
                    rows = r.get("rows", [])
                except Exception as exc:
                    log.warning("%s/%s 실패: %s — 건너뜀(재실행 시 재시도)", server, seed, exc)
                    continue
                rec = {
                    "server": server,
                    "seed": seed,
                    "seed_class": seed_class,
                    "capped": len(rows) >= SEARCH_LIMIT,
                    "rows": [
                        {
                            "characterId": row["characterId"],
                            "jobId": row.get("jobId"),
                            "jobName": row.get("jobName"),
                            "jobGrowId": row.get("jobGrowId"),
                            "jobGrowName": row.get("jobGrowName"),
                            "level": row.get("level"),
                            "fame": row.get("fame"),
                        }
                        for row in rows
                    ],
                }
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                out.flush()
                n_done += 1
                if n_done % 20 == 0:
                    log.info("진행 %d/%d (경과 %.0f초)", n_done, total_pairs, time.monotonic() - t0)

    log.info("수집 완료: 호출 %d회(이번 실행), 실패 %d", c.call_count, c.fail_count)
    return c


def build_yield_table():
    """시드별 수확량·capped 표 (게이트 1 보고용, 식별 정보 없음)."""
    done = load_checkpoint()
    by_seed = {}
    for (server, seed), rec in done.items():
        e = by_seed.setdefault(seed, {"seed": seed, "class": rec["seed_class"],
                                      "calls": 0, "rows": 0, "capped_calls": 0})
        e["calls"] += 1
        e["rows"] += len(rec["rows"])
        e["capped_calls"] += 1 if rec["capped"] else 0
    table = sorted(by_seed.values(), key=lambda x: (x["class"], -x["rows"]))
    YIELD_PATH.write_text(json.dumps({
        "generated_at": datetime.now(KST).isoformat(timespec="seconds"),
        "seeds": table,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return table


if __name__ == "__main__":
    client = collect()
    table = build_yield_table()
    capped = sum(t["capped_calls"] for t in table)
    calls = sum(t["calls"] for t in table)
    log.info("시드 수확 표 저장: %s (호출 %d건 중 상한 도달 %d건)", YIELD_PATH, calls, capped)
