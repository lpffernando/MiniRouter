import { describe, expect, it } from "vitest";

import {
  createMissingSlotResponse,
  createProviderErrorResponse,
  createUnsatisfiedSlotResponse,
  selectConfiguredSlotForChat,
  slotCanServeOpenAIChat,
  toMutableUpstreamResponse,
} from "./chat.js";

describe("selectConfiguredSlotForChat", () => {
  it("runs the MVP with balanced, strong, and vision slots without requiring fast", () => {
    const result = selectConfiguredSlotForChat(
      {
        model: "minirouter/auto",
        messages: [{ role: "user", content: "summarize this short note" }],
      },
      {
        MINIROUTER_BALANCED_PROVIDER: "openai-compatible",
        MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_BALANCED_API_KEY: "balanced-key",
        MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
        MINIROUTER_STRONG_PROVIDER: "openai-compatible",
        MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_STRONG_API_KEY: "strong-key",
        MINIROUTER_STRONG_MODEL: "glm-5.2",
        MINIROUTER_VISION_PROVIDER: "openai-compatible",
        MINIROUTER_VISION_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_VISION_API_KEY: "vision-key",
        MINIROUTER_VISION_MODEL: "glm-4.6v",
      },
    );

    expect(result?.slot.slot).toBe("balanced");
    expect(result?.slot.model).toBe("deepseek-v4-flash");
    expect(result?.tier).toBe("SIMPLE");
  });

  it("selects the configured strong slot for reasoning prompts", () => {
    const result = selectConfiguredSlotForChat(
      {
        model: "minirouter/auto",
        messages: [
          {
            role: "user",
            content: "prove the theorem step by step using mathematical induction",
          },
        ],
        max_tokens: 1024,
      },
      {
        MINIROUTER_FAST_PROVIDER: "openai-compatible",
        MINIROUTER_FAST_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_FAST_API_KEY: "fast-key",
        MINIROUTER_FAST_MODEL: "glm-4.7-flash",
        MINIROUTER_STRONG_PROVIDER: "openai-compatible",
        MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_STRONG_API_KEY: "strong-key",
        MINIROUTER_STRONG_MODEL: "glm-5.2",
      },
    );

    expect(result?.slot.slot).toBe("strong");
    expect(result?.slot.model).toBe("glm-5.2");
    expect(result?.tier).toBe("REASONING");
  });

  it("honors an explicitly requested configured slot model", () => {
    const result = selectConfiguredSlotForChat(
      {
        model: "minirouter/slot/strong",
        messages: [{ role: "user", content: "hello" }],
      },
      {
        MINIROUTER_BALANCED_PROVIDER: "openai-compatible",
        MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_BALANCED_API_KEY: "balanced-key",
        MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
        MINIROUTER_STRONG_PROVIDER: "openai-compatible",
        MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_STRONG_API_KEY: "strong-key",
        MINIROUTER_STRONG_MODEL: "glm-5.2",
      },
    );

    expect(result?.slot.slot).toBe("strong");
    expect(result?.slot.model).toBe("glm-5.2");
  });
});

describe("slotCanServeOpenAIChat", () => {
  it("does not allow OpenAI Chat requests to be converted into native Anthropic requests", () => {
    expect(
      slotCanServeOpenAIChat({
        slot: "strong",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "key",
        model: "claude-sonnet",
        supportsTools: true,
        supportsVision: true,
      }),
    ).toBe(false);
  });
});

describe("createMissingSlotResponse", () => {
  it("returns an explicit configuration error instead of a fake successful chat response", async () => {
    const response = createMissingSlotResponse();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        message: "MiniRouter has no configured model slots. Configure MINIROUTER_BALANCED_BASE_URL, MINIROUTER_STRONG_BASE_URL, or MINIROUTER_VISION_BASE_URL before using routed models.",
        type: "configuration_error",
      },
    });
  });
});

describe("createUnsatisfiedSlotResponse", () => {
  it("returns a configuration error when no configured slot can satisfy the request", async () => {
    const response = createUnsatisfiedSlotResponse(new Error("No configured model slot can satisfy the request"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        message:
          "No configured MiniRouter model slot can satisfy this request. Check VISION support for image inputs and SUPPORTS_TOOLS for Agent/tool calls.",
        type: "configuration_error",
      },
    });
  });
});

describe("createProviderErrorResponse", () => {
  it("returns a provider error without exposing secrets", async () => {
    const response = createProviderErrorResponse(new Error("fetch failed for api-key secret-value"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: {
        message: "Upstream provider request failed. Check the selected slot BASE_URL, API_KEY, and network access.",
        type: "provider_error",
      },
    });
  });
});

describe("toMutableUpstreamResponse", () => {
  it("copies upstream status and headers into a new response", async () => {
    const upstream = new Response("ok", {
      status: 201,
      headers: {
        "content-type": "application/json",
        "x-request-id": "upstream-1",
      },
    });

    const response = toMutableUpstreamResponse(upstream);

    expect(response).not.toBe(upstream);
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-request-id")).toBe("upstream-1");
    await expect(response.text()).resolves.toBe("ok");
  });
});
