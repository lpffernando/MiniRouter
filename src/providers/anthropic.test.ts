import { describe, expect, it, vi } from "vitest";

import { executeAnthropicMessages } from "./anthropic.js";

describe("executeAnthropicMessages", () => {
  it("forwards native Anthropic Messages bodies without converting message shape", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg_test", content: [{ type: "text", text: "ok" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await executeAnthropicMessages(
      {
        model: "minirouter/auto",
        system: "Be concise.",
        messages: [
          { role: "user", content: "hello" },
        ],
        max_tokens: 512,
        tools: [{ name: "save_result", input_schema: { type: "object" } }],
      },
      {
        slot: "strong",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "secret",
        model: "claude-sonnet",
        supportsTools: true,
        supportsVision: true,
      },
      fetchImpl,
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "secret",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-sonnet");
    expect(body.system).toBe("Be concise.");
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.tools).toEqual([{ name: "save_result", input_schema: { type: "object" } }]);
  });
});
