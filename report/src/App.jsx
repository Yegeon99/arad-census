import { useEffect, useMemo, useState } from "react";
import census from "./data/census.json";
import seedYield from "./data/seed_yield.json";
import { HBarList, CompareBars, Donut, Heatmap, StackBar } from "./components/charts.jsx";

// Phase별 실측치 (파이프라인 로그 기준 — 게이트 보고와 동일 수치)
const MEASURED = {
  apiCalls: 933, // 검증 43 + /df/jobs 1 + 검색 289 + 타임라인 600
  llmCostUsd: 0.0707, // 인사이트 배치 2회 (재생성 1회 포함) 실측
  collectSec: 87,
  timelineSec: 181,
  surveyedAt: "2026-08-25",
};

const SECTIONS = [
  { id: "s1", no: "§1", title: "직업 분포" },
  { id: "s2", no: "§2", title: "성장 피라미드" },
  { id: "s3", no: "§3", title: "활성도" },
  { id: "s4", no: "§4", title: "직업 × 명성 격차" },
  { id: "s5", no: "§5", title: "AI 인사이트" },
  { id: "s6", no: "§6", title: "방법론과 한계" },
];

const ACT_COLORS = {
  "주간 활성": "var(--ink-6)",
  "월간 활성": "var(--ink-4)",
  "저활성": "var(--ink-2)",
  "휴면": "#D8D5CE",
};

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function SectionTitle({ no, title, sub }) {
  return (
    <div className="mb-5">
      <h2 className="m-0 text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>
        <span style={{ color: "var(--accent)" }}>{no}</span> {title}
      </h2>
      {sub && <p className="prose-block mt-1 text-[13.5px]">{sub}</p>}
    </div>
  );
}

function Note({ children }) {
  return (
    <p className="mt-3 rounded-md px-3 py-2 text-[12.5px]" style={{ background: "var(--accent-soft)", color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

export default function App() {
  const active = useScrollSpy(SECTIONS.map((s) => s.id));
  const d = census.distributions;
  const du = census.distributions_uncapped_only;
  const act = census.activity;
  const meta = census.meta;

  const fameCompare = useMemo(() => {
    const u = Object.fromEntries(du.fame_bins.map((b) => [b.range, b.pct]));
    return d.fame_bins.map((b) => ({ label: b.range, full: b.pct, unc: u[b.range] ?? 0 }));
  }, [d, du]);

  const topJobs = d.job.filter((j) => !j.jobName.startsWith("기타")).slice(0, 15);
  const bottomJobs = d.job.filter((j) => !j.jobName.startsWith("기타")).slice(-5).reverse();

  const heat = useMemo(() => {
    const cols = d.fame_bins.map((b) => b.range);
    const byJob = new Map();
    for (const c of d.job_x_fame) {
      if (!byJob.has(c.jobName)) byJob.set(c.jobName, {});
      byJob.get(c.jobName)[c.bin] = c.masked ? null : c.count;
    }
    const order = d.job.filter((j) => byJob.has(j.jobName)).slice(0, 20).map((j) => j.jobName);
    const rowTotal = (r) => Object.values(byJob.get(r)).reduce((s, v) => s + (v ?? 0), 0);
    return { cols, rows: order, cell: (r, c) => byJob.get(r)[c] ?? 0, rowTotal, byJob };
  }, [d]);

  // §4 상위 구간 대표성: 직업별 상위 3구간(미카엘라 입장~하드) 비중 vs 전체 평균
  const gap = useMemo(() => {
    const upper = ["미카엘라 입장", "미카엘라 권장", "하드 권장 이상"];
    const overallUpper = d.fame_bins.filter((b) => upper.includes(b.range)).reduce((s, b) => s + b.count, 0)
      / d.fame_bins.reduce((s, b) => s + b.count, 0);
    const rows = [];
    for (const [job, cells] of heat.byJob) {
      const total = Object.values(cells).reduce((s, v) => s + (v ?? 0), 0);
      if (total < 300) continue;
      const up = upper.reduce((s, b) => s + (cells[b] ?? 0), 0);
      rows.push({ job, total, upperShare: up / total, index: up / total / overallUpper });
    }
    rows.sort((a, b) => b.index - a.index);
    return { overallUpper, top: rows.slice(0, 5), bottom: rows.slice(-5).reverse() };
  }, [d, heat]);

  const seedStats = useMemo(() => {
    const s = seedYield.seeds;
    const cls = (k) => s.filter((x) => x.class === k);
    return {
      common: cls("common").length, rare: cls("rare").length,
      calls: s.reduce((a, x) => a + x.calls, 0),
      capped: s.reduce((a, x) => a + x.capped_calls, 0),
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* 헤더 */}
      <header className="border-b" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-[840px] px-5 py-10">
          <p className="m-0 text-[13px] font-semibold tracking-wide" style={{ color: "var(--accent)" }}>ARAD CENSUS · 2026-08 조사 회차</p>
          <h1 className="mt-1 mb-3 text-[30px] leading-snug font-bold" style={{ color: "var(--text-primary)" }}>
            아라드 센서스 — 던파 캐릭터 표본조사
          </h1>
          <p className="prose-block m-0 text-[15px]">
            8개 서버에서 한국어 음절 시드 검색으로 추출한 캐릭터 <b className="num">{meta.sample_size.toLocaleString()}명</b> 표본의
            직업·명성·활성도 분포. 조사일 {MEASURED.surveyedAt}, 타임라인 활성도는 층화 서브샘플 <b className="num">{act.subsample_size}명</b> 기준.
          </p>
          <p className="mt-3 rounded-md border px-3 py-2 text-[13px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-base)" }}>
            이 조사는 모집단 추정이 아니라 <b>표본조사 방법론의 시연</b>이다. 표본 추출 방식의 편향과 한계를 §6에서 그대로 공개한다.
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1080px] flex-1 gap-8 px-5">
        {/* 목차 사이드 내비 (스크롤 스파이) */}
        <nav className="sticky top-6 hidden h-fit w-[170px] shrink-0 pt-10 lg:block" aria-label="목차">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block border-l-2 py-1.5 pl-3 text-[13px] no-underline"
               style={{
                 borderColor: active === s.id ? "var(--accent)" : "var(--border)",
                 color: active === s.id ? "var(--accent)" : "var(--text-secondary)",
                 fontWeight: active === s.id ? 700 : 400,
               }}>
              {s.no} {s.title}
            </a>
          ))}
        </nav>

        <main className="min-w-0 max-w-[840px] flex-1 pt-10 pb-16">
          {/* §1 직업 분포 */}
          <section id="s1" className="mb-14">
            <SectionTitle no="§1" title="직업 분포"
              sub={`정규화된 최종 전직명 기준 (1차 전직~眞 각성을 하나로 합산). 표본 ${meta.sample_size.toLocaleString()}명 중 공개 가능한 직업 ${d.job.length - 1}종 + 마스킹 합산 1항.`} />
            <HBarList items={topJobs.map((j) => ({ label: j.jobName, value: j.pct }))}
              valueFmt={(v, item) => `${v}%`} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <p className="m-0 font-semibold" style={{ color: "var(--text-primary)" }}>상위 발견</p>
                <p className="prose-block m-0 mt-1">
                  크루세이더가 {d.job[0].pct}%로 최다. 상위 5개 직업(크루세이더·다크템플러·넨마스터·브레이커·스위프트 마스터)이
                  전체의 24.3%를 차지한다.
                </p>
              </div>
              <div className="rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <p className="m-0 font-semibold" style={{ color: "var(--text-primary)" }}>하위 발견</p>
                <p className="prose-block m-0 mt-1">
                  공개 직업 중 하위: {bottomJobs.map((j) => `${j.jobName} ${j.pct}%`).join(", ")}.
                  표본 10명 미만 직업은 "기타"로 합산했다.
                </p>
              </div>
            </div>
            <Note>각성 단계 분포: 眞 {d.stage.find((s) => s.stage === "眞")?.pct}% — 표본 대부분이 최종 각성 상태다.
              검색 노출·상한 편향으로 성장 완료 캐릭터가 과대 대표되었을 가능성이 있다 (§6).</Note>
          </section>

          {/* §2 성장 피라미드 */}
          <section id="s2" className="mb-14">
            <SectionTitle no="§2" title="성장 피라미드 — 전체 표본 vs 비상한 표본"
              sub={`명성 6구간 (컨텐츠 입장컷 기준, 이상~미만). 전체 표본 ${(meta.sample_size - meta.fame_missing).toLocaleString()}명 vs 상한(200건) 미도달 검색에서만 발견된 비상한 표본 ${meta.uncapped_sample_size.toLocaleString()}명.`} />
            <CompareBars bins={fameCompare} leftKey="full" rightKey="unc"
              leftLabel={`전체 표본 (n=${(meta.sample_size - meta.fame_missing).toLocaleString()})`}
              rightLabel={`비상한 표본 (n=${(meta.uncapped_sample_size - meta.uncapped_fame_missing).toLocaleString()})`} />
            <div className="prose-block mt-4 space-y-2 text-[13.5px]">
              <p className="m-0">
                검색이 상한(200건)에 도달하면 어떤 200명이 반환되는지 기준이 공개되어 있지 않고, 실측 결과 고명성 쪽으로
                크게 쏠린다. 상한에 걸리지 않은 검색에서만 발견된 <b>비상한 표본은 레기온 미만이 {fameCompare[0].unc}%</b>로,
                전체 표본({fameCompare[0].full}%)보다 훨씬 저명성 중심이다.
              </p>
              <p className="m-0">
                명성 결측 {meta.fame_missing.toLocaleString()}명은 분포에서 제외했다. 결측자의 43.5%가 100 미만
                저레벨이라, 결측 제외는 피라미드를 추가로 상향 편향시킬 가능성이 있다 (§6).
              </p>
            </div>
          </section>

          {/* §3 활성도 */}
          <section id="s3" className="mb-14">
            <SectionTitle no="§3" title="활성도 — 원 수치와 편향 보정 재추정"
              sub={`층화 서브샘플 n=${act.subsample_size} (명성 구간 비례). 판정: 최근 90일 타임라인 최신 이벤트 기준 7일/30일/90일/휴면.`} />
            <div className="flex flex-wrap items-center gap-8">
              <Donut
                parts={act.overall.map((o) => ({ label: o.label, value: o.count, color: ACT_COLORS[o.label] }))}
                centerTitle={`${act.overall.find((o) => o.label === "휴면").pct}%`}
                centerSub={`휴면 (n=${act.subsample_size})`}
              />
              <div className="min-w-[240px] flex-1">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ color: "var(--text-muted)" }}>
                      <th className="pb-1 text-left font-medium">판정</th>
                      <th className="pb-1 text-right font-medium">원 수치</th>
                      <th className="pb-1 text-right font-medium">가중 재추정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {act.overall.map((o) => (
                      <tr key={o.label} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="py-1.5">
                          <span className="mr-1.5 inline-block h-[10px] w-[10px] rounded-sm align-middle" style={{ background: ACT_COLORS[o.label] }} />
                          {o.label}
                        </td>
                        <td className="num py-1.5 text-right">{o.pct}% <span style={{ color: "var(--text-muted)" }}>({o.count})</span></td>
                        <td className="num py-1.5 text-right font-semibold" style={{ color: "var(--accent)" }}>
                          {act.reweighted_by_uncapped.pct[o.label]}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Note>
              가중 재추정: 명성 구간별 서브샘플 활성률에 <b>비상한 표본의 구간 비중을 가중치</b>로 곱해 합산한 값 —
              검색 상한 편향을 저명성 쪽으로 보정한 방향의 추정치다. 휴면은 원 수치 {act.overall.find((o) => o.label === "휴면").pct}% →
              재추정 {act.reweighted_by_uncapped.pct["휴면"]}%로 커진다. 두 수치 모두 §6의 교란 요인(타임라인 기록 밀도,
              검색 노출 조건)을 제거하지 못한다.
            </Note>
            <h3 className="mt-6 mb-2 text-[15px] font-bold">명성 구간별 활성 구성 (구간별 n 병기)</h3>
            <div className="space-y-2">
              {act.by_fame_bin.map((b) => (
                <div key={b.bin} className="text-[12.5px]">
                  <div className="mb-0.5 flex justify-between" style={{ color: "var(--text-secondary)" }}>
                    <span>
                      {b.bin} <span className="num" style={{ color: "var(--text-muted)" }}>(n={b.n})</span>
                      {b.small_sample && (
                        <span className="ml-1.5 rounded-sm px-1.5 py-0.5 text-[10.5px]" style={{ background: "var(--masked)", color: "var(--text-secondary)" }}>표본 소</span>
                      )}
                    </span>
                    <span className="num">휴면 {b.pct["휴면"]}%</span>
                  </div>
                  <StackBar parts={["주간 활성", "월간 활성", "저활성", "휴면"].map((k) => ({ label: k, value: b.counts[k], color: ACT_COLORS[k] }))} />
                </div>
              ))}
            </div>
            <Note>
              발견 경로별 비교: 비상한 표본의 휴면율 <b className="num">{act.by_capped.uncapped.pct["휴면"]}%</b> (n={act.by_capped.uncapped.n})
              vs 상한 표본 <b className="num">{act.by_capped.capped_only.pct["휴면"]}%</b> (n={act.by_capped.capped_only.n}) —
              검색 상한 편향이 활성도 수치도 끌어올리고 있음을 시사한다.
            </Note>
          </section>

          {/* §4 직업 × 명성 격차 */}
          <section id="s4" className="mb-14">
            <SectionTitle no="§4" title="직업 × 명성 격차"
              sub="상위 20개 직업(정규화 전직명)의 명성 구간 구성. 셀 = 해당 직업 내 구간 비중(행 기준), 표본 10명 미만 셀은 마스킹." />
            <Heatmap rows={heat.rows} cols={heat.cols} cell={heat.cell} rowTotal={heat.rowTotal} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <p className="m-0 font-semibold" style={{ color: "var(--text-primary)" }}>상위 구간 과대 대표 (레이드권 비중 ÷ 전체 평균 {Math.round(gap.overallUpper * 100)}%)</p>
                <ul className="prose-block m-0 mt-1 list-none p-0">
                  {gap.top.map((r) => (
                    <li key={r.job} className="flex justify-between py-0.5">
                      <span>{r.job} <span className="num text-[11px]" style={{ color: "var(--text-muted)" }}>(n={r.total.toLocaleString()})</span></span>
                      <span className="num font-semibold" style={{ color: "var(--accent)" }}>×{r.index.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <p className="m-0 font-semibold" style={{ color: "var(--text-primary)" }}>상위 구간 과소 대표</p>
                <ul className="prose-block m-0 mt-1 list-none p-0">
                  {gap.bottom.map((r) => (
                    <li key={r.job} className="flex justify-between py-0.5">
                      <span>{r.job} <span className="num text-[11px]" style={{ color: "var(--text-muted)" }}>(n={r.total.toLocaleString()})</span></span>
                      <span className="num font-semibold">×{r.index.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Note>레이드권 = 미카엘라 입장 이상 3구간 합. ×1.00이면 전체 평균과 같은 비중. fame 표본 300명 이상 직업만 산출. 마스킹 셀은 합산에서 제외되어 하한값이다.</Note>
          </section>

          {/* §5 AI 인사이트 */}
          <section id="s5" className="mb-14">
            <SectionTitle no="§5" title="AI 인사이트"
              sub="집계 전체 + 편향 노트를 입력으로 생성 (배치 1회, 인용 수치는 집계 원본과 전수 대조 후 불일치 교정). 발견 → 해석 가설 → 필요한 추가 검증 구조. 단정 없음." />
            <div className="space-y-4">
              {census.insights.map((ins, i) => (
                <div key={i} className="rounded-md border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="num text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>#{i + 1}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={ins.confidence === "관찰"
                        ? { background: "var(--accent-soft)", color: "var(--accent)" }
                        : { background: "var(--masked)", color: "var(--text-secondary)" }}>
                      {ins.confidence}
                    </span>
                  </div>
                  <p className="m-0 text-[14px] font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>{ins.finding}</p>
                  <p className="prose-block m-0 mt-2 text-[13.5px]">{ins.interpretation}</p>
                  <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                    <b>검증에 필요한 것</b> — {ins.needed_validation}
                  </p>
                  <p className="m-0 mt-1.5 text-[12.5px] italic" style={{ color: "var(--accent)" }}>{ins.follow_up}</p>
                </div>
              ))}
            </div>
          </section>

          {/* §6 방법론과 한계 */}
          <section id="s6" className="mb-10">
            <SectionTitle no="§6" title="방법론과 한계" sub="표본 설계 · 확인된 편향 · 윤리 원칙 · 실측치. 이 섹션이 본 조사의 핵심이다." />

            <h3 className="mb-2 text-[15px] font-bold">표본 설계</h3>
            <div className="rounded-md border p-4 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <ol className="prose-block m-0 list-decimal space-y-1 pl-5">
                <li>한국어 2글자 시드 {seedStats.common + seedStats.rare}개 (흔한 조합 {seedStats.common} + 희귀 조합 {seedStats.rare}) × 8개 서버를 캐릭터 검색 API(포함 검색, 상한 200건)로 조회 — 호출 {seedStats.calls}건 중 상한 도달 {seedStats.capped}건 (45.8%)</li>
                <li>서버·캐릭터 기준 중복 제거 → 표본 프레임 {meta.sample_size.toLocaleString()}명 (검색 응답에 직업·레벨·명성이 포함되어 캐릭터당 추가 호출 없음)</li>
                <li>상한 도달 검색의 고명성 쏠림을 통제하기 위해 희귀 시드를 절반 배치하고, 상한 미도달 검색에서 발견된 비상한 표본 {meta.uncapped_sample_size.toLocaleString()}명의 분포를 별도 산출해 비교 공개</li>
                <li>활성도는 명성 6구간 비례 층화 서브샘플 {act.subsample_size}명의 최근 90일 타임라인으로 판정 (캐릭터당 1호출)</li>
                <li>AI 인사이트는 집계 JSON + 편향 노트를 입력으로 배치 1회 생성, 인용 수치를 집계 원본과 대조 검증</li>
              </ol>
            </div>

            <h3 className="mt-6 mb-2 text-[15px] font-bold">확인된 편향 (실측 근거 있음)</h3>
            <ul className="prose-block m-0 list-disc space-y-1.5 pl-5 text-[13.5px]">
              <li><b>검색 상한 고명성 쏠림</b> — 상한 도달 시 선별 기준 비공개. 비상한 표본은 레기온 미만 79.5% vs 전체 44.8% (§2). 본 조사 최대 편향.</li>
              <li><b>명성 결측 제외의 상향 편향</b> — 결측 1,441명 중 43.5%가 100 미만 저레벨. 제외로 피라미드가 실제보다 위로 치우칠 가능성.</li>
              <li><b>작명 문화 편향</b> — 한글 포함 검색이므로 영문·숫자·특수문자 작명 캐릭터는 구조적으로 제외.</li>
              <li><b>활성도 과소집계</b> — 타임라인은 행동 이벤트만 기록. 접속만 하는 유저는 휴면으로 판정될 수 있음.</li>
              <li><b>명성-활성 기울기의 교란 2종</b> — ① 구간별 타임라인 기록 밀도 차이 ② 검색 노출의 최근 접속 조건 미확인. §3의 기울기는 이 둘과 분리되지 않음.</li>
              <li><b>조사 단위 = 캐릭터</b> — 동일 유저의 다중 캐릭터 중복 가능. 유저 분포가 아님.</li>
            </ul>

            <h3 className="mt-6 mb-2 text-[15px] font-bold">확인 불가 항목</h3>
            <ul className="prose-block m-0 list-disc space-y-1 pl-5 text-[13.5px]">
              <li>검색 노출의 "최근 접속 여부" 조건 — 문서·실측 모두에서 확인 불가</li>
              <li>상한 도달 시 200명 선별 기준 (명성순·레벨순 아님까지만 실측 확인)</li>
              <li>서버별 전체 모집단 크기 — 표본 비율 산정 불가</li>
            </ul>

            <h3 className="mt-6 mb-2 text-[15px] font-bold">개인정보·윤리 원칙</h3>
            <ul className="prose-block m-0 list-disc space-y-1 pl-5 text-[13.5px]">
              <li>캐릭터명·모험단명·길드명은 수집·저장하지 않음. characterId는 타임라인 조사 직후 sha256 해시로 치환 폐기, 직업 UUID도 폐기</li>
              <li>공개 산출물은 집계 수치만 포함 — 식별 정보 잔존 자동 스캔 0건 통과</li>
              <li>특정 캐릭터를 지목하는 서술 없음. 표본 10명 미만 셀은 "표본 부족"으로 마스킹</li>
              <li>호출 간 0.3초 대기·재시도 1회·1회성 배치 — 상시 스케줄 아님</li>
            </ul>

            <h3 className="mt-6 mb-2 text-[15px] font-bold">실측치</h3>
            <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <table className="w-full text-[13px]">
                <tbody>
                  {[
                    ["표본 크기", `${meta.sample_size.toLocaleString()}명 (비상한 ${meta.uncapped_sample_size.toLocaleString()}명 · 명성 결측 ${meta.fame_missing.toLocaleString()}명)`],
                    ["타임라인 서브샘플", `${act.subsample_size}명 (층화 비례, 최소 구간 n=11)`],
                    ["API 호출 (누적)", `약 ${MEASURED.apiCalls}회 — 검증 43 + 직업 트리 1 + 검색 ${seedStats.calls + 1} + 타임라인 600, 실패 0`],
                    ["LLM 비용", `$${MEASURED.llmCostUsd} (인사이트 배치 2회 — 재생성 1회 포함, claude-haiku-4-5)`],
                    ["수집 소요", `검색 ${MEASURED.collectSec}초 + 타임라인 ${MEASURED.timelineSec}초`],
                    ["식별 정보 스캔", "커밋 산출물·체크포인트 모두 0건"],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      <td className="w-[160px] px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>{k}</td>
                      <td className="num px-3 py-2">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="prose-block mt-5 text-[13px]">
              데이터 출처: <a href="https://developers.neople.co.kr" target="_blank" rel="noreferrer">Neople 오픈 API</a> (캐릭터 검색·타임라인).
              원본 응답을 저장하지 않고 집계 수치만 공개합니다. 파이프라인·집계 코드는{" "}
              <a href="https://github.com/Yegeon99/arad-census" target="_blank" rel="noreferrer">GitHub 저장소</a> 참조.
            </p>
          </section>
        </main>
      </div>

      <footer className="border-t" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-[1080px] px-5 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
          <p className="m-0">본 서비스는 Neople 오픈 API에서 제공받은 데이터를 일부 가공하여 활용하고 있습니다.</p>
          <p className="m-0 mt-0.5">비공식 팬메이드 포트폴리오 — ㈜네오플·넥슨과 무관합니다. 게임 IP 아트워크를 사용하지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}
