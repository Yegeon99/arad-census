# -*- coding: utf-8 -*-
"""직업 기준을 마지막 전직 완료로 바꾼 뒤, 직업 관련 인사이트만 다시 쓴다 (배치 1회).

대상은 1, 4, 5번. 나머지는 손대지 않는다.
쓸 수 있는 수치를 미리 확정해 넘기고, 모델은 문장만 다시 쓴다.
검사에 걸리면 저장하지 않는다.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.llm import get_client, check_budget, record_call, parse_json_array
from scripts.rewrite_insights import SYSTEM, validate, FIELDS  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "report" / "src" / "derived" / "insights.json"
FACTS_PATH = ROOT / "report" / "content" / "insight_facts.json"
MODEL = "claude-haiku-4-5"

NEW = {
    1: {
        "source": (
            "마지막 전직을 마친 캐릭터 29,527명 가운데 크루세이더가 2,281명으로 7.7%를 차지해 가장 많습니다. "
            "상위 5개 직업은 크루세이더, 다크템플러, 넨마스터, 브레이커, 스위프트 마스터이고 "
            "다섯 직업을 합치면 7,480명으로 25.3%입니다."
        ),
        "guard": (
            "막 만든 캐릭터를 빼고 성장을 마친 캐릭터만 센 순위라는 점을 밝힙니다. "
            "잘린 검색의 쏠림 때문에 이 순위를 게임 전체 인구 순위라고 말할 수 없습니다."
        ),
        "numbers": ["29,527", "2,281", "7.7", "7,480", "25.3"],
        "keyNumber": "7.7%, 2,281명",
    },
    4: {
        "source": (
            "마지막 전직을 마친 캐릭터 29,527명 가운데 쏠림 없는 표본은 3,812명입니다. "
            "크루세이더 비중은 두 표본에서 모두 7.7%로 같습니다. "
            "사령술사는 전체 0.8%, 쏠림 없는 표본 0.9%로 거의 차이가 없습니다."
        ),
        "guard": (
            "성장을 마친 캐릭터만 놓고 보면 검색 방식에 따른 직업 구성 차이가 거의 사라진다는 점을 말합니다. "
            "앞서 커 보이던 차이가 성장 단계가 섞여 있던 탓일 수 있다고만 적고, 원인을 단정하지 않습니다."
        ),
        "numbers": ["29,527", "3,812", "7.7", "0.8", "0.9"],
        "keyNumber": "7.7%와 7.7%",
    },
    5: {
        "source": (
            "직업별 성장 단계 구성은 여전히 다릅니다. 크루세이더는 명성 점수가 있는 2,219명 가운데 "
            "레기온 입장 전이 883명 39.8%, 아포칼립스 입장 이상이 1,336명 60.2%입니다. "
            "사령술사는 211명 가운데 레기온 입장 전이 99명 46.9%, 아포칼립스 입장 이상이 112명 53.1%입니다. "
            "사령술사는 표본이 10명 미만이라 공개하지 않은 칸이 하나 있어 아포칼립스 입장 이상 값은 최소값입니다."
        ),
        "guard": (
            "마지막 전직을 마친 캐릭터만 센 값이라는 점을 밝힙니다. "
            "난이도나 게임 안에서의 위치를 원인으로 단정하지 않습니다."
        ),
        "numbers": ["2,219", "883", "39.8", "1,336", "60.2", "211", "99", "46.9", "112", "53.1", "10"],
        "keyNumber": "60.2%와 53.1%",
    },
}


def run():
    check_budget()
    facts = json.loads(FACTS_PATH.read_text(encoding="utf-8"))
    by_id = {f["id"]: f for f in facts}
    for i, spec in NEW.items():
        by_id[i]["source"] = spec["source"]
        by_id[i]["guard"] = spec["guard"]
        by_id[i]["numbers"] = spec["numbers"]

    targets = [by_id[i] for i in sorted(NEW)]
    payload = [{"id": f["id"], "source": f["source"], "guard": f["guard"],
                "allowed_numbers": f["numbers"]} for f in targets]
    user = ("아래 항목의 문장을 규칙대로 다시 씁니다.\n\n"
            + json.dumps(payload, ensure_ascii=False, indent=1))

    client = get_client()
    resp = client.messages.create(model=MODEL, max_tokens=3000, system=SYSTEM,
                                  messages=[{"role": "user", "content": user}])
    cost = record_call(MODEL, resp.usage, "insight_rewrite_final")
    items = parse_json_array("".join(b.text for b in resp.content if b.type == "text"))
    validate(items, targets)

    written = json.loads(OUT.read_text(encoding="utf-8"))
    by_out = {w["id"]: w for w in written}
    for got in items:
        w = by_out[got["id"]]
        for f in ("title", "finding", "interpretation", "validation", "nextQuestion"):
            w[f] = got[f].strip()
        w["keyNumber"] = NEW[got["id"]]["keyNumber"]

    FACTS_PATH.write_text(json.dumps(facts, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT.write_text(json.dumps(written, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"인사이트 {sorted(NEW)}번 재작성 (비용 ${cost:.4f}, "
          f"입력 {resp.usage.input_tokens} / 출력 {resp.usage.output_tokens} 토큰)")


if __name__ == "__main__":
    run()
