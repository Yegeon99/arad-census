// 표시 안정성 검사.
// 화면 일곱 개에 주소로 곧장 들어가 1초 뒤 상태를 본다.
// 투명한 채로 남은 요소가 있는지, 본문이 실제로 그려졌는지, 캔버스가 비어 있지 않은지 확인한다.
// 그다음 빠른 스크롤로 일곱 화면을 훑으며, 어느 시점에도 본문 자리가
// 비어 보이지 않는지 본다.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const outPath = join(here, "..", "..", "docs", "stability.json");
mkdirSync(dirname(outPath), { recursive: true });

const PAGES = ["overview", "jobs", "growth", "activity", "gap", "insights", "method"];
const WAIT_MS = 1000;
const MIN_TEXT = 400; // 이 정도 글자는 나와 있어야 화면이 그려진 것으로 본다

// 등장 연출은 화면에 들어올 때 도므로 두 번 본다.
// 1단계 들어가자마자: 첫 화면 안에 안 보이는 요소가 없어야 한다.
// 2단계 맨 아래까지 한 번에 내린 뒤: 화면 어디에도 안 보이는 요소가 없어야 한다.

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
// 빠른 스크롤 검사: 초당 화면 세 개 속도로 내리며 이 간격마다 들여다본다.
const SCROLL_SCREENS_PER_SEC = 3;
const SAMPLE_MS = 100;
// 빠른 스크롤은 느린 기기 조건에서 본다. 빠른 기기에서는 무엇이든 제때 나와
// 검사가 헛돈다. 이 값은 진입 성능 검사(perf-block)와 같은 조건이다.
const SCROLL_CPU_SLOWDOWN = 4;
const VISIBLE_MS = 400;  // report/src/lib/reveal.js 의 같은 이름 상수와 맞춘다
const PORT = 4183;
await new Promise((r) => server.listen(PORT, r));

/**
 * 지금 화면에 무엇이 나와 있는지 본다.
 * 흐림은 물려받으므로 위로 거슬러 올라가며 곱해서 실제로 보이는지 따진다.
 */
const LOOK = () => {
  const h = window.innerHeight;
  const main = document.querySelector("main");
  if (!main) return { chars: 0, shapes: 0, faded: [], mainShare: 0 };

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

  let chars = 0;
  let shapes = 0;
  let inView = 0;
  let textEls = 0;
  const faded = [];
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
      // 같은 요소가 몇 번을 내리 안 보이는지 세려면 이름표가 있어야 한다
      if (!el.dataset.stabId) {
        window.__stabSeq = (window.__stabSeq ?? 0) + 1;
        el.dataset.stabId = String(window.__stabSeq);
      }
      faded.push({
        id: el.dataset.stabId,
        what: String(el.className?.baseVal ?? el.className ?? el.tagName).slice(0, 40),
      });
    }
  }
  const mb = main.getBoundingClientRect();
  const cover = Math.max(0, Math.min(mb.bottom, h) - Math.max(mb.top, 0));
  return { chars, shapes, faded, mainShare: cover / h, inView, textEls };
};

/**
 * 빠른 스크롤로 훑으며 비어 보이는 순간이 있는지 본다.
 *
 * 갓 들어온 화면에서 곧바로 내린다. 한 번 다 훑고 난 화면에서 재면 이미 전부
 * 그려지고 연출도 끝난 뒤라 무엇을 해도 통과한다. 사람이 겪는 자리는
 * 들어오자마자 내리는 그 순간이다.
 *
 * 내리고 한 번 그린 직후를 들여다본다. 그리기 전을 재면 사람이 볼 수 없는
 * 순간을 재게 되고, 잦아들기를 기다려 주면 늦게 나타나는 것이 안 잡힌다.
 * 사람 눈에 닿는 것은 그려진 그림이므로 그 시점을 잰다. 본문이 화면의 4분의 1도 안 걸치는 자리(머리글과 바닥글만 보이는
 * 끝)는 뺀다.
 *
 * 잡는 것 두 가지.
 *   - 본문 자리가 통째로 빈 순간
 *   - 화면에 들어온 뒤 마지노선(VISIBLE_MS)을 넘겨 계속 안 보이는 요소
 */
async function fastScrollScan(page, viewportHeight) {
  const step = Math.round((viewportHeight * SCROLL_SCREENS_PER_SEC * SAMPLE_MS) / 1000);
  const limit = Math.ceil(VISIBLE_MS / SAMPLE_MS) + 1; // 이만큼 내리 안 보이면 마지노선을 넘긴 것
  const blanks = [];
  const stuck = [];
  const streak = new Map(); // 이름표 -> 내리 안 보인 횟수
  let samples = 0;
  // 화면이 올라오기까지는 기다린다. 아직 받아 오는 중인 자리는 진입 검사(1단계)
  // 몫이지 스크롤 연출 몫이 아니다. 내릴 거리가 화면 두 개는 생긴 그 순간부터
  // 내리기 시작한다. 그 시점에도 아래쪽 연출은 아직 하나도 안 돌아 있다.
  await page.waitForFunction(
    () => (document.querySelector("main")?.innerText.length ?? 0) > 200
      && document.documentElement.scrollHeight > window.innerHeight * 2,
    null,
    { timeout: 15000 }
  );
  // 아래로 갈수록 문서가 길어지므로 바닥에 닿았다고 바로 끝내지 않는다.
  let atBottom = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const at = await page.evaluate((by) => new Promise((done) => {
      window.scrollBy(0, by);
      // 한 번 그려질 때까지 기다린다. 그려야 사람 눈에 닿는다.
      requestAnimationFrame(() => done({
        y: window.scrollY,
        max: document.documentElement.scrollHeight - window.innerHeight,
      }));
    }), step);
    const look = await page.evaluate(LOOK);
    samples += 1;
    if (look.mainShare >= 0.25) {
      if (look.chars === 0 && look.shapes === 0) {
        blanks.push({ y: Math.round(at.y), n: samples, inView: look.inView, textEls: look.textEls,
          faded: look.faded.length, what: look.faded[0]?.what ?? "" });
      }
      const now = new Set();
      for (const f of look.faded) {
        now.add(f.id);
        const n = (streak.get(f.id) ?? 0) + 1;
        streak.set(f.id, n);
        if (n === limit) stuck.push(`${Math.round(at.y)}px ${f.what}`);
      }
      for (const id of [...streak.keys()]) if (!now.has(id)) streak.delete(id);
    }
    atBottom = at.y >= at.max - 1 ? atBottom + 1 : 0;
    if (atBottom >= 3) break;
    await page.waitForTimeout(SAMPLE_MS);
  }
  return { samples, blanks, stuck };
}

const browser = await chromium.launch();
const results = [];

for (const viewport of [{ width: 1440, height: 900, tag: "desktop" }, { width: 390, height: 844, tag: "mobile" }]) {
  for (const id of PAGES) {
    // 주소로 곧장 들어가는 상황을 그대로 만든다 (매번 새 탭)
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/#${id}`, { waitUntil: "load" });
    await page.waitForTimeout(WAIT_MS);
    // 1단계: 첫 화면 안에서 안 보이는 요소
    const inViewFaded = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return ["본문 없음"];
      const out = [];
      for (const el of main.querySelectorAll("*")) {
        const rects = el.getClientRects();
        if (!rects.length) continue;
        const box = el.getBoundingClientRect();
        // 등장 연출은 화면에 들어서기 전부터 미리 켜므로,
        // 화면 안에 조금이라도 걸친 요소는 이미 나와 있어야 한다.
        if (box.bottom <= 0 || box.top >= window.innerHeight) continue;
        const cs = getComputedStyle(el);
        if (Number(cs.opacity) < 0.05 || cs.visibility === "hidden") {
          out.push(String(el.className?.baseVal ?? el.className ?? el.tagName).slice(0, 40));
        }
      }
      return out;
    });

    // 2단계: 맨 아래까지 한 번에 내려 빠른 스크롤에서도 연출이 다 도는지 본다
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);

    const r = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return { ok: false, why: "본문 없음" };
      // 사실상 안 보이는 요소만 잡는다. 흐리게 둔 장식은 뺀다.
      const faded = [];
      for (const el of main.querySelectorAll("*")) {
        if (!el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        if (Number(cs.opacity) < 0.05 || cs.visibility === "hidden") {
          faded.push(String(el.className?.baseVal ?? el.className ?? el.tagName).slice(0, 40));
        }
      }
      // 차트 안 글자끼리 겹치는지 (겹치면 읽을 수 없다)
      const texts = [];
      for (const t of main.querySelectorAll("svg text")) {
        const s = (t.textContent ?? "").trim();
        if (!s) continue;
        const r = t.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        texts.push({ s, x: r.left, y: r.top, w: r.width, h: r.height, svg: t.ownerSVGElement });
      }
      const overlaps = [];
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i];
          const b = texts[j];
          if (a.svg !== b.svg) continue;
          const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (dx > 1.5 && dy > 1.5) overlaps.push(`${a.s} / ${b.s}`);
        }
      }

      // 아직 끝나지 않은 등장 애니메이션
      const running = (document.getAnimations ? document.getAnimations() : [])
        .filter((a) => a.playState === "running").length;
      const canvases = [];
      for (const c of main.querySelectorAll("canvas")) {
        const box = c.getBoundingClientRect();
        if (box.width < 4 || box.height < 4) { canvases.push({ empty: true, why: "크기 없음" }); continue; }
        const off = document.createElement("canvas");
        off.width = 60;
        off.height = 40;
        const ctx = off.getContext("2d");
        ctx.drawImage(c, 0, 0, 60, 40);
        const data = ctx.getImageData(0, 0, 60, 40).data;
        const seen = new Set();
        for (let i = 0; i < data.length; i += 4) {
          seen.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
        }
        canvases.push({ empty: seen.size <= 2, colors: seen.size });
      }
      return {
        textLength: main.innerText.replace(/\s+/g, "").length,
        faded: faded.slice(0, 6),
        fadedCount: faded.length,
        running,
        overlaps: overlaps.slice(0, 6),
        overlapCount: overlaps.length,
        canvases,
      };
    });
    // 3단계: 느린 기기 조건에서, 갓 들어온 화면을 곧바로 빠르게 내려 본다
    const fastCtx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const fastPage = await fastCtx.newPage();
    const cdp = await fastCtx.newCDPSession(fastPage);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: SCROLL_CPU_SLOWDOWN });
    await fastPage.goto(`http://localhost:${PORT}/#${id}`, { waitUntil: "load" });
    const fast = await fastScrollScan(fastPage, viewport.height);
    await fastCtx.close();

    const emptyCanvas = (r.canvases ?? []).filter((c) => c.empty).length;
    results.push({
      view: viewport.tag,
      page: id,
      textLength: r.textLength ?? 0,
      fadedCount: r.fadedCount ?? 0,
      faded: r.faded ?? [],
      inViewFadedCount: inViewFaded.length,
      inViewFaded: inViewFaded.slice(0, 6),
      runningAnimations: r.running ?? 0,
      overlapCount: r.overlapCount ?? 0,
      overlaps: r.overlaps ?? [],
      canvasCount: (r.canvases ?? []).length,
      emptyCanvas,
      fastSamples: fast.samples,
      fastBlanks: fast.blanks,
      fastStuck: fast.stuck.slice(0, 6),
      ok: (r.textLength ?? 0) >= MIN_TEXT && (r.fadedCount ?? 1) === 0 && inViewFaded.length === 0
        && emptyCanvas === 0 && (r.running ?? 1) === 0 && (r.overlapCount ?? 1) === 0
        && fast.blanks.length === 0 && fast.stuck.length === 0,
    });
    await ctx.close();
  }
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
writeFileSync(outPath, JSON.stringify({
  waitMs: WAIT_MS, minText: MIN_TEXT,
  fastScroll: { screensPerSec: SCROLL_SCREENS_PER_SEC, sampleMs: SAMPLE_MS, cpuSlowdown: SCROLL_CPU_SLOWDOWN },
  results,
}, null, 1), "utf-8");
const samples = results.reduce((a, r) => a + r.fastSamples, 0);
console.log(`표시 안정성: ${results.length - failed.length}/${results.length} 통과 (진입 후 ${WAIT_MS}밀리초 시점)`);
console.log(`빠른 스크롤 (CPU ${SCROLL_CPU_SLOWDOWN}배 느리게): 초당 화면 ${SCROLL_SCREENS_PER_SEC}개 속도로 ${samples}번 들여다봄, ` +
  `빈 화면 ${results.reduce((a, r) => a + r.fastBlanks.length, 0)}번, ` +
  `마지노선 넘겨 안 보인 요소 ${results.reduce((a, r) => a + r.fastStuck.length, 0)}건`);
for (const f of failed) {
  console.log(`  실패 ${f.view} ${f.page}: 글자 ${f.textLength}, 첫 화면 안 보이는 요소 ${f.inViewFadedCount}, 스크롤 뒤 안 보이는 요소 ${f.fadedCount}, 빈 캔버스 ${f.emptyCanvas}, 도는 애니메이션 ${f.runningAnimations}, 글자 겹침 ${f.overlapCount}, 빠른 스크롤 빈 화면 ${f.fastBlanks.length}`,
    f.inViewFaded.concat(f.faded, f.overlaps, f.fastStuck));
}
process.exit(failed.length ? 1 : 0);
