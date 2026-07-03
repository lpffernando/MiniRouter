import { describe, expect, it } from "vitest";

import {
  createAnthropicProviderErrorResponse,
  createUnsatisfiedAnthropicSlotResponse,
  selectConfiguredSlotForAnthropicMessages,
} from "./anthropic-messages.js";

describe("selectConfiguredSlotForAnthropicMessages", () => {
  it("runs the MVP with balanced, strong, and vision slots without requiring fast", () => {
    const result = selectConfiguredSlotForAnthropicMessages(
      {
        model: "minirouter/auto",
        messages: [{ role: "user", content: "summarize this short note" }],
        max_tokens: 512,
      },
      {
        MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_BALANCED_API_KEY: "balanced-key",
        MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
        MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_STRONG_API_KEY: "strong-key",
        MINIROUTER_STRONG_MODEL: "glm-5.2",
        MINIROUTER_VISION_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_VISION_API_KEY: "vision-key",
        MINIROUTER_VISION_MODEL: "glm-4.6v",
      },
    );

    expect(result?.slot.slot).toBe("balanced");
    expect(result?.slot.model).toBe("deepseek-v4-flash");
  });

  it("selects the same slot model for Anthropic-native requests without changing endpoint standard", () => {
    const result = selectConfiguredSlotForAnthropicMessages(
      {
        model: "minirouter/auto",
        messages: [{ role: "user", content: "prove this carefully step by step" }],
        max_tokens: 1024,
      },
      {
        MINIROUTER_FAST_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_FAST_API_KEY: "fast-key",
        MINIROUTER_FAST_MODEL: "glm-4.7-flash",
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
    const result = selectConfiguredSlotForAnthropicMessages(
      {
        model: "minirouter/slot/strong",
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 512,
      },
      {
        MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_BALANCED_API_KEY: "balanced-key",
        MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
        MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_STRONG_API_KEY: "strong-key",
        MINIROUTER_STRONG_MODEL: "glm-5.2",
      },
    );

    expect(result?.slot.slot).toBe("strong");
    expect(result?.slot.model).toBe("glm-5.2");
  });
});

describe("createUnsatisfiedAnthropicSlotResponse", () => {
  it("returns a configuration error when no configured slot can satisfy the request", async () => {
    const response = createUnsatisfiedAnthropicSlotResponse(new Error("No configured model slot can satisfy the request"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        message:
          "No configured MiniRouter model slot can satisfy this Anthropic Messages request. Check VISION support for image inputs and SUPPORTS_TOOLS for tool calls.",
        type: "configuration_error",
      },
    });
  });
});

describe("createAnthropicProviderErrorResponse", () => {
  it("returns a provider error without exposing secrets", async () => {
    const response = createAnthropicProviderErrorResponse(new Error("fetch failed for secret-value"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: {
        message:
          "Upstream Anthropic Messages provider request failed. Check the selected slot BASE_URL, API_KEY, and network access.",
        type: "provider_error",
      },
    });
  });
});
