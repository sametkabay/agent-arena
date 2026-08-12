import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
/** GitHub Pages project site: https://<user>.github.io/agent-arena/ */
const BASE = "/agent-arena/";

/** /local-llm/<host>/<port>/... → http://host:port/... (DEV streaming-friendly proxy). */
function localLlmTarget(req: IncomingMessage): string {
  const url = req.url ?? "";
  const m = url.match(/^\/local-llm\/([^/]+)\/(\d+)/);
  if (!m) return "http://127.0.0.1:3100";
  return `http://${m[1]}:${m[2]}`;
}

/**
 * Serve pack GLBs from disk on every request.
 * Vite's SPA fallback returns index.html for files added after startup when
 * `server.watch.ignored` covers `public/assets/packs/**` (Windows EBUSY workaround).
 */
function servePackAssets(): Plugin {
  const basePrefix = BASE.replace(/\/$/, "");
  return {
    name: "serve-pack-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let raw = req.url?.split("?")[0] ?? "";
        if (basePrefix && raw.startsWith(basePrefix + "/")) {
          raw = raw.slice(basePrefix.length);
        }
        if (!raw.startsWith("/assets/packs/")) {
          next();
          return;
        }
        const rel = decodeURIComponent(raw.replace(/^\/+/, ""));
        const filePath = path.resolve(rootDir, "public", rel);
        const packsRoot = path.resolve(rootDir, "public", "assets", "packs");
        if (
          !filePath.startsWith(packsRoot + path.sep) &&
          filePath !== packsRoot
        ) {
          next();
          return;
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const type =
          ext === ".glb"
            ? "model/gltf-binary"
            : ext === ".gltf"
              ? "model/gltf+json"
              : "application/octet-stream";
        res.statusCode = 200;
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(filePath).pipe(res as ServerResponse);
      });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), servePackAssets()],
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
        // http-proxy `router` — not in Vite's ProxyOptions typings
        ...({ router: localLlmTarget } as object),
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
