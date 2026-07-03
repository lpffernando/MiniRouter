/**
 * GET /v1/models — List available models (OpenAI-compatible)
 */

import type { Context } from "hono";
import { VISIBLE_OPENCLAW_MODELS } from "../../models.js";
import { loadModelSlotsFromEnv } from "../../providers/env.js";

type EnvLike = Record<string, string | undefined>;

type OpenAIModelEntry = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  root?: string;
};

function virtualRoutingModels(created: number): OpenAIModelEntry[] {
  return [
    {
      id: "minirouter/auto",
      object: "model",
      created,
      owned_by: "minirouter",
    },
    {
      id: "minirouter/eco",
      object: "model",
      created,
      owned_by: "minirouter",
    },
    {
      id: "minirouter/premium",
      object: "model",
      created,
      owned_by: "minirouter",
    },
  ];
}

export function buildModelList(env: EnvLike = process.env, created = Math.floor(Date.now() / 1000)): OpenAIModelEntry[] {
  const slots = loadModelSlotsFromEnv(env);
  const slotEntries = (["fast", "balanced", "strong", "vision"] as const)
    .map((slot) => slots[slot])
    .filter((slot) => !!slot)
    .map((slot) => ({
      id: `minirouter/slot/${slot.slot}`,
      object: "model" as const,
      created,
      owned_by: "minirouter",
      root: slot.model,
    }));

  if (slotEntries.length > 0) {
    return [...virtualRoutingModels(created), ...slotEntries];
  }

  const legacyModels = VISIBLE_OPENCLAW_MODELS.map((m) => ({
    id: m.id,
    object: "model" as const,
    created,
    owned_by: "minirouter",
  }));

  return [...virtualRoutingModels(created), ...legacyModels];
}

/**
 * GET /v1/models
 *
 * Returns all available models in OpenAI format.
 * In Phase 2, this will filter by user permissions.
 */
export async function listModels(c: Context) {
  // Simple paging (LiteLLM-style)
  const after = c.req.query("after");
  let data = buildModelList();
  if (after) {
    const idx = data.findIndex((m) => m.id === after);
    if (idx >= 0) {
      data = data.slice(idx + 1);
    }
  }

  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10), 500);
  const page = data.slice(0, limit);

  return c.json({
    object: "list",
    data: page,
    has_more: data.length > limit,
  });
}
