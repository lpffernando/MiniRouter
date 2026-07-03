import type { ModelSlot } from "../providers/types.js";

export type HeadroomMode = "off" | "adaptive" | "force";

export type HeadroomConfig = {
  enabled: boolean;
  mode: HeadroomMode;
  url?: string;
  minTokens: number;
  contextRatio: number;
};

export type HeadroomProtocol = "openai-chat" | "anthropic-messages";

export type HeadroomResult<TBody> = {
  body: TBody;
  applied: boolean;
  reason: "disabled" | "short_request" | "no_url" | "force" | "min_tokens" | "context_headroom";
};

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

function readBool(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function readMode(value: string | undefined): HeadroomMode {
  if (value === "force" || value === "adaptive" || value === "off") return value;
  return "off";
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadHeadroomConfig(env: EnvLike = process.env): HeadroomConfig {
  const enabled = readBool(env["MINIROUTER_HEADROOM_ENABLED"]);
  const mode = enabled ? readMode(env["MINIROUTER_HEADROOM_MODE"] ?? "adaptive") : "off";
  return {
    enabled,
    mode,
    url: env["MINIROUTER_HEADROOM_URL"],
    minTokens: readNumber(env["MINIROUTER_HEADROOM_MIN_TOKENS"], 8000),
    contextRatio: readNumber(env["MINIROUTER_HEADROOM_CONTEXT_RATIO"], 0.85),
  };
}

function estimateTokens(body: unknown): number {
  return Math.ceil(JSON.stringify(body).length / 4);
}

function maxOutputTokens(body: Record<string, unknown>): number {
  const value = body["max_tokens"] ?? body["max_completion_tokens"];
  return typeof value === "number" ? value : 0;
}

function shouldOptimize<TBody extends Record<string, unknown>>(
  body: TBody,
  slot: ModelSlot,
  config: HeadroomConfig,
): HeadroomResult<TBody>["reason"] {
  if (!config.enabled || config.mode === "off") return "disabled";
  if (config.mode === "force") return "force";

  const inputTokens = estimateTokens(body);
  if (inputTokens >= config.minTokens) return "min_tokens";

  if (slot.contextWindowTokens) {
    const totalTokens = inputTokens + maxOutputTokens(body);
    if (totalTokens >= slot.contextWindowTokens * config.contextRatio) {
      return "context_headroom";
    }
  }

  return "short_request";
}

function optimizeUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/optimize")) return trimmed;
  return `${trimmed}/optimize`;
}

export async function optimizeWithHeadroom<TBody extends Record<string, unknown>>(input: {
  protocol: HeadroomProtocol;
  body: TBody;
  slot: ModelSlot;
  config?: HeadroomConfig;
  fetchImpl?: FetchLike;
}): Promise<HeadroomResult<TBody>> {
  const config = input.config ?? loadHeadroomConfig();
  const reason = shouldOptimize(input.body, input.slot, config);

  if (reason === "disabled" || reason === "short_request") {
    return { body: input.body, applied: false, reason };
  }

  if (!config.url) {
    return { body: input.body, applied: false, reason: "no_url" };
  }

  const response = await (input.fetchImpl ?? fetch)(optimizeUrl(config.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      protocol: input.protocol,
      body: input.body,
      slot: {
        name: input.slot.slot,
        model: input.slot.model,
      },
      policy: {
        mode: config.mode,
        reason,
        protectStaticPrefix: true,
        preserveNativeApiShape: true,
      },
    }),
  });

  if (!response.ok) {
    return { body: input.body, applied: false, reason };
  }

  const payload = (await response.json()) as { body?: TBody };
  return {
    body: payload.body ?? input.body,
    applied: payload.body !== undefined,
    reason,
  };
}

