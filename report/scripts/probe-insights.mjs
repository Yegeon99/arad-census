// 모바일 인사이트 화면만 되풀이해 재는 조사용 측정기.
//
//   node scripts/probe-insights.mjs 40        # 40회
//
// stability.mjs 의 빠른 스크롤과 같은 조건(초당 화면 3개, 100밀리초마다 들여다봄,
// CPU 4배 느리게)으로 이 화면 하나만 되풀이해 훑는다. 빈 화면이 잡힌 그 순간의
// DOM 과 배치 상태를 같이 남겨, 무엇이 밀려 있었는지 보게 한다.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const outPath = join(here, "..", "..", "docs", "probe-insights.json");
mkdirSync(dirname(outPath), { recursive: true });

const RUNS = Number(process.argv[2] ?? 40);
const VIEWPORT = { width: 390, height: 844 };
const SCROLL_SCREENS_PER_SEC = 3;
const SAMPLE_MS = 100;
const CPU = 4;
const PORT = 4210;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(PORT, r));

/** 지금 화면에 무엇이 나와 있고, 그리는 쪽은 어디까지 갔는지 한 번에 본다. */
const LOOK = () => {
  const h = window.innerHeight;
  const main = document.querySelector("main");
  if (!main) return { chars: 0, shapes: 0, inView: 0, textEls: 0, faded: 0 };

  const seen = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.display === "none") return 0;
      o *= Number(cs.opacity);
      if (o < 0.05) return 0;
    }
    return o;
  };

  let chars = 0, shapes = 0, inView = 0, textEls = 0, faded = 0;
  let fadedWhat = "";
  for (const el of main.querySelectorAll("*")) {
    if (!el.getClientRects().length) continue;
    const b = el.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= h) continue;
    inView += 1;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const shape = /^(svg|canvas|img)$/i.test(el.tagName) && b.width * b.height > 2000;
    if (!ownText && !shape) continue;
    textEls += 1;
    if (seen(el) > 0) {
      if (ownText) chars += el.textContent.trim().length;
      if (shape) shapes += 1;
    } else {
      faded += 1;
      if (!fadedWhat) {
        fadedWhat = String(el.className?.baseVal ?? el.className ?? el.tagName).slice(0, 40);
        // 투명도의 주인을 찾는다. 위로 거슬러 올라가며 1보다 작은 놈을 다 적는다.
        window.__chain = [];
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n);
          const o = Number(cs.opacity);
          if (o < 1) {
            window.__chain.push({
              tag: n.tagName,
              cls: String(n.className?.baseVal ?? n.className ?? "").slice(0, 46),
              op: Number(o.toFixed(3)),
              tf: cs.transform === "none" ? "" : cs.transform,
            });
          }
        }
      }
    }
  }

  // 화면 안에 자리는 잡았는데 안이 텅 빈 상자. Stagger 가 아직 차례를 못 받으면
  // 자식을 아예 그리지 않으므로 이 수가 곧 "밀려 있는 카드 수"다.
  let emptyInView = 0;
  for (const el of main.querySelectorAll("div")) {
    if (el.childElementCount !== 0) continue;
    if ((el.textContent ?? "").trim()) continue;
    const b = el.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= h) continue;
    emptyInView += 1;
  }

  const mb = main.getBoundingClientRect();
  const cover = Math.max(0, Math.min(mb.bottom, h) - Math.max(mb.top, 0));
  return {
    chars, shapes, inView, textEls, faded, fadedWhat, emptyInView,
    mainShare: cover / h,
    cards: main.querySelectorAll("h3").length,
    admit: window.__admit ? window.__admit() : null,
    reveal: window.__reveal ? window.__reveal() : null,
    투명도주인: window.__chain ?? [],
  };
};

const browser = await chromium.launch();
const runs = [];

for (let run = 1; run <= RUNS; run += 1) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.goto(`http://localhost:${PORT}/#insights`, { waitUntil: "load" });

  await page.waitForFunction(
    () => (document.querySelector("main")?.innerText.length ?? 0) > 200
      && document.documentElement.scrollHeight > window.innerHeight * 2,
    null,
    { timeout: 15000 }
  );

  const step = Math.round((VIEWPORT.height * SCROLL_SCREENS_PER_SEC * SAMPLE_MS) / 1000);
  const blanks = [];
  let samples = 0;
  let atBottom = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const at = await page.evaluate((by) => new Promise((done) => {
      window.scrollBy(0, by);
      requestAnimationFrame(() => done({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }));
    }), step);
    const look = await page.evaluate(LOOK);
    samples += 1;
    if (look.mainShare >= 0.25 && look.chars === 0 && look.shapes === 0) {
      blanks.push({
        y: Math.round(at.y), n: samples,
        inView: look.inView, textEls: look.textEls,
        faded: look.faded, fadedWhat: look.fadedWhat,
        빈상자: look.emptyInView, 그려진카드: look.cards,
        admit: look.admit, reveal: look.reveal, 투명도주인: look.투명도주인,
      });
    }
    atBottom = at.y >= at.max - 1 ? atBottom + 1 : 0;
    if (atBottom >= 3) break;
    await page.waitForTimeout(SAMPLE_MS);
  }

  runs.push({ run, samples, blanks });
  const mark = blanks.length === 0 ? "통과" : `빈 화면 ${blanks.length}번`;
  console.log(`${String(run).padStart(2)} / ${RUNS}  ${mark}`);
  if (blanks.length) console.log("     " + JSON.stringify(blanks[0]));
  await ctx.close();
}

await browser.close();
server.close();

const bad = runs.filter((r) => r.blanks.length > 0);
const total = runs.reduce((a, r) => a + r.blanks.length, 0);
writeFileSync(outPath, JSON.stringify({
  viewport: VIEWPORT, screensPerSec: SCROLL_SCREENS_PER_SEC, sampleMs: SAMPLE_MS, cpuSlowdown: CPU,
  runs: RUNS, failedRuns: bad.length, totalBlanks: total, detail: runs,
}, null, 1), "utf8");

console.log(`\n모바일 인사이트 ${RUNS}회: 실패 ${bad.length}회 (빈 화면 ${total}번), 실패율 ${(bad.length / RUNS * 100).toFixed(1)}%`);
console.log(`기록: ${outPath}`);
