import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadHeadroomConfig, optimizeWithHeadroom } from "./headroom.js";
import type { ModelSlot } from "../providers/types.js";

// Mock headroom-ai compress function
const mockCompress = vi.fn();
vi.mock("headroom-ai", () => ({
  compress: (...args: unknown[]) => mockCompress(...args),
}));

const slot: ModelSlot = {
  slot: "balanced",
  provider: "auto",
  baseUrl: "https://api.example.com/v1",
  apiKey: "key",
  model: "deepseek-v4-flash",
  supportsTools: true,
  supportsVision: false,
  contextWindowTokens: 4096,
};

describe("loadHeadroomConfig", () => {
  it("defaults to disabled off mode", () => {
    expect(loadHeadroomConfig({})).toMatchObject({
      enabled: false,
      mode: "off",
    });
  });

  it("loads adaptive headroom settings from environment variables", () => {
    expect(
      loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "adaptive",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
        MINIROUTER_HEADROOM_MIN_TOKENS: "2000",
        MINIROUTER_HEADROOM_CONTEXT_RATIO: "0.8",
      }),
    ).toMatchObject({
      enabled: true,
      mode: "adaptive",
      url: "http://localhost:8787",
      minTokens: 2000,
      contextRatio: 0.8,
    });
  });
});

describe("optimizeWithHeadroom", () => {
  beforeEach(() => {
    mockCompress.mockReset();
  });

  it("passes through unchanged when Headroom is disabled", async () => {
    const body = { messages: [{ role: "user", content: "short" }] };

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body,
      slot,
      config: loadHeadroomConfig({}),
    });

    expect(result.body).toBe(body);
    expect(result.applied).toBe(false);
    expect(mockCompress).not.toHaveBeenCalled();
  });

  it("does not call Headroom for short adaptive requests", async () => {
    const body = { messages: [{ role: "user", content: "short" }] };

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body,
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "adaptive",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
        MINIROUTER_HEADROOM_MIN_TOKENS: "2000",
      }),
    });

    expect(result.applied).toBe(false);
    expect(mockCompress).not.toHaveBeenCalled();
  });

  it("calls headroom-ai compress() in force mode and returns the optimized body", async () => {
    mockCompress.mockResolvedValueOnce({
      messages: [{ role: "user", content: "optimized" }],
      tokensBefore: 100,
      tokensAfter: 40,
      tokensSaved: 60,
      compressionRatio: 0.4,
      transformsApplied: ["json_compact", "whitespace"],
      compressed: true,
    });

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body: { messages: [{ role: "user", content: "original" }] },
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "force",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
      }),
    });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe("headroom_compress");
    expect(result.body).toEqual({ messages: [{ role: "user", content: "optimized" }] });
    expect(result.compression).toMatchObject({
      originalChars: 400,
      compressedChars: 160,
      blocks: 2,
    });
    expect(mockCompress).toHaveBeenCalledWith(
      [{ role: "user", content: "original" }],
      expect.objectContaining({
        model: "deepseek-v4-flash",
        baseUrl: "http://localhost:8787",
        timeout: 15_000,
        fallback: false,
      }),
    );
  });

  it("does not call headroom-ai for long adaptive requests without oversized tail blocks", async () => {
    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body: { messages: [{ role: "user", content: "x".repeat(14_000) }], max_tokens: 1024 },
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "adaptive",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
        MINIROUTER_HEADROOM_CONTEXT_RATIO: "0.85",
        MINIROUTER_TAIL_COMPRESSION_ENABLED: "true",
        MINIROUTER_TAIL_COMPRESSION_MIN_CHARS: "1000",
      }),
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no_compression");
    expect(mockCompress).not.toHaveBeenCalled();
  });

  it("does not compress oversized tails when no Headroom URL is configured", async () => {
    const body = {
      messages: [
        { role: "system", content: "stable prefix" },
        { role: "user", content: "install dependencies" },
        { role: "tool", content: Array.from({ length: 200 }, (_, i) => `log ${i} ${"x".repeat(80)}`).join("\n") },
      ],
    };

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body,
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "adaptive",
        MINIROUTER_HEADROOM_MIN_TOKENS: "2000",
        MINIROUTER_TAIL_COMPRESSION_ENABLED: "true",
        MINIROUTER_TAIL_COMPRESSION_MIN_CHARS: "1000",
        MINIROUTER_TAIL_COMPRESSION_MAX_CHARS: "800",
      }),
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no_compression");
    expect(mockCompress).not.toHaveBeenCalled();
    expect(result.body).toBe(body);
  });

  it("compresses only oversized OpenAI tool tails through Headroom in adaptive mode", async () => {
    mockCompress.mockResolvedValueOnce({
      messages: [{ role: "tool", tool_call_id: "call_1", content: "compressed tail" }],
      tokensBefore: 4000,
      tokensAfter: 400,
      tokensSaved: 3600,
      compressionRatio: 0.1,
      transformsApplied: ["tail"],
      compressed: true,
    });

    const body = {
      messages: [
        { role: "system", content: "stable prefix" },
        { role: "user", content: "install dependencies" },
        { role: "tool", tool_call_id: "call_1", content: Array.from({ length: 200 }, (_, i) => `log ${i} ${"x".repeat(80)}`).join("\n") },
      ],
    };

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body,
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "adaptive",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
        MINIROUTER_TAIL_COMPRESSION_ENABLED: "true",
        MINIROUTER_TAIL_COMPRESSION_MIN_CHARS: "1000",
        MINIROUTER_TAIL_COMPRESSION_MAX_CHARS: "800",
      }),
    });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe("headroom_compress");
    expect(result.body.messages[0]).toBe(body.messages[0]);
    expect(result.body.messages[1]).toBe(body.messages[1]);
    expect(result.body.messages[2]).toEqual({ role: "tool", tool_call_id: "call_1", content: "compressed tail" });
    expect(mockCompress).toHaveBeenCalledWith(
      [{ role: "tool", tool_call_id: "call_1", content: body.messages[2].content }],
      expect.objectContaining({
        model: "deepseek-v4-flash",
        baseUrl: "http://localhost:8787",
        timeout: 15_000,
        fallback: false,
      }),
    );
  });

  it("does not fall back to local compression when headroom-ai compress() throws", async () => {
    mockCompress.mockRejectedValueOnce(new Error("connection refused"));

    const body = {
      messages: [
        { role: "system", content: "stable prefix" },
        { role: "user", content: "install dependencies" },
        { role: "tool", content: Array.from({ length: 200 }, (_, i) => `log ${i} ${"x".repeat(80)}`).join("\n") },
      ],
    };

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body,
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "force",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
        MINIROUTER_HEADROOM_MIN_TOKENS: "2000",
        MINIROUTER_TAIL_COMPRESSION_ENABLED: "true",
        MINIROUTER_TAIL_COMPRESSION_MIN_CHARS: "1000",
        MINIROUTER_TAIL_COMPRESSION_MAX_CHARS: "800",
      }),
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no_compression");
    expect(result.body).toBe(body);
    expect(mockCompress).toHaveBeenCalledOnce();
  });
});
