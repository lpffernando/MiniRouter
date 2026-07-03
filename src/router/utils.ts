/**
 * Shared utilities for the routing pipeline.
 */

import { BLOCKRUN_MODELS } from "../models.js";
import type { ModelPricing } from "./selector.js";

/**
 * Build a Map<modelId, pricing> from the BLOCKRUN_MODELS catalog.
 * Cached — the catalog is static at runtime so we only need to build it once.
 */
let pricingCache: Map<string, ModelPricing> | null = null;

export function buildModelPricing(): Map<string, ModelPricing> {
  if (pricingCache) return pricingCache;
  pricingCache = new Map(
    BLOCKRUN_MODELS.map((model) => [
      model.id,
      {
        inputPrice: model.inputPrice,
        outputPrice: model.outputPrice,
        flatPrice: model.flatPrice,
      },
    ]),
  );
  return pricingCache;
}