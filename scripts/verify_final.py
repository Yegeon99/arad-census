# -*- coding: utf-8 -*-
"""최종 검수: 집계 정합성 assert + 화면 숫자 대조 + 금지 표현 스캔.

1부. 집계 산출물 자체의 정합성 (2026-08 회차 게이트 반영분).
2부. 리포트 번들이 집계 원본과 같은 수치인지 (이름만 화면 용어로 바뀐다).
3부. 집계 원본에서 다시 계산한 표기가 화면 글에 그대로 있는지.
4부. 인사이트 문장의 모든 숫자가 허용 목록 안인지.
5부. 금지 표현 스캔.

금지 표현은 세 겹으로 본다.
  1층 실제로 화면에 그려진 글 (docs/rendered_text.txt, 캡처 스크립트가 만든다)
  2층 리포트 원본 코드 (report/src, report/content, report/index.html)
  3층 빌드 산출물 전체 (dist 안의 모든 파일)
3층에서는 두 글자짜리 표기 하나만 빼고 본다. 압축된 자바스크립트에는 변수
대입이 그 두 글자 그대로 수도 없이 들어가기 때문이다. 그 표기는 1층과 2층에서
검사하며, 화면과 원본 코드 어디에도 없으면 산출물에서도 나올 수 없다.

실행: python scripts/verify_final.py
"""

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CENSUS = ROOT / "data" / "census_2026-08.json"
SEEDS = ROOT / "data" / "seed_yield.json"
COSTS = ROOT / "data" / "llm_costs.json"
BUNDLE = ROOT / "report" / "src" / "data" / "census.json"
STABILITY = ROOT / "docs" / "stability.json"
INSIGHTS = ROOT / "report" / "src" / "derived" / "insights.json"
FACTS = ROOT / "report" / "content" / "insight_facts.json"
DIST = ROOT / "report" / "dist"
RENDERED = ROOT / "docs" / "rendered_text.txt"

FORBIDDEN = ["완전 검색", "한도 검색", "편향 보정값", "명성값", "빠짐없이 모은",
             "답하는 질문은", "발견 경로",
             "—", "–", "ㅡ", "§", "n=", "capped", "uncapped",
             "reweighted", "job_x_fame", "small_sample", "비상한", "레기온 미만",
             "가중 재추정", "자각1", "외전"]
FORBIDDEN_NAME = {"—": "줄표", "–": "짧은 줄표", "ㅡ": "낱자 으", "§": "절 기호"}

RAID_BINS = ["미카엘라 입장", "미카엘라 권장", "하드 권장 이상"]

failures = []
checks = 0


def ok(cond, message):
    global checks
    checks += 1
    if not cond:
        failures.append(message)


# ── 화면과 같은 반올림 (둘째 자리를 맞춘 뒤 올림 방향) ──
def _hu(x):
    return math.floor(x + 0.5)


def round1(v):
    return _hu(_hu(v * 100) / 10) / 10


def pct(v):
    return f"{round1(v):.1f}%"


def pp(v):
    return f"{round1(v):.1f}%포인트"


def people(v):
    return f"{v:,}명"


def times(v):
    return f"{v:.2f}배"


# ── 1. 집계 산출물 자체의 정합성 ──
def check_census(c):
    m = c["meta"]
    d = c["distributions"]
    u = c["distributions_uncapped_only"]

    ok(m["sample_size"] == 31523, "표본 크기가 31,523이 아닙니다")
    ok(m["sample_size"] - m["fame_missing"] == 30082, "명성 보유 표본이 30,082가 아닙니다")
    ok(m["uncapped_sample_size"] == 5352, "완전 검색 표본이 5,352가 아닙니다")
    ok(m["uncapped_sample_size"] - m["uncapped_fame_missing"] == 4087,
       "완전 검색 명성 표본이 4,087이 아닙니다")
    ok(m.get("round") == "2026-08", "조사 회차 표기가 없습니다")

    names = [j["jobName"] for j in d["job"]]
    ok("자각1" not in names and "크리에이터" not in names,
       "직업 목록에 합산 대상 이름이 그대로 남아 있습니다")
    ok(not any(x["jobName"] == "자각1" for x in d["job_x_fame"]),
       "교차표에 합산 대상 이름이 남아 있습니다")
    etc = [j for j in d["job"] if j["jobName"].startswith("기타")]
    ok(len(etc) == 1 and etc[0]["count"] == 416, "합산 항목이 416명이 아닙니다")

    # 마지막 전직을 마친 캐릭터만의 집계
    f = c["distributions_final_stage"]
    ok(f["sample_size"] == 29527, "성장 완료 캐릭터가 29,527명이 아닙니다")
    ok(sum(j["count"] for j in f["job"]) == f["sample_size"], "성장 완료 직업 인원 합이 다릅니다")
    ok(sum(b["count"] for b in f["fame_bins"]) == f["sample_size"] - f["fame_missing"],
       "성장 완료 명성 구간 인원 합이 다릅니다")
    ok(not any(x["jobName"] == "자각1" for x in f["job_x_fame"]),
       "성장 완료 교차표에 합산 대상 이름이 남아 있습니다")
    ok(f["uncapped_sample_size"] > 0, "성장 완료 기준 쏠림 없는 표본이 비어 있습니다")

    ok(sum(j["count"] for j in d["job"]) == m["sample_size"], "직업 인원 합이 표본 크기와 다릅니다")
    ok(sum(j["count"] for j in u["job"]) == m["uncapped_sample_size"],
       "완전 검색 직업 인원 합이 완전 검색 표본과 다릅니다")
    ok(sum(b["count"] for b in d["fame_bins"]) == 30082, "명성 구간 인원 합이 30,082가 아닙니다")
    ok(sum(b["count"] for b in u["fame_bins"]) == 4087, "완전 검색 구간 인원 합이 4,087이 아닙니다")
    ok(sum(s["count"] for s in d["stage"]) == m["sample_size"], "각성 단계 인원 합이 표본 크기와 다릅니다")
    ok(abs(sum(b["pct"] for b in d["fame_bins"]) - 100) < 0.05, "명성 구간 비중 합이 100이 아닙니다")
    ok(abs(sum(b["pct"] for b in u["fame_bins"]) - 100) < 0.05, "완전 검색 구간 비중 합이 100이 아닙니다")

    act = c["activity"]
    ok(sum(o["count"] for o in act["overall"]) == act["subsample_size"],
       "활성도 인원 합이 조사 인원과 다릅니다")
    ok(abs(sum(act["reweighted_by_uncapped"]["pct"].values()) - 100) < 0.5,
       "보정 후 비중 합이 100 근처가 아닙니다")


# ── 2. 리포트 번들이 집계 원본과 같은 수치인지 ──
def check_bundle(c):
    b = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ok(b["meta"]["sampleSize"] == c["meta"]["sample_size"], "번들의 표본 크기가 다릅니다")
    ok(b["meta"]["completeSampleSize"] == c["meta"]["uncapped_sample_size"],
       "번들의 완전 검색 표본이 다릅니다")
    ok([x["count"] for x in b["distributions"]["job"]]
       == [x["count"] for x in c["distributions"]["job"]], "번들의 직업 인원이 다릅니다")
    ok([x["count"] for x in b["distributions"]["fameBins"]]
       == [x["count"] for x in c["distributions"]["fame_bins"]], "번들의 구간 인원이 다릅니다")
    ok(len(b["distributions"]["jobByFame"]) == len(c["distributions"]["job_x_fame"]),
       "번들의 교차표 칸 수가 다릅니다")
    ok("insights" not in b, "번들에 옛 인사이트가 남아 있습니다")
    ok(b["finalStage"]["sampleSize"] == c["distributions_final_stage"]["sample_size"],
       "번들의 성장 완료 표본이 다릅니다")
    ok([x["count"] for x in b["finalStage"]["job"]]
       == [x["count"] for x in c["distributions_final_stage"]["job"]],
       "번들의 성장 완료 직업 인원이 다릅니다")


# ── 3. 화면 숫자 대조 ──
def check_numbers(c, text):
    meta = c["meta"]
    d = c["distributions"]
    u = c["distributions_uncapped_only"]
    act = c["activity"]
    seeds = json.loads(SEEDS.read_text(encoding="utf-8"))["seeds"]

    fame = {b["range"]: b for b in d["fame_bins"]}
    ufame = {b["range"]: b for b in u["fame_bins"]}
    job = {j["jobName"]: j for j in d["job"]}
    ujob = {j["jobName"]: j for j in u["job"]}

    expect = {}
    expect["표본 크기"] = people(meta["sample_size"])
    expect["완전 검색 표본 크기"] = people(meta["uncapped_sample_size"])
    expect["명성값이 있는 표본"] = people(meta["sample_size"] - meta["fame_missing"])
    expect["완전 검색 명성 표본"] = people(meta["uncapped_sample_size"] - meta["uncapped_fame_missing"])
    expect["명성값 결측"] = people(meta["fame_missing"])
    expect["합산 항목 인원"] = people([j for j in d["job"] if j["jobName"].startswith("기타")][0]["count"])

    fin = c["distributions_final_stage"]
    fjob = {j["jobName"]: j for j in fin["job"]}
    top5 = ["크루세이더", "다크템플러", "넨마스터", "브레이커", "스위프트 마스터"]
    top5_n = sum(fjob[j]["count"] for j in top5)
    expect["성장 완료 캐릭터"] = people(fin["sample_size"])
    expect["최다 직업 비중"] = pct(fjob["크루세이더"]["pct"])
    expect["최다 직업 인원"] = people(fjob["크루세이더"]["count"])
    expect["상위 다섯 인원"] = people(top5_n)
    expect["상위 다섯 비중"] = pct(top5_n / fin["sample_size"] * 100)
    expect["진 각성 비중"] = pct(next(s["pct"] for s in d["stage"] if s["stage"] == "眞"))

    gap = ufame["레기온 미만"]["pct"] - fame["레기온 미만"]["pct"]
    expect["레기온 입장 전 전체"] = pct(fame["레기온 미만"]["pct"])
    expect["레기온 입장 전 완전 검색"] = pct(ufame["레기온 미만"]["pct"])
    expect["두 표본의 차이"] = pp(gap)
    expect["레기온 입장 전 인원"] = people(fame["레기온 미만"]["count"])
    expect["레이드 진입 구간 비중"] = pct(sum(fame[b]["pct"] for b in RAID_BINS))
    lows = [r for r in meta["fame_missing_level_dist"] if r["range"] in ("1~49", "50~99")]
    expect["결측 저레벨 비중"] = pct(sum(r["count"] for r in lows)
                                / sum(r["count"] for r in meta["fame_missing_level_dist"]) * 100)

    overall = {o["label"]: o for o in act["overall"]}
    adj = act["reweighted_by_uncapped"]["pct"]
    expect["보정 전 조용한 비중"] = pct(overall["휴면"]["pct"])
    expect["보정 후 조용한 비중"] = pct(adj["휴면"])
    expect["보정 전 최근 7일"] = pct(overall["주간 활성"]["pct"])
    expect["보정 후 최근 7일"] = pct(adj["주간 활성"])
    expect["조용한 비중 차이"] = pp(adj["휴면"] - overall["휴면"]["pct"])
    expect["활성도 조사 인원"] = people(act["subsample_size"])
    expect["완전 검색 조사 인원"] = people(act["by_capped"]["uncapped"]["n"])
    expect["한도 검색 조사 인원"] = people(act["by_capped"]["capped_only"]["n"])
    expect["완전 검색 조용한 비중"] = pct(act["by_capped"]["uncapped"]["pct"]["휴면"])
    expect["한도 검색 조용한 비중"] = pct(act["by_capped"]["capped_only"]["pct"]["휴면"])
    lowest = act["by_fame_bin"][0]
    expect["가장 낮은 구간 조용한 비중"] = pct(lowest["pct"]["휴면"])
    expect["가장 낮은 구간 인원"] = people(lowest["n"])

    cells = {}
    for x in fin["job_x_fame"]:
        cells.setdefault(x["jobName"], {})[x["bin"]] = None if x.get("masked") else x["count"]
    ffame = {b["range"]: b for b in fin["fame_bins"]}
    total_fame = sum(b["count"] for b in fin["fame_bins"])
    overall_raid = sum(ffame[b]["count"] for b in RAID_BINS) / total_fame
    rows = []
    for name, cs in cells.items():
        total = sum(v for v in cs.values() if v)
        if total < 300:
            continue
        raid = sum(cs.get(b) or 0 for b in RAID_BINS)
        rows.append((name, total, raid / total, raid / total / overall_raid))
    rows.sort(key=lambda r: -r[3])
    best, worst = rows[0], rows[-1]
    expect["표본 평균 레이드 진입 비중"] = pct(overall_raid * 100)
    expect["가장 높은 직업 지수"] = times(best[3])
    expect["가장 낮은 직업 지수"] = times(worst[3])
    expect["가장 높은 직업과 낮은 직업 배수"] = times(best[3] / worst[3])

    expect["검색 횟수"] = f"{meta['search_calls']:,}회"
    expect["한도 검색 횟수"] = f"{meta['search_calls_capped']:,}회"
    expect["한도 검색 비중"] = pct(meta["search_calls_capped"] / meta["search_calls"] * 100)
    expect["시드 검색 합계"] = f"{sum(s['calls'] for s in seeds):,}회"

    cost = json.loads(COSTS.read_text(encoding="utf-8"))["total_cost_usd"]
    expect["모델 비용"] = f"{cost:.4f}달러"

    for label, want in expect.items():
        ok(want in text, f"화면 글에 {label} 표기 {want!r}가 없습니다")

    ok(ujob["크루세이더"]["pct"] < job["크루세이더"]["pct"],
       "완전 검색 표본에서 최다 직업 비중이 줄지 않았습니다")
    return len(expect)


# ── 4. 인사이트 수치 전수 대조 ──
GLOBAL_NUMBERS = {"1", "2", "3", "4", "5", "6", "7", "8", "30", "90", "200"}
FIELDS = ["title", "keyNumber", "finding", "interpretation", "validation", "nextQuestion"]


def check_insights():
    items = json.loads(INSIGHTS.read_text(encoding="utf-8"))
    facts = {f["id"]: f for f in json.loads(FACTS.read_text(encoding="utf-8"))}
    ok(len(items) == 8, f"인사이트가 8개가 아닙니다 ({len(items)}개)")
    total = 0
    for item in items:
        spec = facts.get(item["id"])
        ok(spec is not None, f"인사이트 {item['id']}의 근거 수치 목록이 없습니다")
        if spec is None:
            continue
        blob = " ".join(item[f] for f in FIELDS)
        allowed = set(spec["numbers"]) | GLOBAL_NUMBERS
        found = re.findall(r"\d[\d,]*(?:\.\d+)?", blob)
        total += len(found)
        stray = sorted({n for n in found if n not in allowed})
        ok(not stray, f"인사이트 {item['id']}에 허용 목록 밖 숫자 {stray}")
        ok(item["confidence"] in ("데이터에서 확인됨", "추가 검증 필요"),
           f"인사이트 {item['id']}의 확신 표기가 규칙 밖입니다")
        ok(not re.search(r"\d", item["title"]), f"인사이트 {item['id']} 제목에 숫자가 있습니다")
        ok(item["nextQuestion"].rstrip().endswith("?"),
           f"인사이트 {item['id']}의 다음 질문이 물음표로 끝나지 않습니다")
    return total


# ── 5. 금지 표현 스캔 ──
SRC_DIRS = [ROOT / "report" / "src", ROOT / "report" / "content"]
SRC_FILES = [ROOT / "report" / "index.html"]
SRC_SUFFIXES = (".js", ".jsx", ".css", ".json", ".html", ".md")
# 압축된 자바스크립트에서 변수 대입과 구별할 수 없는 표기 (1층과 2층에서 검사한다)
MINIFY_COLLIDING = {"n="}
# 표본 수 표기는 뒤에 숫자가 붙은 형태만 잡는다. 화면 코드에는 open= 이나
# min= 처럼 같은 두 글자로 끝나는 속성 이름이 흔하기 때문이다.
COUNT_NOTATION = re.compile(r"n=\s*\d")


def scan_forbidden(text, tokens):
    hits = []
    for token in tokens:
        n = len(COUNT_NOTATION.findall(text)) if token == "n=" else text.count(token)
        if n:
            hits.append((FORBIDDEN_NAME.get(token, token), n))
    return hits


def read_all(paths):
    out = [path.read_text(encoding="utf-8", errors="ignore") for path in paths]
    return chr(10).join(out), len(out)


def check_layers(rendered):
    layers = {}
    counts = {}

    layers["화면에 그려진 글"] = scan_forbidden(rendered, FORBIDDEN)
    counts["화면에 그려진 글"] = f"{len(rendered):,}자"

    src_paths = list(SRC_FILES)
    for d in SRC_DIRS:
        src_paths.extend(p for p in d.rglob("*") if p.is_file() and p.suffix in SRC_SUFFIXES)
    src_text, n_src = read_all(src_paths)
    layers["리포트 원본 코드"] = scan_forbidden(src_text, FORBIDDEN)
    counts["리포트 원본 코드"] = f"파일 {n_src}개"

    dist_paths = [p for p in DIST.rglob("*") if p.is_file() and p.suffix != ".png"]
    dist_text, n_dist = read_all(dist_paths)
    dist_tokens = [t for t in FORBIDDEN if t not in MINIFY_COLLIDING]
    layers["빌드 산출물 전체"] = scan_forbidden(dist_text, dist_tokens)
    counts["빌드 산출물 전체"] = f"파일 {n_dist}개, 압축 변수와 겹치는 표기 1종 제외"

    for name, hits in layers.items():
        ok(not hits, f"{name}에 화면에 쓰지 않는 표현이 남아 있습니다 {hits}")
    return layers, counts


ASK_ENDINGS = ("는가", "은가", "인가")


def check_headings(rendered):
    """소제목을 의문형으로 달지 않았는지 본다. 짧은 줄만 소제목으로 친다."""
    bad = []
    for line in rendered.splitlines():
        t = line.strip()
        if 2 < len(t) <= 30 and t.endswith(ASK_ENDINGS):
            bad.append(t)
    ok(not bad, f"의문형 소제목이 남아 있습니다 {sorted(set(bad))[:5]}")
    return len(bad)


def check_stability():
    """화면 일곱 개에 주소로 곧장 들어갔을 때 1초 뒤 빈 곳이 없는지."""
    if not STABILITY.exists():
        ok(False, "표시 안정성 결과가 없습니다. report 폴더에서 node scripts/stability.mjs 를 돌리십시오")
        return None
    data = json.loads(STABILITY.read_text(encoding="utf-8"))
    rows = data["results"]
    # 화면 7개 x 데스크톱·모바일. 평면과 입체 토글이 사라져 14개가 됐다.
    ok(len(rows) == 14, f"표시 안정성 검사 대상이 14개가 아닙니다 ({len(rows)}개)")
    for r in rows:
        ok(r["ok"], f"표시 안정성 실패 {r['view']} {r['page']}: 글자 {r['textLength']}, "
                    f"안 보이는 요소 {r['fadedCount']}, 빈 캔버스 {r['emptyCanvas']}, "
                    f"도는 애니메이션 {r['runningAnimations']}, 글자 겹침 {r['overlapCount']}")
    return data


def main():
    if not RENDERED.exists():
        print("화면 글 모음이 없습니다. report 폴더에서 node scripts/capture.mjs 를 먼저 돌리십시오.")
        sys.exit(1)
    rendered = RENDERED.read_text(encoding="utf-8")
    census = json.loads(CENSUS.read_text(encoding="utf-8"))

    check_census(census)
    check_bundle(census)
    n_expect = check_numbers(census, rendered)
    n_numbers = check_insights()
    check_headings(rendered)
    stability = check_stability()
    layers, counts = check_layers(rendered)

    print("[집계 정합성]")
    print("  표본 크기, 직업·구간·단계 인원 합, 합산 항목, 보정 후 비중 합 확인")
    print("  리포트 번들이 집계 원본과 같은 수치인지 확인")
    print("[숫자 정합성]")
    print(f"  집계 원본에서 다시 계산한 표기 {n_expect}건을 화면 글과 대조")
    print(f"  인사이트 문장의 숫자 {n_numbers}개를 허용 목록과 대조")
    print("[표시 안정성]")
    if stability:
        good = sum(1 for r in stability["results"] if r["ok"])
        print(f"  주소로 곧장 진입 후 {stability['waitMs']}밀리초 시점: {good}/{len(stability['results'])} 통과")
        print(f"  차트 글자 겹침: {sum(r['overlapCount'] for r in stability['results'])}건")
    print("[금지 표현 스캔]")
    for name, hits in layers.items():
        print(f"  {name}: {'0건' if not hits else hits}  ({counts[name]})")
    print(f"[검사 {checks}건] 실패 {len(failures)}건")
    for f in failures:
        print("  실패:", f)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
