// 파이프라인 산출물(data/)을 리포트 번들로 복사 — 식별 정보 없는 집계만
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dest = join(here, "..", "src", "data");
mkdirSync(dest, { recursive: true });
copyFileSync(join(root, "data", "census_2026-08.json"), join(dest, "census.json"));
copyFileSync(join(root, "data", "seed_yield.json"), join(dest, "seed_yield.json"));
console.log("sync-data: census.json, seed_yield.json 복사 완료");
