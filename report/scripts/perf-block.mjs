// 메인 스레드가 얼마나 오래 막히는지 잰다.
// 진입, 스크롤, 보정 전환 클릭 세 가지 상황을 CPU 저속 조건에서 반복 측정한다.
//
//   node scripts/perf-block.mjs [반복횟수] [CPU 배율]
//
// 판정 기준: 어느 상황에서도 한 번에 200밀리초를 넘겨 막히지 않아야 한다.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const RUNS = Number(process.argv[2] ?? 20);
const THROTTLE = Number(process.argv[3] ?? 4);
const LIMIT_MS = 200;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
const PORT = 4186;
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();

// 페이지 안에서 긴 작업을 직접 주워 담는다. 이름이 붙는 것은 브라우저가 주는 대로 쓴다.
const WATCH = `
  window.__blocks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__blocks.push({ at: e.startTime, ms: e.duration });
    }).observe({ entryTypes: ["longtask"] });
  } catch (err) { window.__blockErr = String(err); }
  window.__mark = (tag) => { window.__blocks.push({ tag, at: performance.now(), ms: 0 }); };
`;

const since = (page, from) =>
  page.evaluate((t) => window.__blocks.filter((b) => b.ms > 0 && b.at >= t).map((b) => b.ms), from);

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await page.addInitScript(WATCH);
  return { ctx, page };
}

/** 진입 직후 막히는 시간 */
async function enterRun(hash) {
  const { ctx, page } = await newPage();
  await page.goto(`http://localhost:${PORT}/#${hash}`, { waitUntil: "commit" });
  await page.waitForTimeout(3500);
  const blocks = await since(page, 0);
  await ctx.close();
  return blocks;
}

/** 사람이 굴리듯 조금씩 여러 번 굴리며 막히는 시간 */
async function scrollRun(hash) {
  const { ctx, page } = await newPage();
  await page.goto(`http://localhost:${PORT}/#${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const from = await page.evaluate(() => performance.now());
  for (let i = 0; i < 24; i += 1) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(600);
  const blocks = await since(page, from);
  await ctx.close();
  return blocks;
}

/** 성장 단계 화면에서 관측값과 보정값을 오가며 막히는 시간 */
async function toggleRun() {
  const { ctx, page } = await newPage();
  await page.goto(`http://localhost:${PORT}/#growth`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const to = page.getByRole("button", { name: /보정값/ });
  const back = page.getByRole("button", { name: /관측값/ });
  await to.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const from = await page.evaluate(() => performance.now());
  for (let i = 0; i < 3; i += 1) {
    await to.click();
    await page.waitForTimeout(500);
    await back.click();
    await page.waitForTimeout(500);
  }
  const blocks = await since(page, from);
  await ctx.close();
  return blocks;
}

const SCENARIOS = [
  ["한눈에 보기 진입", () => enterRun("overview")],
  ["한눈에 보기 스크롤", () => scrollRun("overview")],
  ["성장 단계 스크롤", () => scrollRun("growth")],
  ["성장 단계 보정 전환", () => toggleRun()],
  ["조사 방법 진입", () => enterRun("method")],
];

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

console.log(`CPU ${THORTTLE_LABEL()} 조건, 상황마다 ${RUNS}회 반복. 기준 한 번에 ${LIMIT_MS}밀리초 이하`);
function THORTTLE_LABEL() { return `${THROTTLE}배 느리게`; }
console.log("");

let worst = 0;
for (const [name, run] of SCENARIOS) {
  const maxes = [];
  const all = [];
  for (let i = 0; i < RUNS; i += 1) {
    const blocks = await run();
    maxes.push(blocks.length ? Math.max(...blocks) : 0);
    all.push(...blocks);
  }
  const max = Math.max(...maxes);
  const over = maxes.filter((m) => m > LIMIT_MS).length;
  worst = Math.max(worst, max);
  console.log(
    `${name.padEnd(18)} 가장 긴 멈춤 ${String(Math.round(max)).padStart(6)}밀리초` +
    `  회차 중앙값 ${String(Math.round(pct(maxes, 50))).padStart(5)}` +
    `  95번째 ${String(Math.round(pct(maxes, 95))).padStart(5)}` +
    `  기준 초과 ${over}/${RUNS}회` +
    `  (긴 작업 ${all.length}건)`
  );
}

console.log("");
console.log(worst > LIMIT_MS
  ? `판정: 실패. 가장 긴 멈춤 ${Math.round(worst)}밀리초가 기준 ${LIMIT_MS}밀리초를 넘습니다`
  : `판정: 통과. 가장 긴 멈춤 ${Math.round(worst)}밀리초`);

await browser.close();
server.close();
process.exit(worst > LIMIT_MS ? 1 : 0);
