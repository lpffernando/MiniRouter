import { describe, expect, it, vi } from "vitest";

import { executeOpenAICompatibleChat } from "./openai-compatible.js";

describe("executeOpenAICompatibleChat", () => {
  it("forwards OpenAI chat requests to the configured base URL and model", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await executeOpenAICompatibleChat(
      {
        model: "minirouter/auto",
        messages: [{ role: "user", content: "hello" }],
        stream: false,
      },
      {
        slot: "fast",
        provider: "auto",
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret",
        model: "real-model",
        supportsTools: true,
        supportsVision: true,
      },
      fetchImpl,
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret",
        }),
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("real-model");
  });
});
