// 审计 routing_debug 字段 — 直接读库,不重跑分类器
//
// 用法:
//   node scripts/audit-routing-debug.mjs            # 最近 20 条
//   node scripts/audit-routing-debug.mjs --misroute # 只看 tierRaw != tier 的(黑箱铁证)
//   node scripts/audit-routing-debug.mjs --upgraded  # 只看被升级路径改过的
//   node scripts/audit-routing-debug.mjs --limit 50  # 改条数

import Database from "better-sqlite3";
import { join } from "node:path";
import { homedir } from "node:os";

const args = new Set(process.argv.slice(2));
const onlyMisroute = args.has("--misroute");
const onlyUpgraded = args.has("--upgraded");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 20;

const db = new Database(join(homedir(), ".minirouter", "minirouter.db"), { readonly: true });

let where = ["routing_debug IS NOT NULL"];
if (onlyMisroute) where.push("json_extract(routing_debug, '$.tierRaw') != tier");
if (onlyUpgraded) where.push("json_extract(routing_debug, '$.upgraded') = 1");
const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

const rows = db.prepare(`
  SELECT created_at, model, tier, effort, has_tools, input_tokens, prompt_digest, routing_debug
  FROM usage_logs
  ${whereClause}
  ORDER BY created_at DESC
  LIMIT ?
`).all(limit);

if (rows.length === 0) {
  console.error("No rows match. (routing_debug may be empty — restart the server to populate it.)");
  db.close();
  process.exit(0);
}

let i = 0;
for (const r of rows) {
  i++;
  let d;
  try { d = JSON.parse(r.routing_debug); } catch { console.log(`#${i} ${r.created_at} (routing_debug 不可解析)\n`); continue; }

  const arrow = d.tierRaw !== r.tier ? `${d.tierRaw ?? "null"} → ${r.tier} ⚠` : `${r.tier}`;
  const upg = d.upgraded ? ` [upgraded: ${d.upgradeReason ?? "?"}]` : "";
  console.log(`--- #${i} ${r.created_at} ---`);
  console.log(`  tier: ${arrow}${upg}`);
  console.log(`  model: ${r.model} | effort: ${r.effort ?? "-"} | tools: ${r.has_tools} | in_tok: ${r.input_tokens}`);
  console.log(`  score: ${d.score?.toFixed(4)} | conf: ${d.confidence?.toFixed(3)} | agentic: ${d.agenticScore}`);
  if (r.prompt_digest) console.log(`  prompt: ${r.prompt_digest.slice(0, 140)}`);
  if (d.signals?.length) console.log(`  signals: ${d.signals.join(", ")}`);
  const hit = (d.dimensions || []).filter((x) => x.signal);
  if (hit.length) {
    console.log(`  dimensions:`);
    for (const dim of hit) console.log(`    ${dim.name}: ${dim.score}  [${dim.signal}]`);
  }
  console.log("");
}

db.close();
