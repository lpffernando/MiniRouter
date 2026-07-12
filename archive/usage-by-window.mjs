// 用量统计:5小时/7天/30天 按模型
import Database from "better-sqlite3";
import { join } from "node:path";
import { homedir } from "node:os";

const db = new Database(join(homedir(), ".minirouter", "minirouter.db"), { readonly: true });

const rows = db.prepare(`
  SELECT model,
    SUM(CASE WHEN created_at >= datetime('now','-5 hours') THEN 1 ELSE 0 END) AS h5,
    SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS w,
    SUM(CASE WHEN created_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS m,
    COUNT(*) AS total
  FROM usage_logs
  WHERE status='success'
  GROUP BY model
  ORDER BY h5 DESC, total DESC
`).all();

console.log("总数据范围:");
const range = db.prepare(`SELECT MIN(created_at) first, MAX(created_at) last, COUNT(*) n FROM usage_logs WHERE status='success'`).get();
console.log(`  ${range.first} → ${range.last}  (共 ${range.n} 条)\n`);

console.log("model | 5h | 7d | 30d | total");
console.log("-".repeat(60));
for (const r of rows) {
  console.log(`${r.model} | ${r.h5} | ${r.w} | ${r.m} | ${r.total}`);
}

// 按 tier 也出一组
console.log("\n--- 按 tier ---");
const tiers = db.prepare(`
  SELECT tier,
    SUM(CASE WHEN created_at >= datetime('now','-5 hours') THEN 1 ELSE 0 END) AS h5,
    SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS w,
    SUM(CASE WHEN created_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS m
  FROM usage_logs WHERE status='success' GROUP BY tier ORDER BY h5 DESC
`).all();
for (const r of tiers) console.log(`${r.tier} | ${r.h5} | ${r.w} | ${r.m}`);

db.close();
