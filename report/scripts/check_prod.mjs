// 프로덕션 배포 검증: 콘솔 오류·섹션 수·핵심 수치 표기
import { chromium } from "playwright";

const URL = process.argv[2] ?? "https://arad-census.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const sections = await page.$$eval("section[id]", (els) => els.map((e) => e.id));
const body = await page.textContent("body");
console.log("섹션:", sections.join(", "));
console.log("표본 수 표기:", body.includes("31,523") ? "OK" : "누락");
console.log("팬메이드 고지:", body.includes("비공식 팬메이드") ? "OK" : "누락");
console.log("BI 고지:", body.includes("Neople 오픈 API에서 제공받은 데이터") ? "OK" : "누락");
console.log("콘솔 오류:", errs.length, "건");
errs.forEach((e) => console.log(" ", e));
await browser.close();
process.exit(errs.length ? 1 : 0);
