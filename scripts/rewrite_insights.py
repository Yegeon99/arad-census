# -*- coding: utf-8 -*-
"""AI 인사이트 문장 재작성 (배치 1회).

집계 수치는 손대지 않는다. 각 인사이트에 쓸 수 있는 수치 표기를 미리 확정해
모델에 넘기고, 모델은 문장만 다시 쓴다. 재작성 결과는 리포트 전용 파일
report/src/derived/insights.json 에만 저장하며 집계 산출물은 건드리지 않는다.

검사: 구조, 금지 표현, 수치 전수 대조 (허용 목록 밖 숫자가 나오면 저장 중단).
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.llm import get_client, check_budget, record_call, parse_json_array

ROOT = Path(__file__).resolve().parent.parent
CENSUS = ROOT / "data" / "census_2026-08.json"
OUT = ROOT / "report" / "src" / "derived" / "insights.json"
FACTS_OUT = ROOT / "report" / "content" / "insight_facts.json"
MODEL = "claude-haiku-4-5"

FORBIDDEN = ["—", "–", "ㅡ", "§", "n=", "capped", "uncapped",
             "reweighted", "job_x_fame", "small_sample", "비상한",
             "레기온 미만", "가중 재추정",
             "자각1", "관찰", "가설", "과대 대표",
             "과소 대표", "상한", "휴면",
             "주간 활성", "월간 활성", "저활성",
             "미카엘라", "표본 소"]

# 구조적으로 늘 쓰이는 숫자 (구간 수, 기준 일수, 서버 수, 검색 한도 등)
GLOBAL_NUMBERS = {"1", "2", "3", "4", "5", "6", "7", "8", "30", "90", "200"}

FIELDS = ["title", "finding", "interpretation", "validation", "nextQuestion"]


def facts():
    """인사이트 8개별 근거 수치와 화면 표기를 확정한다."""
    return [
        {
            "id": 1,
            "confidence": "데이터에서 확인됨",
            "focus": "topJobs",
            "source": (
                "전체 표본 31,523명 가운데 크루세이더가 2,373명으로 7.5%를 차지해 가장 많습니다. "
                "상위 5개 직업은 크루세이더, 다크템플러, 넨마스터, 브레이커, 스위프트 마스터이고 "
                "다섯 직업을 합치면 7,670명으로 24.3%입니다."
            ),
            "guard": (
                "검색 한도 편향 때문에 이 순위가 게임 전체 인구 순위라고 말할 수 없습니다. "
                "표본 안에서의 상대 비교로만 서술합니다."
            ),
            "numbers": ["31,523", "2,373", "7.5", "7,670", "24.3"],
        },
        {
            "id": 2,
            "confidence": "추가 검증 필요",
            "focus": "famePyramid",
            "source": (
                "명성값이 있는 표본 30,082명 기준으로 레기온 입장 전 구간이 13,483명 44.8%입니다. "
                "상급 던전 구간부터 하드 권장 구간까지를 합치면 10,984명 36.5%입니다. "
                "완전 검색 표본에서는 레기온 입장 전 비중이 79.5%로 훨씬 큽니다. "
                "명성값이 없어 분포에서 제외한 1,441명 가운데 43.5%가 레벨 100 미만입니다."
            ),
            "guard": "표본이 위쪽으로 기울어 있을 가능성을 말할 뿐, 실제 인구 비중을 단정하지 않습니다.",
            "numbers": ["30,082", "13,483", "44.8", "10,984", "36.5", "79.5", "1,441", "43.5", "100"],
        },
        {
            "id": 3,
            "confidence": "추가 검증 필요",
            "focus": "activityByBin",
            "source": (
                "명성 구간이 올라갈수록 접속 기록이 뚜렷하게 촘촘해집니다. "
                "레기온 입장 전 구간은 269명 중 78.4%가 90일 넘게 기록이 없고, "
                "레이드 권장 구간은 52명 중 90일 넘게 기록이 없는 비중이 0.0%이며, "
                "하드 권장 구간은 11명 전원인 100.0%가 최근 7일 안에 기록을 남겼습니다."
            ),
            "guard": (
                "확인 방법에는 두 가지를 반드시 넣습니다. "
                "첫째 명성 구간별 기록 밀도 차이 확인, 둘째 검색 노출이 최근 접속과 연결되는지 확인입니다. "
                "완전 검색 표본 82명의 90일 넘게 기록 없음 비중 75.6%와 한도 검색 518명의 34.6% 차이도 함께 언급합니다."
            ),
            "numbers": ["269", "78.4", "52", "0.0", "11", "100.0", "75.6", "34.6", "82", "518"],
        },
        {
            "id": 4,
            "confidence": "추가 검증 필요",
            "focus": "jobCompare",
            "source": (
                "사령술사는 전체 표본에서 332명 1.1%인데 완전 검색 표본에서는 144명 2.7%로 "
                "상대 비중이 2.6배로 커집니다. 크루세이더는 반대로 전체 표본 2,373명 7.5%에서 "
                "완전 검색 표본 358명 6.7%로 오히려 줄어듭니다."
            ),
            "guard": "직업 인기나 신규 유입을 단정하지 않고, 발견 경로에 따른 구성 차이로만 서술합니다.",
            "numbers": ["332", "1.1", "144", "2.7", "2.6", "7.5", "6.7", "358", "2,373"],
        },
        {
            "id": 5,
            "confidence": "데이터에서 확인됨",
            "focus": "jobFameProfile",
            "source": (
                "직업별 명성 구간 구성이 서로 크게 다릅니다. 크루세이더는 2,373명 가운데 "
                "레기온 입장 전이 941명 39.7%, 아포칼립스 입장 이상이 1,336명 56.3%입니다. "
                "사령술사는 332명 가운데 레기온 입장 전이 203명 61.1%, 아포칼립스 입장 이상이 112명 33.7%입니다. "
                "사령술사는 표본이 10명 미만이라 공개하지 않은 칸이 하나 있어 아포칼립스 입장 이상 값은 최소값입니다."
            ),
            "guard": "난이도나 게임 안에서의 위치를 원인으로 단정하지 않습니다.",
            "numbers": ["2,373", "941", "39.7", "1,336", "56.3", "332", "203", "61.1", "112", "33.7", "10"],
        },
        {
            "id": 6,
            "confidence": "추가 검증 필요",
            "focus": "activityAdjust",
            "source": (
                "활성도 조사 600명 기준으로 90일 넘게 기록이 없는 비중은 보정 전 40.2%인데 "
                "편향 보정값은 64.6%로 24.4%p 높습니다. 최근 7일 접속은 보정 전 39.2%에서 "
                "보정 후 17.7%로 21.5%p 떨어집니다."
            ),
            "guard": "보정값도 기록 밀도 차이와 검색 노출 조건을 제거하지 못한다는 점을 함께 적습니다.",
            "numbers": ["600", "40.2", "64.6", "24.4", "39.2", "17.7", "21.5"],
        },
        {
            "id": 7,
            "confidence": "데이터에서 확인됨",
            "focus": "activityExtremes",
            "source": (
                "구간 사이 격차가 극단적입니다. 하드 권장 구간은 11명 전원이 최근 7일 안에 기록을 남겨 100.0%이고, "
                "레이드 권장 구간은 52명 중 50명 96.2%가 최근 7일 접속이며 90일 넘게 기록이 없는 비중은 0.0%입니다. "
                "레기온 입장 전 구간은 269명 중 211명 78.4%가 90일 넘게 기록이 없습니다."
            ),
            "guard": "하드 권장 구간은 11명뿐이라 참고용이라는 점을 발견 문장 안에 밝힙니다.",
            "numbers": ["11", "100.0", "52", "50", "96.2", "0.0", "269", "211", "78.4"],
        },
        {
            "id": 8,
            "confidence": "데이터에서 확인됨",
            "focus": "searchLimit",
            "source": (
                "검색 288회 가운데 132회가 200명 한도에 걸렸습니다. 비율로는 45.8%입니다. "
                "활성도 조사 600명을 발견 경로로 나누면 한도 검색에서만 발견된 캐릭터가 518명 86.3%, "
                "완전 검색에서도 발견된 캐릭터가 82명 13.7%입니다."
            ),
            "guard": "한도에 걸렸을 때 어떤 200명이 돌아오는지는 공개되어 있지 않다는 사실을 적습니다.",
            "numbers": ["288", "132", "45.8", "600", "518", "86.3", "82", "13.7"],
        },
    ]


SYSTEM = """당신은 통계조사 리포트의 국문 카피라이터입니다.
이미 검증이 끝난 수치는 그대로 두고, 문장만 읽히게 다시 씁니다.

출력은 JSON 배열만 냅니다. 앞뒤 설명을 붙이지 않습니다.
배열 원소는 입력으로 준 항목과 같은 순서, 같은 개수입니다.
각 원소의 필드는 다음과 같습니다.

{
  "id": 입력의 id 숫자 그대로,
  "title": "무엇을 발견했는가만 담은 한 줄 제목, 숫자를 넣지 않습니다, 20자 안팎",
  "finding": "발견 두 문장",
  "interpretation": "해석 두 문장",
  "validation": "이렇게 확인할 수 있습니다에 이어질 본문, 한 문장에서 두 문장",
  "nextQuestion": "다음 질문 한 문장, 물음표로 끝냅니다"
}

글쓰기 규칙입니다.
1. 문장은 쉼표와 마침표로만 잇습니다. 줄표, 붙임표, 물결표, 화살표, 괄호 안의 괄호를 쓰지 않습니다.
2. 문체는 합니다체와 입니다체로 통일합니다.
3. 주어진 source 안에 있는 수치만 씁니다. 새 숫자를 만들거나 계산하지 않습니다.
   수치 표기는 source에 적힌 형태를 그대로 옮깁니다.
4. 백분율은 퍼센트로, 인원은 명으로 적습니다. 퍼센트끼리의 차이는 퍼센트포인트로 적습니다.
5. 해석은 단정하지 않습니다. 보입니다, 가능성이 있습니다 수준으로 씁니다.
6. guard에 적힌 주의사항을 반드시 문장에 반영합니다.
7. 다음 표현을 쓰지 않습니다. 비상한, 레기온 미만, 상한, 휴면, 주간 활성, 월간 활성,
   저활성, 미카엘라, 가중 재추정, 관찰, 가설, 과대 대표, 과소 대표, 자각1,
   그리고 영문 코드 이름과 영문 약어.
8. 조사 단위는 캐릭터이며 유저가 아닙니다. 유저 수로 말하지 않습니다.
9. 각 필드는 서로 다른 말로 씁니다. 같은 문장을 되풀이하지 않습니다."""


def numbers_in(text: str):
    return re.findall(r"\d[\d,]*(?:\.\d+)?", text)


def validate(items, spec):
    if len(items) != len(spec):
        raise ValueError(f"인사이트 수 {len(items)}개 — {len(spec)}개 요구")
    for got, want in zip(items, spec):
        tag = f"인사이트 {want['id']}"
        if got.get("id") != want["id"]:
            raise ValueError(f"{tag}: id 불일치 {got.get('id')}")
        for f in FIELDS:
            if not isinstance(got.get(f), str) or not got[f].strip():
                raise ValueError(f"{tag}: {f} 비어 있음")
        blob = " ".join(got[f] for f in FIELDS)
        bad = [t for t in FORBIDDEN if t in blob]
        if bad:
            raise ValueError(f"{tag}: 금지 표현 {bad}")
        if numbers_in(got["title"]):
            raise ValueError(f"{tag}: 제목에 숫자가 들어감")
        if not got["nextQuestion"].rstrip().endswith("?"):
            raise ValueError(f"{tag}: 다음 질문이 물음표로 끝나지 않음")
        allowed = set(want["numbers"]) | GLOBAL_NUMBERS
        stray = [n for n in numbers_in(blob) if n not in allowed]
        if stray:
            raise ValueError(f"{tag}: 허용 목록 밖 숫자 {sorted(set(stray))}")


def run():
    check_budget()
    spec = facts()
    FACTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    FACTS_OUT.write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")

    payload = [{"id": s["id"], "source": s["source"], "guard": s["guard"],
                "allowed_numbers": s["numbers"]} for s in spec]
    user = ("아래 8개 항목의 문장을 규칙대로 다시 씁니다.\n\n"
            + json.dumps(payload, ensure_ascii=False, indent=1))

    client = get_client()
    resp = client.messages.create(model=MODEL, max_tokens=6000, system=SYSTEM,
                                  messages=[{"role": "user", "content": user}])
    cost = record_call(MODEL, resp.usage, "insight_rewrite")
    text = "".join(b.text for b in resp.content if b.type == "text")
    items = parse_json_array(text)
    validate(items, spec)

    out = []
    for got, want in zip(items, spec):
        out.append({
            "id": want["id"],
            "title": got["title"].strip(),
            "finding": got["finding"].strip(),
            "interpretation": got["interpretation"].strip(),
            "validation": got["validation"].strip(),
            "nextQuestion": got["nextQuestion"].strip(),
            "confidence": want["confidence"],
            "focus": want["focus"],
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"인사이트 {len(out)}개 재작성 저장 (비용 ${cost:.4f}, "
          f"입력 {resp.usage.input_tokens} / 출력 {resp.usage.output_tokens} 토큰)")


if __name__ == "__main__":
    run()
