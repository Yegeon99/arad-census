# -*- coding: utf-8 -*-
"""문서 안의 링크, 앵커, 이미지가 실제로 가리키는 곳이 있는지 확인한다."""

import re
import sys
from pathlib import Path

DOCS = ("README.md", "docs/findings.md", "data/README.md")


def slug(h):
    """GitHub 이 제목에서 앵커를 만드는 방식과 같게 맞춘다."""
    s = h.strip().lower()
    s = re.sub(r"[^\w\s\-가-힣]", "", s, flags=re.UNICODE)
    return s.replace(" ", "-")


heads = {}
for f in DOCS:
    t = Path(f).read_text(encoding="utf-8")
    heads[f] = {slug(m.group(2)) for m in re.finditer(r"^(#{1,6})\s+(.+)$", t, re.M)}

bad = 0
for f in DOCS:
    t = Path(f).read_text(encoding="utf-8")
    base = Path(f).parent
    for m in re.finditer(r"(!?)\[([^\]]*)\]\(([^)]+)\)", t):
        is_img, target = m.group(1) == "!", m.group(3)
        if target.startswith("http"):
            continue
        path, _, anchor = target.partition("#")
        tgt = (base / path).resolve() if path else Path(f).resolve()
        if path and not tgt.exists():
            print(f"  문제 {f}: 대상 없음 {target}")
            bad += 1
            continue
        if is_img:
            continue
        if anchor:
            key = tgt.relative_to(Path(".").resolve()).as_posix()
            if key in heads and anchor not in heads[key]:
                print(f"  문제 {f}: 앵커 없음 {target}")
                bad += 1

print(f"링크와 이미지 검사: 문제 {bad}건")
sys.exit(1 if bad else 0)
