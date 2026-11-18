import { describe, expect, it } from "vitest";
import { sampleModel } from "@/test/fixtures";
import {
  MODEL_FORMAT,
  MODEL_IO_LIMITS,
  MODEL_VERSION,
  ModelImportError,
  buildModelExport,
  dedupeImportedModels,
  modelExportFileName,
  normalizeModelBaseUrl,
  parseModelImport,
  stripSecretsFromBaseUrl,
  type ImportedModel,
} from "@/lib/modelConfigIO";

const FAKE_KEY = "sk-test-FAKE-0000";
const FAKE_HEADER = "org-secret-FAKE-hdr";

function modelWithSecrets(
  overrides: Parameters<typeof sampleModel>[0] = {},
) {
  return sampleModel({
    apiKey: FAKE_KEY,
    extraHeaders: [{ key: "X-Org", value: FAKE_HEADER }],
    ...overrides,
  });
}

function importFile(
  models: unknown[],
  extras: Record<string, unknown> = {},
) {
  return JSON.stringify({
    format: MODEL_FORMAT,
    version: MODEL_VERSION,
    includesApiKeys: false,
    models,
    ...extras,
  });
}

function row(partial: Record<string, unknown> = {}) {
  return {
    name: "GPT",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
    ...partial,
  };
}

describe("buildModelExport", () => {
  it("omits apiKey, header values, id, and createdAt when keys are excluded", () => {
    const json = buildModelExport([modelWithSecrets()], false);
    expect(json).not.toContain("FAKE");
    expect(json).not.toMatch(/"apiKey"/);
    expect(json).not.toMatch(/"extraHeaders"/);
    expect(json).not.toMatch(/"id"/);
    expect(json).not.toMatch(/"createdAt"/);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(MODEL_FORMAT);
    expect(parsed.version).toBe(MODEL_VERSION);
    expect(parsed.includesApiKeys).toBe(false);
    expect(parsed.models[0].headerNames).toEqual(["X-Org"]);
    expect(parsed.models[0].extraHeaders).toBeUndefined();
    expect(parsed.models[0].apiKey).toBeUndefined();
  });

  it("includes apiKey and header values when keys are requested", () => {
    const json = buildModelExport([modelWithSecrets()], true);
    const parsed = JSON.parse(json);
    expect(parsed.includesApiKeys).toBe(true);
    expect(parsed.models[0].apiKey).toBe(FAKE_KEY);
    expect(parsed.models[0].extraHeaders).toEqual([
      { key: "X-Org", value: FAKE_HEADER },
    ]);
    expect(parsed.models[0].headerNames).toBeUndefined();
    expect(json).toContain(FAKE_KEY);
  });

  it("pretty-prints JSON", () => {
    const json = buildModelExport([sampleModel()], false);
    expect(json).toContain("\n");
    expect(json.startsWith("{")).toBe(true);
  });

  it("strips login and secret query params from baseUrl when keys are excluded", () => {
    const json = buildModelExport(
      [
        modelWithSecrets({
          baseUrl:
            "https://user-FAKE:tok-FAKE@proxy.example.test/v1?api_key=FAKE-q&region=eu",
          apiKey: undefined,
          extraHeaders: [],
        }),
      ],
      false,
    );
    expect(json).not.toContain("FAKE");
    expect(json).toContain("region=eu");
    expect(json).toContain("https://proxy.example.test/v1");
    expect(json).not.toContain("api_key");
    expect(json).not.toContain("user-");
  });
});

describe("stripSecretsFromBaseUrl", () => {
  it("clears userinfo and secret-looking query names case-insensitively", () => {
    expect(
      stripSecretsFromBaseUrl(
        "https://user:token@proxy.example.test/v1?API_KEY=x&Token=y&region=eu&Signature=z",
      ),
    ).toBe("https://proxy.example.test/v1?region=eu");
  });
});

describe("modelExportFileName", () => {
  it("uses YYYYMMDD and optional -WITH-KEYS", () => {
    const d = new Date("2026-11-12T12:00:00Z");
    expect(modelExportFileName(false, d)).toBe(
      "agent-arena-models-20261112.aa-models.json",
    );
    expect(modelExportFileName(true, d)).toBe(
      "agent-arena-models-20261112-WITH-KEYS.aa-models.json",
    );
  });
});

describe("normalizeModelBaseUrl", () => {
  it("lowercases scheme/host, strips trailing slash and default ports", () => {
    expect(normalizeModelBaseUrl("HTTPS://API.OpenAI.com/v1/")).toBe(
      "https://api.openai.com/v1",
    );
    expect(normalizeModelBaseUrl("http://localhost:80/v1")).toBe(
      "http://localhost/v1",
    );
    expect(normalizeModelBaseUrl("https://example.com:443")).toBe(
      "https://example.com",
    );
  });

  it("keeps query and hash", () => {
    expect(
      normalizeModelBaseUrl("https://api.example.com/v1?x=1#frag"),
    ).toBe("https://api.example.com/v1?x=1#frag");
  });

  it("rejects non-http schemes and credentials", () => {
    expect(normalizeModelBaseUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeModelBaseUrl("ftp://files.example.com")).toBeNull();
    expect(
      normalizeModelBaseUrl("https://user:pass@api.example.com/v1"),
    ).toBeNull();
  });

  it("accepts root-relative paths used by DEV proxies", () => {
    expect(normalizeModelBaseUrl("/ollama")).toBe("/ollama");
    expect(normalizeModelBaseUrl("/ollama/")).toBe("/ollama");
    expect(normalizeModelBaseUrl("/local-llm/127.0.0.1/8080/v1")).toBe(
      "/local-llm/127.0.0.1/8080/v1",
    );
    expect(normalizeModelBaseUrl("//host/evil")).toBeNull();
  });

  it("handles IPv6 hostnames", () => {
    const norm = normalizeModelBaseUrl("http://[::1]:8080/v1/");
    expect(norm).toBe("http://[::1]:8080/v1");
  });
});

describe("parseModelImport errors", () => {
  it("rejects oversized files before trusting content", () => {
    expect(() =>
      parseModelImport("{}", { fileSize: MODEL_IO_LIMITS.maxFileBytes + 1 }),
    ).toThrow(expect.objectContaining({ code: "tooLarge" }));
  });

  it("rejects when text.length alone exceeds the size limit", () => {
    const huge = "x".repeat(MODEL_IO_LIMITS.maxFileBytes + 1);
    expect(() => parseModelImport(huge)).toThrow(
      expect.objectContaining({ code: "tooLarge" }),
    );
  });

  it("rejects non-JSON text", () => {
    expect(() => parseModelImport("not json {{{")).toThrow(
      expect.objectContaining({ code: "invalidJson" }),
    );
  });

  it("rejects null, array, and string roots", () => {
    for (const text of ["null", "[]", '"hello"']) {
      expect(() => parseModelImport(text)).toThrow(
        expect.objectContaining({ code: "wrongFormat" }),
      );
    }
  });

  it("rejects wrong format and unsupported version", () => {
    expect(() =>
      parseModelImport(
        JSON.stringify({
          format: "other",
          version: 1,
          models: [row()],
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "wrongFormat" }));
    expect(() =>
      parseModelImport(
        JSON.stringify({
          format: MODEL_FORMAT,
          version: 99,
          models: [row()],
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "unsupportedVersion" }));
  });

  it("rejects empty models array and all-invalid rows", () => {
    expect(() => parseModelImport(importFile([]))).toThrow(
      expect.objectContaining({ code: "empty" }),
    );
    expect(() =>
      parseModelImport(importFile([{ provider: "nope", modelId: "x" }])),
    ).toThrow(expect.objectContaining({ code: "empty" }));
  });

  it("rejects more than 50 models in a file", () => {
    const models = Array.from({ length: 51 }, (_, i) =>
      row({ modelId: `m-${i}`, name: `M${i}` }),
    );
    expect(() => parseModelImport(importFile(models))).toThrow(
      expect.objectContaining({ code: "tooMany" }),
    );
  });

  it("rejects when existing + new would exceed 100", () => {
    expect(() =>
      parseModelImport(importFile([row()]), { existingCount: 100 }),
    ).toThrow(expect.objectContaining({ code: "tooManyTotal" }));
  });
});

describe("parseModelImport sanitize", () => {
  it("round-trips export → import for key-less and keyed files", () => {
    const source = modelWithSecrets({
      name: "Prod",
      baseUrl: "https://api.openai.com/v1/",
    });
    const noKeys = buildModelExport([source], false);
    const withKeys = buildModelExport([source], true);

    const a = parseModelImport(noKeys);
    expect(a.hadApiKeys).toBe(false);
    expect(a.models[0]).toMatchObject({
      name: "Prod",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      modelId: "gpt-4o-mini",
      extraHeaders: [{ key: "X-Org", value: "" }],
    });
    expect(a.models[0]!.apiKey).toBeUndefined();

    const b = parseModelImport(withKeys);
    expect(b.hadApiKeys).toBe(true);
    expect(b.models[0]).toMatchObject({
      apiKey: FAKE_KEY,
      extraHeaders: [{ key: "X-Org", value: FAKE_HEADER }],
    });
  });

  it("rejects over-length modelId/apiKey/header values; still clips name", () => {
    const longName = "n".repeat(MODEL_IO_LIMITS.nameMax + 20);
    const longModel = "m".repeat(MODEL_IO_LIMITS.modelIdMax + 20);
    const longKey = "k".repeat(MODEL_IO_LIMITS.apiKeyMax + 20);
    const longHeader = "h".repeat(MODEL_IO_LIMITS.headerValueMax + 1);
    const result = parseModelImport(
      importFile(
        [
          row({
            name: "   ",
            modelId: longModel,
            apiKey: "sk-test-FAKE-0000",
          }),
          row({
            name: "Keyed",
            modelId: "ok-key",
            apiKey: longKey,
            baseUrl: "https://api.example.com/v2",
          }),
          row({
            name: "Hdr",
            modelId: "ok-hdr",
            baseUrl: "https://api.example.com/v3",
            extraHeaders: [{ key: "X-Long", value: longHeader }],
          }),
          row({
            name: longName,
            modelId: "short",
            baseUrl: "https://api.example.com/v4",
          }),
        ],
        { includesApiKeys: true },
      ),
    );
    expect(result.invalid).toBe(3);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.modelId).toBe("short");
    expect(result.models[0]!.name.length).toBe(MODEL_IO_LIMITS.nameMax);
  });

  it("rejects control characters in apiKey and name", () => {
    const result = parseModelImport(
      importFile(
        [
          row({ name: "bad\rname", modelId: "a" }),
          row({ name: "Ok", modelId: "b", apiKey: "sk-\nFAKE" }),
          row({ name: "Good", modelId: "c" }),
        ],
        { includesApiKeys: true },
      ),
    );
    expect(result.invalid).toBe(2);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.modelId).toBe("c");
  });

  it("accepts root-relative baseUrl on import and dedupes as-is", () => {
    const result = parseModelImport(
      importFile([
        row({
          name: "Local",
          provider: "ollama",
          baseUrl: "/ollama/",
          modelId: "llama3",
        }),
        row({
          name: "Dup",
          provider: "ollama",
          baseUrl: "/ollama",
          modelId: "llama3",
        }),
      ]),
    );
    expect(result.duplicates).toBe(1);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.baseUrl).toBe("/ollama");
  });

  it("ignores __proto__/constructor keys without polluting prototypes", () => {
    const text = `{
      "format": "${MODEL_FORMAT}",
      "version": ${MODEL_VERSION},
      "constructor": { "polluted": true },
      "__proto__": { "polluted": true },
      "models": [{
        "name": "GPT",
        "provider": "openai",
        "baseUrl": "https://api.openai.com/v1",
        "modelId": "proto-ok",
        "__proto__": { "polluted": true },
        "constructor": { "polluted": true }
      }]
    }`;
    const result = parseModelImport(text);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.modelId).toBe("proto-ok");
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
    expect(Object.hasOwn(result.models[0]!, "polluted")).toBe(false);
    expect(Object.hasOwn(result.models[0]!, "constructor")).toBe(false);
  });

  it("drops unknown providers and bad URLs instead of coercing", () => {
    const result = parseModelImport(
      importFile([
        row({ provider: "nope" }),
        row({ baseUrl: "javascript:alert(1)", modelId: "a" }),
        row({ baseUrl: "ftp://x", modelId: "b" }),
        row({
          baseUrl: "https://user:pass@api.example.com/v1",
          modelId: "c",
        }),
        row({ modelId: "ok", baseUrl: "https://ok.example.com/v1" }),
      ]),
    );
    expect(result.invalid).toBe(4);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.modelId).toBe("ok");
  });

  it("rejects modelId with control characters", () => {
    const result = parseModelImport(
      importFile([
        row({ modelId: "bad\nid" }),
        row({ modelId: "good" }),
      ]),
    );
    expect(result.invalid).toBe(1);
    expect(result.models[0]!.modelId).toBe("good");
  });

  it("sanitizes headers: invalid names, CRLF values, forbidden, duplicates", () => {
    const result = parseModelImport(
      importFile([
        row({
          extraHeaders: [
            { key: "X-Good", value: "ok" },
            { key: "Bad Name", value: "x" },
            { key: "X-CR", value: "a\rb" },
            { key: "Host", value: "evil" },
            { key: "Cookie", value: "a=b" },
            { key: "Content-Length", value: "9" },
            { key: "x-good", value: "dup-ignored" },
            { key: "X-Second", value: "two" },
          ],
        }),
      ]),
    );
    expect(result.models[0]!.extraHeaders).toEqual([
      { key: "X-Good", value: "ok" },
      { key: "X-Second", value: "two" },
    ]);
  });

  it("restores headerNames as empty-value headers", () => {
    const result = parseModelImport(
      importFile([row({ headerNames: ["X-Org", "host", "X-Org"] })]),
    );
    expect(result.models[0]!.extraHeaders).toEqual([{ key: "X-Org", value: "" }]);
  });

  it("drops unknown top-level and per-model fields", () => {
    const result = parseModelImport(
      JSON.stringify({
        format: MODEL_FORMAT,
        version: MODEL_VERSION,
        secret: "nope",
        models: [{ ...row(), mystery: 1, id: "keep-out", createdAt: 9 }],
      }),
    );
    expect(result.models[0]).not.toHaveProperty("mystery");
    expect(result.models[0]).not.toHaveProperty("id");
    expect(result.models[0]).not.toHaveProperty("createdAt");
  });

  it("flags hadApiKeys from includesApiKeys or embedded secrets", () => {
    expect(
      parseModelImport(importFile([row()], { includesApiKeys: true }))
        .hadApiKeys,
    ).toBe(true);
    expect(
      parseModelImport(
        importFile([row({ apiKey: FAKE_KEY })], { includesApiKeys: false }),
      ).hadApiKeys,
    ).toBe(true);
    expect(
      parseModelImport(
        importFile([
          row({ extraHeaders: [{ key: "X", value: FAKE_HEADER }] }),
        ]),
      ).hadApiKeys,
    ).toBe(true);
  });

  it("caps headers at 20", () => {
    const names = Array.from({ length: 25 }, (_, i) => `X-H${i}`);
    const result = parseModelImport(importFile([row({ headerNames: names })]));
    expect(result.models[0]!.extraHeaders).toHaveLength(20);
  });
});

describe("dedupeImportedModels", () => {
  const base: ImportedModel = {
    name: "A",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
    extraHeaders: [],
  };

  it("skips against existing and earlier rows; URL case/slash are equivalent", () => {
    const existing = [
      sampleModel({
        provider: "openai",
        baseUrl: "https://api.openai.com/v1/",
        modelId: "gpt-4o-mini",
      }),
    ];
    const items: ImportedModel[] = [
      {
        ...base,
        baseUrl: "HTTPS://API.OpenAI.com/v1",
        name: "Dup existing",
      },
      {
        ...base,
        modelId: "new-one",
        name: "Fresh",
        baseUrl: "https://api.openai.com/v1",
      },
      {
        ...base,
        modelId: "new-one",
        name: "Dup in file",
        baseUrl: "https://api.openai.com/v1/",
      },
    ];
    const { models, duplicates } = dedupeImportedModels(items, existing);
    expect(duplicates).toBe(2);
    expect(models).toHaveLength(1);
    expect(models[0]!.name).toBe("Fresh");
  });

  it("parseModelImport reports duplicates including same-file URL variants", () => {
    const result = parseModelImport(
      importFile([
        row({ name: "Keep", baseUrl: "https://api.openai.com/v1" }),
        row({ name: "Skip", baseUrl: "HTTPS://API.OpenAI.com/v1/" }),
        row({
          name: "New",
          modelId: "other",
          baseUrl: "https://api.openai.com/v1",
        }),
      ]),
      {
        existing: [
          sampleModel({
            baseUrl: "https://api.openai.com/v1",
            modelId: "already",
          }),
        ],
      },
    );
    // First kept, second dup of first; third is new. existing "already" unused.
    expect(result.duplicates).toBe(1);
    expect(result.models).toHaveLength(2);

    const againstExisting = parseModelImport(
      importFile([
        row({ modelId: "gpt-4o-mini", baseUrl: "https://API.openai.com/v1/" }),
        row({ modelId: "brand-new", baseUrl: "https://api.openai.com/v1" }),
      ]),
      { existing: [sampleModel()] },
    );
    expect(againstExisting.duplicates).toBe(1);
    expect(againstExisting.models).toHaveLength(1);
    expect(againstExisting.models[0]!.modelId).toBe("brand-new");
  });

  it("returns empty models with duplicate count when every row collides", () => {
    const result = parseModelImport(importFile([row()]), {
      existing: [sampleModel()],
    });
    expect(result.models).toHaveLength(0);
    expect(result.duplicates).toBe(1);
    expect(result).not.toBeInstanceOf(ModelImportError);
  });
});
