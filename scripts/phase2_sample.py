# -*- coding: utf-8 -*-
"""상한 우회 표본 실행.

상한 도달 조합 전량을 쪼개면 143,406호출(12시간)이라 표본으로만 잰다.
무작위 400개 조합을 직업군 18종으로 쪼개 재호출하고, 상한이 가리고 있던
규모와 성격을 추정한다.

산출
- 쪼갠 뒤 실제 합계 / 200 = 상한이 가리는 배수
- 쪼갠 뒤에도 상한에 걸린 직업군 조합의 비율 (쪼개도 못 벗어나는지)
- 새로 드러난 캐릭터와 원래 200명 안에 있던 캐릭터의 명성 분포·직업 구성 차이

개인정보: characterId 는 phase1 과 같은 회차 소금으로 즉시 해시. 이름은 받지 않는다.
"""

import json
import logging
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402
from scripts.sample_r2 import P1, P2, SEARCH_LIMIT, anon, done_keys  # noqa: E402

SAMPLE_N = 400
RANDOM_SEED = 20260831
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("p2")


def pick():
    capped = []
    with P1.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec["capped"]:
                capped.append((rec["server"], rec["seed"]))
    rnd = random.Random(RANDOM_SEED)
    chosen = rnd.sample(capped, min(SAMPLE_N, len(capped)))
    return capped, set(chosen), chosen


def run():
    c = NeopleClient()
    jobs = [(j["jobId"], j["jobName"]) for j in c.get("/df/jobs")["rows"]]
    capped_all, chosen_set, chosen = pick()
    done = done_keys(P2, lambda r: (r["server"], r["seed"], r["jobId"]))
    planned = len(chosen) * len(jobs)
    log.info("상한 도달 조합 %d개 중 %d개를 뽑아 직업군 %d종으로 쪼갠다 = %d호출 (완료 %d)",
             len(capped_all), len(chosen), len(jobs), planned, len(done))
    log.info("무작위 시드 %d", RANDOM_SEED)
    t0 = time.monotonic()
    n = len(done)
    with P2.open("a", encoding="utf-8") as out:
        for server, seed in chosen:
            for jid, jname in jobs:
                if (server, seed, jid) in done:
                    continue
                try:
                    r = c.get(f"/df/servers/{server}/characters",
                              {"characterName": seed, "wordType": "full",
                               "jobId": jid, "limit": SEARCH_LIMIT})
                    rows = r.get("rows", [])
                except Exception as exc:
                    log.warning("%s/%s 실패: %s", server, seed, exc)
                    continue
                out.write(json.dumps({
                    "server": server, "seed": seed, "jobId": jid, "jobGroup": jname,
                    "capped": len(rows) >= SEARCH_LIMIT,
                    "rows": [{
                        "h": anon(x["characterId"]),
                        "jobName": x.get("jobName"),
                        "jobGrowName": x.get("jobGrowName"),
                        "level": x.get("level"),
                        "fame": x.get("fame"),
                    } for x in rows],
                }, ensure_ascii=False) + "\n")
                out.flush()
                n += 1
                if n % 400 == 0:
                    el = time.monotonic() - t0
                    rate = (n - len(done)) / max(el, 1)
                    log.info("진행 %d/%d (%.1f%%) 경과 %.0f분 남은 %.0f분",
                             n, planned, n / planned * 100, el / 60,
                             (planned - n) / max(rate, 0.001) / 60)
    log.info("phase2 표본 완료: 호출 %d, 실패 %d, 소요 %.1f분",
             c.call_count, c.fail_count, (time.monotonic() - t0) / 60)


if __name__ == "__main__":
    run()
