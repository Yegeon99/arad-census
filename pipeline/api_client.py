# -*- coding: utf-8 -*-
"""Neople Open API 클라이언트 (dnf-market-analyst에서 이식).

API 매너 (지침서 절대 규칙 5):
- 호출 간 0.3초 대기
- 재시도 1회 (백오프 2초)
- 키는 로그에 절대 남기지 않는다
"""

import logging
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
API_BASE = "https://api.neople.co.kr"

CALL_INTERVAL_SEC = 0.3
RETRY_LIMIT = 1
RETRY_BACKOFF_SEC = 2.0
TIMEOUT_SEC = 15

log = logging.getLogger("api_client")


def load_api_key() -> str:
    key = os.environ.get("NEOPLE_API_KEY", "").strip()
    if not key:
        try:
            from dotenv import load_dotenv
            load_dotenv(ROOT / ".env")
            key = os.environ.get("NEOPLE_API_KEY", "").strip()
        except ImportError:
            pass
    if not key:
        log.error("NEOPLE_API_KEY가 없습니다 (.env 또는 환경변수 확인)")
        sys.exit(1)
    return key


class NeopleClient:
    """호출 카운트·대기·재시도를 내장한 클라이언트."""

    def __init__(self, key: str | None = None):
        self.key = key or load_api_key()
        self.session = requests.Session()
        self.call_count = 0
        self.fail_count = 0
        self._last_call = 0.0

    def get(self, path: str, params: dict | None = None):
        """대기 → GET → 실패 시 1회 재시도. HTTP 오류는 (status, body) 포함 예외."""
        params = dict(params or {}, apikey=self.key)
        last_err = None
        for attempt in range(RETRY_LIMIT + 1):
            wait = CALL_INTERVAL_SEC - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()
            self.call_count += 1
            try:
                resp = self.session.get(f"{API_BASE}{path}", params=params, timeout=TIMEOUT_SEC)
                if resp.status_code == 200:
                    return resp.json()
                last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
            except requests.RequestException as exc:
                last_err = type(exc).__name__
            if attempt < RETRY_LIMIT:
                time.sleep(RETRY_BACKOFF_SEC)
        self.fail_count += 1
        raise RuntimeError(last_err)

    # --- 캐릭터 조사용 엔드포인트 ---

    def servers(self):
        return self.get("/df/servers")

    def search_characters(self, server_id: str, name: str, word_type: str = "match", limit: int = 200):
        return self.get(
            f"/df/servers/{server_id}/characters",
            {"characterName": name, "wordType": word_type, "limit": limit},
        )

    def character_basic(self, server_id: str, character_id: str):
        return self.get(f"/df/servers/{server_id}/characters/{character_id}")

    def character_timeline(self, server_id: str, character_id: str, limit: int = 10, **extra):
        return self.get(
            f"/df/servers/{server_id}/characters/{character_id}/timeline",
            {"limit": limit, **extra},
        )
