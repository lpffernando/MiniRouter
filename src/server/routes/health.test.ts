import { describe, expect, it } from "vitest";

import { buildReadinessPayload } from "./health.js";

describe("buildReadinessPayload", () => {
  it("marks the routing MVP ready when balanced, strong, and vision are configured", () => {
    const payload = buildReadinessPayload({
      MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_BALANCED_API_KEY: "balanced-key",
      MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
      MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_STRONG_API_KEY: "strong-key",
      MINIROUTER_STRONG_MODEL: "glm-5.2",
      MINIROUTER_VISION_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_VISION_API_KEY: "vision-key",
      MINIROUTER_VISION_MODEL: "glm-4.6v",
      MINIROUTER_VISION_SUPPORTS_VISION: "true",
    });

    expect(payload.status).toBe("ready");
    expect(payload.mvp.ready).toBe(true);
    expect(payload.mvp.requiredSlots).toEqual(["balanced", "strong", "vision"]);
    expect(payload.mvp.missingSlots).toEqual([]);
    expect(payload.mvp.optionalSlots).toEqual(["fast"]);
  });

  it("reports missing required MVP slots while keeping fast optional", () => {
    const payload = buildReadinessPayload({
      MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
      MINIROUTER_BALANCED_API_KEY: "balanced-key",
      MINIROUTER_BALANCED_MODEL: "deepseek-v4-flash",
    });

    expect(payload.status).toBe("not_ready");
    expect(payload.mvp.ready).toBe(false);
    expect(payload.mvp.missingSlots).toEqual(["strong", "vision"]);
    expect(payload.mvp.optionalSlots).toEqual(["fast"]);
  });
});
