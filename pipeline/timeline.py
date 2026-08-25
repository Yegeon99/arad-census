# -*- coding: utf-8 -*-
"""CS-2 타임라인 조사기.

전체 표본(fame 보유)에서 명성 6구간 비례 층화로 600명 추출 → 최근 90일
타임라인 최신 이벤트 1건 조회 → 활성(7/30일)/저활성(90일)/휴면 판정.

- 구간 배분이 10명 미만이면 해당 구간 제외(리포트 마스킹) 후 잔여 구간에
  비례 재배분 (게이트 1 응답 5항).
- 추출은 고정 시드 RNG (재현성).
- 체크포인트: cid_hash 단위 재개.
- 개인정보: 결과 파일(timeline.jsonl)에는 cid_hash(sha256 16자)만 저장.
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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.api_client import NeopleClient
from pipeline.aggregate import load_bins, bin_label

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
CALLS_PATH = ROOT / "data" / "checkpoints" / "calls.jsonl"
TL_PATH = ROOT / "data" / "checkpoints" / "timeline.jsonl"

RNG_SEED = 20260825

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("timeline")


def cid_hash(cid: str) -> str:
    return hashlib.sha256(cid.encode()).hexdigest()[:16]


def load_chars_with_ids():
    """calls.jsonl → 고유 캐릭터 (characterId 원문 필요 — 이 함수 결과는 저장 금지)."""
    chars = {}
    with CALLS_PATH.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            for row in rec["rows"]:
                cid = row.get("characterId")
                if cid is None:
                    raise RuntimeError("characterId 원문이 이미 폐기됨 — 타임라인 조사 불가")
                key = (rec["server"], cid)
                if key not in chars:
                    chars[key] = {"server": rec["server"], "cid": cid, "fame": row["fame"]}
    return list(chars.values())


def stratified_sample(chars, bins, target):
    acfg_target = target
    with_fame = [c for c in chars if c["fame"] is not None]
    for c in with_fame:
        c["bin"] = bin_label(c["fame"], bins)
    by_bin = {}
    for c in with_fame:
        by_bin.setdefault(c["bin"], []).append(c)
    n_total = len(with_fame)
    alloc = {b["label"]: round(acfg_target * len(by_bin.get(b["label"], [])) / n_total) for b in bins}
    # 10명 미만 배분 구간 제외 후 재배분
    excluded = [k for k, v in alloc.items() if v < 10]
    if excluded:
        log.info("배분 10명 미만 구간 제외(마스킹): %s", excluded)
        rest = {k: len(by_bin[k]) for k in alloc if k not in excluded}
        rest_total = sum(rest.values())
        alloc = {k: round(acfg_target * v / rest_total) for k, v in rest.items()}
    rng = random.Random(RNG_SEED)
    picked = []
    for b_label, n in alloc.items():
        pool = by_bin.get(b_label, [])
        n = min(n, len(pool))
        picked.extend(rng.sample(pool, n))
    return picked, alloc, excluded


def classify(newest_date_str, now):
    if newest_date_str is None:
        return "휴면"
    d = datetime.strptime(newest_date_str, "%Y-%m-%d %H:%M").replace(tzinfo=KST)
    age = (now - d).days
    if age <= 7:
        return "주간 활성"
    if age <= 30:
        return "월간 활성"
    return "저활성"


def run():
    bins = load_bins()
    acfg = json.loads((ROOT / "config" / "activity.json").read_text(encoding="utf-8"))
    chars = load_chars_with_ids()
    picked, alloc, excluded = stratified_sample(chars, bins, acfg["subsample_size"])
    log.info("층화 추출 %d명 (배분: %s)", len(picked), alloc)

    done = set()
    if TL_PATH.exists():
        with TL_PATH.open(encoding="utf-8") as f:
            done = {json.loads(l)["cid_hash"] for l in f}
    log.info("체크포인트 %d명 완료됨", len(done))

    now = datetime.now(KST)
    start = (now - timedelta(days=acfg["lookback_days"])).strftime("%Y-%m-%d %H:%M")
    end = now.strftime("%Y-%m-%d %H:%M")

    c = NeopleClient()
    t0 = time.monotonic()
    n_done = 0
    with TL_PATH.open("a", encoding="utf-8") as out:
        for ch in picked:
            h = cid_hash(ch["cid"])
            if h in done:
                continue
            try:
                tl = c.character_timeline(ch["server"], ch["cid"], limit=1,
                                          startDate=start, endDate=end)
                rows = tl.get("timeline", {}).get("rows", [])
                newest = rows[0]["date"] if rows else None
            except Exception as exc:
                log.warning("%s… 실패: %s — 건너뜀(재실행 시 재시도)", h[:6], exc)
                continue
            out.write(json.dumps({
                "cid_hash": h,
                "server": ch["server"],
                "fame_bin": ch["bin"],
                "newest": newest,
                "activity": classify(newest, now),
            }, ensure_ascii=False) + "\n")
            out.flush()
            n_done += 1
            if n_done % 50 == 0:
                log.info("진행 %d/%d (경과 %.0f초)", n_done + len(done), len(picked),
                         time.monotonic() - t0)

    with TL_PATH.open(encoding="utf-8") as f:
        counts = Counter(json.loads(l)["activity"] for l in f)
    log.info("완료: 호출 %d회, 실패 %d — 판정 %s", c.call_count, c.fail_count, dict(counts))
    if excluded:
        log.info("마스킹 구간: %s", excluded)


if __name__ == "__main__":
    run()
