// 넘침·겹침 검사. 글자를 키운 뒤 무엇이 밖으로 삐져나갔고 무엇이 서로 부딪는지 본다.
//
//   node scripts/overflow-check.mjs                    # 빌드 산출물
//   node scripts/overflow-check.mjs https://dnf-census.vercel.app   # 배포본
//
// 보는 것 네 가지.
//   1. 문서가 가로로 넘치는지 (스크롤바가 생기는지)
//   2. 화면 밖으로 나간 요소가 있는지. 가로 스크롤 상자 안에 든 것은 뺀다
//   3. SVG 글자가 제 그림틀 밖으로 나갔는지. 글자를 키우면 여기가 먼저 터진다
//   4. SVG 글자끼리 서로 겹치는지. 글자를 키우면 마주 보는 두 머리말이 가운데서 부딪는다
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const PAGES = ["overview", "jobs", "growth", "activity", "gap", "insights", "method"];
const VIEWS = [["데스크탑", { width: 1440, height: 900 }], ["모바일", { width: 390, height: 844 }]];
const SLACK = 1; // 소수점 반올림에서 오는 1픽셀은 넘침으로 치지 않는다

let base = process.argv[2];
let server = null;
if (!base) {
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
  server = createServer((req, res) => {
    let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
    if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
    res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
    res.end(readFileSync(p));
  });
  await new Promise((r) => server.listen(4193, r));
  base = "http://localhost:4193";
}

/** 지금 화면에서 넘친 것을 모은다. */
const LOOK = (slack) => {
  const out = { doc: 0, wide: [], svg: [], hit: [] };
  const vw = document.documentElement.clientWidth;
  out.doc = Math.max(0, document.documentElement.scrollWidth - vw);

  const label = (el) => {
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 2).join(".");
    const txt = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName}${cls ? "." + cls : ""} "${txt}"`;
  };

  // 가로로 일부러 굴리는 상자 안은 넘쳐도 된다
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (n.classList?.contains("scroll-x")) return true;
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };

  const main = document.querySelector("main") ?? document.body;
  for (const el of main.querySelectorAll("*")) {
    if (!el.getClientRects().length) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    const over = Math.max(0 - b.left, b.right - vw);
    if (over > slack && !inScroller(el)) out.wide.push({ over: Math.round(over), what: label(el) });
  }

  // SVG 글자가 제 그림틀을 벗어났는지, 그리고 글자끼리 겹치는지.
  // 그림틀 판정은 viewBox 좌표로, 겹침 판정은 화면 좌표로 본다.
  const short = (t) => (t.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
  for (const svg of document.querySelectorAll("svg")) {
    const vb = svg.viewBox?.baseVal;
    if (!vb || !vb.width) continue;
    const drawn = [];
    for (const t of svg.querySelectorAll("text")) {
      if (!t.getClientRects().length) continue;
      let box;
      try { box = t.getBBox(); } catch { continue; }
      const over = Math.max(vb.x - box.x, box.x + box.width - (vb.x + vb.width));
      if (over > slack) out.svg.push({ over: Math.round(over), what: short(t) });
      const r = t.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) drawn.push({ r, t });
    }
    // 마주 보는 머리말이 가운데서 부딪는 경우를 잡는다. 겹친 넓이가 두 글자
    // 가운데 작은 쪽의 8분의 1을 넘으면 겹침으로 본다. 1~2픽셀 스치는 것은 뺀다.
    for (let i = 0; i < drawn.length; i += 1) {
      for (let j = i + 1; j < drawn.length; j += 1) {
        const a = drawn[i].r, b = drawn[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w <= slack || h <= slack) continue;
        const area = w * h;
        const smaller = Math.min(a.width * a.height, b.width * b.height);
        if (area > smaller / 8) {
          out.hit.push({ area: Math.round(area), a: short(drawn[i].t), b: short(drawn[j].t) });
        }
      }
    }
  }
  return out;
};

const browser = await chromium.launch();
let bad = 0;

for (const [viewName, viewport] of VIEWS) {
  console.log(`[${viewName} ${viewport.width}]`);
  const page = await browser.newPage({ viewport });
  for (const name of PAGES) {
    // 이 리포트는 해시 라우팅이다. `/growth` 로 가면 첫 화면이 나온다.
    await page.goto(`${base}/#${name}`, { waitUntil: "networkidle" });
    // 등장 연출과 차트가 자리를 잡은 뒤에 잰다
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const r = await page.evaluate(LOOK, SLACK);
    const hit = r.doc > SLACK || r.wide.length > 0 || r.svg.length > 0 || r.hit.length > 0;
    if (!hit) { console.log(`  ${name}: 통과`); continue; }
    bad += 1;
    console.log(`  ✗ ${name}`);
    if (r.doc > SLACK) console.log(`      문서가 가로로 ${r.doc}픽셀 넘침`);
    for (const w of r.wide.slice(0, 6)) console.log(`      화면 밖 ${w.over}픽셀  ${w.what}`);
    for (const s of r.svg.slice(0, 6)) console.log(`      그림틀 밖 ${s.over}픽셀  글자 "${s.what}"`);
    for (const c of r.hit.slice(0, 6)) console.log(`      글자끼리 겹침 ${c.area}제곱픽셀  "${c.a}" ↔ "${c.b}"`);
  }
  await page.close();
}

await browser.close();
server?.close();

console.log(bad === 0 ? "\n넘침·겹침 검사: 통과" : `\n넘침·겹침 검사: 실패 ${bad}건`);
process.exit(bad === 0 ? 0 : 1);
