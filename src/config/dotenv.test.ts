import { describe, expect, it } from "vitest";

import { parseDotEnv } from "./dotenv.js";

describe("parseDotEnv", () => {
  it("parses comments, quoted values, and unquoted values", () => {
    expect(
      parseDotEnv(`
        # MiniRouter
        MINIROUTER_SIMPLE_MODEL=deepseek-chat
        MINIROUTER_SIMPLE_API_KEY="sk-test"
        MINIROUTER_SIMPLE_BASE_URL='https://api.example.com/v1'
      `),
    ).toEqual({
      MINIROUTER_SIMPLE_MODEL: "deepseek-chat",
      MINIROUTER_SIMPLE_API_KEY: "sk-test",
      MINIROUTER_SIMPLE_BASE_URL: "https://api.example.com/v1",
    });
  });
});
