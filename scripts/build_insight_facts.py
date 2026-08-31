# -*- coding: utf-8 -*-
"""인사이트가 쓸 수 있는 수치 목록을 집계에서 뽑아 만든다.

인사이트 문장에 이 목록 밖의 숫자가 들어오면 저장이 멈춘다(verify_final 4부).
목록을 손으로 적으면 집계와 어긋나므로 여기서 계산해 만든다.

    python scripts/build_insight_facts.py
"""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data"
OUT = ROOT / "report" / "content" / "insight_facts.json"


def load(name):
    return json.loads((D / name).read_text(encoding="utf-8"))


c = load("census_2026-08-r2.json")
cap = load("cap_correct.json")
split = load("phase2_sample.json")
rounds = load("rounds.json")
act = load("activity_r2.json")
verify = load("verification_2026-08-r2.json")

SCREEN = {
    "레기온 미만": "레기온 입장 전",
    "상급 던전권": "상급 던전 구간",
    "미카엘라 입장": "레이드 입장 구간",
    "미카엘라 권장": "레이드 권장 구간",
    "하드 권장 이상": "하드 권장 구간",
}
ACT = {"주간 활성": "최근 7일 접속", "월간 활성": "최근 30일 접속",
       "저활성": "최근 90일 접속", "휴면": "90일 넘게 기록 없음"}


# 화면과 같은 반올림
def _hu(x):
    return math.floor(x + 0.5)


def p1(v):
    return f"{_hu(_hu(v * 100) / 10) / 10:.1f}"


def n(v):
    return f"{v:,}"


fin = c["distributions_final_stage"]
meta = c["meta"]
fjob = [j for j in fin["job"] if not j["jobName"].startswith("기타")]
top5 = fjob[:5]
top5_n = sum(j["count"] for j in top5)
ffame = {b["range"]: b for b in fin["fame_bins"]}
corrected = cap["bin_share_cap_corrected"]
lows = [r for r in meta["fame_missing_level_dist"] if r["range"] in ("1~49", "50~99")]
low_pct = sum(r["count"] for r in lows) / sum(r["count"] for r in meta["fame_missing_level_dist"]) * 100

bundle = json.loads((ROOT / "report" / "src" / "data" / "census.json").read_text(encoding="utf-8"))
adjusted = bundle["activity"]["adjusted"]["pct"]
overall = {ACT[k]: v for k, v in act["overall"].items()}
bins = {SCREEN.get(k, k): v for k, v in act["by_fame_bin"].items()}
lowest_bin = bins["레기온 입장 전"]
highest_bin = bins["하드 권장 구간"]
dorm = {r["bin"]: r for r in verify["dormancy"]}
stage_split = split["bin_old_vs_new"][0]

# 직업별 성장 단계 구성 (교차표)
cells = {}
for x in fin["job_x_fame"]:
    cells.setdefault(x["jobName"], {})[x["bin"]] = None if x.get("masked") else x["count"]


def profile(job):
    cs = cells[job]
    total = sum(v for v in cs.values() if v)
    low = cs.get("레기온 미만") or 0
    return total, low, total - low


cru_total, cru_low, cru_rest = profile("크루세이더")
nec_total, nec_low, nec_rest = profile("사령술사")

f1, f2 = rounds["first"], rounds["second"]
gap0 = rounds["job_gap"][0]

FACTS = [
    {
        "id": 1, "confidence": "데이터에서 확인됨", "focus": "topJobs",
        "source": (f"마지막 전직을 마친 캐릭터 {n(fin['sample_size'])}명 가운데 {top5[0]['jobName']}가 "
                   f"{n(top5[0]['count'])}명으로 {p1(top5[0]['pct'])}%를 차지해 가장 많습니다. "
                   f"상위 5개 직업은 {', '.join(j['jobName'] for j in top5)}이고 "
                   f"다섯 직업을 합치면 {n(top5_n)}명으로 {p1(top5_n / fin['sample_size'] * 100)}%입니다."),
        "guard": "막 만든 캐릭터를 빼고 성장을 마친 캐릭터만 센 순위라는 점을 밝힙니다. "
                 "잘린 검색의 쏠림이 남아 있어 게임 전체 인구 순위라고 말할 수 없습니다.",
        "numbers": [n(fin["sample_size"]), n(top5[0]["count"]), p1(top5[0]["pct"]),
                    n(top5_n), p1(top5_n / fin["sample_size"] * 100)],
    },
    {
        "id": 2, "confidence": "추가 검증 필요", "focus": "capCorrection",
        "source": (f"관측값으로는 레기온 입장 전 구간이 {p1(ffame['레기온 미만']['pct'])}%입니다. "
                   f"상한에 걸린 검색을 쪼개 다시 받아 그 몫을 되돌리면 {p1(corrected['레기온 미만'])}%가 됩니다. "
                   f"차이는 {p1(corrected['레기온 미만'] - ffame['레기온 미만']['pct'])}%포인트입니다. "
                   f"성장을 마친 캐릭터 {n(fin['sample_size'])}명 기준이고, 명성 점수가 없어 분포에서 뺀 "
                   f"{n(meta['fame_missing'])}명 가운데 {p1(low_pct)}%가 레벨 100 미만입니다."),
        "guard": "보정값은 표본 400개 조합에서 잰 배수를 상한 도달 조합 전체에 적용한 추정이라는 점, "
                 "쪼갠 뒤에도 일부가 여전히 상한에 걸려 있어 보정 후에도 적게 잡혔을 수 있다는 점을 밝힙니다.",
        "numbers": [p1(ffame["레기온 미만"]["pct"]), p1(corrected["레기온 미만"]),
                    p1(corrected["레기온 미만"] - ffame["레기온 미만"]["pct"]),
                    n(fin["sample_size"]), n(meta["fame_missing"]), p1(low_pct),
                    "400", p1(split["still_capped_pct"]), "100"],
    },
    {
        "id": 3, "confidence": "추가 검증 필요", "focus": "activityByBin",
        "source": (f"레기온 입장 전 구간 {lowest_bin['n']}명 가운데 {p1(lowest_bin['pct']['휴면'])}%가 "
                   f"90일 넘게 기록이 없습니다. 명성 점수로 훑은 표본 {n(verify['meta']['sample_size'])}명으로 "
                   f"거꾸로 계산한 같은 구간 값은 {p1(dorm['레기온 미만']['implied'])}%입니다."),
        "guard": "거꾸로 계산한 값은 표본이 명성에 치우치지 않았다는 가정 위에서 나온 것이라 논리가 "
                 "순환한다는 점, 조용한 비중을 잰 표본이 구간마다 작다는 점을 함께 밝힙니다. 단정하지 않습니다.",
        "numbers": [str(lowest_bin["n"]), p1(lowest_bin["pct"]["휴면"]),
                    n(verify["meta"]["sample_size"]), p1(dorm["레기온 미만"]["implied"]),
                    str(verify["meta"]["subsample_min"]), str(verify["meta"]["subsample_max"])],
    },
    {
        "id": 4, "confidence": "데이터에서 확인됨", "focus": "roundCompare",
        "source": (f"처음 조사는 두 글자 {f1['seeds']}개로 모아 이름에 한글이 든 캐릭터의 "
                   f"{p1(f1['coverage_pct'])}%에 닿았고, 명성 방식과 직업 구성이 {p1(f1['job_tvd'])}%포인트 갈렸습니다. "
                   f"이번 조사는 흔한 조합 {n(f2['seeds'])}개로 바꿔 {p1(f2['coverage_pct'])}%에 닿았고 "
                   f"직업 구성 차이는 {p1(f2['job_tvd'])}%포인트로 줄었습니다. "
                   f"가장 크게 벌어져 있던 {gap0['jobName']}는 {p1(gap0['first'])}%포인트에서 "
                   f"{p1(abs(gap0['second']))}%포인트가 됐습니다."),
        "guard": "시드로 고른 낱말이 직업과 맞물려 있었다는 실측을 근거로 적습니다. "
                 "직업 축의 개선은 그대로 읽을 수 있지만 성장 단계 축은 그렇지 않다는 점을 함께 밝힙니다.",
        "numbers": [str(f1["seeds"]), p1(f1["coverage_pct"]), p1(f1["job_tvd"]),
                    n(f2["seeds"]), p1(f2["coverage_pct"]), p1(f2["job_tvd"]),
                    p1(gap0["first"]), p1(abs(gap0["second"]))],
    },
    {
        "id": 5, "confidence": "데이터에서 확인됨", "focus": "jobFameProfile",
        "source": (f"직업마다 성장 단계 구성이 다릅니다. 크루세이더는 명성 점수가 있는 {n(cru_total)}명 가운데 "
                   f"레기온 입장 전이 {n(cru_low)}명 {p1(cru_low / cru_total * 100)}%이고 그 위가 "
                   f"{n(cru_rest)}명 {p1(cru_rest / cru_total * 100)}%입니다. "
                   f"사령술사는 {n(nec_total)}명 가운데 레기온 입장 전이 {n(nec_low)}명 "
                   f"{p1(nec_low / nec_total * 100)}%이고 그 위가 {n(nec_rest)}명 "
                   f"{p1(nec_rest / nec_total * 100)}%입니다."),
        "guard": "마지막 전직을 마친 캐릭터만 센 값이라는 점을 밝힙니다. "
                 "난이도나 게임 안에서의 위치를 원인으로 단정하지 않습니다.",
        "numbers": [n(cru_total), n(cru_low), p1(cru_low / cru_total * 100), n(cru_rest),
                    p1(cru_rest / cru_total * 100), n(nec_total), n(nec_low),
                    p1(nec_low / nec_total * 100), n(nec_rest), p1(nec_rest / nec_total * 100), "10"],
    },
    {
        "id": 6, "confidence": "추가 검증 필요", "focus": "activityAdjust",
        "source": (f"90일 넘게 기록이 없는 비중은 관측값 {p1(overall['90일 넘게 기록 없음']['pct'])}%, "
                   f"상한 보정값 {p1(adjusted['90일 넘게 기록 없음'])}%로 "
                   f"{p1(adjusted['90일 넘게 기록 없음'] - overall['90일 넘게 기록 없음']['pct'])}%포인트 커집니다. "
                   f"최근 7일 접속은 {p1(overall['최근 7일 접속']['pct'])}%에서 "
                   f"{p1(adjusted['최근 7일 접속'])}%로 내려갑니다. "
                   f"조사 인원은 {act['meta']['subsample_size']}명입니다."),
        "guard": "보정은 구간 비중만 바꾼 것이고 판정 방식의 기울기는 걷어내지 못한다는 점을 밝힙니다. "
                 "관측값과 보정값을 모두 그대로 둡니다.",
        "numbers": [p1(overall["90일 넘게 기록 없음"]["pct"]), p1(adjusted["90일 넘게 기록 없음"]),
                    p1(adjusted["90일 넘게 기록 없음"] - overall["90일 넘게 기록 없음"]["pct"]),
                    p1(overall["최근 7일 접속"]["pct"]), p1(adjusted["최근 7일 접속"]),
                    str(act["meta"]["subsample_size"])],
    },
    {
        "id": 7, "confidence": "추가 검증 필요", "focus": "activityExtremes",
        "source": (f"하드 권장 구간은 {highest_bin['n']}명 전원이 최근 7일 안에 기록을 남겼습니다. "
                   f"레기온 입장 전 구간은 {lowest_bin['n']}명 가운데 {p1(lowest_bin['pct']['휴면'])}%가 "
                   f"90일 넘게 기록이 없습니다. 최근 7일 접속은 {p1(lowest_bin['pct']['주간 활성'])}%입니다."),
        "guard": "격차 안에 실제 접속 차이와 기록이 남는 빈도 차이가 섞여 있어 갈라내지 못했다는 점, "
                 "가장 높은 구간의 표본이 매우 작다는 점을 밝힙니다.",
        "numbers": [str(highest_bin["n"]), str(lowest_bin["n"]), p1(lowest_bin["pct"]["휴면"]),
                    p1(lowest_bin["pct"]["주간 활성"]), "100.0", "0.0"],
    },
    {
        "id": 8, "confidence": "데이터에서 확인됨", "focus": "searchLimit",
        "source": (f"검색 {n(meta['search_calls'])}회 가운데 {n(meta['search_calls_capped'])}회가 "
                   f"200명 한도에 걸렸습니다. 비율로는 "
                   f"{p1(meta['search_calls_capped'] / meta['search_calls'] * 100)}%입니다. "
                   f"한도에 걸린 검색 {split['sampled_combos']}개를 직업군으로 쪼개 다시 부르니 한 조합당 "
                   f"{round(200 * split['multiplier_mean'])}명이 나왔고, 새로 드러난 캐릭터의 "
                   f"{p1(stage_split['new'])}%가 레기온 입장 전 구간이었습니다. "
                   f"원래 200명 안에서는 {p1(stage_split['old'])}%였습니다."),
        "guard": "한도에 걸렸을 때 어떤 200명이 돌아오는지는 공개되어 있지 않다는 사실을 적습니다. "
                 "잘릴 때 낮은 명성 캐릭터가 먼저 잘린다는 것은 실측 결과입니다.",
        "numbers": [n(meta["search_calls"]), n(meta["search_calls_capped"]),
                    p1(meta["search_calls_capped"] / meta["search_calls"] * 100),
                    str(split["sampled_combos"]), str(round(200 * split["multiplier_mean"])),
                    p1(stage_split["new"]), p1(stage_split["old"]),
                    f"{split['multiplier_mean']:.2f}"],
    },
]

for f in FACTS:
    f["numbers"] = sorted(set(f["numbers"]))

OUT.write_text(json.dumps(FACTS, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"인사이트 근거 수치 목록 저장: {OUT.relative_to(ROOT)} ({len(FACTS)}건)")
for f in FACTS:
    print(f"  {f['id']} {f['focus']:<16} 허용 숫자 {len(f['numbers'])}개")
