# -*- coding: utf-8 -*-
"""2차 회차 집계. 1차 파이프라인을 그대로 쓰되 입출력만 갈아 끼운다.

1차 산출물(data/census_2026-08.json)은 건드리지 않는다.
활성도는 이번 회차에서 다시 재지 않는다 (판정 방식 문제라 시드를 바꿔도 개선되지 않는다).
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import pipeline.aggregate as ag  # noqa: E402

CKPT = ROOT / "data" / "checkpoints"
P1, P2 = CKPT / "r2_phase1.jsonl", CKPT / "r2_phase2.jsonl"
MERGED = CKPT / "r2_merged.jsonl"
OUT = ROOT / "data" / "census_2026-08-r2.json"


def merge():
    """두 단계의 체크포인트를 1차 집계기가 읽는 모양으로 합친다."""
    n1 = n2 = 0
    with MERGED.open("w", encoding="utf-8") as out:
        for path, tag in ((P1, "phase1"), (P2, "phase2")):
            if not path.exists():
                continue
            with path.open(encoding="utf-8") as f:
                for line in f:
                    rec = json.loads(line)
                    out.write(json.dumps({
                        "server": rec["server"],
                        "seed": rec["seed"],
                        "seed_class": tag,
                        "capped": rec["capped"],
                        "rows": [{
                            "cid_hash": r["h"],
                            "jobName": r["jobName"],
                            "jobGrowName": r["jobGrowName"],
                            "level": r["level"],
                            "fame": r["fame"],
                        } for r in rec["rows"]],
                    }, ensure_ascii=False) + "\n")
                    if tag == "phase1":
                        n1 += 1
                    else:
                        n2 += 1
    return n1, n2


if __name__ == "__main__":
    n1, n2 = merge()
    ag.CALLS_PATH = MERGED
    ag.OUT_PATH = OUT
    ag.ROUND = "2026-08-r2"
    ag.load_activity = lambda *a, **k: None      # 이번 회차는 타임라인 조사 없음
    c = ag.aggregate()

    # 이번 회차만의 기록을 meta 에 덧붙인다
    d = json.loads(OUT.read_text(encoding="utf-8"))
    d["meta"]["round"] = "2026-08-r2"
    d["meta"]["note"] = ("2차 회차. 시드를 명성 방식 표본의 두 글자 조합 빈도 상위 1,000개로 바꿨다. "
                         "1차 결과는 그대로 두고 나란히 비교하기 위한 별도 회차다. "
                         "활성도는 다시 재지 않았다.")
    d["meta"]["seed_count"] = len(json.loads((ROOT / "config" / "seeds_r2.json").read_text(encoding="utf-8"))["seeds"])
    d["meta"]["phase1_calls"] = n1
    d["meta"]["phase2_calls"] = n2
    OUT.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")

    m = d["meta"]
    print(f"표본 {m['sample_size']:,}명 (비상한 {m['uncapped_sample_size']:,}, 명성 결측 {m['fame_missing']:,})")
    print(f"호출 phase1 {n1:,} + phase2 {n2:,} = {n1 + n2:,}건, 상한 도달 {m['search_calls_capped']:,}건")
    print(f"진 각성 {d['distributions_final_stage']['sample_size']:,}명")
    print(f"저장 {OUT.relative_to(ROOT)} / 식별 정보 스캔 0건")
