import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bklit UI가 내려주는 파일이 "@/..." 로 서로를 찾는다.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // 라이선스 주석까지 걷어내 빌드 산출물에 화면에 쓰지 않는 표현이 남지 않게 한다.
  esbuild: { legalComments: "none" },
  build: { target: "es2020", chunkSizeWarningLimit: 1200 },
});
