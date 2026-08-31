// 스크롤 한 번에 레이아웃이 몇 번 다시 계산되는지 센다.
// 스크롤 이벤트마다 요소 위치를 물어보면 그때마다 레이아웃이 강제로 돈다.
//
//   node scripts/perf-layout.mjs [화면] [CPU 배율] [스크롤 횟수]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const HASH = process.argv[2] ?? "overview";
const THROTTLE = Number(process.argv[3] ?? 4);
const STEPS = Number(process.argv[4] ?? 200);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
const PORT = 4184;
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
await cdp.send("Performance.enable");

await page.addInitScript(`
  window.__scrollEvents = 0;
  window.addEventListener("scroll", () => { window.__scrollEvents += 1; }, { passive: true, capture: true });
`);

await page.goto(`http://localhost:${PORT}/#${HASH}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
const g = (m, k) => m.metrics.find((x) => x.name === k)?.value ?? 0;
const before = await cdp.send("Performance.getMetrics");
const t0 = Date.now();

for (let i = 0; i < STEPS; i += 1) {
  await page.mouse.wheel(0, 90);
}
await page.waitForTimeout(500);

const after = await cdp.send("Performance.getMetrics");
const wall = Date.now() - t0;
const events = await page.evaluate(() => window.__scrollEvents);

const layouts = g(after, "LayoutCount") - g(before, "LayoutCount");
const styles = g(after, "RecalcStyleCount") - g(before, "RecalcStyleCount");
const layoutMs = (g(after, "LayoutDuration") - g(before, "LayoutDuration")) * 1000;
const styleMs = (g(after, "RecalcStyleDuration") - g(before, "RecalcStyleDuration")) * 1000;
const scriptMs = (g(after, "ScriptDuration") - g(before, "ScriptDuration")) * 1000;
const taskMs = (g(after, "TaskDuration") - g(before, "TaskDuration")) * 1000;

console.log(`화면 #${HASH}  DOM 요소 ${nodes.toLocaleString()}개  CPU ${THROTTLE}배 느리게`);
console.log(`스크롤 ${STEPS}번 굴림, 스크롤 이벤트 ${events}건, 실제 걸린 시간 ${wall}밀리초`);
console.log("");
console.log(`  레이아웃 계산  ${String(layouts).padStart(6)}회  ${Math.round(layoutMs)}밀리초` +
  `  (스크롤 이벤트당 ${(layouts / Math.max(1, events)).toFixed(2)}회)`);
console.log(`  스타일 계산    ${String(styles).padStart(6)}회  ${Math.round(styleMs)}밀리초`);
console.log(`  스크립트                  ${Math.round(scriptMs)}밀리초`);
console.log(`  전체 작업                 ${Math.round(taskMs)}밀리초  (측정 구간의 ${((taskMs / wall) * 100).toFixed(1)}%)`);

await browser.close();
server.close();
