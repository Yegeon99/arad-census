# -*- coding: utf-8 -*-
"""CS-3 집계기.

체크포인트(calls.jsonl)에서 표본 프레임을 만들어 분포를 산출한다.

- 중복 제거: (server, characterId). 비상한 호출에서 1회라도 발견되면
  found_uncapped=True.
- 산출: 전체 표본 분포 4종(job / fame_bins / server / job×fame) +
  비상한(uncapped) 표본만의 분포 3종(job / fame_bins / server) — 상한 편향
  비교용 (§6 방법론).
- 마스킹: 표본 10명 미만 셀. job 분포는 "기타"로 합산, job×fame 교차 셀은
  masked=true 처리(수치 미공개).
- 개인정보: 산출물에는 어떤 식별 정보도 넣지 않는다. 저장 전 자체 검증.
"""

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
CALLS_PATH = ROOT / "data" / "checkpoints" / "calls.jsonl"
OUT_PATH = ROOT / "data" / "census_2026-08.json"

MIN_CELL = 10  # 마스킹 기준


def load_bins():
    cfg = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))
    return cfg["bins"]


def bin_label(fame, bins):
    for b in bins:
        if fame >= b["min"] and (b["max"] is None or fame < b["max"]):
            return b["label"]
    return None


def load_frame():
    """호출 체크포인트 → 고유 캐릭터 프레임 (메모리 내에서만 ID 사용)."""
    chars = {}  # (server, characterId) -> dict
    call_stats = {"calls": 0, "capped_calls": 0}
    with CALLS_PATH.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            call_stats["calls"] += 1
            call_stats["capped_calls"] += 1 if rec["capped"] else 0
            for row in rec["rows"]:
                key = (rec["server"], row["characterId"])
                if key not in chars:
                    chars[key] = {
                        "server": rec["server"],
                        "jobName": row["jobName"],
                        "jobGrowName": row["jobGrowName"],
                        "level": row["level"],
                        "fame": row["fame"],
                        "found_uncapped": not rec["capped"],
                    }
                elif not rec["capped"]:
                    chars[key]["found_uncapped"] = True
    return list(chars.values()), call_stats


def dist_job(frame, total):
    counter = Counter(c["jobGrowName"] for c in frame)
    out, etc_count, etc_jobs = [], 0, 0
    for name, n in counter.most_common():
        if n >= MIN_CELL:
            out.append({"jobName": name, "count": n, "pct": round(n / total * 100, 2)})
        else:
            etc_count += n
            etc_jobs += 1
    if etc_count:
        out.append({"jobName": f"기타(표본<{MIN_CELL} 직업 {etc_jobs}개)",
                    "count": etc_count, "pct": round(etc_count / total * 100, 2)})
    return out


def dist_fame(frame, bins):
    with_fame = [c for c in frame if c["fame"] is not None]
    counter = Counter(bin_label(c["fame"], bins) for c in with_fame)
    n = len(with_fame)
    return [{"range": b["label"], "count": counter.get(b["label"], 0),
             "pct": round(counter.get(b["label"], 0) / n * 100, 2) if n else 0}
            for b in bins], len(frame) - n


def dist_server(frame):
    counter = Counter(c["server"] for c in frame)
    return [{"server": s, "count": n} for s, n in counter.most_common()]


def dist_job_x_fame(frame, bins):
    """job×fame 교차. 10명 미만 셀은 masked (수치 미공개)."""
    cells = defaultdict(int)
    job_totals = Counter()
    for c in frame:
        if c["fame"] is None:
            continue
        cells[(c["jobGrowName"], bin_label(c["fame"], bins))] += 1
        job_totals[c["jobGrowName"]] += 1
    # 교차표는 fame 있는 표본 수 MIN_CELL 이상 직업만 (그 외는 전 셀이 마스킹 대상)
    jobs = [j for j, n in job_totals.most_common() if n >= MIN_CELL]
    out = []
    for j in jobs:
        for b in bins:
            n = cells.get((j, b["label"]), 0)
            if n == 0:
                out.append({"jobName": j, "bin": b["label"], "count": 0})
            elif n < MIN_CELL:
                out.append({"jobName": j, "bin": b["label"], "count": None, "masked": True})
            else:
                out.append({"jobName": j, "bin": b["label"], "count": n})
    return out


def pii_scan(text: str) -> list:
    """산출물 문자열에서 식별 정보 패턴 탐지."""
    hits = []
    if re.search(r"[0-9a-f]{32}", text):
        hits.append("characterId(32hex) 패턴")
    for key in ("characterId", "characterName", "adventureName", "guildName", "guildId"):
        if f'"{key}"' in text:
            hits.append(f"{key} 키")
    return hits


def aggregate():
    bins = load_bins()
    frame, call_stats = load_frame()
    total = len(frame)
    uncapped = [c for c in frame if c["found_uncapped"]]

    fame_dist, fame_missing = dist_fame(frame, bins)
    u_fame_dist, u_fame_missing = dist_fame(uncapped, bins)

    census = {
        "meta": {
            "surveyed_at": datetime.now(KST).isoformat(timespec="seconds"),
            "sample_size": total,
            "fame_missing": fame_missing,
            "uncapped_sample_size": len(uncapped),
            "uncapped_fame_missing": u_fame_missing,
            "search_calls": call_stats["calls"],
            "search_calls_capped": call_stats["capped_calls"],
            "timeline_subsample": 0,  # Phase 2에서 채움
            "servers": sorted({c["server"] for c in frame}),
            "method_version": "1.0",
            "min_cell": MIN_CELL,
        },
        "distributions": {
            "job": dist_job(frame, total),
            "fame_bins": fame_dist,
            "server": dist_server(frame),
            "job_x_fame": dist_job_x_fame(frame, bins),
        },
        "distributions_uncapped_only": {
            "note": "상한(200) 미도달 검색에서 발견된 표본만의 분포 — 상한 도달 표본의 고명성 쏠림 편향 비교용",
            "job": dist_job(uncapped, len(uncapped)) if uncapped else [],
            "fame_bins": u_fame_dist,
            "server": dist_server(uncapped),
        },
        "activity": None,  # Phase 2
        "insights": [],    # Phase 2
    }

    # 정합성 검증
    assert sum(d["count"] for d in census["distributions"]["job"]) == total, "job 합계 불일치"
    assert sum(d["count"] for d in census["distributions"]["server"]) == total, "server 합계 불일치"
    assert sum(d["count"] for d in fame_dist) == total - fame_missing, "fame 합계 불일치"

    text = json.dumps(census, ensure_ascii=False, indent=2)
    hits = pii_scan(text)
    if hits:
        raise RuntimeError(f"식별 정보 잔존 감지 — 저장 중단: {hits}")
    OUT_PATH.write_text(text, encoding="utf-8")
    return census


if __name__ == "__main__":
    c = aggregate()
    m = c["meta"]
    print(f"표본 {m['sample_size']}명 (비상한 {m['uncapped_sample_size']}명, fame 결측 {m['fame_missing']}명)")
    print(f"검색 호출 {m['search_calls']}건 중 상한 도달 {m['search_calls_capped']}건")
    print(f"저장: {OUT_PATH} / 식별 정보 스캔 0건")
