import { describe, expect, it } from "vitest";

import { normalizeOpenAIChatRequest } from "./openai-chat.js";
import { extractRoutingFeatures } from "../routing/features/extractor.js";

describe("normalizeOpenAIChatRequest", () => {
  it("preserves tools, image content, json mode, and token budget in the canonical request", () => {
    const request = normalizeOpenAIChatRequest({
      model: "minirouter/auto",
      messages: [
        { role: "system", content: "Return JSON." },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this UI and call a tool if needed." },
            { type: "image_url", image_url: { url: "https://example.com/screen.png" } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "inspect_ui",
            parameters: { type: "object" },
          },
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
      stream: true,
    });

    const features = extractRoutingFeatures(request);

    expect(request.protocol).toBe("openai-chat");
    expect(request.model).toBe("minirouter/auto");
    expect(request.maxOutputTokens).toBe(2048);
    expect(request.stream).toBe(true);
    expect(features.requirements.vision).toBe(true);
    expect(features.requirements.toolCalling).toBe(true);
    expect(features.requirements.jsonMode).toBe(true);
    expect(features.promptText).toContain("Describe this UI");
  });

  it("preserves optional metadata for step-aware routing", () => {
    const request = normalizeOpenAIChatRequest({
      model: "minirouter/auto",
      metadata: {
        minirouter: {
          step_type: "final_synthesis",
          current_step: "write final conclusion",
        },
      },
      messages: [{ role: "user", content: "ok" }],
    });

    expect(request.metadata).toEqual({
      minirouter: {
        step_type: "final_synthesis",
        current_step: "write final conclusion",
      },
    });
  });
});
