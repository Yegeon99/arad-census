// 어느 함수가 메인 스레드를 붙잡는지 CPU 프로파일로 찾는다.
//
//   node scripts/perf-profile.mjs <상황> [CPU 배율]
//   상황: enter-overview | scroll-overview | scroll-growth | toggle-growth
//         | drag-growth | tabs-method | enter-method
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const WHAT = process.argv[2] ?? "scroll-overview";
const THROTTLE = Number(process.argv[3] ?? 4);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
const PORT = 4185;
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

const hash = WHAT.endsWith("overview") ? "overview" : WHAT.endsWith("method") ? "method" : "growth";
const profileEntry = WHAT.startsWith("enter");

if (!profileEntry) {
  await page.goto(`http://localhost:${PORT}/#${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}

await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");

if (profileEntry) {
  await page.goto(`http://localhost:${PORT}/#${hash}`, { waitUntil: "commit" });
  await page.waitForTimeout(4000);
} else if (WHAT.startsWith("scroll")) {
  for (let i = 0; i < 30; i += 1) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(800);
} else if (WHAT === "toggle-growth") {
  const to = page.getByRole("button", { name: /보정값/ });
  const back = page.getByRole("button", { name: /관측값/ });
  await to.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  for (let i = 0; i < 4; i += 1) {
    await to.click(); await page.waitForTimeout(450);
    await back.click(); await page.waitForTimeout(450);
  }
} else if (WHAT === "drag-growth") {
  const slider = page.locator("#pyramid-slider");
  await slider.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 40; i += 1) {
    await page.mouse.move(box.x + (box.width * i) / 40, box.y + box.height / 2);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
} else if (WHAT === "tabs-method") {
  for (let i = 0; i < 3; i += 1) {
    for (const name of ["처음 조사와 달라진 점", "다시 재본 결과", "편향과 확인 불가 항목", "개인정보와 실측치", "표본 설계"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.waitForTimeout(320);
    }
  }
}

const { profile } = await cdp.send("Profiler.stop");

// 자기 시간 합산
const byNode = new Map();
for (const n of profile.nodes) byNode.set(n.id, n);
const self = new Map();
const total = profile.samples?.length ?? 0;
const interval = (profile.endTime - profile.startTime) / Math.max(1, total);
for (const id of profile.samples ?? []) {
  self.set(id, (self.get(id) ?? 0) + 1);
}
const rows = [...self.entries()]
  .map(([id, n]) => {
    const node = byNode.get(id);
    const f = node?.callFrame ?? {};
    const where = f.url ? `${f.url.split("/").pop()}:${f.lineNumber + 1}` : "";
    return { name: f.functionName || "(익명)", where, ms: (n * interval) / 1000, n };
  })
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 18);

const wall = (profile.endTime - profile.startTime) / 1000;
console.log(`상황 ${WHAT}, CPU ${THROTTLE}배 느리게, 측정 구간 ${Math.round(wall)}밀리초`);
console.log(`표본 ${total}개, 표본 간격 ${(interval / 1000).toFixed(2)}밀리초`);
console.log("");
console.log("자기 시간이 긴 함수");
for (const r of rows) {
  if (r.ms < 1) continue;
  console.log(`  ${String(Math.round(r.ms)).padStart(6)}밀리초  ${r.name.slice(0, 42).padEnd(44)} ${r.where}`);
}

await browser.close();
server.close();
