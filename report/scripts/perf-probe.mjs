import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4180";
const browser = await chromium.launch();

async function probe(hash) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pending = new Map();
  page.on("request", (r) => pending.set(r.url(), Date.now()));
  page.on("requestfinished", (r) => pending.delete(r.url()));
  page.on("requestfailed", (r) => pending.delete(r.url()));

  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");

  const t0 = Date.now();
  await page.goto(`${BASE}/#${hash}`, { waitUntil: "commit" });

  // load 이벤트 발생 시각
  let loadAt = null;
  page.on("load", () => { loadAt = Date.now() - t0; });
  await page.waitForTimeout(6000);

  const readyState = await page.evaluate(() => document.readyState);
  const navTiming = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    return n ? { load: Math.round(n.loadEventEnd), dcl: Math.round(n.domContentLoadedEventEnd) } : null;
  });

  // 5초 지난 시점부터 10초 동안 메인 스레드 점유 측정
  const before = await cdp.send("Performance.getMetrics");
  const g = (m, k) => m.metrics.find((x) => x.name === k)?.value ?? 0;
  const rafBefore = await page.evaluate(() => {
    window.__f = 0;
    const tick = () => { window.__f += 1; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return 0;
  });
  const w0 = Date.now();
  await page.waitForTimeout(10000);
  const after = await cdp.send("Performance.getMetrics");
  const wall = (Date.now() - w0) / 1000;
  const frames = await page.evaluate(() => window.__f);

  const script = g(after, "ScriptDuration") - g(before, "ScriptDuration");
  const layout = g(after, "LayoutDuration") - g(before, "LayoutDuration");
  const style = g(after, "RecalcStyleDuration") - g(before, "RecalcStyleDuration");
  const task = g(after, "TaskDuration") - g(before, "TaskDuration");

  const stuck = [...pending.entries()].map(([u, at]) => `${Math.round((Date.now() - at) / 1000)}초 대기 ${u.slice(0, 90)}`);

  await ctx.close();
  return {
    hash,
    readyState,
    loadEventMs: navTiming?.load ?? null,
    busyPct: +((task / wall) * 100).toFixed(1),
    scriptPct: +((script / wall) * 100).toFixed(1),
    layoutPct: +((layout / wall) * 100).toFixed(1),
    stylePct: +((style / wall) * 100).toFixed(1),
    fps: +(frames / wall).toFixed(1),
    pending: stuck,
  };
}

for (const h of ["overview", "jobs", "gap", "method"]) {
  const r = await probe(h);
  console.log(`#${r.hash}  메인 스레드 ${r.busyPct}%  (스크립트 ${r.scriptPct}, 레이아웃 ${r.layoutPct}, 스타일 ${r.stylePct})  프레임 ${r.fps}/초  readyState ${r.readyState}  load ${r.loadEventMs}ms`);
  if (r.pending.length) r.pending.forEach((p) => console.log("   미완료:", p));
}
await browser.close();
