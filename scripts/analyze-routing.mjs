// 临时分析脚本 — 审计调度策略
import Database from "better-sqlite3";
import { join } from "node:path";
import { homedir } from "node:os";

const db = new Database(join(homedir(), ".minirouter", "minirouter.db"), { readonly: true });
const q = (sql) => db.prepare(sql).all();
const one = (sql) => db.prepare(sql).get();

console.log("\n=== 1. 总览 ===");
console.log(one(`SELECT COUNT(*) n FROM usage_logs`));
console.log(one(`SELECT MIN(created_at) first, MAX(created_at) last FROM usage_logs`));
console.log(one(`SELECT COUNT(*) n, SUM(cost_usd) cost, AVG(savings_pct) avg_sav FROM usage_logs WHERE status='success'`));

console.log("\n=== 2. 按 tier 分布 ===");
console.table(q(`SELECT tier, COUNT(*) n, ROUND(SUM(cost_usd),4) cost, ROUND(AVG(savings_pct),3) sav, ROUND(AVG(latency_ms),0) lat FROM usage_logs WHERE status='success' GROUP BY tier ORDER BY n DESC`));

console.log("\n=== 3. 按 profile 分布 ===");
console.table(q(`SELECT profile, COUNT(*) n, ROUND(SUM(cost_usd),4) cost FROM usage_logs WHERE status='success' GROUP BY profile ORDER BY n DESC`));

console.log("\n=== 4. 模型命中分布 (top 20) ===");
console.table(q(`SELECT model, COUNT(*) n, ROUND(SUM(cost_usd),4) cost, ROUND(AVG(savings_pct),3) sav, ROUND(AVG(latency_ms),0) lat FROM usage_logs WHERE status='success' GROUP BY model ORDER BY n DESC LIMIT 20`));

console.log("\n=== 5. tier × profile 交叉 (看 auto 是否过度用强模型) ===");
console.table(q(`SELECT tier, profile, COUNT(*) n FROM usage_logs WHERE status='success' GROUP BY tier, profile ORDER BY tier, profile`));

console.log("\n=== 6. 错误/限流 ===");
console.table(q(`SELECT status, error_type, COUNT(*) n FROM usage_logs GROUP BY status, error_type ORDER BY n DESC LIMIT 10`));

console.log("\n=== 7. 最近 100 条 tier 分布 (看新策略效果) ===");
console.table(q(`SELECT tier, COUNT(*) n, ROUND(AVG(savings_pct),3) sav FROM (SELECT * FROM usage_logs WHERE status='success' ORDER BY created_at DESC LIMIT 100) GROUP BY tier`));

console.log("\n=== 8. 强模型(intent upgrade) 命中 ===");
console.table(q(`SELECT COUNT(*) n FROM usage_logs WHERE prompt_digest LIKE '%高智%' OR prompt_digest LIKE '%强模型%' OR prompt_digest LIKE '%strong model%' OR prompt_digest LIKE '%更强%'`));

console.log("\n=== 9. savings 异常 (<=0 说明没省钱) ===");
console.table(q(`SELECT CASE WHEN savings_pct IS NULL THEN 'null' WHEN savings_pct <= 0 THEN '<=0' WHEN savings_pct < 0.5 THEN '0-0.5' ELSE '>0.5' END bucket, COUNT(*) n, ROUND(AVG(cost_usd),4) avg_cost FROM usage_logs WHERE status='success' GROUP BY bucket`));

console.log("\n=== 10. 压缩应用情况 ===");
console.table(q(`SELECT compression_applied, COUNT(*) n, ROUND(AVG(compression_original_chars),0) orig, ROUND(AVG(compression_compressed_chars),0) comp FROM usage_logs GROUP BY compression_applied`));

console.log("\n=== 11. 最近 7 天每日请求量 ===");
console.table(q(`SELECT DATE(created_at) d, COUNT(*) n, ROUND(SUM(cost_usd),4) cost, ROUND(AVG(savings_pct),3) sav FROM usage_logs WHERE created_at >= datetime('now','-7 days') GROUP BY d ORDER BY d DESC`));

db.close();
