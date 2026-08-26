// 표시 안정성 검사.
// 화면 일곱 개에 주소로 곧장 들어가 1초 뒤 상태를 본다.
// 투명한 채로 남은 요소가 있는지, 본문이 실제로 그려졌는지, 캔버스가 비어 있지 않은지 확인한다.
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

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
const PORT = 4183;
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const results = [];

for (const viewport of [{ width: 1440, height: 900, tag: "desktop" }, { width: 390, height: 844, tag: "mobile" }]) {
  for (const id of PAGES) {
    // 주소로 곧장 들어가는 상황을 그대로 만든다 (매번 새 탭)
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(`http://localhost:${PORT}/#${id}`, { waitUntil: "load" });
    await page.waitForTimeout(WAIT_MS);
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
        canvases,
      };
    });
    const emptyCanvas = (r.canvases ?? []).filter((c) => c.empty).length;
    results.push({
      view: viewport.tag,
      page: id,
      textLength: r.textLength ?? 0,
      fadedCount: r.fadedCount ?? 0,
      faded: r.faded ?? [],
      runningAnimations: r.running ?? 0,
      canvasCount: (r.canvases ?? []).length,
      emptyCanvas,
      ok: (r.textLength ?? 0) >= MIN_TEXT && (r.fadedCount ?? 1) === 0
        && emptyCanvas === 0 && (r.running ?? 1) === 0,
    });
    await page.close();
  }
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
writeFileSync(outPath, JSON.stringify({ waitMs: WAIT_MS, minText: MIN_TEXT, results }, null, 1), "utf-8");
console.log(`표시 안정성: ${results.length - failed.length}/${results.length} 통과 (진입 후 ${WAIT_MS}밀리초 시점)`);
for (const f of failed) {
  console.log(`  실패 ${f.view} ${f.page}: 글자 ${f.textLength}, 안 보이는 요소 ${f.fadedCount}, 빈 캔버스 ${f.emptyCanvas}, 도는 애니메이션 ${f.runningAnimations}`, f.faded);
}
process.exit(failed.length ? 1 : 0);
