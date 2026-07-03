import { describe, expect, it } from "vitest";

import {
  abilityScoresFromLlmStats,
  averageScore,
  percentScore,
  qualifiedAverageScore,
  weightedScore,
} from "./score-utils.mjs";

describe("score-utils", () => {
  it("keeps missing benchmark values as null instead of zero", () => {
    expect(percentScore(null)).toBeNull();
    expect(percentScore(undefined)).toBeNull();
    expect(percentScore(Number.NaN)).toBeNull();
  });

  it("normalizes fractional benchmark scores to 0-100 points", () => {
    expect(percentScore(0.642)).toBe(64);
    expect(percentScore(79)).toBe(79);
  });

  it("computes overall from available ability scores only", () => {
    expect(averageScore([64, 79, null])).toBe(72);
    expect(averageScore([null, null])).toBeNull();
  });

  it("requires enough dimensions before publishing an overall score", () => {
    expect(qualifiedAverageScore([78, null, null], { minSignals: 2 })).toBeNull();
    expect(qualifiedAverageScore([78, 91, null], { minSignals: 2 })).toBe(85);
  });

  it("computes weighted scores from available benchmark signals", () => {
    expect(
      weightedScore([
        { value: 0.8, weight: 0.75 },
        { value: 0.6, weight: 0.25 },
        { value: null, weight: 1 },
      ]),
    ).toBe(75);
  });

  it("uses one recognized benchmark per enabled dashboard ability score", () => {
    expect(
      abilityScoresFromLlmStats({
        swe_bench_verified_score: 0.642,
        swe_bench_pro_score: 0.9,
        scicode_score: 0.417,
        gpqa_score: 0.791,
        aime_2025_score: 0.973,
        hle_score: 0.144,
        mmmlu_score: 0.825,
      }),
    ).toEqual({
      coding: 64,
      reasoning: 79,
      chinese: null,
      overall: 72,
    });
  });

  it("does not treat MMMLU as a Chinese-native benchmark", () => {
    expect(
      abilityScoresFromLlmStats({
        mmmlu_score: 0.918,
      }),
    ).toEqual({
      coding: null,
      reasoning: null,
      chinese: null,
      overall: null,
    });
  });

  it("does not promote a model from AIME when GPQA is missing", () => {
    expect(
      abilityScoresFromLlmStats({
        aime_2025_score: 0.973,
      }),
    ).toEqual({
      coding: null,
      reasoning: null,
      chinese: null,
      overall: null,
    });
  });

  it("does not publish overall for one isolated benchmark dimension", () => {
    expect(
      abilityScoresFromLlmStats({
        swe_bench_verified_score: 0.778,
      }),
    ).toEqual({
      coding: 78,
      reasoning: null,
      chinese: null,
      overall: null,
    });
  });
});
