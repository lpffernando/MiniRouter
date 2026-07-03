import type { ModelSlot } from "./types.js";

type FetchLike = typeof fetch;

const DEFAULT_TIMEOUT_MS = 180_000; // 3 minutes

function readTimeout(env: Record<string, string | undefined> = process.env): number {
  const raw = env["MINIROUTER_UPSTREAM_TIMEOUT_MS"];
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function messagesUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/messages")) return trimmed;
  return `${trimmed}/messages`;
}

export async function executeAnthropicMessages(
  body: Record<string, unknown>,
  slot: ModelSlot,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const upstreamBody: Record<string, unknown> = {
    ...body,
    model: slot.model,
  };

  return fetchImpl(messagesUrl(slot.baseUrl), {
    method: "POST",
    headers: {
      "x-api-key": slot.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
    signal: AbortSignal.timeout(readTimeout()),
  });
}