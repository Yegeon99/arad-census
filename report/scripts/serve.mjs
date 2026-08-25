// dist 정적 서버 (검사용)
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
createServer((req, res) => {
  let p = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0].split("#")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(dist, "index.html");
  res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000");
  const body = readFileSync(p);
  if ((req.headers["accept-encoding"] ?? "").includes("gzip")) {
    res.setHeader("Content-Encoding", "gzip");
    res.end(gzipSync(body));
    return;
  }
  res.end(body);
}).listen(4180, () => console.log("serve: http://localhost:4180"));
