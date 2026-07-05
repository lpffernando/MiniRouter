// 最近 20 条调度审计
import Database from "better-sqlite3";
import { join } from "node:path";
import { homedir } from "node:os";

const db = new Database(join(homedir(), ".minirouter", "minirouter.db"), { readonly: true });

const rows = db.prepare(`
  SELECT created_at, model, tier, profile, strategy,
         input_tokens, output_tokens, latency_ms, first_token_ms,
         status, is_streaming, has_tools, has_vision,
         optimization_reason, compression_applied,
         compression_original_chars, compression_compressed_chars,
         prompt_digest
  FROM usage_logs
  ORDER BY created_at DESC
  LIMIT 20
`).all();

let i = 0;
for (const r of rows) {
  i++;
  console.log(`\n--- #${i} ${r.created_at} ---`);
  console.log(`  tier: ${r.tier} | model: ${r.model} | profile: ${r.profile} | strat: ${r.strategy}`);
  console.log(`  status: ${r.status} | stream: ${r.is_streaming} | tools: ${r.has_tools} | vision: ${r.has_vision}`);
  console.log(`  tokens: in=${r.input_tokens} out=${r.output_tokens} | lat: ${r.latency_ms}ms ttft: ${r.first_token_ms}ms`);
  console.log(`  opt: ${r.optimization_reason ?? '-'} | compress: ${r.compression_applied} (${r.compression_original_chars}->${r.compression_compressed_chars})`);
  console.log(`  prompt: ${r.prompt_digest ? r.prompt_digest.slice(0,180) : '(null)'}`);
}

db.close();
