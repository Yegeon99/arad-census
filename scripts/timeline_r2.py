# -*- coding: utf-8 -*-
"""2차 표본의 활성도 서브샘플.

2차 수집은 characterId 를 즉시 해시해 버렸으므로 타임라인을 부를 원본 아이디가 없다.
그래서 2차와 같은 시드·같은 검색으로 후보를 다시 뽑아 층화 표본을 만든다.
판정 기준(7일/30일/90일/미기록)과 표본 크기(600)는 1차와 같다.

목적: 명성 방식과 같은 모집단(레벨 110 이상 + 90일 내 접속)으로 잘랐을 때
      2차의 명성 분포가 명성 방식과 얼마나 맞는지 다시 재는 것.

한계: 타임라인은 행동 기록만 남는다. 접속만 하고 기록을 안 남기는 캐릭터는
      휴면으로 잡히며, 그 과대집계는 저명성 구간에서 특히 크다(1차 검증에서 확인).
      이 필터로 자르면 저명성 쪽이 실제보다 많이 잘려 나가므로, 결과는
      "2차가 명성 방식에 가까워지는" 방향으로 유리하게 기운다. 보고에 함께 적는다.

개인정보: characterId 는 타임라인 호출 직후 해시한다. 저장물에는 해시와 집계만 남는다.
"""

import hashlib
import json
import logging
import random
import sys
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.api_client import NeopleClient  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
CKPT = ROOT / "data" / "checkpoints"
TL = CKPT / "r2_timeline.jsonl"
TARGET = 600
CAND_CALLS = 60          # 후보를 모으는 검색 호출 수
RNG_SEED = 20260831

BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
LABELS = [b["label"] for b in BINS]
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("tl2")


def bin_of(f):
    if f is None:
        return None
    for b in BINS:
        if f >= b["min"] and (b["max"] is None or f < b["max"]):
            return b["label"]
    return None


def classify(newest, now):
    if newest is None:
        return "휴면"
    d = datetime.strptime(newest, "%Y-%m-%d %H:%M").replace(tzinfo=KST)
    age = (now - d).days
    if age <= 7:
        return "주간 활성"
    if age <= 30:
        return "월간 활성"
    return "저활성"


def run():
    rng = random.Random(RNG_SEED)
    combos = []
    with (CKPT / "r2_phase1.jsonl").open(encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            combos.append((r["server"], r["seed"]))
    picks = rng.sample(combos, CAND_CALLS)

    c = NeopleClient()
    cand = {}
    for server, seed in picks:
        try:
            r = c.search_characters(server, seed, word_type="full", limit=200)
        except Exception as exc:
            log.warning("후보 검색 실패 %s/%s: %s", server, seed, exc)
            continue
        for x in r.get("rows", []):
            lab = bin_of(x.get("fame"))
            if lab is None:
                continue
            cand[(server, x["characterId"])] = {
                "server": server, "cid": x["characterId"],
                "fame": x["fame"], "level": x.get("level"), "bin": lab,
            }
    log.info("후보 %d명 (검색 %d회)", len(cand), c.call_count)

    # 2차 표본의 명성 구간 비중에 비례해 배분
    r2 = json.loads((ROOT / "data" / "census_2026-08-r2.json").read_text(encoding="utf-8"))
    w = {x["range"]: x["pct"] for x in r2["distributions_final_stage"]["fame_bins"]}
    by_bin = {}
    for v in cand.values():
        by_bin.setdefault(v["bin"], []).append(v)
    alloc = {b: round(TARGET * w[b] / 100) for b in LABELS}
    picked = []
    for b in LABELS:
        pool = by_bin.get(b, [])
        n = min(alloc[b], len(pool))
        if n < len(alloc):
            pass
        picked.extend(rng.sample(pool, n))
        alloc[b] = n
    log.info("층화 배분 %s (합계 %d)", alloc, len(picked))

    done = set()
    if TL.exists():
        with TL.open(encoding="utf-8") as f:
            for line in f:
                done.add(json.loads(line)["cid_hash"])

    now = datetime.now(KST)
    start = (now - timedelta(days=90)).strftime("%Y-%m-%d %H:%M")
    end = now.strftime("%Y-%m-%d %H:%M")
    t0 = time.monotonic()
    n = 0
    with TL.open("a", encoding="utf-8") as out:
        for ch in picked:
            h = hashlib.sha256(ch["cid"].encode()).hexdigest()[:16]
            if h in done:
                continue
            try:
                tl = c.character_timeline(ch["server"], ch["cid"], limit=1,
                                          startDate=start, endDate=end)
                rows = tl.get("timeline", {}).get("rows", [])
                newest = rows[0]["date"] if rows else None
            except Exception as exc:
                log.warning("%s 실패: %s", h[:6], exc)
                continue
            out.write(json.dumps({
                "cid_hash": h, "fame_bin": ch["bin"], "level": ch["level"],
                "activity": classify(newest, now),
            }, ensure_ascii=False) + "\n")
            out.flush()
            n += 1
            if n % 100 == 0:
                log.info("진행 %d/%d (경과 %.0f초)", n, len(picked), time.monotonic() - t0)

    rows = [json.loads(l) for l in TL.open(encoding="utf-8")]
    cnt = Counter(r["activity"] for r in rows)
    per_bin = {}
    for b in LABELS:
        sub = [r for r in rows if r["fame_bin"] == b]
        if not sub:
            continue
        cc = Counter(r["activity"] for r in sub)
        per_bin[b] = {"n": len(sub),
                      "pct": {k: round(cc.get(k, 0) / len(sub) * 100, 2)
                              for k in ("주간 활성", "월간 활성", "저활성", "휴면")}}
    res = {
        "meta": {"surveyed_at": now.isoformat(timespec="seconds"), "round": "2026-08-r2",
                 "subsample_size": len(rows), "candidate_calls": CAND_CALLS,
                 "api_calls": c.call_count, "rng_seed": RNG_SEED,
                 "criteria": "최신 타임라인 이벤트 기준 7/30/90일, 이벤트 없음=휴면",
                 "caveat": ("타임라인은 행동 기록만 남으므로 접속만 하는 캐릭터는 휴면으로 "
                            "과대집계된다. 그 과대집계는 저명성 구간에서 특히 크다.")},
        "overall": {k: {"count": cnt.get(k, 0), "pct": round(cnt.get(k, 0) / len(rows) * 100, 2)}
                    for k in ("주간 활성", "월간 활성", "저활성", "휴면")},
        "by_fame_bin": per_bin,
    }
    (ROOT / "data" / "activity_r2.json").write_text(json.dumps(res, ensure_ascii=False, indent=2),
                                                    encoding="utf-8")
    log.info("완료: %d명, 호출 %d, 소요 %.1f분", len(rows), c.call_count,
             (time.monotonic() - t0) / 60)
    for k, v in res["overall"].items():
        log.info("  %s %d명 %.1f%%", k, v["count"], v["pct"])


if __name__ == "__main__":
    run()
