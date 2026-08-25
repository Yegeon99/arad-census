// Playwright 캡처 (데스크톱·모바일 전 섹션) + 콘솔 메시지 수집
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const outDir = join(here, "..", "..", "docs", "captures");
mkdirSync(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!existsSync(p)) p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4179, r));

const browser = await chromium.launch();
const consoleMsgs = [];
const pageErrors = [];

async function shoot(name, viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleMsgs.push(`[${name}][${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => pageErrors.push(`[${name}] ${e.message}`));
  await page.goto("http://localhost:4179/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${name}-full.png`), fullPage: true });
  const sections = await page.$$eval("section[id]", (els) => els.map((e) => e.id));
  console.log(`${name}: 섹션 ${sections.length}개 (${sections.join(", ")})`);
  for (const id of sections) {
    const el = await page.$(`#${id}`);
    await el.screenshot({ path: join(outDir, `${name}-${id}.png`) });
  }
  await page.close();
}

await shoot("desktop", { width: 1440, height: 900 });
await shoot("mobile", { width: 390, height: 844 });

await browser.close();
server.close();

console.log(`콘솔 오류·경고: ${consoleMsgs.length}건`);
consoleMsgs.forEach((m) => console.log(" ", m));
console.log(`페이지 오류: ${pageErrors.length}건`);
pageErrors.forEach((m) => console.log(" ", m));
process.exit(consoleMsgs.length + pageErrors.length > 0 ? 1 : 0);
