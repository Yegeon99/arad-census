# -*- coding: utf-8 -*-
"""검증 결과를 반영해 활성도 인사이트 세 개(3, 6, 7)만 다시 생성한다.

전체 배치가 아니라 세 항목만 겨냥한 소형 배치 1회다. 예산이 거의 다 찼기 때문이다.
나머지 다섯 인사이트는 손대지 않는다.

생성 뒤 숫자는 허용 목록과 대조하고, 통과하지 못하면 저장하지 않는다.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.insights import MODEL  # noqa: E402
from pipeline.llm import check_budget, get_client, parse_json_array, record_call  # noqa: E402

INS = ROOT / "report" / "src" / "derived" / "insights.json"
FACTS = ROOT / "report" / "content" / "insight_facts.json"
VERIFY = ROOT / "data" / "verification_2026-08.json"
TARGET = [3, 6, 7]

items = json.loads(INS.read_text(encoding="utf-8"))
facts = {f["id"]: f for f in json.loads(FACTS.read_text(encoding="utf-8"))}
verify = json.loads(VERIFY.read_text(encoding="utf-8"))
census = json.loads((ROOT / "data" / "census_2026-08.json").read_text(encoding="utf-8"))

act = census["activity"]
brief = {
    "검증조사": {
        "방법": "명성 점수 축을 일정 간격으로 훑어 각 지점의 캐릭터를 전수 수집",
        "요청수": verify["meta"]["api_calls"],
        "표본": verify["meta"]["sample_size"],
        "제약": "레벨 110 이상이면서 최근 90일 안에 접속한 캐릭터만 보인다",
        "성장단계분포_총차이_퍼센트포인트": verify["fame_tvd"],
        "직업구성_총차이_퍼센트포인트": verify["job_tvd"],
        "휴면판정_역산": verify["dormancy"],
    },
    "활성도_원자료": {
        "표본": act["subsample_size"],
        "전체": {x["label"]: x["pct"] for x in act["overall"]},
        "보정후": act["reweighted_by_uncapped"]["pct"],
        "구간별": [{"구간": b["bin"], "표본": b["n"], "휴면": b["pct"].get("휴면", 0.0),
                  "주간활성": b["pct"].get("주간 활성", 0.0)} for b in act["by_fame_bin"]],
    },
}

SYSTEM = """당신은 표본조사 리포트의 문장을 쓰는 사람이다.
검증 조사에서 활성도 판정이 부풀었을 가능성이 나왔다. 그 결과를 반영해
활성도 인사이트 세 개를 다시 쓴다.

출력은 JSON 배열만. 각 원소:
{"id": 정수, "title": "", "finding": "", "interpretation": "", "validation": "",
 "nextQuestion": "", "confidence": "", "keyNumber": ""}

절대 규칙
1. 숫자는 각 항목에 주어진 허용 목록 안의 것만 쓴다. 목록 밖 숫자는 절대 금지.
   숫자를 새로 계산하지 않는다. 목록에 없으면 숫자 없이 서술한다.
2. title 에는 숫자를 하나도 넣지 않는다.
3. nextQuestion 은 물음표로 끝나는 한 문장.
4. confidence 는 "데이터에서 확인됨" 또는 "추가 검증 필요" 둘 중 하나.
5. 원인 단정 금지. "~일 수 있습니다", "~가능성이 있습니다" 어투를 쓴다.
6. 줄표와 붙임표를 쓰지 않는다. 코드 이름이나 영문 식별자를 쓰지 않는다.
7. 쉬운 말로 쓴다. 전문 용어 대신 풀어 쓴다.
8. 검증 조사의 역산값은 확정이 아니다. 1차 조사 표본이 명성에 치우치지
   않았다는 가정 위에서 나온 값이라 논리가 순환한다는 점, 휴면을 잰 표본이
   구간마다 작다는 점을 validation 에 반드시 함께 적는다.
9. 원인을 표본 치우침과 판정 오차로 갈라낼 수 없다는 점을 분명히 한다.
10. 1차 조사 수치 자체는 부정하지 않는다. 나란히 놓고 의심을 적는다."""

payload = {
    "검증결과": brief,
    "다시_쓸_항목": [
        {
            "id": i,
            "지금문장": {k: items[[x["id"] for x in items].index(i)][k]
                     for k in ("title", "finding", "interpretation", "validation", "nextQuestion")},
            "허용숫자": facts[i]["numbers"],
            "다뤄야_할_요지": {
                3: "낮은 명성 구간의 조용한 비중이 판정 방식 때문에 부풀었을 수 있다",
                6: "보정값은 판정 방식의 의심이 풀린 뒤에야 쓸 수 있다",
                7: "구간별 접속 격차 안에 실제 차이와 기록이 남는 빈도 차이가 섞여 있다",
            }[i],
        }
        for i in TARGET
    ],
}

# 다른 생성 스크립트와 같은 상한 검사를 거친다.
check_budget()
client = get_client()
resp = client.messages.create(
    model=MODEL,
    max_tokens=2600,
    system=SYSTEM,
    messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
)
cost = record_call(MODEL, resp.usage, "regen_insights_verify")
out = parse_json_array(resp.content[0].text)

# 검증: 숫자 허용 목록, 제목 숫자, 물음표, 확신 표기
import re  # noqa: E402
GLOBAL = {"1", "2", "3", "4", "5", "6", "7", "8", "30", "90", "200"}
FIELDS = ["title", "keyNumber", "finding", "interpretation", "validation", "nextQuestion"]
problems = []
by_id = {o["id"]: o for o in out}
for i in TARGET:
    o = by_id.get(i)
    if o is None:
        problems.append(f"{i}번이 응답에 없음")
        continue
    blob = " ".join(o[f] for f in FIELDS)
    stray = sorted({n for n in re.findall(r"\d[\d,]*(?:\.\d+)?", blob)
                    if n not in set(facts[i]["numbers"]) | GLOBAL})
    if stray:
        problems.append(f"{i}번 허용 목록 밖 숫자 {stray}")
    if re.search(r"\d", o["title"]):
        problems.append(f"{i}번 제목에 숫자")
    if not o["nextQuestion"].rstrip().endswith("?"):
        problems.append(f"{i}번 다음 질문이 물음표로 안 끝남")
    if o["confidence"] not in ("데이터에서 확인됨", "추가 검증 필요"):
        problems.append(f"{i}번 확신 표기 규칙 밖")
    for bad in ("—", "–", "ㅡ"):
        if bad in blob:
            problems.append(f"{i}번에 줄표")

print(f"입력 {resp.usage.input_tokens} 토큰, 출력 {resp.usage.output_tokens} 토큰, 비용 ${cost:.6f}")
if problems:
    print("검사 실패 — 저장하지 않았습니다")
    for x in problems:
        print("  ", x)
    sys.exit(1)

for it in items:
    if it["id"] in by_id:
        o = by_id[it["id"]]
        for k in ("title", "finding", "interpretation", "validation", "nextQuestion",
                  "confidence", "keyNumber"):
            it[k] = o[k]
INS.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print("검사 통과 — 인사이트 3, 6, 7 저장 완료")
