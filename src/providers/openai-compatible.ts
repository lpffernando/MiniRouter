import type { ModelSlot } from "./types.js";

type FetchLike = typeof fetch;

const DEFAULT_TIMEOUT_MS = 180_000; // 3 minutes — LLM responses can be slow

function readTimeout(env: Record<string, string | undefined> = process.env): number {
  const raw = env["MINIROUTER_UPSTREAM_TIMEOUT_MS"];
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function executeOpenAICompatibleChat(
  body: Record<string, unknown>,
  slot: ModelSlot,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const upstreamBody = {
    ...body,
    model: slot.model,
  };

  return fetchImpl(chatCompletionsUrl(slot.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${slot.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
    signal: AbortSignal.timeout(readTimeout()),
  });
}