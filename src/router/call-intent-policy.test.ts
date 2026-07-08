import { describe, expect, it } from "vitest";

import { applyCallIntentTierPolicy } from "./call-intent-policy.js";
import type { CallIntent } from "../routing/features/call-intent.js";
import type { RoutingFeatures } from "../routing/features/extractor.js";
import type { Tier } from "./types.js";

function intent(overrides: Partial<CallIntent>): CallIntent {
  return {
    globalGoal: null,
    currentStep: null,
    classifierText: "",
    stepType: "unknown",
    qualityHint: null,
    confidence: 0.5,
    signals: [],
    source: "heuristic",
    ...overrides,
  };
}

function features(overrides: Partial<RoutingFeatures> = {}): RoutingFeatures {
  return {
    promptText: "",
    estimatedInputTokens: 100,
    estimatedTotalTokens: 4196,
    requirements: {
      toolCalling: false,
      structuredOutput: false,
      jsonMode: false,
      vision: false,
      audio: false,
      video: false,
      longContext: false,
      agentic: false,
    },
    ...overrides,
  };
}

function apply(tier: Tier, callIntent: CallIntent, routingFeatures = features()) {
  return applyCallIntentTierPolicy({ tier, callIntent, features: routingFeatures });
}

describe("applyCallIntentTierPolicy", () => {
  it("keeps short housekeeping calls on SIMPLE", () => {
    const result = apply("MEDIUM", intent({ stepType: "housekeeping", currentStep: "reply only pong" }));

    expect(result.tier).toBe("SIMPLE");
    expect(result.downgraded).toBe(true);
  });

  it("raises planning to at least COMPLEX", () => {
    const result = apply("MEDIUM", intent({ stepType: "planning" }));

    expect(result.tier).toBe("COMPLEX");
    expect(result.upgraded).toBe(true);
  });

  it("raises final synthesis to at least COMPLEX", () => {
    const result = apply("SIMPLE", intent({ stepType: "final_synthesis" }));

    expect(result.tier).toBe("COMPLEX");
  });

  it("raises interpretive data analysis to COMPLEX", () => {
    const result = apply(
      "MEDIUM",
      intent({ stepType: "data_analysis", currentStep: "compare report methodology and write final interpretation" }),
    );

    expect(result.tier).toBe("COMPLEX");
  });

  it("keeps coding at least MEDIUM", () => {
    const result = apply("SIMPLE", intent({ stepType: "coding" }));

    expect(result.tier).toBe("MEDIUM");
  });

  it("raises long agentic debugging continuations to COMPLEX", () => {
    const result = apply(
      "MEDIUM",
      intent({ stepType: "debugging", signals: ["recent-failure"], currentStep: "Exit code 1 Traceback" }),
      features({
        estimatedInputTokens: 66000,
        estimatedTotalTokens: 70096,
        requirements: { ...features().requirements, toolCalling: true, agentic: true },
      }),
    );

    expect(result.tier).toBe("COMPLEX");
    expect(result.reason).toBe("debugging agent continuation min tier COMPLEX");
  });

  it("raises long agentic tool-result continuations with unknown intent to COMPLEX", () => {
    const result = apply(
      "MEDIUM",
      intent({
        stepType: "unknown",
        signals: ["tool-result"],
        currentStep: '[{"text":"/tmp/floor_model.json","type":"text"}]',
      }),
      features({
        estimatedInputTokens: 66000,
        estimatedTotalTokens: 70096,
        requirements: { ...features().requirements, toolCalling: true, agentic: true },
      }),
    );

    expect(result.tier).toBe("COMPLEX");
    expect(result.reason).toBe("tool-result continuation min tier COMPLEX");
  });

  it("does not downgrade housekeeping when tools or long context are present", () => {
    const result = apply(
      "MEDIUM",
      intent({ stepType: "housekeeping" }),
      features({ estimatedInputTokens: 3000, requirements: { ...features().requirements, toolCalling: true } }),
    );

    expect(result.tier).toBe("MEDIUM");
    expect(result.downgraded).toBe(false);
  });
});
