// 화면을 눈으로 확인할 때 쓰는 촬영기.
// node scripts/shot.mjs <화면> [누를 버튼 글자] [저장 이름]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const id = process.argv[2] ?? "overview";
const click = process.argv[3] ?? "";
const name = process.argv[4] ?? `check-${id}`;
const out = join(here, "..", "..", "docs", "captures", `${name}.png`);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4197, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`http://localhost:4197/#${id}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// 연출을 다 돌린 뒤 위로 돌아온다
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 70));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1200);
// 배치를 보려고 찍는 것이므로 등장 연출을 모두 끝난 상태로 고정한다.
// 위로 되돌아온 뒤에는 화면 밖 요소가 아직 안 켜져 있어 빈 칸처럼 찍힌다.
await page.evaluate(() => {
  for (const el of document.querySelectorAll("main *")) {
    const cs = getComputedStyle(el);
    if (Number(cs.opacity) < 1) el.style.opacity = "1";
    if (cs.transform !== "none") el.style.transform = "none";
  }
});
if (click) {
  await page.getByRole("button", { name: click }).first().click();
  await page.waitForTimeout(900);
}
await page.screenshot({ path: out, fullPage: true });
await browser.close();
server.close();
console.log("저장", out, "| 콘솔 오류", errs.length);
errs.forEach((e) => console.log("  ", e));
