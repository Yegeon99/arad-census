// 세리프로 그려지는 글자만 모아 글꼴 주소를 좁힌다.
// 한글 세리프 한 벌은 통째로 받으면 수백 킬로바이트라, 실제로 쓰는 글자만
// 요청하도록 index.html의 글꼴 주소를 다시 쓴다.
// 화면 글이 바뀌면 다시 돌린다: node scripts/serif-glyphs.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const indexPath = join(here, "..", "index.html");

const PAGES = ["overview", "jobs", "growth", "activity", "gap", "insights", "method"];
const SERIF = ".t-display, .t-title, .t-lead, h1, h2, h3";
// 화면에 따라 값이 바뀌는 자리에 나올 수 있는 글자를 미리 넣어 둔다.
const ALWAYS = "0123456789,.%배명개곳회포인트초일주년월 ";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4181, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const chars = new Set(ALWAYS);

for (const id of PAGES) {
  await page.goto(`http://localhost:4181/#${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // 접기 펼치기와 탭까지 눌러 숨은 제목도 모은다
  const buttons = await page.locator("main button").count();
  for (let i = 0; i < buttons; i += 1) {
    const btn = page.locator("main button").nth(i);
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(300);
  const text = await page.$$eval(SERIF, (els) => els.map((e) => e.innerText).join(""));
  for (const ch of text) if (ch.trim()) chars.add(ch);
}

await browser.close();
server.close();

const glyphs = [...chars].sort().join("");
const url = `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&text=${encodeURIComponent(glyphs)}&display=swap`;

let html = readFileSync(indexPath, "utf-8");
html = html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Serif\+KR[^"]*/g, url.replace(/&/g, "&amp;"));
writeFileSync(indexPath, html, "utf-8");

console.log(`세리프로 쓰는 글자 ${glyphs.length}자를 골라 글꼴 주소를 다시 썼습니다.`);
console.log(`주소 길이 ${url.length}자`);
