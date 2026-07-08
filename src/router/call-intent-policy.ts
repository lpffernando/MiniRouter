import type { CallIntent } from "../routing/features/call-intent.js";
import type { RoutingFeatures } from "../routing/features/extractor.js";
import type { Tier } from "./types.js";

const TIER_RANK: Record<Tier, number> = {
  SIMPLE: 0,
  MEDIUM: 1,
  COMPLEX: 2,
  REASONING: 3,
};

function maxTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

function canDowngradeHousekeeping(callIntent: CallIntent, features: RoutingFeatures): boolean {
  return (
    callIntent.stepType === "housekeeping" &&
    !features.requirements.toolCalling &&
    !features.requirements.vision &&
    features.estimatedInputTokens < 2000
  );
}

function isInterpretiveDataStep(callIntent: CallIntent): boolean {
  return /(最终|总结|结论|业务解释|口径|报告|对外表达|final|conclusion|interpret)/i.test(
    [callIntent.currentStep, callIntent.classifierText].filter(Boolean).join("\n"),
  );
}

function isLongAgenticContinuation(callIntent: CallIntent, features: RoutingFeatures): boolean {
  return (
    features.requirements.toolCalling &&
    features.requirements.agentic &&
    features.estimatedInputTokens >= 16000 &&
    (callIntent.signals.includes("recent-failure") || callIntent.signals.includes("tool-result"))
  );
}

export function applyCallIntentTierPolicy(input: {
  tier: Tier;
  callIntent: CallIntent;
  features: RoutingFeatures;
}): {
  tier: Tier;
  upgraded: boolean;
  downgraded: boolean;
  reason?: string;
} {
  const original = input.tier;
  let tier = input.tier;
  let reason: string | undefined;

  if (canDowngradeHousekeeping(input.callIntent, input.features)) {
    tier = "SIMPLE";
    reason = "housekeeping short step";
  } else {
    let minTier: Tier | null = null;
    if (input.callIntent.qualityHint === "strong") minTier = "COMPLEX";
    if (input.callIntent.stepType === "coding") minTier = maxTier(minTier ?? "SIMPLE", "MEDIUM");
    if (input.callIntent.stepType === "debugging") {
      const tierForDebugging = isLongAgenticContinuation(input.callIntent, input.features) ? "COMPLEX" : "MEDIUM";
      minTier = maxTier(minTier ?? "SIMPLE", tierForDebugging);
      if (tierForDebugging === "COMPLEX") reason = "debugging agent continuation min tier COMPLEX";
    }
    if (input.callIntent.stepType === "unknown" && isLongAgenticContinuation(input.callIntent, input.features)) {
      minTier = maxTier(minTier ?? "SIMPLE", "COMPLEX");
      reason = "tool-result continuation min tier COMPLEX";
    }
    if (input.callIntent.stepType === "data_analysis") {
      minTier = maxTier(minTier ?? "SIMPLE", isInterpretiveDataStep(input.callIntent) ? "COMPLEX" : "MEDIUM");
    }
    if (input.callIntent.stepType === "planning" || input.callIntent.stepType === "final_synthesis") {
      minTier = "COMPLEX";
    }
    if (input.callIntent.stepType === "vision") minTier = "COMPLEX";

    if (minTier && TIER_RANK[tier] < TIER_RANK[minTier]) {
      tier = minTier;
      reason ??= `${input.callIntent.stepType} min tier ${minTier}`;
    }
  }

  return {
    tier,
    upgraded: TIER_RANK[tier] > TIER_RANK[original],
    downgraded: TIER_RANK[tier] < TIER_RANK[original],
    reason,
  };
}
