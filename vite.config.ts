import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage } from "node:http";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** /local-llm/<host>/<port>/... → http://host:port/... (DEV streaming-friendly proxy). */
function localLlmTarget(req: IncomingMessage): string {
  const url = req.url ?? "";
  const m = url.match(/^\/local-llm\/([^/]+)\/(\d+)/);
  if (!m) return "http://127.0.0.1:3100";
  return `http://${m[1]}:${m[2]}`;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  server: {
    port: 5174,
    // Binary GLB packs lock frequently on Windows; don't chokidar-watch them.
    watch: {
      ignored: [
        "**/public/assets/packs/**",
        "**/*.glb",
        "**/*.gltf",
        "**/*.bin",
      ],
    },
    proxy: {
      "/ollama": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ollama/, ""),
      },
      "/local-llm": {
        target: "http://127.0.0.1:3100",
        changeOrigin: true,
        router: localLlmTarget,
        rewrite: (p) => p.replace(/^\/local-llm\/[^/]+\/\d+/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Discourage intermediary buffering of SSE/NDJSON streams.
            proxyRes.headers["cache-control"] = "no-cache, no-transform";
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
    },
  },
});
