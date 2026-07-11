import { describe, expect, it } from "vitest";

import { buildModelList } from "./models.js";

describe("buildModelList", () => {
  it("returns routing models and only configured slots", () => {
    const models = buildModelList(
      {
        MINIROUTER_BALANCED_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_BALANCED_API_KEY: "balanced-key",
        MINIROUTER_BALANCED_MODEL: "balanced-model",
        MINIROUTER_STRONG_BASE_URL: "https://api.example.com/v1",
        MINIROUTER_STRONG_API_KEY: "strong-key",
        MINIROUTER_STRONG_MODEL: "strong-model",
      },
      1,
    );

    expect(models).toEqual([
      { id: "minirouter/auto", object: "model", created: 1, owned_by: "minirouter" },
      { id: "minirouter/eco", object: "model", created: 1, owned_by: "minirouter" },
      { id: "minirouter/premium", object: "model", created: 1, owned_by: "minirouter" },
      {
        id: "minirouter/slot/balanced",
        object: "model",
        created: 1,
        owned_by: "minirouter",
        root: "balanced-model",
      },
      {
        id: "minirouter/slot/strong",
        object: "model",
        created: 1,
        owned_by: "minirouter",
        root: "strong-model",
      },
    ]);
  });
});
