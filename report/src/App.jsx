import { useEffect, useMemo, useState } from "react";
import census from "./data/census.json";
import seedYield from "./data/seed_yield.json";
import { HBarList, CompareBars, Heatmap, StackBar, StackBar100, Legend, HeatScaleLegend, FlowDiagram } from "./components/charts.jsx";

// Phase별 실측치 (파이프라인 로그 기준 — 게이트 보고와 동일 수치)
const MEASURED = {
  apiCalls: 933, // 검증 43 + /df/jobs 1 + 검색 289 + 타임라인 600
  llmCostUsd: 0.0707, // 인사이트 배치 2회 (재생성 1회 포함) 실측
  collectSec: 87,
  timelineSec: 181,
  surveyedAt: "2026-08-25",
};

const SECTIONS = [
  { id: "s1", no: "1", title: "직업 분포" },
  { id: "s2", no: "2", title: "성장 피라미드" },
  { id: "s3", no: "3", title: "활성도" },
  { id: "s4", no: "4", title: "직업 × 명성 격차" },
  { id: "s5", no: "5", title: "AI 인사이트" },
  { id: "s6", no: "6", title: "방법론과 한계" },
];

const ACT_ORDER = ["주간 활성", "월간 활성", "저활성", "휴면"];
const ACT_COLORS = {
  "주간 활성": "var(--ink-6)",
  "월간 활성": "var(--ink-4)",
  "저활성": "var(--ink-3)",
  "휴면": "#D8D5CE",
};
const ACT_DARK = { "주간 활성": true, "월간 활성": true, "저활성": false, "휴면": false };

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

function SectionTitle({ no, title, lead }) {
  return (
    <div className="mb-6">
      <p className="num m-0 text-[13px] font-semibold tracking-widest" style={{ color: "var(--accent)" }}>§{no}</p>
      <h2 className="m-0 mt-0.5 text-[26px] font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {lead && <p className="lead m-0 mt-2.5">{lead}</p>}
    </div>
  );
}

function FindingQuote({ title, children }) {
  return (
    <blockquote className="finding-quote text-[14px]">
      {title && <p className="m-0 font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>}
      <p className="prose-block m-0 mt-0.5">{children}</p>
    </blockquote>
  );
}

function SmallBadge({ children }) {
  return (
    <span className="ml-1.5 rounded-sm px-1.5 py-0.5 text-[10.5px]" style={{ background: "var(--masked)", color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

function ConfidenceBadge({ value }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={value === "관찰"
        ? { background: "var(--accent)", color: "#fff" }
        : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--text-muted)" }}>
      {value}
    </span>
  );
}

export default function App() {
  const active = useScrollSpy(SECTIONS.map((s) => s.id));
  const d = census.distributions;
  const du = census.distributions_uncapped_only;
  const act = census.activity;
  const meta = census.meta;

  const fameN = meta.sample_size - meta.fame_missing; // 30,082
  const uncFameN = meta.uncapped_sample_size - meta.uncapped_fame_missing; // 4,087

  const fameCompare = useMemo(() => {
    const u = Object.fromEntries(du.fame_bins.map((b) => [b.range, b.pct]));
    return d.fame_bins.map((b) => ({ label: b.range, full: b.pct, unc: u[b.range] ?? 0 }));
  }, [d, du]);
  const gapAnnotate = useMemo(() => {
    const worst = [...fameCompare].sort((a, b) => Math.abs(b.unc - b.full) - Math.abs(a.unc - a.full))[0];
    return { label: worst.label, text: `차이 +${(worst.unc - worst.full).toFixed(1)}%p` };
  }, [fameCompare]);

  // 직업별 명성 표본 n (job_x_fame 비마스킹 셀 합 — 마스킹 셀 제외 하한)
  const heat = useMemo(() => {
    const cols = d.fame_bins.map((b) => b.range);
    const byJob = new Map();
    for (const c of d.job_x_fame) {
      if (!byJob.has(c.jobName)) byJob.set(c.jobName, {});
      byJob.get(c.jobName)[c.bin] = c.masked ? null : c.count;
    }
    const fameTotal = (cells) => Object.values(cells).reduce((s, v) => s + (v ?? 0), 0);
    const ranked = [...byJob.entries()]
      .map(([job, cells]) => ({ job, total: fameTotal(cells), masked: Object.values(cells).some((v) => v === null) }))
      .sort((a, b) => b.total - a.total);
    const rows = ranked.slice(0, 20).map((r) => r.job);
    let maxShare = 0;
    for (const { job, total } of ranked.slice(0, 20)) {
      for (const v of Object.values(byJob.get(job))) {
        if (v && total) maxShare = Math.max(maxShare, v / total);
      }
    }
    return {
      cols, rows, ranked, byJob, maxShare,
      cell: (r, c) => byJob.get(r)[c] ?? 0,
      rowTotal: (r) => fameTotal(byJob.get(r)),
    };
  }, [d]);

  const topJobs = heat.ranked.slice(0, 15).map((r) => ({ label: r.job, value: +(r.total / fameN * 100).toFixed(2) }));
  const top5Share = heat.ranked.slice(0, 5).reduce((s, r) => s + r.total, 0);
  const bottomJobs = heat.ranked.slice(-5).reverse().map((r) => ({ label: r.job, value: +(r.total / fameN * 100).toFixed(2) }));

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

  const dormantRaw = act.overall.find((o) => o.label === "휴면").pct;
  const dormantRw = act.reweighted_by_uncapped.pct["휴면"];
  const actLegend = ACT_ORDER.map((k) => ({ label: k, color: ACT_COLORS[k] }));

  const summary = [
    {
      href: "#s2", confidence: "관찰", title: "상한 도달 검색의 고명성 쏠림",
      text: `검색 288콜 중 132콜(45.8%)이 상한(200건)에 도달했고, 상한 미도달 검색에서만 발견된 비상한 표본은 레기온 미만이 ${fameCompare[0].unc}%로 전체 표본(${fameCompare[0].full}%)보다 훨씬 저명성 중심 — 본 조사 최대 편향.`,
    },
    {
      href: "#s3", confidence: "가설", title: "편향 보정 재추정 시 휴면 40% → 65%",
      text: `비상한 표본의 명성 분포를 가중치로 재추정하면 휴면 비율이 원 수치 ${dormantRaw}%에서 ${dormantRw}%로 커진다. 검색 상한 편향이 활성도도 끌어올리고 있을 가능성.`,
    },
    {
      href: "#s4", confidence: "가설", title: "직업별 레이드권 과대/과소 대표",
      text: `직업 내 레이드권(미카엘라 입장 이상) 비중이 전체 평균 ${(gap.overallUpper * 100).toFixed(1)}% 대비 ×${gap.top[0]?.index.toFixed(2)}(${gap.top[0]?.job})에서 ×${gap.bottom[gap.bottom.length - 1]?.index.toFixed(2)}(${gap.bottom[gap.bottom.length - 1]?.job})까지 벌어진다.`,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* 히어로 헤더 */}
      <header className="border-b" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-[840px] px-5 pt-14 pb-12">
          <p className="m-0 text-[13px] font-semibold tracking-widest" style={{ color: "var(--accent)" }}>ARAD CENSUS · 2026-08 조사 회차</p>
          <h1 className="mt-2 mb-4 text-[40px] font-bold sm:text-[44px]" style={{ color: "var(--text-primary)" }}>
            아라드 센서스
          </h1>
          <p className="prose-block m-0 max-w-[620px] text-[16px]">
            한국어 음절 시드 검색으로 추출한 던전앤파이터 캐릭터 표본의 직업·명성·활성도 분포 조사 — {MEASURED.surveyedAt}.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["전체 표본", meta.sample_size.toLocaleString(), "명"],
              ["비상한 표본", meta.uncapped_sample_size.toLocaleString(), "명"],
              ["타임라인 서브샘플", act.subsample_size.toLocaleString(), "명"],
              ["API 호출", MEASURED.apiCalls.toLocaleString(), "회"],
            ].map(([label, value, unit]) => (
              <div key={label} className="rounded-md border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
                <p className="caption m-0">{label}</p>
                <p className="num m-0 mt-0.5 text-[24px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                  {value}<span className="text-[13px] font-normal" style={{ color: "var(--text-muted)" }}> {unit}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="caption num m-0 mt-2">
            명성 표본 {fameN.toLocaleString()}명 (결측 {meta.fame_missing.toLocaleString()} 제외) · 비상한 명성 표본 {uncFameN.toLocaleString()}명
          </p>
          <p className="mt-6 rounded-md border px-4 py-3 text-[14px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-base)" }}>
            이 조사는 모집단 추정이 아니라 <b>표본조사 방법론의 시연</b>이다. 표본 추출 방식의 편향과 한계를 §6에서 그대로 공개한다.
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1080px] flex-1 gap-8 px-5">
        {/* 목차 사이드 내비 (스크롤 스파이) */}
        <nav className="sticky top-6 hidden h-fit w-[170px] shrink-0 pt-12 lg:block" aria-label="목차">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block border-l-2 py-1.5 pl-3 text-[13px] no-underline"
               style={{
                 borderColor: active === s.id ? "var(--accent)" : "var(--border)",
                 color: active === s.id ? "var(--accent)" : "var(--text-secondary)",
                 fontWeight: active === s.id ? 700 : 400,
               }}>
              §{s.no} {s.title}
            </a>
          ))}
        </nav>

        <main className="min-w-0 max-w-[840px] flex-1 pt-12 pb-16">
          {/* 요약 — 핵심 발견 3가지 */}
          <section className="mb-24">
            <h2 className="m-0 text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>요약 — 핵심 발견 3가지</h2>
            <div className="mt-4 space-y-4">
              {summary.map((s) => (
                <blockquote key={s.href} className="finding-quote text-[14px]">
                  <p className="m-0 flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}>
                    <ConfidenceBadge value={s.confidence} />
                    <a href={s.href} className="no-underline" style={{ color: "var(--text-primary)" }}>{s.title} ↓</a>
                  </p>
                  <p className="prose-block m-0 mt-1">{s.text}</p>
                </blockquote>
              ))}
            </div>
          </section>

          {/* §1 직업 분포 */}
          <section id="s1" className="mb-24">
            <SectionTitle no="1" title="직업 분포"
              lead="지금 아라드에서 어떤 직업이 가장 많이 플레이되고 있는가? 명성 표본 30,082명의 정규화된 최종 전직명 기준 상위 15개 직업." />
            <HBarList items={topJobs} accentCount={5} valueFmt={(v) => `${v}%`} />
            <div className="mt-5 space-y-4">
              <FindingQuote title="상위 발견">
                크루세이더가 {topJobs[0].value}%로 최다. 상위 5개 직업(크루세이더·다크템플러·넨마스터·브레이커·스위프트 마스터)이
                명성 표본의 {(top5Share / fameN * 100).toFixed(1)}%(n={top5Share.toLocaleString()})를 차지한다.
              </FindingQuote>
              <FindingQuote title="하위 발견">
                공개 직업 중 하위: {bottomJobs.map((j) => `${j.label} ${j.value}%`).join(", ")}.
                표본 10명 미만 직업과 외전 캐릭터는 "기타"로 합산했다.
              </FindingQuote>
              <FindingQuote>
                각성 단계 분포: 眞 {d.stage.find((s) => s.stage === "眞")?.pct}% — 표본 대부분이 최종 각성 상태다.
                검색 노출·상한 편향으로 성장 완료 캐릭터가 과대 대표되었을 가능성이 있다 (§6).
              </FindingQuote>
            </div>
            <p className="footnote m-0">
              직업 정규화: 1차 전직~眞 각성을 최종 전직명 하나로 합산. n은 명성 표본(전체 {meta.sample_size.toLocaleString()}명 중
              명성 결측 {meta.fame_missing.toLocaleString()}명 제외) 기준이며, 표본 10명 미만 마스킹 셀은 합산에서 제외되어 하한값이다.
              외전 캐릭터(다크나이트·크리에이터)는 전직 트리가 성장 단계명을 공유해 "기타"로 합산 (§6).
            </p>
          </section>

          {/* §2 성장 피라미드 */}
          <section id="s2" className="mb-24">
            <SectionTitle no="2" title="성장 피라미드 — 전체 표본 vs 비상한 표본"
              lead={`검색 상한(200건)에 도달한 검색은 어떤 캐릭터를 돌려주는가? 상한 도달 시 선별 기준은 비공개인데, 실측 결과 고명성 쪽으로 크게 쏠린다. 상한에 걸리지 않은 검색에서만 발견된 비상한 표본은 레기온 미만이 ${fameCompare[0].unc}%로, 전체 표본(${fameCompare[0].full}%)보다 훨씬 저명성 중심이다.`} />
            <CompareBars bins={fameCompare} leftKey="full" rightKey="unc"
              leftLabel={`전체 표본 n=${fameN.toLocaleString()} (명성 결측 제외)`}
              rightLabel={`비상한 표본 n=${uncFameN.toLocaleString()} (명성 결측 제외)`}
              annotate={gapAnnotate} />
            <p className="footnote m-0">
              명성 6구간은 컨텐츠 입장컷 기준(이상~미만). 명성 결측 {meta.fame_missing.toLocaleString()}명(비상한 {meta.uncapped_fame_missing.toLocaleString()}명)은
              분포에서 제외했다. 결측자의 43.5%가 100 미만 저레벨이라, 결측 제외는 피라미드를 추가로 상향 편향시킬 가능성이 있다 (§6).
            </p>
          </section>

          {/* §3 활성도 */}
          <section id="s3" className="mb-24">
            <SectionTitle no="3" title="활성도 — 원 수치와 편향 보정 재추정"
              lead={`표본 캐릭터들은 지금도 플레이 중인가? 층화 서브샘플 ${act.subsample_size}명(명성 구간 비례)의 최근 90일 타임라인으로 판정한 원 수치와, 검색 상한 편향을 보정한 방향의 재추정을 나란히 놓는다.`} />
            <div className="mb-3"><Legend entries={actLegend} /></div>
            <div className="space-y-2">
              <StackBar100 label="원 수치" sub={`n=${act.subsample_size}`}
                parts={ACT_ORDER.map((k) => {
                  const o = act.overall.find((x) => x.label === k);
                  return { label: k, value: o.count, color: ACT_COLORS[k], dark: ACT_DARK[k] };
                })} />
              <StackBar100 label="가중 재추정" sub="비상한 분포 가중"
                parts={ACT_ORDER.map((k) => ({ label: k, value: act.reweighted_by_uncapped.pct[k], color: ACT_COLORS[k], dark: ACT_DARK[k] }))} />
            </div>
            <FindingQuote>
              휴면 비율이 원 수치 {dormantRaw}%에서 재추정 {dormantRw}%로 커진다. 두 수치 모두 §6의 교란 요인
              (타임라인 기록 밀도, 검색 노출 조건)을 제거하지 못한다.
            </FindingQuote>

            <h3 className="mt-8 mb-2 text-[16px] font-bold">명성 구간별 활성 구성 (구간별 n 병기)</h3>
            <p className="caption m-0 mb-2">색 구분은 섹션 상단 범례와 동일.</p>
            <div className="space-y-2">
              {act.by_fame_bin.map((b) => (
                <div key={b.bin} className="text-[12.5px]">
                  <div className="mb-0.5 flex justify-between" style={{ color: "var(--text-secondary)" }}>
                    <span>
                      {b.bin} <span className="num" style={{ color: "var(--text-muted)" }}>(n={b.n})</span>
                      {b.small_sample && <SmallBadge>표본 소</SmallBadge>}
                    </span>
                    <span className="num">휴면 {b.pct["휴면"]}%</span>
                  </div>
                  <StackBar parts={ACT_ORDER.map((k) => ({ label: k, value: b.counts[k], color: ACT_COLORS[k] }))} />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <FindingQuote>
                발견 경로별 비교<SmallBadge>표본 소</SmallBadge> — 비상한 표본의 휴면율 <b className="num">{act.by_capped.uncapped.pct["휴면"]}%</b> (n={act.by_capped.uncapped.n})
                vs 상한 표본 <b className="num">{act.by_capped.capped_only.pct["휴면"]}%</b> (n={act.by_capped.capped_only.n}) —
                검색 상한 편향이 활성도 수치도 끌어올리고 있음을 시사한다. 서브샘플 내 비상한 수(82명)가 작아 불확실성이 크다.
              </FindingQuote>
            </div>
            <p className="footnote m-0">
              가중 재추정: 명성 구간별 서브샘플 활성률에 비상한 표본의 구간 비중을 가중치로 곱해 합산 —
              검색 상한 편향을 저명성 쪽으로 보정한 방향의 추정치. 판정 기준: 최근 90일 타임라인 최신 이벤트의
              경과일 7일/30일/90일, 이벤트 없음은 휴면 (행동 이벤트만 기록되므로 과소집계 가능, §6).
            </p>
          </section>

          {/* §4 직업 × 명성 격차 */}
          <section id="s4" className="mb-24">
            <SectionTitle no="4" title="직업 × 명성 격차"
              lead="어떤 직업이 최상위 컨텐츠까지 성장해 있는가? 명성 표본 상위 20개 직업의 명성 구간 구성과, 레이드권 구간의 과대·과소 대표를 본다." />
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="caption num m-0">n(명성 표본) · 표본 10명 미만 셀은 마스킹</p>
              <HeatScaleLegend maxPct={Math.round(heat.maxShare * 100)} />
            </div>
            <Heatmap rows={heat.rows} cols={heat.cols} cell={heat.cell} rowTotal={heat.rowTotal} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { title: "상위 구간 과대 대표", rows: gap.top, accent: true },
                { title: "상위 구간 과소 대표", rows: gap.bottom, accent: false },
              ].map((card) => (
                <div key={card.title} className="rounded-md border p-3.5 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  <p className="m-0 font-semibold" style={{ color: "var(--text-primary)" }}>{card.title}</p>
                  <p className="caption num m-0 mt-0.5">지수 = 직업 내 레이드권(미카엘라 입장 이상) 비중 ÷ 전체 평균 {(gap.overallUpper * 100).toFixed(1)}%</p>
                  <ul className="prose-block m-0 mt-1.5 list-none p-0">
                    {card.rows.map((r) => (
                      <li key={r.job} className="flex justify-between py-0.5">
                        <span>{r.job} <span className="num text-[11px]" style={{ color: "var(--text-muted)" }}>(n={r.total.toLocaleString()})</span></span>
                        <span className="num font-semibold" style={card.accent ? { color: "var(--accent)" } : undefined}>×{r.index.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="footnote m-0">
              n은 명성 표본 기준(마스킹 셀 제외 하한). ×1.00이면 전체 평균과 같은 비중. 명성 표본 300명 이상 직업만 산출.
            </p>
          </section>

          {/* §5 AI 인사이트 */}
          <section id="s5" className="mb-24">
            <SectionTitle no="5" title="AI 인사이트"
              lead="집계 전체와 편향 노트를 입력으로 AI가 생성한 8개 인사이트. 인용 수치는 집계 원본과 전수 대조 후 교정했고, 발견 → 해석 → 필요한 추가 검증의 구조로 단정 없이 서술한다." />
            <div className="space-y-4">
              {census.insights.map((ins, i) => (
                <div key={i} className="rounded-md border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="num text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>#{i + 1}</span>
                    <ConfidenceBadge value={ins.confidence} />
                  </div>
                  <p className="m-0 text-[18px] font-bold leading-normal" style={{ color: "var(--text-primary)" }}>{ins.finding}</p>
                  <p className="prose-block m-0 mt-2.5 text-[14px]">
                    <span className="caption mr-1.5 font-semibold">해석</span>{ins.interpretation}
                  </p>
                  <p className="m-0 mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="caption mr-1.5 font-semibold">검증에 필요한 것</span>{ins.needed_validation}
                  </p>
                  <p className="m-0 mt-2.5 border-l-2 pl-2.5 text-[13px]" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                    <span className="caption mr-1.5 font-semibold">후속 질문</span>{ins.follow_up}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* §6 방법론과 한계 */}
          <section id="s6" className="mb-10">
            <SectionTitle no="6" title="방법론과 한계"
              lead="이 숫자들은 어떻게 만들어졌고, 어디까지 믿을 수 있는가? 표본 설계 · 확인된 편향 · 윤리 원칙 · 실측치. 이 섹션이 본 조사의 핵심이다." />

            <h3 className="mb-2 text-[16px] font-bold">표본 설계</h3>
            <FlowDiagram />
            <p className="footnote m-0">
              시드: 한국어 2글자 {seedStats.common + seedStats.rare}개(흔한 조합 {seedStats.common} + 희귀 조합 {seedStats.rare}) ×
              8개 서버, 포함 검색·상한 200건 — 호출 {seedStats.calls}건 중 상한 도달 {seedStats.capped}건(45.8%).
              검색 응답에 직업·레벨·명성이 포함되어 캐릭터당 추가 호출 없음. 서버·캐릭터 기준 중복 제거.
              상한 도달 편향 통제를 위해 희귀 시드를 절반 배치하고 비상한 표본 분포를 별도 산출·비교 공개.
              활성도는 명성 6구간 비례 층화 서브샘플의 최근 90일 타임라인 판정(캐릭터당 1호출).
              AI 인사이트는 집계 JSON + 편향 노트 입력으로 배치 생성 후 인용 수치 전수 대조.
            </p>

            <h3 className="mt-8 mb-2 text-[16px] font-bold">확인된 편향 (실측 근거 있음)</h3>
            <ul className="prose-block m-0 list-disc space-y-1.5 pl-5 text-[14px]">
              <li><b>검색 상한 고명성 쏠림</b> — 상한 도달 시 선별 기준 비공개. 비상한 표본은 레기온 미만 79.5% vs 전체 44.8% (§2). 본 조사 최대 편향.</li>
              <li><b>명성 결측 제외의 상향 편향</b> — 결측 1,441명 중 43.5%가 100 미만 저레벨. 제외로 피라미드가 실제보다 위로 치우칠 가능성.</li>
              <li><b>작명 문화 편향</b> — 한글 포함 검색이므로 영문·숫자·특수문자 작명 캐릭터는 구조적으로 제외.</li>
              <li><b>활성도 과소집계</b> — 타임라인은 행동 이벤트만 기록. 접속만 하는 유저는 휴면으로 판정될 수 있음.</li>
              <li><b>명성-활성 기울기의 교란 2종</b> — ① 구간별 타임라인 기록 밀도 차이 ② 검색 노출의 최근 접속 조건 미확인. §3의 기울기는 이 둘과 분리되지 않음.</li>
              <li><b>외전 캐릭터 합산</b> — 다크나이트·크리에이터는 전직 트리가 성장 단계명("자각1")을 공유해 직업 구분이 불가, "기타"로 합산 (371명, 1.2%).</li>
              <li><b>조사 단위 = 캐릭터</b> — 동일 유저의 다중 캐릭터 중복 가능. 유저 분포가 아님.</li>
            </ul>

            <h3 className="mt-8 mb-2 text-[16px] font-bold">확인 불가 항목</h3>
            <ul className="prose-block m-0 list-disc space-y-1 pl-5 text-[14px]">
              <li>검색 노출의 "최근 접속 여부" 조건 — 문서·실측 모두에서 확인 불가</li>
              <li>상한 도달 시 200명 선별 기준 (명성순·레벨순 아님까지만 실측 확인)</li>
              <li>서버별 전체 모집단 크기 — 표본 비율 산정 불가</li>
            </ul>

            <h3 className="mt-8 mb-2 text-[16px] font-bold">개인정보·윤리 원칙</h3>
            <ul className="prose-block m-0 list-disc space-y-1 pl-5 text-[14px]">
              <li>캐릭터명·모험단명·길드명은 수집·저장하지 않음. characterId는 타임라인 조사 직후 sha256 해시로 치환 폐기, 직업 UUID도 폐기</li>
              <li>공개 산출물은 집계 수치만 포함 — 식별 정보 잔존 자동 스캔 0건 통과</li>
              <li>특정 캐릭터를 지목하는 서술 없음. 표본 10명 미만 셀은 "표본 부족"으로 마스킹</li>
              <li>호출 간 0.3초 대기·재시도 1회·1회성 배치 — 상시 스케줄 아님</li>
            </ul>

            <h3 className="mt-8 mb-2 text-[16px] font-bold">실측치</h3>
            <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <table className="w-full text-[13px]">
                <tbody>
                  {[
                    ["표본 크기", `전체 ${meta.sample_size.toLocaleString()}명 · 명성 표본 ${fameN.toLocaleString()}명 · 비상한 ${meta.uncapped_sample_size.toLocaleString()}명 (명성 있음 ${uncFameN.toLocaleString()}명)`],
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
