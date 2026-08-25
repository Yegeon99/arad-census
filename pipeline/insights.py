# -*- coding: utf-8 -*-
"""CS-4 AI 인사이트 생성기.

집계 전체(census JSON) + bias_notes.md를 입력으로 인사이트 5~8개를 생성해
census JSON의 insights 필드에 기록한다. 배치 1회 호출, 비용 기록.

정직성 (지침서 절대 규칙 7):
- confidence(관찰/가설) 필수, 단정 금지, needed_validation 필수
- 생성 후 스키마 검증 실패 시 저장하지 않고 중단
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.llm import get_client, check_budget, record_call, parse_json_array

ROOT = Path(__file__).resolve().parent.parent
CENSUS_PATH = ROOT / "data" / "census_2026-08.json"
BIAS_PATH = ROOT / "data" / "bias_notes.md"
PROMPT_PATH = ROOT / "pipeline" / "prompts" / "insight_system.txt"

MODEL = "claude-haiku-4-5"
REQUIRED = {"finding", "interpretation", "confidence", "needed_validation", "follow_up"}


def slim_census(census: dict) -> dict:
    """입력 토큰 절약: 교차표는 마스킹·0 셀 제외, 나머지는 전체 유지."""
    slim = json.loads(json.dumps(census, ensure_ascii=False))
    slim.pop("insights", None)
    xt = slim["distributions"]["job_x_fame"]
    slim["distributions"]["job_x_fame"] = [
        c for c in xt if c.get("count") not in (None, 0)
    ]
    slim["distributions"]["job_x_fame_note"] = "0셀·마스킹 셀 생략됨"
    return slim


def validate(insights: list):
    if not (5 <= len(insights) <= 8):
        raise ValueError(f"인사이트 수 {len(insights)} — 5~8개 요구")
    for i, ins in enumerate(insights):
        missing = REQUIRED - set(ins)
        if missing:
            raise ValueError(f"인사이트 {i}: 필드 누락 {missing}")
        if ins["confidence"] not in ("관찰", "가설"):
            raise ValueError(f"인사이트 {i}: confidence 값 오류 {ins['confidence']!r}")


def run():
    check_budget()
    census = json.loads(CENSUS_PATH.read_text(encoding="utf-8"))
    system = PROMPT_PATH.read_text(encoding="utf-8")
    user = (
        "## 집계 결과 (census JSON)\n"
        + json.dumps(slim_census(census), ensure_ascii=False)
        + "\n\n## 편향 노트 (bias_notes.md)\n"
        + BIAS_PATH.read_text(encoding="utf-8")
        + "\n\n위 집계와 편향 노트를 바탕으로 인사이트 JSON 배열을 출력하라."
    )

    client = get_client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    cost = record_call(MODEL, resp.usage, "insights")
    text = "".join(b.text for b in resp.content if b.type == "text")
    insights = parse_json_array(text)
    validate(insights)

    census["insights"] = insights
    CENSUS_PATH.write_text(json.dumps(census, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"인사이트 {len(insights)}개 저장 (비용 ${cost:.4f}, "
          f"입력 {resp.usage.input_tokens} / 출력 {resp.usage.output_tokens} 토큰)")


if __name__ == "__main__":
    run()
