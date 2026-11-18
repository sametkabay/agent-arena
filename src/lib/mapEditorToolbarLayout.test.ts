import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(path.join(rootDir, "src/styles/global.css"), "utf8");

/** Collect rule bodies for a selector inside `@media (max-width: Npx)` blocks. */
function mediaRuleBodies(selector: string, maxWidthPx: number): string[] {
  const mediaRe = new RegExp(
    `@media\\s*\\(\\s*max-width:\\s*${maxWidthPx}px\\s*\\)\\s*\\{`,
    "g",
  );
  const bodies: string[] = [];
  let mediaMatch: RegExpExecArray | null;
  while ((mediaMatch = mediaRe.exec(css))) {
    const start = mediaMatch.index + mediaMatch[0].length;
    let depth = 1;
    let i = start;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    const block = css.slice(start, i - 1);
    const selRe = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
      "g",
    );
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = selRe.exec(block))) {
      bodies.push(ruleMatch[1] ?? "");
    }
  }
  return bodies;
}

function declaresClipping(body: string): boolean {
  const decls = body
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const decl of decls) {
    const [prop, ...rest] = decl.split(":");
    const value = rest.join(":").trim().toLowerCase();
    const property = prop?.trim().toLowerCase() ?? "";
    if (property === "max-height") {
      if (value && value !== "none" && value !== "initial" && value !== "unset") {
        return true;
      }
    }
    if (property === "overflow" || property === "overflow-y") {
      if (value === "hidden" || value === "clip" || value === "scroll" || value === "auto") {
        return true;
      }
    }
  }
  return false;
}

describe("map editor toolbar actions (narrow viewports)", () => {
  it("does not clip wrapped .map-editor__toolbar-actions rows at ≤720px / ≤480px", () => {
    const at720 = mediaRuleBodies(".map-editor__toolbar-actions", 720);
    const at480 = mediaRuleBodies(".map-editor__toolbar-actions", 480);
    expect(at720.length).toBeGreaterThan(0);

    for (const body of [...at720, ...at480]) {
      expect(declaresClipping(body), body).toBe(false);
    }
  });
});
