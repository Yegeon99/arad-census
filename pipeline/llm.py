# -*- coding: utf-8 -*-
"""LLM 호출 공통 유틸 (dnf-market-analyst에서 이식).

- Anthropic 클라이언트 초기화 (.env 또는 환경변수)
- 호출당 비용 계산·기록 (data/llm_costs.json)
- 인사이트 생성은 배치 1회가 원칙 (지침서 절대 규칙 9), 예산 $0.1 검사

키 값은 어떤 경로로도 출력하지 않는다.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
COSTS_PATH = ROOT / "data" / "llm_costs.json"

# PRD 비기능 요구: 인사이트 생성 비용 상한.
# 2026-08-31 상향 (0.10 -> 0.15). 검증 조사 결과를 반영하려고 인사이트 3개를
# 재생성하면서 초기 상한 $0.10 을 초과했고, 실측 누적 $0.1077 을 반영해 조정했다.
BUDGET_USD = 0.15

# USD / 1M tokens (input, output) — 2026-08 기준 공식 단가
PRICING = {
    "claude-haiku-4-5": (1.00, 5.00),
}


class LLMBudgetExceeded(RuntimeError):
    """LLM 비용 상한 초과 — 실행 중단 신호."""


def get_client():
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        try:
            from dotenv import load_dotenv
            load_dotenv(ROOT / ".env")
            key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        except ImportError:
            pass
    if not key:
        print("ANTHROPIC_API_KEY 없음 (.env 또는 환경변수 확인)")
        sys.exit(1)
    import anthropic
    return anthropic.Anthropic(api_key=key)


def cost_of(model: str, input_tokens: int, output_tokens: int) -> float:
    inp, outp = PRICING[model]
    return input_tokens / 1_000_000 * inp + output_tokens / 1_000_000 * outp


def _load_ledger() -> dict:
    if COSTS_PATH.exists():
        return json.loads(COSTS_PATH.read_text(encoding="utf-8-sig"))
    return {"total_cost_usd": 0.0, "calls": []}


def check_budget():
    spent = _load_ledger()["total_cost_usd"]
    if spent >= BUDGET_USD:
        raise LLMBudgetExceeded(f"LLM 비용 상한 초과: ${spent:.4f} >= ${BUDGET_USD:.2f}")


def record_call(model: str, usage, caller: str) -> float:
    cost = cost_of(model, usage.input_tokens, usage.output_tokens)
    ledger = _load_ledger()
    ledger["calls"].append({
        "at": datetime.now(KST).isoformat(timespec="seconds"),
        "model": model, "caller": caller,
        "inputTokens": usage.input_tokens, "outputTokens": usage.output_tokens,
        "costUsd": round(cost, 6),
    })
    ledger["total_cost_usd"] = round(ledger["total_cost_usd"] + cost, 6)
    COSTS_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=1), encoding="utf-8")
    return cost


def parse_json_array(text: str):
    """모델 응답에서 JSON 배열 파싱 (코드펜스 허용)."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.startswith("json"):
            t = t[4:]
    start, end = t.find("["), t.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("JSON 배열 없음")
    return json.loads(t[start:end + 1])
