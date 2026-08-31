# -*- coding: utf-8 -*-
"""검증 조사 분석 — 1차 조사(이름 검색) 편향 계량.

비교는 같은 모집단끼리만 성립한다.
  1차 조사 표본 -> 진 각성(레벨 110 대리) + 명성 있음 -> 90일 내 접속 보정
  = 명성 방식이 보는 모집단

휴면률은 600명 부표본에서 왔다. 구간별 n 이 63~269 라 추정 오차가 작지 않다.
그래서 점추정 하나가 아니라 95% 예측 밴드로 낸다. 실측이 밴드를 벗어나야
비로소 "1차 조사 표본 편향"을 의심할 수 있고, 밴드 안이면 두 원인
(표본 편향 / 휴면률 추정 오차)을 갈라낼 수 없다.
"""

import io
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
census = json.loads((ROOT / "data" / "census_2026-08.json").read_text(encoding="utf-8"))
probe = json.loads((ROOT / "data" / "fame_probe_2026-08.json").read_text(encoding="utf-8"))
BINS = [b["label"] for b in json.loads((ROOT / "config" / "fame_bins.json").read_text(encoding="utf-8"))["bins"]]

random.seed(20260831)
DRAWS = 40_000
out = io.StringIO()


def p(s=""):
    print(s, file=out)


def wilson(x, n, z=1.96):
    if n == 0:
        return (0.0, 0.0, 0.0)
    ph = x / n
    d = 1 + z * z / n
    c = (ph + z * z / (2 * n)) / d
    h = z / d * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))
    return (ph, max(0.0, c - h), min(1.0, c + h))


# ── 1. 비교 모집단 ────────────────────────────────────────────────────
fs = census["distributions_final_stage"]
act = {b["bin"]: b for b in census["activity"]["by_fame_bin"]}
cen_bin = {x["range"]: x["count"] for x in fs["fame_bins"]}
cen_pct = {x["range"]: x["pct"] for x in fs["fame_bins"]}
cen_total = sum(cen_bin.values())

p("## 1. 비교 모집단과 휴면률 (부표본 n 병기)")
p()
p(f"{'구간':<14}{'1차 인원':>9}{'1차 비중':>9}{'부표본 n':>9}{'휴면':>7}{'휴면률':>8}{'95% 신뢰구간':>18}")
dorm = {}
for b in BINS:
    a = act[b]
    n = a["n"]
    x = a["counts"].get("휴면", 0)
    ph, lo, hi = wilson(x, n)
    dorm[b] = (x, n, ph, lo, hi)
    p(f"{b:<14}{cen_bin[b]:>9,}{cen_pct[b]:>8.2f}%{n:>9}{x:>7}{ph * 100:>7.1f}%"
      f"{f'{lo * 100:.1f}~{hi * 100:.1f}%':>18}")
p()
p(f"진 각성 + 명성 있음 = {cen_total:,}명 (1차 표본 31,523 중)")

# ── 2. 예측 밴드 (몬테카를로) ────────────────────────────────────────
draws = {b: [] for b in BINS}
tot_draws = []
for _ in range(DRAWS):
    act_counts = {}
    for b in BINS:
        x, n, _, _, _ = dorm[b]
        d = random.betavariate(x + 0.5, n - x + 0.5)   # Jeffreys 사후분포
        act_counts[b] = cen_bin[b] * (1 - d)
    t = sum(act_counts.values())
    tot_draws.append(t)
    for b in BINS:
        draws[b].append(act_counts[b] / t * 100)


def pct(vals, q):
    s = sorted(vals)
    return s[int(q * (len(s) - 1))]


pred = {b: (pct(draws[b], 0.025), pct(draws[b], 0.5), pct(draws[b], 0.975)) for b in BINS}
act_size = (pct(tot_draws, 0.025), pct(tot_draws, 0.5), pct(tot_draws, 0.975))

p()
p(f"90일 내 접속 추정 인원 = {act_size[1]:,.0f}명 "
  f"(95% {act_size[0]:,.0f}~{act_size[2]:,.0f}), 진 각성+명성 대비 {act_size[1] / cen_total * 100:.1f}%")

# ── 3. 구간별 비중: 실측 vs 예측 밴드 ────────────────────────────────
meas = probe["bin_share_pct"]
p()
p("## 2. 구간별 비중 — 명성 방식 실측 vs 1차 조사 예측 밴드")
p()
p(f"{'구간':<14}{'1차 원표본':>11}{'예측(중앙)':>11}{'예측 95% 밴드':>20}{'명성 실측':>10}{'실측-예측':>11}{'판정':>8}")
verdict = {}
for b in BINS:
    lo, mid, hi = pred[b]
    m = meas[b]
    inside = lo <= m <= hi
    verdict[b] = inside
    p(f"{b:<14}{cen_pct[b]:>10.2f}%{mid:>10.2f}%{f'{lo:.2f}~{hi:.2f}%':>20}{m:>9.2f}%"
      f"{m - mid:>+10.2f}%p{'밴드 안' if inside else '밴드 밖':>8}")
p()
n_in = sum(verdict.values())
p(f"6구간 중 {n_in}구간이 예측 밴드 안, {6 - n_in}구간이 밖.")

# ── 4. 편향 분해 ──────────────────────────────────────────────────────
p()
p("## 3. 편향 분해")
p()
p(f"{'구간':<14}{'휴면 포함 하향':>15}{'잔차(상향)':>13}{'합계':>10}")
for b in BINS:
    down = pred[b][1] - cen_pct[b]      # 휴면 제거로 생기는 이동
    resid = meas[b] - pred[b][1]        # 그러고도 남는 차이
    p(f"{b:<14}{down:>+14.2f}%p{resid:>+12.2f}%p{down + resid:>+9.2f}%p")
p()
p("휴면 포함 하향 = 1차 조사가 휴면 캐릭터를 품어 아래쪽이 두꺼워진 몫.")
p("잔차 = 휴면을 걷어내고도 남는 차이. 잘린 검색(45.8%)의 상향 편향과")
p("       휴면률 추정 오차가 여기 섞여 있고, 이 표만으로는 갈라낼 수 없다.")

# ── 5. 직업 구성 ──────────────────────────────────────────────────────
p()
p("## 4. 직업 구성 — 1차 조사(진 각성) vs 명성 방식")
p()
jp = probe["job_population"]
jtot = sum(jp.values())
cen_job = {x["jobName"]: x["pct"] for x in fs["job"]}
rows = []
for name, pop in jp.items():
    m = pop / jtot * 100
    c = cen_job.get(name)
    if c is not None:
        rows.append((name, c, m, m - c))
rows.sort(key=lambda r: -abs(r[3]))
p(f"{'직업':<14}{'1차':>8}{'명성 실측':>10}{'차이':>10}")
for r in rows[:12]:
    p(f"{r[0]:<14}{r[1]:>7.2f}%{r[2]:>9.2f}%{r[3]:>+9.2f}%p")
p(f"... 공통 직업 {len(rows)}종")
p()
tvd = sum(abs(r[3]) for r in rows) / 2
p(f"직업 분포 총변이거리(TVD) = {tvd:.2f}%p — 두 분포를 맞추려면 이만큼을 옮겨야 한다.")

gp = probe["group_population"]
gtot = sum(gp.values())
cen_grp = {x["jobName"]: x["pct"] for x in fs["job_group"]}
grows = []
for name, pop in gp.items():
    if name in cen_grp:
        m = pop / gtot * 100
        grows.append((name, cen_grp[name], m, m - cen_grp[name]))
grows.sort(key=lambda r: -abs(r[3]))
p()
p(f"{'직업군':<14}{'1차':>8}{'명성 실측':>10}{'차이':>10}")
for r in grows[:8]:
    p(f"{r[0]:<14}{r[1]:>7.2f}%{r[2]:>9.2f}%{r[3]:>+9.2f}%p")
p(f"직업군 TVD = {sum(abs(r[3]) for r in grows) / 2:.2f}%p")

# ── 6. 표본·레벨 확인 ────────────────────────────────────────────────
p()
p("## 5. 표집 상태")
mt = probe["meta"]
gc = probe["grid_check"]
lv = {int(k): v for k, v in probe["level_hist"].items()}
lvtot = sum(lv.values())
p(f"표본 {mt['sample_size']:,}명, 호출 {mt['api_calls']}회, 소요 {mt['elapsed_sec'] / 60:.1f}분, 실패 {mt['api_failures']}회")
p(f"포화(200) 점 {len(mt['saturated_points'])}개 — 한 점이 상한에 걸린 적 없음")
p(f"격자 검증 {gc['gap_pct']:+.2f}% ({'통과' if gc['pass'] else '초과'}), 창 {len(gc['windows'])}개")
p(f"모집단 추정 {probe['total_population']:,}명 (활성 110+)")
p(f"레벨 최소 {min(lv)} / 110 미만 {sum(v for k, v in lv.items() if k < 110):,}명 "
  f"({sum(v for k, v in lv.items() if k < 110) / lvtot * 100:.2f}%)")
p(f"진 각성 비율 {probe['final_stage_population'] / probe['total_population'] * 100:.2f}%")

Path(ROOT / "data" / "fame_analysis.txt").write_text(out.getvalue(), encoding="utf-8")
print(out.getvalue())
