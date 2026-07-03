import { describe, expect, it } from "vitest";

import { buildModelList } from "./models.js";

describe("buildModelList", () => {
  it("lists routed virtual models and configured env slots for the MVP", () => {
    const models = buildModelList({
      MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_BALANCED_API_KEY: "balanced-key",
      MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
      MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_STRONG_API_KEY: "strong-key",
      MINIROUTER_STRONG_MODEL: "glm-5.2",
      MINIROUTER_VISION_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_VISION_API_KEY: "vision-key",
      MINIROUTER_VISION_MODEL: "glm-4.6v",
    });

    expect(models.map((model) => model.id)).toEqual([
      "minirouter/auto",
      "minirouter/eco",
      "minirouter/premium",
      "minirouter/slot/balanced",
      "minirouter/slot/strong",
      "minirouter/slot/vision",
    ]);
    expect(models.find((model) => model.id === "minirouter/slot/strong")).toMatchObject({
      owned_by: "minirouter",
      root: "glm-5.2",
    });
  });
});
