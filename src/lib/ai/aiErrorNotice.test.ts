import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyAiCallFailed,
  resetAiErrorNoticeThrottleForTests,
  sanitizeAiErrorReason,
} from "@/lib/ai/aiErrorNotice";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

describe("sanitizeAiErrorReason", () => {
  it("redacts sk- and Bearer secrets and truncates to ~120 chars", () => {
    const long = `HTTP 401 with sk-test-FAKE-abc123 and Bearer xyz ${"x".repeat(200)}`;
    const out = sanitizeAiErrorReason(new Error(long));
    expect(out).not.toContain("sk-test-FAKE-abc123");
    expect(out).not.toContain("Bearer xyz");
    expect(out).toContain("[redacted]");
    expect(out.length).toBeLessThanOrEqual(120);
  });

  it("extracts a readable message from a JSON HTTP body", () => {
    const body = JSON.stringify({
      error: { message: "Incorrect API key provided: sk-test-FAKE-abc123" },
    });
    const out = sanitizeAiErrorReason(new Error(`HTTP 401: ${body}`));
    expect(out).toMatch(/^HTTP 401: Incorrect API key provided: \[redacted\]/);
    expect(out).not.toContain("sk-test-FAKE-abc123");
    expect(out).not.toContain("{");
  });

  it("extracts message from truncated JSON via regex fallback", () => {
    const snippet =
      '{"error":{"message":"Rate limit exceeded for sk-test-FAKE-abc123","type":"invali';
    const out = sanitizeAiErrorReason(new Error(`HTTP 429: ${snippet}`));
    expect(out).toMatch(/^HTTP 429: Rate limit exceeded for \[redacted\]/);
    expect(out).not.toContain("sk-test-FAKE-abc123");
    expect(out).not.toContain("{");
  });

  it("leaves non-JSON HTTP bodies unchanged (aside from redaction/truncation)", () => {
    const out = sanitizeAiErrorReason(
      new Error("HTTP 502: Bad Gateway upstream timeout"),
    );
    expect(out).toBe("HTTP 502: Bad Gateway upstream timeout");
  });

  it("redacts secrets in extracted JSON messages", () => {
    const body = JSON.stringify({
      message: "auth failed Bearer xyz-secret-token",
    });
    const out = sanitizeAiErrorReason(new Error(`HTTP 401: ${body}`));
    expect(out).toBe("HTTP 401: auth failed [redacted]");
  });
});

describe("notifyAiCallFailed", () => {
  const showToast = vi.fn();

  beforeEach(() => {
    resetAiErrorNoticeThrottleForTests();
    showToast.mockReset();
    useArenaStore.setState({ showToast } as never);
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAiErrorNoticeThrottleForTests();
  });

  it("shows a toast with the agent name and a sanitized reason", () => {
    notifyAiCallFailed(
      sampleAgent({ displayName: "Explorer" }),
      sampleModel({ id: "model-1" }),
      new Error("boom with sk-test-FAKE-abc123"),
    );
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 8_000);
    const msg = showToast.mock.calls[0]![0] as string;
    expect(msg).toContain("Explorer");
    expect(msg).toContain("couldn't get a reply");
    expect(msg).toContain("boom");
    expect(msg).not.toContain("sk-test-FAKE-abc123");
  });

  it("throttles toasts per model id for 30 seconds", () => {
    const agent = sampleAgent({ displayName: "Explorer" });
    const model = sampleModel({ id: "model-1" });
    notifyAiCallFailed(agent, model, new Error("first"));
    notifyAiCallFailed(agent, model, new Error("second"));
    expect(showToast).toHaveBeenCalledOnce();

    vi.setSystemTime(1_000_000 + 30_000);
    notifyAiCallFailed(agent, model, new Error("third"));
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("does not toast on AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    notifyAiCallFailed(sampleAgent(), sampleModel(), err);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("redacts Bearer tokens in the toast reason", () => {
    notifyAiCallFailed(
      sampleAgent({ displayName: "Scout" }),
      sampleModel({ id: "model-2" }),
      new Error("auth failed Bearer xyz"),
    );
    const msg = showToast.mock.calls[0]![0] as string;
    expect(msg).not.toContain("Bearer xyz");
    expect(msg).toContain("[redacted]");
    expect(showToast.mock.calls[0]![1]).toBe(8_000);
  });
});
