/**
 * Usage Log Queries
 */

import { getDb } from "../connection.js";
import { usageLogs } from "../schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface LogUsageInput {
  userId: string;
  apiKeyId?: string;
  providerInstanceId?: string;
  requestId: string;
  requestedModel?: string;
  selectedSlot?: string;
  model: string;
  tier?: string;
  profile?: string;
  strategy?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  costUsd: number;
  baselineCostUsd?: number;
  savingsPct?: number;
  latencyMs?: number;
  firstTokenMs?: number;
  status?: string;
  errorType?: string;
  isStreaming?: boolean;
  hasTools?: boolean;
  hasVision?: boolean;
  hasAgentic?: boolean;
  promptDigest?: string;
  globalGoalDigest?: string;
  currentStepDigest?: string;
  stepType?: string;
  qualityHint?: string;
  callIntentDebug?: string;
  optimizationReason?: string;
  compressionApplied?: boolean;
  compressionOriginalChars?: number;
  compressionCompressedChars?: number;
  compressionBlocks?: number;
  routingDebug?: string;
  effort?: string;
}

export async function logUsage(input: LogUsageInput): Promise<void> {
  const db = getDb();
  await db.insert(usageLogs).values({
    userId: input.userId,
    apiKeyId: input.apiKeyId ?? null,
    providerInstanceId: input.providerInstanceId ?? null,
    requestId: input.requestId,
    requestedModel: input.requestedModel ?? null,
    selectedSlot: input.selectedSlot ?? null,
    model: input.model,
    tier: input.tier ?? null,
    profile: input.profile ?? null,
    strategy: input.strategy ?? null,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    cacheReadTokens: input.cacheReadTokens ?? 0,
    costUsd: input.costUsd,
    baselineCostUsd: input.baselineCostUsd ?? null,
    savingsPct: input.savingsPct ?? null,
    latencyMs: input.latencyMs ?? null,
    firstTokenMs: input.firstTokenMs ?? null,
    status: input.status ?? "success",
    errorType: input.errorType ?? null,
    isStreaming: input.isStreaming ? 1 : 0,
    hasTools: input.hasTools ? 1 : 0,
    hasVision: input.hasVision ? 1 : 0,
    hasAgentic: input.hasAgentic ? 1 : 0,
    promptDigest: input.promptDigest ?? null,
    globalGoalDigest: input.globalGoalDigest ?? null,
    currentStepDigest: input.currentStepDigest ?? null,
    stepType: input.stepType ?? null,
    qualityHint: input.qualityHint ?? null,
    callIntentDebug: input.callIntentDebug ?? null,
    optimizationReason: input.optimizationReason ?? null,
    compressionApplied: input.compressionApplied ? 1 : 0,
    compressionOriginalChars: input.compressionOriginalChars ?? 0,
    compressionCompressedChars: input.compressionCompressedChars ?? 0,
    compressionBlocks: input.compressionBlocks ?? 0,
    routingDebug: input.routingDebug ?? null,
    effort: input.effort ?? null,
    createdAt: new Date().toISOString(),
  });
}

export interface UsageStats {
  totalRequests: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgSavingsPct: number;
}

export async function getUserUsageStats(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<UsageStats> {
  const db = getDb();
  const result = await db
    .select({
      totalRequests: sql<number>`COUNT(*)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${usageLogs.costUsd}), 0)`,
      totalInputTokens: sql<number>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
      avgSavingsPct: sql<number>`COALESCE(AVG(${usageLogs.savingsPct}), 0)`,
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.userId, userId),
        gte(usageLogs.createdAt, fromDate),
        lte(usageLogs.createdAt, toDate),
        eq(usageLogs.status, "success"),
      ),
    );

  return {
    totalRequests: Number(result[0]?.totalRequests ?? 0),
    totalCostUsd: Number(result[0]?.totalCostUsd ?? 0),
    totalInputTokens: Number(result[0]?.totalInputTokens ?? 0),
    totalOutputTokens: Number(result[0]?.totalOutputTokens ?? 0),
    avgSavingsPct: Number(result[0]?.avgSavingsPct ?? 0),
  };
}
