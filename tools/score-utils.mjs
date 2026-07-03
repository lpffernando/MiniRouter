export function percentScore(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return Math.round(n <= 1 ? n * 100 : n);
}

export function averageScore(values) {
  const scores = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

export const SCORE_RULES = {
  coding: {
    description:
      "SWE-bench Verified only. No fallback to SWE-bench Pro because the two leaderboards are not directly comparable.",
    benchmark: "swe_bench_verified_score",
  },
  reasoning: {
    description:
      "GPQA only. AIME/HLE/etc. remain raw audit signals but are not mixed into the dashboard score.",
    benchmark: "gpqa_score",
  },
  chinese: {
    description:
      "SuperCLUE general leaderboard total score, imported separately from superclueai.com. LLM Stats MMMLU is not used as a Chinese score.",
    benchmark: "superclue_general_total_score",
  },
  overall: {
    description:
      "Plain average of available benchmark-backed dimensions, emitted only when at least two dimensions are present.",
  },
};

export function weightedScore(signals) {
  let weighted = 0;
  let totalWeight = 0;

  for (const signal of signals) {
    const value = percentScore(signal.value);
    if (value == null) continue;
    weighted += value * signal.weight;
    totalWeight += signal.weight;
  }

  if (totalWeight === 0) return null;
  return Math.round(weighted / totalWeight);
}

export function qualifiedWeightedScore(signals, options = {}) {
  const { minSignals = 1 } = options;
  const availableSignals = signals.filter((signal) => percentScore(signal.value) != null);
  if (availableSignals.length < minSignals) return null;
  return weightedScore(signals);
}

export function directBenchmarkScore(value) {
  return percentScore(value);
}

export function qualifiedAverageScore(values, options = {}) {
  const { minSignals = 1 } = options;
  const scores = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (scores.length < minSignals) return null;
  return averageScore(scores);
}

export function abilityScoresFromLlmStats(model) {
  const coding = directBenchmarkScore(model.swe_bench_verified_score);
  const reasoning = directBenchmarkScore(model.gpqa_score);
  const chinese = null;

  return {
    coding,
    reasoning,
    chinese,
    overall: qualifiedAverageScore([coding, reasoning, chinese], { minSignals: 2 }),
  };
}
