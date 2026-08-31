// 세리프로 그리기로 한 글자가 실제로 그 글꼴로 그려지는지 화면마다 확인한다.
// 서브셋으로 글꼴 주소를 좁히면 목록에 없는 글자가 폴백으로 떨어져 깨져 보인다.
// 이 검사는 그 상태를 잡아낸다: node scripts/font-check.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const PAGES = ["overview", "jobs", "growth", "activity", "gap", "insights", "method"];
const SERIF = ".t-display, .t-title, .t-lead, h1, h2, h3";
const FACES = ['400 16px "Noto Serif KR"', '700 16px "Noto Serif KR"'];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
const PORT = 4189;
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let missing = 0;
let checked = 0;

const collect = () =>
  page.evaluate((sel) =>
    [...document.querySelectorAll(sel)].map((e) => e.innerText).filter(Boolean).join(""), SERIF);

for (const id of PAGES) {
  await page.goto(`http://localhost:${PORT}/#${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // 탭은 누를 때마다 앞의 내용이 사라진다. 한 번 누를 때마다 그 자리에서
  // 글자를 걷어 와야 모든 탭의 제목이 빠짐없이 모인다.
  let text = await collect();
  const buttons = await page.locator("main button").count();
  for (let i = 0; i < buttons; i += 1) {
    const btn = page.locator("main button").nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(220);
    text += await collect();
  }

  const report = await page.evaluate(async ({ text: all, faces }) => {
    const chars = new Set();
    for (const ch of all) if (ch.trim()) chars.add(ch);
    const joined = [...chars].join("");
    // 필요한 조각을 먼저 받아 둔다 (unicode-range 로 쪼개져 온다)
    for (const f of faces) await document.fonts.load(f, joined).catch(() => {});
    await document.fonts.ready;

    // document.fonts.check() 는 글자를 못 그려도 참을 돌려준다. 폴백으로
    // 떨어졌는지 알려면 실제로 그려 보고 너비를 견주는 수밖에 없다.
    // 대조군 글꼴 두 벌 모두와 너비가 같으면 세리프가 안 걸린 것이다.
    const ctx = document.createElement("canvas").getContext("2d");
    const width = (ch, family, weight) => {
      ctx.font = `${weight} 48px ${family}`;
      return ctx.measureText(ch).width;
    };
    const bad = [];
    for (const ch of chars) {
      let drawn = false;
      for (const weight of [400, 700]) {
        for (const sentinel of ["monospace", "sans-serif"]) {
          const base = width(ch, sentinel, weight);
          const test = width(ch, `"Noto Serif KR", ${sentinel}`, weight);
          if (test !== base) { drawn = true; break; }
        }
        if (drawn) break;
      }
      if (!drawn) bad.push(ch);
    }
    return { total: chars.size, bad };
  }, { text, faces: FACES });

  checked += report.total;
  missing += report.bad.length;
  console.log(`${id}: 세리프 글자 ${report.total}자 중 빠진 글자 ${report.bad.length}자` +
    (report.bad.length ? ` — ${report.bad.slice(0, 24).join(" ")}` : ""));
}

await browser.close();
server.close();
console.log(`합계: ${checked}자 확인, 폴백으로 떨어지는 글자 ${missing}자`);
process.exit(missing ? 1 : 0);
