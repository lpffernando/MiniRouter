import { describe, expect, it, vi } from "vitest";

import { loadHeadroomConfig, optimizeWithHeadroom } from "./headroom.js";
import type { ModelSlot } from "../providers/types.js";

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
  it("passes through unchanged when Headroom is disabled", async () => {
    const fetchImpl = vi.fn();
    const body = { messages: [{ role: "user", content: "short" }] };

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body,
      slot,
      config: loadHeadroomConfig({}),
      fetchImpl,
    });

    expect(result.body).toBe(body);
    expect(result.applied).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call Headroom for short adaptive requests", async () => {
    const fetchImpl = vi.fn();
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
      fetchImpl,
    });

    expect(result.applied).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls Headroom in force mode and returns the optimized body", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ body: { messages: [{ role: "user", content: "optimized" }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body: { messages: [{ role: "user", content: "original" }] },
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "force",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
      }),
      fetchImpl,
    });

    expect(result.applied).toBe(true);
    expect(result.body).toEqual({ messages: [{ role: "user", content: "optimized" }] });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:8787/optimize",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("calls Headroom in adaptive mode near the slot context limit", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ body: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await optimizeWithHeadroom({
      protocol: "openai-chat",
      body: { messages: [{ role: "user", content: "x".repeat(14_000) }], max_tokens: 1024 },
      slot,
      config: loadHeadroomConfig({
        MINIROUTER_HEADROOM_ENABLED: "true",
        MINIROUTER_HEADROOM_MODE: "adaptive",
        MINIROUTER_HEADROOM_URL: "http://localhost:8787",
        MINIROUTER_HEADROOM_CONTEXT_RATIO: "0.85",
      }),
      fetchImpl,
    });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe("context_headroom");
  });
});
