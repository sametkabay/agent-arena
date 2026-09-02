import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { load as loadYaml } from "js-yaml";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

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

export default defineConfig({
  plugins: [react(), yamlPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@data": path.resolve(rootDir, "data"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.generated.ts",
        "src/lib/three/**",
        "src/lib/useStickToBottom.ts",
        "src/lib/types.ts",
        // Thin IndexedDB/Blob/ObjectURL glue — needs a real browser, like lib/three/**.
        // Pure logic (validation, spec-building) lives in userAssetValidation.ts and is tested.
        "src/lib/assets/userAssetDb.ts",
        "src/lib/assets/userAssets.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ["text", "html"],
    },
  },
});
