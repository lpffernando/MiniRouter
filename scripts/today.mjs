#!/usr/bin/env node
/**
 * MiniRouter 今日看板
 * 只查当天(本地时区 00:00 至今)的调用情况
 *
 * 用法: node scripts/today.mjs
 */

import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";

const DB = join(homedir(), ".minirouter", "minirouter.db");
const db = new Database(DB, { readonly: true });

// ── 当天 UTC 边界 ──────────────────────────────────────
// created_at 存的是 UTC ISO 字符串,所以取"今日 UTC 00:00"
const now = new Date();
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

const pad = (s, n = 12) => String(s).padEnd(n);

// ── 1. 概览 ─────────────────────────────────────────────
const overview = db.prepare(`
  SELECT
    COUNT(*)                                         AS total,
    SUM(status='success')                            AS success,
    SUM(status='error')                              AS errors,
    ROUND(SUM(input_tokens + output_tokens))          AS total_tokens,
    ROUND(AVG(latency_ms), 0)                        AS avg_lat_ms,
    ROUND(SUM(cache_read_tokens))                    AS cache_tokens
  FROM usage_logs WHERE created_at >= ?
`).get(todayUTC);

console.log(`\n  📋 今日概览 (UTC ${todayUTC.slice(0,10)})`);
console.log(`  ${"─".repeat(42)}`);
console.log(`  总请求       ${String(overview.total).padStart(6)}`);
console.log(`  成功         ${String(overview.success).padStart(6)}`);
console.log(`  失败         ${String(overview.errors).padStart(6)}`);
console.log(`  总 Token     ${String(overview.total_tokens ?? 0).padStart(6)}`);
console.log(`  平均延迟     ${String(overview.avg_lat_ms ?? "-").padStart(6)} ms`);
console.log(`  缓存 Token   ${String(overview.cache_tokens ?? 0).padStart(6)}`);

// ── 2. 各模型调用 ───────────────────────────────────────
const models = db.prepare(`
  SELECT model, COUNT(*) AS calls,
         SUM(status='success') AS ok,
         SUM(status='error') AS fail,
         ROUND(AVG(latency_ms), 0) AS lat,
         ROUND(AVG(input_tokens + output_tokens), 0) AS avg_tok
  FROM usage_logs WHERE created_at >= ?
  GROUP BY model ORDER BY calls DESC
`).all(todayUTC);

if (models.length) {
  console.log(`\n  📊 模型分布`);
  console.log(`  ${"model".padEnd(30)} ${pad("calls")} ${pad("ok")} ${pad("fail")} ${pad("lat_ms")} ${pad("avg_tok")}`);
  console.log(`  ${"─".repeat(70)}`);
  for (const r of models) {
    console.log(`  ${r.model.padEnd(30)} ${pad(r.calls)} ${pad(r.ok)} ${pad(r.fail)} ${pad(r.lat ?? "-")} ${pad(r.avg_tok ?? "-")}`);
  }
}

// ── 3. Tier 分布 ────────────────────────────────────────
const tiers = db.prepare(`
  SELECT COALESCE(tier,'?') AS t, COUNT(*) AS n
  FROM usage_logs WHERE created_at >= ?
  GROUP BY tier ORDER BY n DESC
`).all(todayUTC);

if (tiers.length) {
  console.log(`\n  🏷️  Tier 分布`);
  console.log(`  ${pad("tier",16)} ${pad("calls")}`);
  console.log(`  ${"─".repeat(28)}`);
  for (const r of tiers) console.log(`  ${pad(r.t,16)} ${pad(r.n)}`);
}

// ── 4. 今日错误 ─────────────────────────────────────────
const errs = db.prepare(`
  SELECT error_type, COUNT(*) AS n, model
  FROM usage_logs WHERE created_at >= ? AND status='error' AND error_type IS NOT NULL
  GROUP BY error_type ORDER BY n DESC
`).all(todayUTC);

if (errs.length) {
  console.log(`\n  ❌ 今日错误`);
  for (const r of errs) console.log(`    ${r.error_type}: ${r.n} 次 (${r.model})`);
} else {
  console.log(`\n  ✅ 今日无错误`);
}

// ── 5. 路由抽样 ─────────────────────────────────────────
const samples = db.prepare(`
  SELECT tier, model, prompt_digest
  FROM usage_logs WHERE created_at >= ? AND prompt_digest NOT IN ('',NULL)
  ORDER BY created_at DESC LIMIT 12
`).all(todayUTC);

if (samples.length) {
  console.log(`\n  🔍 路由抽样 (最近 ${samples.length} 条)`);
  console.log(`  ${"tier".padEnd(12)} ${"model".padEnd(30)} digest`);
  console.log(`  ${"─".repeat(75)}`);
  for (const r of samples) {
    const d = (r.prompt_digest ?? "").slice(0, 50).replace(/\n/g, " ");
    console.log(`  ${r.tier?.padEnd(12) ?? "?".padEnd(12)} ${r.model.padEnd(30)} ${d}`);
  }
}

db.close();
