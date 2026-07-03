import { describe, expect, it } from "vitest";

import { normalizeOpenAIChatRequest } from "../../protocols/openai-chat.js";
import { buildRouteReceipt, type CatalogModel } from "./route.js";

const models: CatalogModel[] = [
  {
    id: "cheap/text-only",
    displayName: "Cheap Text Only",
    provider: "Example",
    type: "domestic",
    priceInput: 0.1,
    priceOutput: 0.2,
    scoreCoding: 40,
    scoreReasoning: 40,
    scoreChinese: 60,
    scoreOverall: 55,
    scoreSpeed: 95,
    hasVision: false,
    hasVideo: false,
    hasAudio: false,
    contextWindow: 128000,
    maxOutput: 8192,
    supportsTools: true,
    supportsJson: true,
    isActive: true,
    priority: 0,
  },
  {
    id: "balanced/vision-agent",
    displayName: "Balanced Vision Agent",
    provider: "Example",
    type: "domestic",
    priceInput: 1,
    priceOutput: 2,
    scoreCoding: 78,
    scoreReasoning: 74,
    scoreChinese: 82,
    scoreOverall: 80,
    scoreSpeed: 80,
    hasVision: true,
    hasVideo: false,
    hasAudio: false,
    contextWindow: 256000,
    maxOutput: 32768,
    supportsTools: true,
    supportsJson: true,
    isActive: true,
    priority: 3,
  },
  {
    id: "expensive/vision",
    displayName: "Expensive Vision",
    provider: "Example",
    type: "domestic",
    priceInput: 10,
    priceOutput: 30,
    scoreCoding: 90,
    scoreReasoning: 90,
    scoreChinese: 88,
    scoreOverall: 90,
    scoreSpeed: 60,
    hasVision: true,
    hasVideo: false,
    hasAudio: false,
    contextWindow: 1000000,
    maxOutput: 65536,
    supportsTools: true,
    supportsJson: true,
    isActive: true,
    priority: 1,
  },
];

describe("buildRouteReceipt", () => {
  it("filters hard capability mismatches before selecting the best value model", () => {
    const request = normalizeOpenAIChatRequest({
      model: "minirouter/auto",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this screenshot and return JSON." },
            { type: "image_url", image_url: { url: "https://example.com/ui.png" } },
          ],
        },
      ],
      tools: [{ type: "function", function: { name: "save_result" } }],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });

    const receipt = buildRouteReceipt(request, models, { profile: "auto" });

    expect(receipt.selectedModel.id).toBe("balanced/vision-agent");
    expect(receipt.fallbackChain.map((m) => m.id)).toEqual([
      "balanced/vision-agent",
      "expensive/vision",
    ]);
    expect(receipt.filteredOut).toContainEqual({
      id: "cheap/text-only",
      reason: "vision_required",
    });
    expect(receipt.features.requirements).toMatchObject({
      vision: true,
      toolCalling: true,
      jsonMode: true,
    });
  });
});
