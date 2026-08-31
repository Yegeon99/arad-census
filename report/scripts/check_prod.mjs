// 배포된 리포트 확인 (한 번만 본다)
import { chromium } from "playwright";

const URL = process.argv[2] ?? "https://dnf-census.vercel.app";
const PAGES = [
  ["overview", "한눈에 보기"],
  ["jobs", "직업"],
  ["growth", "성장 단계"],
  ["activity", "활성도"],
  ["gap", "직업과 성장 격차"],
  ["insights", "AI 인사이트"],
  ["method", "조사 방법과 한계"],
];
const MUST = [
  "1,301,990명",
  "비공식 팬메이드",
  "Neople 오픈 API에서 제공받은 데이터",
  "시리즈의 다른 프로젝트",
  "DNF Market",
];
// 사이트 이름은 Arad Census 로 통일했다. 되돌리기 전 이름이 화면에 남으면 안 된다.
const NEVER = [
  "비상한", "레기온 미만", "가중 재추정", "capped", "uncapped",
  "DNF CENSUS", "DNF 센서스", "DNF Census",
];
const LINKS = [
  ["https://dnf-market.vercel.app", "형제 프로젝트"],
  ["https://github.com/Yegeon99/dnf-census", "GitHub 저장소"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().startsWith("[.WebGL-")) errs.push(m.text());
});
page.on("pageerror", (e) => errs.push(e.message));

let bad = 0;
for (const [id, label] of PAGES) {
  await page.goto(`${URL}/#${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const heading = (await page.textContent("main h1")) ?? "";
  const okHeading = heading.trim() === label;
  const body = await page.textContent("body");
  const leaked = NEVER.filter((t) => body.includes(t));
  if (!okHeading || leaked.length) bad += 1;
  console.log(`${id}: 제목 ${okHeading ? "정상" : `어긋남 (${heading.trim()})`}` +
    (leaked.length ? `, 남은 내부 용어 ${leaked}` : ""));
}

await page.goto(URL, { waitUntil: "networkidle" });
// 첫 화면의 큰 숫자는 0에서 올라가며 센다. 정해진 시간만 기다리면 세는
// 도중을 읽어 애먼 실패가 나므로, 값이 자리를 잡을 때까지 기다린다.
for (const t of MUST) {
  const found = await page
    .waitForFunction((needle) => document.body.innerText.includes(needle), t, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!found) bad += 1;
  console.log(`문구 확인 ${t}: ${found ? "정상" : "누락"}`);
}

for (const [href, label] of LINKS) {
  const found = (await page.locator(`a[href="${href}"]`).count()) > 0;
  if (!found) bad += 1;
  console.log(`링크 확인 ${label} ${href}: ${found ? "정상" : "누락"}`);
}

console.log(`콘솔 오류: ${errs.length}건`);
errs.forEach((e) => console.log("  ", e));
await browser.close();
process.exit(bad + errs.length ? 1 : 0);
