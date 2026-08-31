// 배포본을 실제 창을 띄운 브라우저로 굴려 보며 멈추는 순간을 잡는다.
//
//   node scripts/perf-live.mjs [주소] [CPU 배율]
//
// 긴 작업과 입력 반응 지연을 함께 잰다. 사람이 느끼는 "멈춤"은 입력 반응 지연 쪽이다.
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://dnf-census.vercel.app";
const THROTTLE = Number(process.argv[3] ?? 6);

const WATCH = `
  window.__blocks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__blocks.push(Math.round(e.duration));
    }).observe({ entryTypes: ["longtask"] });
  } catch (err) {}
  // 사람이 느끼는 멈춤. 브라우저가 직접 재 주는 입력 처리 시간을 쓴다.
  // 두 번 겹친 프레임 요청으로 재면 창이 뒤에 있을 때 값이 부풀어 못 쓴다.
  window.__lat = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lat.push(Math.round(e.duration));
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  } catch (err) {}
`;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
await page.addInitScript(WATCH);
await page.bringToFront();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const report = async (label) => {
  const { blocks, lat } = await page.evaluate(() => ({ blocks: window.__blocks, lat: window.__lat }));
  const max = blocks.length ? Math.max(...blocks) : 0;
  const maxLat = lat.length ? Math.max(...lat) : 0;
  console.log(`${label.padEnd(24)} 가장 긴 작업 ${String(max).padStart(6)}밀리초` +
    `  입력 반응 최대 ${String(maxLat).padStart(6)}밀리초  (긴 작업 ${blocks.length}건)`);
  await page.evaluate(() => { window.__blocks = []; window.__lat = []; });
  return Math.max(max, maxLat);
};

let worst = 0;
const step = async (label, fn) => {
  await fn();
  worst = Math.max(worst, await report(label));
};

await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
worst = Math.max(worst, await report("한눈에 보기 진입"));

await step("한눈에 보기 훑어내리기", async () => {
  for (let i = 0; i < 60; i += 1) { await page.mouse.wheel(0, 260); await page.waitForTimeout(16); }
  await page.waitForTimeout(700);
});

await step("한눈에 보기 되올리기", async () => {
  for (let i = 0; i < 60; i += 1) { await page.mouse.wheel(0, -260); await page.waitForTimeout(16); }
  await page.waitForTimeout(700);
});

await step("성장 단계 진입", async () => {
  await page.goto(`${BASE}/#growth`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
});

await step("성장 단계 보정 전환", async () => {
  const to = page.getByRole("button", { name: /보정값/ });
  const back = page.getByRole("button", { name: /관측값/ });
  await to.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i += 1) {
    await to.click(); await page.waitForTimeout(420);
    await back.click(); await page.waitForTimeout(420);
  }
});

await step("성장 단계 훑어내리기", async () => {
  for (let i = 0; i < 60; i += 1) { await page.mouse.wheel(0, 260); await page.waitForTimeout(16); }
  await page.waitForTimeout(700);
});

await step("조사 방법 진입과 탭", async () => {
  await page.goto(`${BASE}/#method`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  for (const name of ["처음 조사와 달라진 점", "다시 재본 결과", "편향과 확인 불가 항목", "개인정보와 실측치"]) {
    const b = page.getByRole("button", { name, exact: true });
    if (await b.count()) { await b.click(); await page.waitForTimeout(500); }
  }
});

console.log("");
console.log(`콘솔 오류 ${errors.length}건`);
errors.slice(0, 5).forEach((e) => console.log("  ", e.slice(0, 160)));
console.log(worst > 200
  ? `판정: 실패. 가장 나쁜 값 ${worst}밀리초`
  : `판정: 통과. 가장 나쁜 값 ${worst}밀리초`);

await browser.close();
