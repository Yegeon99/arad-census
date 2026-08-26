// 빌드 산출물을 띄워 화면별 캡처를 찍고, 화면에 실제로 나오는 글을 모아 둔다.
// 모아 둔 글은 scripts/verify_final.py 의 금지 표현 검사에 쓰인다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const outDir = join(here, "..", "..", "docs", "captures");
const textOut = join(here, "..", "..", "docs", "rendered_text.txt");
mkdirSync(outDir, { recursive: true });

const PAGES = [
  ["overview", "한눈에 보기"],
  ["jobs", "직업"],
  ["growth", "성장 단계"],
  ["activity", "활성도"],
  ["gap", "직업과 성장 격차"],
  ["insights", "AI 인사이트"],
  ["method", "조사 방법과 한계"],
];
const SOLID_PAGES = new Set(["overview", "gap"]);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4179, r));

const browser = await chromium.launch();
const problems = [];
const driverNotes = []; // 헤드리스 그래픽 드라이버가 캡처 중에 남기는 알림 (페이지 코드와 무관)
const texts = [];

async function collectText(page, tag) {
  const t = await page.evaluate(() => document.body.innerText);
  texts.push(`===== ${tag} =====\n${t}`);
}

/**
 * 화면 전체를 한 장으로 담는다.
 * fullPage 옵션은 그리기를 미루는 입체 화면을 빈 칸으로 남기므로,
 * 창 높이를 문서 높이만큼 늘려서 실제로 한 번 더 그리게 한 뒤 찍는다.
 */
async function shootWhole(page, path, width) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const tall = Math.min(height + 20, 9000);
  await page.setViewportSize({ width, height: tall });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(400);
  await page.screenshot({ path });
}

/** 아래까지 한 번 훑어 화면에 들어와야 그려지는 요소를 모두 깨운다. */
async function scrollThrough(page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1400);
}

/** 접기 펼치기, 탭, 필터를 모두 눌러 숨은 글까지 모은다. */
async function exerciseControls(page, tag) {
  const count = await page.locator("main button").count();
  for (let i = 0; i < count; i += 1) {
    const btn = page.locator("main button").nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    if (await btn.isDisabled().catch(() => true)) continue;
    await btn.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(120);
    await collectText(page, `${tag} 조작 ${i + 1}`);
  }
}

async function shoot(label, viewport, { withText }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const text = m.text();
    if (text.startsWith("[.WebGL-")) driverNotes.push(`[${label}] ${text}`);
    else problems.push(`[${label}][${m.type()}] ${text}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}][pageerror] ${e.message}`));

  for (const [id, name] of PAGES) {
    await page.goto(`http://localhost:4179/#${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await scrollThrough(page);
    await shootWhole(page, join(outDir, `${label}-${id}.png`), viewport.width);
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    if (withText) {
      await collectText(page, `${label} ${id} ${name}`);
      await exerciseControls(page, `${label} ${id}`);
    }
    // 입체 화면이 있는 곳은 평면으로 바꾼 상태도 한 장 남긴다
    if (withText && SOLID_PAGES.has(id)) {
      const flat = page.getByRole("button", { name: "평면으로 보기" });
      if (await flat.count()) {
        await flat.first().click().catch(() => {});
        await page.waitForTimeout(400);
        await scrollThrough(page);
        await shootWhole(page, join(outDir, `${label}-${id}-flat.png`), viewport.width);
        await page.setViewportSize(viewport);
      }
    }
  }
  await page.close();
}

await shoot("desktop", { width: 1440, height: 900 }, { withText: true });
await shoot("mobile", { width: 390, height: 844 }, { withText: false });

await browser.close();
server.close();

writeFileSync(textOut, texts.join("\n\n"), "utf-8");
console.log(`캡처 저장: ${outDir}`);
console.log(`화면 글 모음: ${textOut} (${texts.length}개 상태)`);
console.log(`페이지 콘솔 오류와 경고: ${problems.length}건`);
problems.forEach((m) => console.log(" ", m));
console.log(`헤드리스 그래픽 드라이버 알림: ${driverNotes.length}건 (페이지 코드와 무관)`);
process.exit(problems.length > 0 ? 1 : 0);
