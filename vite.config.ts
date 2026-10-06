import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { load as loadYaml } from "js-yaml";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

interface DevYaml {
  dev?: {
    port?: number;
    ollamaProxy?: string;
    localLlmFallback?: string;
  };
}

const appYaml = loadYaml(
  fs.readFileSync(path.resolve(rootDir, "agent-arena.yaml"), "utf8"),
) as DevYaml;

const DEV_PORT = appYaml.dev?.port ?? 5174;
const OLLAMA_PROXY = appYaml.dev?.ollamaProxy ?? "http://127.0.0.1:11434";

function yamlPlugin(): Plugin {
  return {
    name: "yaml-import",
    transform(src, id) {
      const file = id.split("?")[0] ?? id;
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) return null;
      const data = loadYaml(src);
      return {
        code: `export default ${JSON.stringify(data)};`,
        map: null,
      };
    },
  };
}

/**
 * Dynamic LLM proxies (Vite's built-in `proxy.router` is ignored).
 * - /local-llm/<host>/<port>/...  → http://host:port/...
 * - /remote-llm/<host>/<port>/... → https://host:port/...
 */
function llmDevProxyPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const raw = req.url ?? "";
    const q = raw.indexOf("?");
    const pathname = q >= 0 ? raw.slice(0, q) : raw;
    const search = q >= 0 ? raw.slice(q) : "";

    const local = pathname.match(/^\/local-llm\/([^/]+)\/(\d+)(\/.*)?$/);
    const remote = pathname.match(/^\/remote-llm\/([^/]+)\/(\d+)(\/.*)?$/);
    const match = local ?? remote;
    if (!match) {
      next();
      return;
    }

    const host = decodeURIComponent(match[1]);
    const port = match[2];
    const restPath = match[3] && match[3].length > 0 ? match[3] : "/";
    const isRemote = Boolean(remote);
    const target = new URL(
      isRemote
        ? `https://${host}${port === "443" ? "" : `:${port}`}${restPath}${search}`
        : `http://${host}:${port}${restPath}${search}`,
    );

    pipeHttpProxy(req, res as ServerResponse, target, isRemote);
  };

  return {
    name: "llm-dev-proxy",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function pipeHttpProxy(
  req: IncomingMessage,
  res: ServerResponse,
  target: URL,
  secure: boolean,
): void {
  const lib = secure ? https : http;
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
  delete headers["origin"];

  const upstream = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (secure ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (upRes) => {
      const outHeaders = { ...upRes.headers };
      outHeaders["cache-control"] = "no-cache, no-transform";
      outHeaders["x-accel-buffering"] = "no";
      res.writeHead(upRes.statusCode ?? 502, outHeaders);
      upRes.pipe(res);
    },
  );

  upstream.on("error", (err) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain");
      res.end(`LLM proxy error: ${err.message}`);
    } else {
      res.end();
    }
  });

  req.pipe(upstream);
}

/**
 * Serve pack/character GLBs from disk on every request.
 * Vite's SPA fallback returns index.html for files added after startup when
 * `server.watch.ignored` covers glb/gltf files (Windows EBUSY workaround).
 */
function servePackAssets(base: string): Plugin {
  const basePrefix = base.replace(/\/$/, "");
  const servedRoots = [
    path.resolve(rootDir, "public", "assets", "packs"),
    path.resolve(rootDir, "public", "assets", "characters"),
  ];
  return {
    name: "serve-pack-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let raw = req.url?.split("?")[0] ?? "";
        if (basePrefix && raw.startsWith(basePrefix + "/")) {
          raw = raw.slice(basePrefix.length);
        }
        if (
          !raw.startsWith("/assets/packs/") &&
          !raw.startsWith("/assets/characters/")
        ) {
          next();
          return;
        }
        const rel = decodeURIComponent(raw.replace(/^\/+/, ""));
        const filePath = path.resolve(rootDir, "public", rel);
        const allowed = servedRoots.some(
          (root) =>
            filePath === root || filePath.startsWith(root + path.sep),
        );
        if (!allowed) {
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

export default defineConfig(({ command }) => {
  // Dev serves at `/`. Production keeps `/agent-arena/` for GitHub Pages.
  const base = command === "build" ? "/agent-arena/" : "/";

  return {
    base,
    plugins: [react(), yamlPlugin(), llmDevProxyPlugin(), servePackAssets(base)],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
        "@data": path.resolve(rootDir, "data"),
      },
    },
    server: {
      port: DEV_PORT,
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
          target: OLLAMA_PROXY,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ollama/, ""),
        },
      },
    },
  };
});
