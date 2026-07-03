/**
 * MiniRouter seed model id -> LLM Stats normalized_id.
 *
 * Keep this conservative: only map exact releases, obvious provider renames, or
 * documented suffix variants. Do not map across major versions just because the
 * serving API id looks similar. For example, deepseek/v4-flash is not
 * deepseek/deepseek-chat; the latter is DeepSeek-V3.2 non-thinking.
 */
export const MODEL_BENCHMARK_ALIASES = {
  // DeepSeek
  "deepseek/v4-flash": "deepseek/deepseek-v4-flash-max",
  "deepseek/v4-pro": "deepseek/deepseek-v4-pro-max",
  "deepseek/v3.2": "deepseek/deepseek-v3.2",

  // MiniMax
  "minimax/m3": "minimax/minimax-m3",
  "minimax/m2.7": "minimax/minimax-m2.7",

  // Alibaba / Qwen
  "alibaba/qwen3-coder-plus": "alibaba/qwen3-coder-480b-a35b-instruct",

  // ByteDance / Seed
  "bytedance/seed-2.0-pro": "bytedance/seed-2.0-pro",
  "bytedance/seed-2.0-lite": "bytedance/seed-2.0-lite",

  // Xiaomi
  "xiaomi/mimo-v2.5-pro": "xiaomi/mimo-v2.5-pro",

  // Moonshot / Kimi
  "moonshot/kimi-k2.7-code-highspeed": "moonshot/kimi-k2.7-code",

  // International comparison models
  "anthropic/claude-opus-4.8": "anthropic/claude-opus-4-8",
  "google/gemini-3-flash": "google/gemini-3-flash-preview",
};

export function benchmarkLookupId(modelId) {
  return MODEL_BENCHMARK_ALIASES[modelId] ?? modelId;
}
