// 인사이트 화면 표시 안정성 간헐 실패 원인 추적.
// 같은 조건으로 20회 반복하고, 실패한 회차의 DOM 상태를 그대로 남긴다.
// node scripts/diagnose-insights.mjs [반복횟수]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const RUNS = Number(process.argv[2] ?? 20);
// 경합을 일부러 만든다. 실제 실패는 다른 화면을 먼저 돌린 뒤 느려진 상태에서 났다.
const THROTTLE = Number(process.argv[3] ?? 1);
const WAIT_MS = 1000;
const PORT = 4193;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
let fails = 0;
const detail = [];

for (let i = 0; i < RUNS; i += 1) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  }
  await page.goto(`http://localhost:${PORT}/#insights`, { waitUntil: "load" });
  await page.waitForTimeout(WAIT_MS);

  const snap = await page.evaluate(() => {
    const main = document.querySelector("main");
    const faded = [];
    for (const el of main.querySelectorAll("*")) {
      if (!el.getClientRects().length) continue;
      const box = el.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= window.innerHeight - 40) continue;
      const cs = getComputedStyle(el);
      if (Number(cs.opacity) < 0.05 || cs.visibility === "hidden") {
        faded.push({
          tag: el.tagName,
          cls: String(el.className?.baseVal ?? el.className ?? "").slice(0, 30),
          opacity: cs.opacity,
          transform: cs.transform === "none" ? "none" : "있음",
          top: Math.round(box.top),
          height: Math.round(box.height),
          // 이 요소가 감싸고 있는 첫 제목으로 어느 카드인지 알아본다
          heading: (el.querySelector("h3")?.textContent ?? "").slice(0, 22),
          childCount: el.children.length,
        });
      }
    }
    return {
      faded,
      cards: main.querySelectorAll("h3").length,
      openCards: main.querySelectorAll('button[aria-expanded="true"]').length,
      miniCharts: main.querySelectorAll("svg").length,
      docHeight: document.body.scrollHeight,
      viewport: window.innerHeight,
    };
  });

  if (snap.faded.length) {
    fails += 1;
    detail.push({ run: i + 1, ...snap });
    console.log(`  회차 ${i + 1}: 실패, 안 보이는 요소 ${snap.faded.length}개`);
    for (const f of snap.faded) {
      console.log(`      <${f.tag}> 클래스 "${f.cls}" 투명도 ${f.opacity} 위치 ${f.top} 높이 ${f.height}` +
        ` 자식 ${f.childCount} 제목 "${f.heading}"`);
    }
  }
  await page.close();
}

await browser.close();
server.close();

console.log("");
console.log(`인사이트 화면 ${RUNS}회(CPU ${THROTTLE}배 지연) 중 실패 ${fails}회 (실패율 ${(fails / RUNS * 100).toFixed(0)}%)`);
if (detail.length) {
  const heights = [...new Set(detail.flatMap((d) => d.faded.map((f) => f.height)))];
  const tops = [...new Set(detail.flatMap((d) => d.faded.map((f) => f.top)))];
  console.log(`실패한 요소의 화면 위치 ${tops.join(", ")}`);
  console.log(`실패한 요소의 높이 ${heights.join(", ")}`);
  console.log(`카드 수 ${[...new Set(detail.map((d) => d.cards))].join(", ")}` +
    ` / 펼친 카드 ${[...new Set(detail.map((d) => d.openCards))].join(", ")}` +
    ` / 그림 요소 ${[...new Set(detail.map((d) => d.miniCharts))].join(", ")}`);
}
process.exit(fails ? 1 : 0);
