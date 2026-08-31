// OG 이미지(1200x630) 생성 — 리포트 색과 문구를 그대로 쓴다.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/og.png");

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #FAFAF8; color: #1B2130;
         font-family: "Pretendard Variable", -apple-system, system-ui, sans-serif; }
  .card { height: 100%; padding: 76px 84px; display: flex; flex-direction: column; justify-content: space-between; }
  .wordmark { font-size: 26px; font-weight: 700; letter-spacing: 0.16em; color: #2450A8; }
  h1 { font-size: 78px; font-weight: 700; line-height: 1.18; letter-spacing: -0.02em; }
  .lede { margin-top: 26px; font-size: 30px; line-height: 1.55; color: #575E70; max-width: 900px; }
  .foot { display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid #CFCCC3; padding-top: 26px; font-size: 24px; color: #575E70; }
  .bars { display: flex; align-items: flex-end; gap: 10px; height: 60px; }
  .bars i { display: block; width: 18px; border-radius: 3px; background: #2450A8; }
</style></head><body><div class="card">
  <div class="wordmark">ARAD CENSUS</div>
  <div>
    <h1>Arad 센서스,<br />던파 캐릭터 표본조사</h1>
    <p class="lede">캐릭터 130만 1,990명 표본으로 읽는 직업과 성장 단계, 접속 기록. 검색이 무엇을 가리는지 직접 재서 보정값을 함께 놓았습니다.</p>
  </div>
  <div class="foot">
    <span>2026년 8월 두 번째 조사 회차 · Neople 오픈 API</span>
    <span class="bars"><i style="height:26px"></i><i style="height:44px"></i><i style="height:60px;opacity:.7"></i></span>
  </div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
