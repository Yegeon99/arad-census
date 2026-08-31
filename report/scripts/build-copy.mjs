// 화면에 실제로 나오는 문구를 모아 report/content/copy.md 로 정리한다.
// 접기와 탭을 모두 눌러 숨은 문구까지 담으므로, 이 파일이 화면 문구 전문이다.
// 화면이 바뀌면 다시 돌린다: node scripts/build-copy.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const out = join(here, "..", "content", "copy.md");

const PAGES = [
  ["overview", "한눈에 보기"],
  ["jobs", "직업"],
  ["growth", "성장 단계"],
  ["activity", "활성도"],
  ["gap", "직업과 성장 격차"],
  ["insights", "AI 인사이트"],
  ["method", "조사 방법과 한계"],
];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4182, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const lines = async () =>
  (await page.evaluate(() => document.querySelector("main").innerText))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const NL = String.fromCharCode(10);
const parts = [
  "# Arad 센서스 리포트 화면 문구 전문",
  "",
  "화면 일곱 개에 실제로 나오는 문구를 그대로 옮긴 것입니다.",
  "접기와 탭을 모두 펼친 상태까지 담았습니다.",
  "표 안의 값까지 포함해 화면에 나오는 글을 모두 담았습니다.",
  "이 파일은 report/scripts/build-copy.mjs 가 빌드 산출물에서 직접 뽑아 만듭니다.",
  "",
];

// 등장 연출과 숫자 카운트업은 화면에 들어와야 돌기 시작한다.
// 맨 아래까지 한 번 내렸다 올려 전부 끝난 상태의 글을 뽑는다.
const settle = async () => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1400);
};

for (const [i, [id, label]] of PAGES.entries()) {
  await page.goto(`http://localhost:4182/#${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await settle();
  const seen = new Set();
  const ordered = [];
  const take = async () => {
    for (const line of await lines()) {
      if (seen.has(line)) continue;
      seen.add(line);
      ordered.push(line);
    }
  };
  await take();
  const count = await page.locator("main button").count();
  for (let b = 0; b < count; b += 1) {
    const btn = page.locator("main button").nth(b);
    if (!(await btn.isVisible().catch(() => false))) continue;
    if (await btn.isDisabled().catch(() => true)) continue;
    await btn.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(150);
    await take();
  }
  parts.push(`## 화면 ${i + 1}. ${label}`, "");
  for (const line of ordered) parts.push(`- ${line}`);
  parts.push("");
}

await browser.close();
server.close();

parts.push(
  "## 모든 화면 공통",
  "",
  "- 상단 내비게이션: 한눈에 보기, 직업, 성장 단계, 활성도, 직업과 성장 격차, AI 인사이트, 조사 방법과 한계",
  "- 좁은 화면에서는 같은 항목이 하단 탭바로 내려갑니다.",
  "- 푸터 첫 줄: 본 서비스는 Neople 오픈 API에서 제공받은 데이터를 일부 가공하여 활용하고 있습니다.",
  "- 푸터 둘째 줄: 비공식 팬메이드 포트폴리오, ㈜네오플·넥슨과 무관합니다. 게임 IP 아트워크를 사용하지 않습니다.",
  "- 푸터 링크: GitHub 저장소, Neople 오픈 API",
  ""
);

writeFileSync(out, parts.join(NL), "utf-8");
console.log(`화면 문구 전문 저장: ${out} (${parts.length}줄)`);
