/**
 * Apply llm-stats.com Reasoning/Coding Index scores to update-models.mjs
 * Run: node models/apply-llmstats.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

let f = readFileSync("models/update-models.mjs", "utf-8");

// llm-stats scores: [reasoning, coding, sourceUrl]
const scores = {
  "zhipu/glm-5.2": [59.1, 48.8],
  "zhipu/glm-5.1": [50.3, 41.1],
  "zhipu/glm-5": [49.3, 34.5],
  "alibaba/qwen3.7-max": [57.5, 45.6],
  "alibaba/qwen3.7-plus": [53.1, 40.4],
  "deepseek/v4-pro": [54.7, 41.1],
  "deepseek/v4-flash": [50.1, 35.7],
  "minimax/m3": [52.8, 44.4],
  "minimax/m2.7": [46.8, 36.8],
  "moonshot/kimi-k2.6": [54.9, 41.4],
  "moonshot/kimi-k2.7-code": [44.8, 39.2],
  "bytedance/seed-2.0-pro": [52.2, 31.6],
  "alibaba/qwen3.5-plus": [47.7, 28.9],
};

const src = "https://llm-stats.com/leaderboards/llm-leaderboard";
let count = 0;

for (const [id, [reasoning, coding]] of Object.entries(scores)) {
  // Pattern: ..."notes","confirmed","sourceUrl", currentCode, currentReasoning, currentBenchSrc)
  // We need to find the m() line and replace the three args before the closing )
  // Strategy: find the m("id", ... and replace only the last 3 value arguments

  const escaped = id.replace(/\//g, "\\/");
  // Match the entire m() call — it's on one line (comma-separated)
  const regex = new RegExp(`(m\\("${escaped}",[^)]*?")[^"]*?"\\),\\s*[^,)]*,\\s*[^,)]*,\\s*"[^"]*"\\)`, "g");

  const replacement = `$1${reasoning},${coding},"${src}")`;
  const before = f;
  f = f.replace(regex, replacement);
  if (f !== before) count++;
}

writeFileSync("models/update-models.mjs", f);
console.log(`Updated ${count}/${Object.keys(scores).length} models with llm-stats scores`);
