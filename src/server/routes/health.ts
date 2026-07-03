import type { Context } from "hono";
import { loadModelSlotsFromEnv } from "../../providers/env.js";

type EnvLike = Record<string, string | undefined>;
type RequiredMvpSlot = "balanced" | "strong" | "vision";

const REQUIRED_MVP_SLOTS: RequiredMvpSlot[] = ["balanced", "strong", "vision"];
const OPTIONAL_MVP_SLOTS = ["fast"] as const;

export function buildReadinessPayload(env: EnvLike = process.env) {
  const slots = loadModelSlotsFromEnv(env);
  const missingSlots = REQUIRED_MVP_SLOTS.filter((slot) => !slots[slot]);
  const ready = missingSlots.length === 0;

  return {
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    mvp: {
      ready,
      requiredSlots: REQUIRED_MVP_SLOTS,
      optionalSlots: [...OPTIONAL_MVP_SLOTS],
      configuredSlots: Object.keys(slots).sort(),
      missingSlots,
    },
  };
}

export function health(c: Context) {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
}

export function readiness(c: Context) {
  const payload = buildReadinessPayload();
  return c.json(payload, payload.mvp.ready ? 200 : 503);
}
