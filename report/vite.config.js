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
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // 라이브러리를 성격별로 갈라 둔다. 한 덩어리로 묶으면 첫 화면에서
        // 필요하지도 않은 것까지 통째로 읽어 들이느라 화면이 늦게 잡힌다.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("animejs")) return "anime";
          if (id.includes("/motion") || id.includes("framer-motion")) return "motion";
          if (id.includes("@visx") || id.includes("/d3-")) return "charts";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
          return "vendor";
        },
      },
    },
  },
});
