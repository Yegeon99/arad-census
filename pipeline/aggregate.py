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


def load_job_map():
    cfg = json.loads((ROOT / "config" / "job_map.json").read_text(encoding="utf-8"))
    return cfg["map"]


def bin_label(fame, bins):
    for b in bins:
        if fame >= b["min"] and (b["max"] is None or fame < b["max"]):
            return b["label"]
    return None


def load_frame():
    """호출 체크포인트 → 고유 캐릭터 프레임 (메모리 내에서만 ID 사용).

    직업 축은 job_map.json으로 정규화: job(최종 전직명)·stage(각성 단계)·
    job_group(기본 직업군). 매핑 실패 이름은 예외로 중단 (게이트 1 응답 1항).
    """
    job_map = load_job_map()
    chars = {}  # (server, cid) -> dict
    call_stats = {"calls": 0, "capped_calls": 0}
    unmapped = set()
    with CALLS_PATH.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            call_stats["calls"] += 1
            call_stats["capped_calls"] += 1 if rec["capped"] else 0
            for row in rec["rows"]:
                cid = row.get("cid_hash") or row.get("characterId")
                key = (rec["server"], cid)
                if key not in chars:
                    grow = row["jobGrowName"]
                    m = job_map.get(grow)
                    if m is None:
                        unmapped.add(grow)
                        continue
                    chars[key] = {
                        "server": rec["server"],
                        "job": m["canonical"],
                        "stage": m["stage"],
                        "job_group": row["jobName"],
                        "level": row["level"],
                        "fame": row["fame"],
                        "found_uncapped": not rec["capped"],
                    }
                elif not rec["capped"]:
                    chars[key]["found_uncapped"] = True
    if unmapped:
        raise RuntimeError(f"job_map 매핑 실패 {len(unmapped)}건: {sorted(unmapped)}")
    return list(chars.values()), call_stats


def dist_job(frame, total, key="job"):
    counter = Counter(c[key] for c in frame)
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


def dist_stage(frame, total):
    order = ["미전직", "0", "1", "2", "眞"]
    counter = Counter(c["stage"] for c in frame)
    return [{"stage": s, "count": counter.get(s, 0),
             "pct": round(counter.get(s, 0) / total * 100, 2)}
            for s in order if counter.get(s, 0) > 0]


def fame_missing_levels(frame):
    """fame 결측 캐릭터의 level 분포 (bias_notes용, 게이트 1 응답 3항)."""
    lv_bins = [("1~49", 1, 50), ("50~99", 50, 100), ("100~109", 100, 110), ("110~115", 110, 116)]
    missing = [c["level"] for c in frame if c["fame"] is None and c["level"] is not None]
    return [{"range": lab, "count": sum(1 for l in missing if lo <= l < hi)}
            for lab, lo, hi in lv_bins]


def dist_job_x_fame(frame, bins):
    """job×fame 교차 (정규화 전직명 기준). 10명 미만 셀은 masked (수치 미공개)."""
    cells = defaultdict(int)
    job_totals = Counter()
    for c in frame:
        if c["fame"] is None:
            continue
        cells[(c["job"], bin_label(c["fame"], bins))] += 1
        job_totals[c["job"]] += 1
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


TL_PATH = ROOT / "data" / "checkpoints" / "timeline.jsonl"


SMALL_N = 30  # 이 미만 구간은 "표본 소" 플래그 (게이트 2 응답 1항)


def _uncapped_lookup():
    """calls.jsonl → cid_hash별 found_uncapped (비상한 호출에서 1회라도 발견)."""
    lut = {}
    with CALLS_PATH.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            for row in rec["rows"]:
                h = row.get("cid_hash")
                if h is None:
                    continue
                lut[h] = lut.get(h, False) or (not rec["capped"])
    return lut


def _rates(rows, labels):
    n = len(rows)
    counter = Counter(r["activity"] for r in rows)
    return {
        "n": n,
        "counts": {lab: counter.get(lab, 0) for lab in labels},
        "pct": {lab: round(counter.get(lab, 0) / n * 100, 2) if n else None for lab in labels},
        "small_sample": n < SMALL_N,
    }


def load_activity(bins, uncapped_fame_dist):
    """타임라인 조사 결과(Phase 2) → activity 섹션. 없으면 None.

    게이트 2 보완: 구간별 n·표본 소 플래그, capped/uncapped 비교,
    비상한 명성 분포 가중 재추정치(reweighted_by_uncapped).
    """
    if not TL_PATH.exists():
        return None
    acfg = json.loads((ROOT / "config" / "activity.json").read_text(encoding="utf-8"))
    labels = [c["label"] for c in acfg["criteria"]]
    rows = [json.loads(l) for l in TL_PATH.open(encoding="utf-8")]
    lut = _uncapped_lookup()
    for r in rows:
        r["found_uncapped"] = lut.get(r["cid_hash"], False)

    n = len(rows)
    counter = Counter(r["activity"] for r in rows)
    by_bin = {b["label"]: [r for r in rows if r["fame_bin"] == b["label"]] for b in bins}

    # 비상한 명성 분포를 가중치로 쓴 재추정: 구간별 활성률 × 비상한 구간 비중 합
    weights = {d["range"]: d["pct"] / 100 for d in uncapped_fame_dist}
    reweighted = {}
    for lab in labels:
        est = 0.0
        for b in bins:
            sub = by_bin[b["label"]]
            if not sub:
                continue
            rate = sum(1 for r in sub if r["activity"] == lab) / len(sub)
            est += weights.get(b["label"], 0) * rate
        reweighted[lab] = round(est * 100, 2)

    return {
        "subsample_size": n,
        "criteria": "최신 타임라인 이벤트 기준 7/30/90일 분류. 이벤트 없음(90일)=휴면 — 접속만 하는 유저는 과소집계 가능 (bias_notes)",
        "lookback_days": acfg["lookback_days"],
        "small_n_threshold": SMALL_N,
        "overall": [{"label": lab, "count": counter.get(lab, 0),
                     "pct": round(counter.get(lab, 0) / n * 100, 2)} for lab in labels],
        "by_fame_bin": [
            dict({"bin": b["label"]}, **_rates(by_bin[b["label"]], labels))
            for b in bins if by_bin[b["label"]]
        ],
        "by_capped": {
            "note": "서브샘플을 발견 경로로 분리 — uncapped=비상한(200 미만) 검색에서 1회 이상 발견",
            "uncapped": _rates([r for r in rows if r["found_uncapped"]], labels),
            "capped_only": _rates([r for r in rows if not r["found_uncapped"]], labels),
            "by_fame_bin_uncapped": [
                dict({"bin": b["label"]}, **_rates([r for r in by_bin[b["label"]] if r["found_uncapped"]], labels))
                for b in bins if any(r["found_uncapped"] for r in by_bin[b["label"]])
            ],
        },
        "reweighted_by_uncapped": {
            "method": "명성 구간별 서브샘플 활성률에 비상한(uncapped) 표본의 6구간 비중을 가중치로 곱해 합산 — 상한 편향 보정 방향의 재추정치",
            "pct": reweighted,
        },
    }


def aggregate():
    bins = load_bins()
    frame, call_stats = load_frame()
    total = len(frame)
    uncapped = [c for c in frame if c["found_uncapped"]]

    fame_dist, fame_missing = dist_fame(frame, bins)
    u_fame_dist, u_fame_missing = dist_fame(uncapped, bins)
    activity = load_activity(bins, u_fame_dist)

    census = {
        "meta": {
            "surveyed_at": datetime.now(KST).isoformat(timespec="seconds"),
            "sample_size": total,
            "fame_missing": fame_missing,
            "uncapped_sample_size": len(uncapped),
            "uncapped_fame_missing": u_fame_missing,
            "search_calls": call_stats["calls"],
            "search_calls_capped": call_stats["capped_calls"],
            "timeline_subsample": activity["subsample_size"] if activity else 0,
            "servers": sorted({c["server"] for c in frame}),
            "method_version": "1.1",
            "min_cell": MIN_CELL,
            "fame_missing_level_dist": fame_missing_levels(frame),
        },
        "distributions": {
            "job": dist_job(frame, total),
            "job_group": dist_job(frame, total, key="job_group"),
            "stage": dist_stage(frame, total),
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
        "activity": activity,
        "insights": [],  # Phase 2 insights.py가 채움
    }

    # 기존 인사이트 보존 (재집계 시 유실 방지)
    if OUT_PATH.exists():
        try:
            prev = json.loads(OUT_PATH.read_text(encoding="utf-8"))
            census["insights"] = prev.get("insights", [])
        except (ValueError, OSError):
            pass

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
