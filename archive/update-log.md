/**
 * 2026-07-03 模型数据更新日志
 * 
 * 新增模型:
 * - 字节: seed-evolving, seed-2.1-pro, seed-2.1-turbo, seed-2.0-code, seed-1.8,
 *        seed-character, seed-code, seed-1.6, seed-1.6-lite, seed-1.6-vision,
 *        seed-translation, 1.5-pro-32k, 1.5-lite-32k, 1.5-vision-pro
 * - 阿里: qwen3.7-max, qwen3.7-plus
 * 
 * 价格更新 (来自官方页面确认):
 * - 腾讯混元: 全部价格已确认 (hunyuan-a13b ¥0.5/2.0 等)
 * - 字节豆包: 全部价格已确认 (从火山引擎官方定价页)
 * - MiniMax: 全部价格已确认 (从官方 pay-as-you-go 页)
 * - 阶跃星辰: 全部价格已确认 (step-3.7-flash ¥1.35/8.10 等)
 * - 小米MiMo: 全部价格已确认 (V2.5 ¥1.0/2.0, V2.5-Pro ¥3.0/6.0)
 * - 百度文心: 全部价格已确认 (ERNIE-5.0 ¥6/24, ERNIE-4.5-Turbo ¥0.8/3.2 等)
 * 
 * 数据源:
 * - DeepSeek: api-docs.deepseek.com/quick_start/pricing
 * - MiniMax: platform.minimaxi.com/docs/guides/pricing-paygo
 * - 百度: cloud.baidu.com/doc/qianfan-docs/s/Jm8r1826a
 * - 阶跃: platform.stepfun.com/docs/zh/guides/pricing/details
 * - 小米: mimo.mi.com/docs/zh-CN/price/pay-as-you-go
 * - 字节: volcengine.com/docs/82379/1544106?lang=zh
 * - 腾讯: cloud.tencent.com/document/product/1729/97731
 * - Kimi: platform.kimi.com/docs/pricing
 * - 阿里: help.aliyun.com/zh/model-studio/getting-started/models
 */

export const UPDATE_LOG = {
  date: "2026-07-03",
  newModels: [
    "bytedance/seed-evolving",
    "bytedance/seed-2.1-pro",
    "bytedance/seed-2.1-turbo",
    "bytedance/seed-2.0-code",
    "bytedance/seed-1.8",
    "bytedance/seed-character",
    "bytedance/seed-code",
    "bytedance/seed-1.6",
    "bytedance/seed-1.6-lite",
    "bytedance/seed-1.6-vision",
    "bytedance/seed-translation",
    "alibaba/qwen3.7-max",
    "alibaba/qwen3.7-plus",
  ],
  confirmedPricing: [
    "tencent (全部7个文本模型)",
    "minimax (M3/M2.7/M2.5系列)",
    "stepfun (step-3.7-flash等)",
    "xiaomi (V2.5/V2.5-Pro)",
    "baidu (ERNIE 5.0/4.5/X1.1)",
    "bytedance (全部Seed系列+GLM/DeepSeek转售)",
  ],
  pendingPricing: [
    "zhipu (JS-SPA, 需浏览器确认)",
    "meituan-longcat (JS-SPA, 需浏览器确认)",
  ],
  totalModels: "53 (从40增至53)",
};