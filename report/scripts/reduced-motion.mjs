// 움직임 최소화 설정에서 연출을 건너뛰고 처음부터 완성된 상태인지 본다.
// 화면 일곱 개에 곧장 들어가 250밀리초 뒤를 보고, 첫 화면 안에 안 나온 요소가
// 하나라도 있으면 실패로 잡는다.
// 실행: node scripts/reduced-motion.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4184, r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
let bad = 0;
for (const id of ["overview", "jobs", "growth", "activity", "gap", "insights", "method"]) {
  await page.goto(`http://localhost:4184/#${id}`, { waitUntil: "load" });
  await page.waitForTimeout(250); // 연출을 건너뛴다면 이 시점에 이미 전부 보여야 한다
  const r = await page.evaluate(() => {
    let faded = 0;
    const which = [];
    for (const el of document.querySelectorAll("main *")) {
      if (!el.getClientRects().length) continue;
      const box = el.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= window.innerHeight) continue;
      if (Number(getComputedStyle(el).opacity) < 0.05) {
        faded += 1;
        const b = el.getBoundingClientRect();
        which.push(`${el.tagName}.${String(el.className?.baseVal ?? el.className ?? "")}`.slice(0, 50) + ` top=${Math.round(b.top)}`);
      }
    }
    const stat = document.querySelector("main .t-display")?.innerText ?? "";
    const rule = document.querySelector("main hr.rule");
    return { faded, which, stat, ruleScale: rule ? getComputedStyle(rule).transform : "none", len: document.querySelector("main").innerText.length };
  });
  if (r.faded > 0 || r.len < 400) bad += 1;
  console.log(id, JSON.stringify(r));
}
console.log(bad === 0 ? "움직임 최소화: 통과" : `움직임 최소화: 실패 ${bad}건`);
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
