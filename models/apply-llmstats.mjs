/**
 * Apply llm-stats.com scores to update-models.mjs
 * Run: node models/apply-llmstats.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

let f = readFileSync("models/update-models.mjs", "utf-8");
const SRC = "https://llm-stats.com";

// [swe_bench_verified_x100, reasoning, coding, mmlu_x100, ceval_x100]
const scores = {
  "zhipu/glm-5.2":   [null,  59.1, 48.8, null, null],
  "zhipu/glm-5.1":   [null,  50.3, 41.1, null, null],
  "zhipu/glm-5":     [77.8,  49.3, 34.5, null, null],
  "zhipu/glm-4.7":   [73.8,  null, null, null, null],
  "alibaba/qwen3.7-max":  [80.4, 57.5, 45.6, null, null],
  "alibaba/qwen3.7-plus": [77.7, 53.1, 40.4, null, null],
  "alibaba/qwen3.6-max":  [78.8, null, null, 93.3, null],
  "alibaba/qwen3.5-plus": [76.4, 47.7, 28.9, null, null],
  "deepseek/v4-pro":    [80.6, 54.7, 41.1, null, null],
  "deepseek/v4-flash":  [79.0, 50.1, 35.7, null, null],
  "minimax/m3":         [80.5, 52.8, 44.4, null, null],
  "minimax/m2.7":       [null, 46.8, 36.8, null, null],
  "minimax/m2.5":       [80.2, null, null, null, null],
  "moonshot/kimi-k2.6":       [80.2, 54.9, 41.4, null, null],
  "moonshot/kimi-k2.7-code":   [null, 44.8, 39.2, null, null],
  "bytedance/seed-2.0-pro":   [76.5, 52.2, 31.6, null, null],
  "bytedance/seed-2.0-lite":  [73.5, null, null, null, null],
  "xiaomi/mimo-v2.5-pro":     [78.9, null, null, 89.4, 91.5],
  "stepfun/step-3.5-flash":   [74.4, null, null, null, null],
};

let count = 0;
for (const [id, [sb, reason, code, mmlu, ceval]] of Object.entries(scores)) {
  // Find the line containing this model ID
  const lines = f.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`m("${id}"`)) {
      const parts = lines[i].split(",");
      // parts[parts.length-3] = codingScore
      // parts[parts.length-2] = reasoningScore
      // parts[parts.length-1] = sourceBenchmark

      if (code !== null) parts[parts.length - 3] = String(code);
      if (reason !== null) parts[parts.length - 2] = String(reason);
      parts[parts.length - 1] = `"${SRC}")`;

      // Add SWE-bench and MMLU/C-Eval to notes if available
      const notesIdx = parts.length - 4; // notes is 4th from end
      let extra = "";
      if (sb !== null) extra += `SWE-bench:${(sb / 100).toFixed(3)} `;
      if (mmlu !== null) extra += `MMLU:${(mmlu / 100).toFixed(3)} `;
      if (ceval !== null) extra += `C-Eval:${(ceval / 100).toFixed(3)} `;
      if (extra) {
        const curNote = parts[notesIdx].replace(/^"/, "").replace(/"$/, "");
        // Don't duplicate if already has the info
        if (!curNote.includes("SWE-bench:")) {
          parts[notesIdx] = `"${curNote} ${extra.trim()}"`;
        }
      }

      lines[i] = parts.join(",");
      count++;
      break;
    }
  }
  f = lines.join("\n");
}

writeFileSync("models/update-models.mjs", f);
console.log(`Updated ${count}/${Object.keys(scores).length} models with llm-stats data`);
