/**
 * SuperCLUE leaderboard model name -> MiniRouter model id.
 *
 * Keep this map conservative. SuperCLUE often includes serving suffixes such as
 * "(high)" or date builds; map only when the release family is clear.
 */
export const SUPERCLUE_MODEL_ALIASES = {
  "Claude-Opus-4.8(high)": "anthropic/claude-opus-4.8",
  "DeepSeek-V4-Flash(max)": "deepseek/v4-flash",
  "DeepSeek-V4-Pro(max)": "deepseek/v4-pro",
  "Doubao-Seed-2.0-lite-260428(high)": "bytedance/seed-2.0-lite",
  "Doubao-Seed-2.0-pro-260215(high)": "bytedance/seed-2.0-pro",
  "GLM-5.1": "zhipu/glm-5.1",
  "GPT-5.5(high)": "openai/gpt-5.5",
  "Hy3 preview(high)": "tencent/hy3-preview",
  "Kimi-K2.6-Thinking": "moonshot/kimi-k2.6",
  "MiniMax-M2.7": "minimax/m2.7",
  "MiniMax-M3": "minimax/m3",
  "MiMo-V2.5-Pro": "xiaomi/mimo-v2.5-pro",
  "Qwen3.7-Max(Thinking)": "alibaba/qwen3.7-max",
  "Step-3.5-Flash": "stepfun/step-3.5-flash",
  "Step-3.7-Flash": "stepfun/step-3.7-flash",
};

export function superclueLookupId(modelName) {
  return SUPERCLUE_MODEL_ALIASES[modelName] ?? null;
}
