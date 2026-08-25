# -*- coding: utf-8 -*-
import json
from pathlib import Path

c = json.loads((Path(__file__).resolve().parent.parent / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
for i, x in enumerate(c["insights"], 1):
    print(f"[{i}] ({x['confidence']}) {x['finding']}")
    print("   해석:", x["interpretation"])
    print("   검증:", x["needed_validation"])
    print("   질문:", x["follow_up"])
    print()
