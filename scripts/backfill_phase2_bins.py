# -*- coding: utf-8 -*-
"""상한 우회 실험의 구간 표를 그 실험이 남긴 글 출력에서 되읽어 집계 파일에 넣는다.

phase2_analyze.py 는 처음에 이 표를 글로만 찍고 집계 파일에는 넣지 않았다.
원본 기록은 개인정보 방침에 따라 이미 지웠으므로 다시 돌릴 수 없다.
그래서 그때 그 실행이 남긴 data/phase2_sample.txt 를 읽어 같은 값을 옮긴다.
사람이 손으로 적는 것이 아니라 실행 기록에서 그대로 읽어 온다.

    python scripts/backfill_phase2_bins.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BINS = json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]
LABELS = [b["label"] for b in BINS]

text = (ROOT / "data" / "phase2_sample.txt").read_text(encoding="utf-8")
target = ROOT / "data" / "phase2_sample.json"
res = json.loads(target.read_text(encoding="utf-8"))

rows = []
for label in LABELS:
    hit = re.search(
        rf"^{re.escape(label)}\s+([\d.]+)%\s+([\d.]+)%\s+([+-][\d.]+)%p\s*$",
        text, re.MULTILINE)
    if not hit:
        raise SystemExit(f"실행 기록에서 {label} 줄을 찾지 못했습니다")
    old, new, diff = (float(g) for g in hit.groups())
    # 세 값이 저마다 두 자리에서 반올림돼 나왔으므로 마지막 자리 하나는 어긋날 수 있다
    if abs(round(new - old, 2) - diff) > 0.011:
        raise SystemExit(f"{label} 줄의 차이 값이 맞지 않습니다")
    rows.append({"bin": label, "old": old, "new": new, "diff": diff})

tvd = sum(abs(r["diff"]) for r in rows) / 2
if abs(tvd - res["fame_tvd_new_vs_old"]) > 0.02:
    raise SystemExit(f"총차이가 집계 파일과 어긋납니다 {tvd} vs {res['fame_tvd_new_vs_old']}")

res["bin_old_vs_new"] = rows
target.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"backfill: 구간 {len(rows)}개 기록, 총차이 {tvd:.2f}%포인트 대조 통과")
