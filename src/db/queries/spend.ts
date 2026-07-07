import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../connection.js";
import { apiKeys, usageLogs, users } from "../schema.js";

export type SpendSummary = {
  requests: number;
  successfulRequests: number;
  errorRequests: number;
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
};

function startOfDayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(now = new Date()): string {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function spendWindows(now = new Date()) {
  return {
    dayStart: startOfDayIso(now),
    monthStart: startOfMonthIso(now),
    now: now.toISOString(),
  };
}

export async function getSpendSummary(
  filters: { userId?: string; apiKeyId?: string; from?: string; to?: string } = {},
): Promise<SpendSummary> {
  const db = getDb();
  const conditions = [];
  if (filters.userId) conditions.push(eq(usageLogs.userId, filters.userId));
  if (filters.apiKeyId) conditions.push(eq(usageLogs.apiKeyId, filters.apiKeyId));
  if (filters.from) conditions.push(gte(usageLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(usageLogs.createdAt, filters.to));

  const query = db
    .select({
      requests: sql<number>`COUNT(*)`,
      successfulRequests: sql<number>`COUNT(CASE WHEN ${usageLogs.status} = 'success' THEN 1 END)`,
      errorRequests: sql<number>`COUNT(CASE WHEN ${usageLogs.status} = 'error' THEN 1 END)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${usageLogs.costUsd}), 0)`,
      inputTokens: sql<number>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
    })
    .from(usageLogs);

  const result = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  return {
    requests: Number(result[0]?.requests ?? 0),
    successfulRequests: Number(result[0]?.successfulRequests ?? 0),
    errorRequests: Number(result[0]?.errorRequests ?? 0),
    totalCostUsd: Number(result[0]?.totalCostUsd ?? 0),
    inputTokens: Number(result[0]?.inputTokens ?? 0),
    outputTokens: Number(result[0]?.outputTokens ?? 0),
  };
}

export async function getPlatformOverview(now = new Date()) {
  const windows = spendWindows(now);
  const [today, month, allTime, activeUsers, activeKeys] = await Promise.all([
    getSpendSummary({ from: windows.dayStart, to: windows.now }),
    getSpendSummary({ from: windows.monthStart, to: windows.now }),
    getSpendSummary(),
    getDb().select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.isActive, 1)),
    getDb().select({ count: sql<number>`COUNT(*)` }).from(apiKeys).where(eq(apiKeys.isActive, 1)),
  ]);

  return {
    today,
    month,
    allTime,
    activeUsers: Number(activeUsers[0]?.count ?? 0),
    activeKeys: Number(activeKeys[0]?.count ?? 0),
  };
}

export async function isSpendLimitExceeded(input: {
  userId: string;
  apiKeyId?: string;
  dailyLimitUsd?: number | null;
  monthlyLimitUsd?: number | null;
  keyDailyLimitUsd?: number | null;
  now?: Date;
}): Promise<{ exceeded: boolean; scope?: "user_daily" | "user_monthly" | "key_daily"; currentUsd?: number; limitUsd?: number }> {
  const windows = spendWindows(input.now ?? new Date());

  if (typeof input.keyDailyLimitUsd === "number") {
    const keySpend = await getSpendSummary({
      apiKeyId: input.apiKeyId,
      from: windows.dayStart,
      to: windows.now,
    });
    if (keySpend.totalCostUsd >= input.keyDailyLimitUsd) {
      return { exceeded: true, scope: "key_daily", currentUsd: keySpend.totalCostUsd, limitUsd: input.keyDailyLimitUsd };
    }
  }

  if (typeof input.dailyLimitUsd === "number") {
    const daySpend = await getSpendSummary({ userId: input.userId, from: windows.dayStart, to: windows.now });
    if (daySpend.totalCostUsd >= input.dailyLimitUsd) {
      return { exceeded: true, scope: "user_daily", currentUsd: daySpend.totalCostUsd, limitUsd: input.dailyLimitUsd };
    }
  }

  if (typeof input.monthlyLimitUsd === "number") {
    const monthSpend = await getSpendSummary({ userId: input.userId, from: windows.monthStart, to: windows.now });
    if (monthSpend.totalCostUsd >= input.monthlyLimitUsd) {
      return { exceeded: true, scope: "user_monthly", currentUsd: monthSpend.totalCostUsd, limitUsd: input.monthlyLimitUsd };
    }
  }

  return { exceeded: false };
}
