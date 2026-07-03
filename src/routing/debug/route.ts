import type { CanonicalRequest } from "../../protocols/ir.js";
import { extractRoutingFeatures, type RoutingFeatures } from "../features/extractor.js";

export type CatalogModel = {
  id: string;
  displayName: string;
  provider: string;
  type: string;
  priceInput: number | null;
  priceOutput: number | null;
  scoreCoding: number | null;
  scoreReasoning: number | null;
  scoreChinese: number | null;
  scoreOverall: number | null;
  scoreSpeed: number | null;
  hasVision: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  contextWindow: number | null;
  maxOutput: number | null;
  supportsTools: boolean;
  supportsJson: boolean;
  isActive: boolean;
  priority: number | null;
};

export type RouteProfile = "eco" | "auto" | "premium";

export type FilteredModel = {
  id: string;
  reason:
    | "inactive"
    | "vision_required"
    | "audio_required"
    | "video_required"
    | "tools_required"
    | "json_required"
    | "context_too_small"
    | "output_too_small";
};

export type RankedModel = CatalogModel & {
  routeScore: number;
  estimatedCost: number;
};

export type RouteReceipt = {
  profile: RouteProfile;
  features: RoutingFeatures;
  selectedModel: RankedModel;
  fallbackChain: RankedModel[];
  filteredOut: FilteredModel[];
};

function averageAbility(model: CatalogModel): number {
  const values = [
    model.scoreOverall,
    model.scoreCoding,
    model.scoreReasoning,
    model.scoreChinese,
  ].filter((value): value is number => typeof value === "number");
  if (values.length === 0) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateCost(model: CatalogModel, features: RoutingFeatures): number {
  const input = model.priceInput ?? 0;
  const output = model.priceOutput ?? 0;
  return (
    (features.estimatedInputTokens / 1_000_000) * input +
    ((features.estimatedTotalTokens - features.estimatedInputTokens) / 1_000_000) * output
  );
}

function costScore(cost: number): number {
  return 100 / (1 + cost * 1000);
}

function rankModel(model: CatalogModel, features: RoutingFeatures, profile: RouteProfile): RankedModel {
  const estimatedCost = estimateCost(model, features);
  const abilityWeight = profile === "premium" ? 0.58 : profile === "eco" ? 0.34 : 0.45;
  const costWeight = profile === "premium" ? 0.08 : profile === "eco" ? 0.34 : 0.18;
  const speedWeight = profile === "premium" ? 0.12 : 0.16;
  const reliabilityWeight = 0.14;
  const priorityWeight = 0.08;
  const ability = averageAbility(model);
  const speed = model.scoreSpeed ?? 60;
  const reliability = model.priority ? Math.min(100, 60 + model.priority * 8) : 60;
  const priority = model.priority ? Math.min(100, model.priority * 20) : 0;

  return {
    ...model,
    estimatedCost,
    routeScore:
      ability * abilityWeight +
      costScore(estimatedCost) * costWeight +
      speed * speedWeight +
      reliability * reliabilityWeight +
      priority * priorityWeight,
  };
}

function getFilterReason(model: CatalogModel, features: RoutingFeatures): FilteredModel["reason"] | null {
  const req = features.requirements;
  if (!model.isActive) return "inactive";
  if (req.vision && !model.hasVision) return "vision_required";
  if (req.audio && !model.hasAudio) return "audio_required";
  if (req.video && !model.hasVideo) return "video_required";
  if (req.toolCalling && !model.supportsTools) return "tools_required";
  if (req.jsonMode && !model.supportsJson) return "json_required";
  if (model.contextWindow !== null && model.contextWindow < features.estimatedTotalTokens) {
    return "context_too_small";
  }
  if (model.maxOutput !== null && model.maxOutput < features.estimatedTotalTokens - features.estimatedInputTokens) {
    return "output_too_small";
  }
  return null;
}

export function buildRouteReceipt(
  request: CanonicalRequest,
  models: CatalogModel[],
  options: { profile?: RouteProfile } = {},
): RouteReceipt {
  const profile = options.profile ?? "auto";
  const features = extractRoutingFeatures(request);
  const filteredOut: FilteredModel[] = [];
  const eligible: CatalogModel[] = [];

  for (const model of models) {
    const reason = getFilterReason(model, features);
    if (reason) {
      filteredOut.push({ id: model.id, reason });
    } else {
      eligible.push(model);
    }
  }

  if (eligible.length === 0) {
    throw new Error("No eligible model for request requirements");
  }

  const fallbackChain = eligible
    .map((model) => rankModel(model, features, profile))
    .sort((a, b) => b.routeScore - a.routeScore);

  return {
    profile,
    features,
    selectedModel: fallbackChain[0]!,
    fallbackChain,
    filteredOut,
  };
}

