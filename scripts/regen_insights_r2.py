# -*- coding: utf-8 -*-
"""두 번째 회차 기준으로 인사이트 여덟 개를 전부 다시 만든다.

입력에 이번 회차 집계, 상한 보정, 회차 비교를 함께 넣는다.
배치 1회로 끝내고, 숫자가 허용 목록을 벗어나면 저장하지 않는다.

    python scripts/regen_insights_r2.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.insights import MODEL  # noqa: E402
from pipeline.llm import check_budget, get_client, parse_json_array, record_call  # noqa: E402

INS = ROOT / "report" / "src" / "derived" / "insights.json"
FACTS = ROOT / "report" / "content" / "insight_facts.json"

facts = json.loads(FACTS.read_text(encoding="utf-8"))
rounds = json.loads((ROOT / "data" / "rounds.json").read_text(encoding="utf-8"))
cap = json.loads((ROOT / "data" / "cap_correct.json").read_text(encoding="utf-8"))
split = json.loads((ROOT / "data" / "phase2_sample.json").read_text(encoding="utf-8"))

브리핑 = {
    "이번_회차": {
        "표본": rounds["second"]["sample_size"],
        "성장을_마친_캐릭터": rounds["second"]["final_stage_size"],
        "시드": rounds["second"]["seeds"],
        "이름에_한글이_든_캐릭터_중_닿은_비율": rounds["second"]["coverage_pct"],
        "상한에_걸린_검색_비중": rounds["second"]["limited_pct"],
    },
    "처음_회차": {
        "표본": rounds["first"]["sample_size"],
        "시드": rounds["first"]["seeds"],
        "닿은_비율": rounds["first"]["coverage_pct"],
        "상한에_걸린_검색_비중": rounds["first"]["limited_pct"],
        "무엇이_잘못됐나": "시드로 고른 낱말이 직업과 맞물려 직업 구성이 기울었고, 그물이 성겨 닿는 범위가 매우 좁았다",
    },
    "상한_보정": {
        "무엇인가": "검색이 200명에서 잘리며 가려진 몫을 되돌려 다시 잡은 값",
        "어떻게_쟀나": "상한에 걸린 검색 400개를 직업군 18종으로 쪼개 다시 불러, 원래 200명 안에 있던 캐릭터와 새로 드러난 캐릭터를 견줬다",
        "쪼갠_뒤_한_조합당_평균": round(200 * split["multiplier_mean"]),
        "배수": split["multiplier_mean"],
        "쪼갠_뒤에도_상한에_걸린_비율": split["still_capped_pct"],
        "새로_드러난_캐릭터의_구간_구성": split["bin_old_vs_new"],
        "관측_구간_비중": cap["bin_share_uncapped_only"],
        "보정_구간_비중": cap["bin_share_cap_corrected"],
        "한계": "표본 400개에서 잰 배수를 상한 도달 조합 전체에 적용한 추정이고, 쪼갠 뒤에도 일부는 여전히 상한에 걸려 있다",
    },
    "회차_비교": {
        "직업_구성_차이": {"처음": rounds["first"]["job_tvd"], "이번": rounds["second"]["job_tvd"]},
        "성장_단계_차이": {"처음": rounds["first"]["fame_tvd"], "이번": rounds["second"]["fame_tvd"]},
        "상한을_걷어낼수록_명성_방식에서_멀어진다": rounds["fame_method_tvd"],
        "왜_멀어지나": "명성 방식도 90일 넘게 접속하지 않은 캐릭터를 못 보는데, 상한이 가리던 것이 바로 그 층이다. 처음 회차에서 잘 맞아 보이던 것은 두 편향이 상쇄된 결과다",
        "틀렸던_예측": [
            "직업군으로 쪼개도 상한을 못 벗어날 것으로 봤으나 실제로는 대부분 벗어났다",
            "명성 방식을 정답지로 삼으려 했으나 같은 층을 못 보아 기준이 될 수 없다",
        ],
    },
}

SYSTEM = """당신은 표본조사 리포트의 문장을 쓰는 사람이다.
두 번째 회차 결과로 인사이트 여덟 개를 전부 새로 쓴다.

출력은 JSON 배열만. 각 원소:
{"id": 정수, "title": "", "finding": "", "interpretation": "", "validation": "",
 "nextQuestion": "", "confidence": "", "keyNumber": ""}

절대 규칙
1. 숫자는 각 항목에 주어진 허용 목록 안의 것만 쓴다. 목록 밖 숫자는 절대 금지.
   숫자를 새로 계산하지 않는다. 목록에 없으면 숫자 없이 서술한다.
2. title 에는 숫자를 하나도 넣지 않는다.
3. nextQuestion 은 물음표로 끝나는 한 문장.
4. confidence 는 주어진 값을 그대로 쓴다.
5. keyNumber 는 그 항목에서 가장 중요한 수치 한두 개를 짧게 적는다. 허용 목록 안에서만.
6. 원인 단정 금지. "~일 수 있습니다", "~가능성이 있습니다" 어투를 쓴다.
7. 줄표와 붙임표를 쓰지 않는다. 코드 이름이나 영문 식별자를 쓰지 않는다.
8. 쉬운 말로 쓴다. 전문 용어 대신 풀어 쓴다.
9. 소제목을 의문형으로 쓰지 않는다. title 은 평서문으로 끝낸다.
10. guard 에 적힌 단서는 validation 에 반드시 담는다.
11. 처음 회차 수치를 부정하지 않는다. 나란히 놓고 무엇이 달라졌는지 적는다.
12. finding 은 관측된 사실만, interpretation 은 그 사실의 뜻만 적는다."""

payload = {
    "배경": 브리핑,
    "쓸_항목": [
        {
            "id": f["id"],
            "confidence": f["confidence"],
            "근거": f["source"],
            "반드시_담을_단서": f["guard"],
            "허용숫자": f["numbers"],
        }
        for f in facts
    ],
}

check_budget()
client = get_client()
resp = client.messages.create(
    model=MODEL,
    max_tokens=6000,
    system=SYSTEM,
    messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
)
cost = record_call(MODEL, resp.usage, "regen_insights_r2")
out = parse_json_array(resp.content[0].text)

GLOBAL = {"1", "2", "3", "4", "5", "6", "7", "8", "18", "30", "90", "110", "200"}
FIELDS = ["title", "keyNumber", "finding", "interpretation", "validation", "nextQuestion"]
ASK_ENDINGS = ("는가", "은가", "인가")

by_id = {o["id"]: o for o in out}
problems = []
for f in facts:
    i = f["id"]
    o = by_id.get(i)
    if o is None:
        problems.append(f"{i}번이 응답에 없음")
        continue
    blob = " ".join(o[k] for k in FIELDS)
    stray = sorted({x for x in re.findall(r"\d[\d,]*(?:\.\d+)?", blob)
                    if x not in set(f["numbers"]) | GLOBAL})
    if stray:
        problems.append(f"{i}번 허용 목록 밖 숫자 {stray}")
    if re.search(r"\d", o["title"]):
        problems.append(f"{i}번 제목에 숫자")
    if o["title"].rstrip().endswith(ASK_ENDINGS):
        problems.append(f"{i}번 제목이 의문형")
    if not o["nextQuestion"].rstrip().endswith("?"):
        problems.append(f"{i}번 다음 질문이 물음표로 안 끝남")
    if o["confidence"] != f["confidence"]:
        problems.append(f"{i}번 확신 표기가 지정과 다름")
    for bad in ("—", "–", "ㅡ"):
        if bad in blob:
            problems.append(f"{i}번에 줄표")

print(f"입력 {resp.usage.input_tokens} 토큰, 출력 {resp.usage.output_tokens} 토큰, 비용 ${cost:.6f}")
if problems:
    print("검사 실패, 저장하지 않았습니다")
    for x in problems:
        print("  ", x)
    sys.exit(1)

items = [
    {
        "id": f["id"],
        "confidence": f["confidence"],
        "focus": f["focus"],
        **{k: by_id[f["id"]][k] for k in
           ("title", "keyNumber", "finding", "interpretation", "validation", "nextQuestion")},
    }
    for f in facts
]
INS.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"검사 통과, 인사이트 {len(items)}개 저장 완료")
