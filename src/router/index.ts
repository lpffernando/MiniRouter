/**
 * Smart Router Entry Point
 *
 * Classifies requests and routes to the cheapest capable model.
 * Delegates to pluggable RouterStrategy (default: RulesStrategy, <1ms).
 */

import type { RoutingDecision, RouterOptions } from "./types.js";
import { getStrategy } from "./strategy.js";

/**
 * Route a request to the cheapest capable model.
 * Delegates to the registered "rules" strategy by default.
 *
 * `classifierText` (optional) is what the 14-dim classifier scores against.
 * Default: same as `prompt` (full conversation text) — but callers should
 * pass ONLY the last user turn so the score reflects the current request's
 * difficulty, not accumulated assistant history. Otherwise every turn in
 * a long coding session hits every keyword and routes to REASONING.
 * `prompt` (full conversation) is still used for token-count estimation.
 */
export function route(
  prompt: string,
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  options: RouterOptions,
  classifierText?: string,
): RoutingDecision {
  const strategy = getStrategy("rules");
  return strategy.route(prompt, systemPrompt, maxOutputTokens, options, classifierText);
}

export { getStrategy, registerStrategy } from "./strategy.js";
export {
  getFallbackChain,
  getFallbackChainFiltered,
  filterByToolCalling,
  filterByVision,
  filterByExcludeList,
  calculateModelCost,
} from "./selector.js";
 export { DEFAULT_ROUTING_CONFIG } from "./config.js";
 export { getConfig } from "./config.js";
 export type {
  RoutingDecision,
  Tier,
  RoutingConfig,
  RouterOptions,
  RouterStrategy,
} from "./types.js";
export type { ModelPricing } from "./selector.js";
