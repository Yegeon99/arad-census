// 화면을 실제로 그려 놓고 훑는 검수.
//
//   node scripts/render-audit.mjs                      # 빌드 산출물
//   node scripts/render-audit.mjs https://dnf-census.vercel.app   # 배포본
//
// 보는 것 다섯 가지.
//   1. 옛 이름이 화면이나 머리말에 남아 있는지
//   2. 13픽셀보다 작은 글자가 있는지 (데스크탑과 모바일 둘 다)
//   3. 깨진 그림이 있는지
//   4. 바깥으로 나가는 링크가 살아 있는지
//   5. 공유 미리보기 그림(OG)이 열리는지
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const PAGES = ["overview", "jobs", "growth", "activity", "gap", "insights", "method"];
const VIEWS = [["데스크탑", { width: 1440, height: 900 }], ["모바일", { width: 390, height: 844 }]];
const MIN_PX = 13;
const OLD_NAMES = ["ARAD CENSUS", "Arad Census", "Arad 센서스", "아라드 센서스"];
const DASHES = ["—", "–"];

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
  await new Promise((r) => server.listen(4192, r));
  base = "http://localhost:4192";
}

const browser = await chromium.launch();
let bad = 0;
const say = (line, ok) => { if (!ok) bad += 1; console.log(`${ok ? "  " : "✗ "}${line}`); };

const consoleErrs = [];
const links = new Set();

for (const [viewName, viewport] of VIEWS) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("[.WebGL-")) consoleErrs.push(m.text()); });
  page.on("pageerror", (e) => consoleErrs.push(e.message));

  const small = new Map(); // 규칙 -> 나온 횟수
  let oldName = 0;
  let dash = 0;
  let brokenImg = 0;

  for (const id of PAGES) {
    await page.goto(`${base}/#${id}`, { waitUntil: "networkidle" });
    // 묶음이 한 프레임에 하나씩 들어온다. 다 들어올 때까지 기다린다.
    await page.waitForFunction(() => (document.querySelector("main")?.innerText.length ?? 0) > 400, null, { timeout: 15000 });
    await page.waitForTimeout(1500);

    const r = await page.evaluate((minPx) => {
      const small = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!el.getClientRects().length) continue;
        // 글자를 직접 담은 요소만 본다
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px >= minPx) continue;
        small.push({
          px: Math.round(px * 10) / 10,
          kind: el.namespaceURI?.includes("svg") ? "차트·삽화 글자" : "본문·라벨 글자",
          tag: el.tagName,
          cls: String(el.getAttribute("class") ?? "").split(" ").slice(0, 2).join(" "),
          text: el.textContent.trim().slice(0, 18),
        });
      }
      const imgs = [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length;
      const out = [...document.querySelectorAll("a[href^=http]")].map((a) => a.href);
      const head = [document.title, ...[...document.querySelectorAll("meta")].map((m) => m.content ?? "")].join("\n");
      return { small, imgs, out, blob: document.body.innerText + "\n" + head };
    }, MIN_PX);

    for (const s of r.small) {
      const key = `${s.px}픽셀  ${s.kind}  ${s.tag}${s.cls ? "." + s.cls : ""}`;
      const got = small.get(key) ?? { n: 0, where: `${id} "${s.text}"` };
      got.n += 1;
      small.set(key, got);
    }
    brokenImg += r.imgs;
    for (const u of r.out) links.add(u);
    for (const n of OLD_NAMES) oldName += r.blob.split(n).length - 1;
    for (const d of DASHES) dash += r.blob.split(d).length - 1;
  }

  console.log(`[${viewName} ${viewport.width}]`);
  say(`옛 이름 ${oldName}건`, oldName === 0);
  const smallTotal = [...small.values()].reduce((a, b) => a + b.n, 0);
  say(`${MIN_PX}픽셀보다 작은 글자 ${smallTotal}건`, smallTotal === 0);
  for (const [k, v] of [...small].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])))
    console.log(`    ${String(v.n).padStart(3)}건  ${k}  | ${v.where}`);
  say(`깨진 그림 ${brokenImg}건`, brokenImg === 0);
  say(`줄표 ${dash}건`, dash === 0);
  await page.close();
}

console.log("[바깥 링크]");
const probe = await browser.newPage();
for (const url of [...links].sort()) {
  const res = await probe.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
  say(`${res?.status() ?? "연결 실패"} ${url}`, Boolean(res) && res.status() < 400);
}

console.log("[공유 미리보기 그림]");
const ogUrl = base.startsWith("http://localhost") ? `${base}/og.png` : `${base}/og.png`;
const og = await probe.goto(ogUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
say(`${og?.status() ?? "연결 실패"} ${ogUrl}`, Boolean(og) && og.status() === 200);
await probe.close();

console.log("[콘솔]");
say(`오류 ${consoleErrs.length}건` + (consoleErrs.length ? ` ${consoleErrs.slice(0, 3)}` : ""), consoleErrs.length === 0);

console.log("");
console.log(bad === 0 ? "화면 검수: 통과" : `화면 검수: 실패 ${bad}건`);
await browser.close();
server?.close();
process.exitCode = bad ? 1 : 0;
