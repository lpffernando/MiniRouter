import { describe, expect, it } from "vitest";

import { normalizeAnthropicMessagesRequest } from "./anthropic-messages.js";
import { extractRoutingFeatures } from "../routing/features/extractor.js";

describe("normalizeAnthropicMessagesRequest", () => {
  it("normalizes native Anthropic messages for routing without requiring upstream conversion", () => {
    const request = normalizeAnthropicMessagesRequest({
      model: "minirouter/auto",
      system: "Return JSON.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this screenshot." },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: "abc",
              },
            },
          ],
        },
      ],
      tools: [{ name: "save_result", input_schema: { type: "object" } }],
      max_tokens: 1024,
    });

    const features = extractRoutingFeatures(request);

    expect(request.protocol).toBe("anthropic-messages");
    expect(features.promptText).toContain("Analyze this screenshot.");
    expect(features.requirements.vision).toBe(true);
    expect(features.requirements.toolCalling).toBe(true);
  });
});

