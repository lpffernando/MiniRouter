# Update Model Registry

This guide documents how to maintain MiniRouter's model database — pricing,
benchmark scores, and new model releases. Suggested frequency: weekly or monthly.

## Official Pricing Pages

| Vendor | Pricing Page URL | Rendering | Trust |
|--------|-----------------|-----------|:---:|
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing | Static HTML | ✅ Direct |
| 智谱 GLM | https://open.bigmodel.cn/pricing | JS-SPA | ⚠️ Browser needed |
| 阿里百炼 (Qwen) | https://help.aliyun.com/zh/model-studio/getting-started/models | Static HTML | ✅ Direct |
| 月之暗面 Kimi | https://platform.kimi.com/docs/pricing | Static HTML | ✅ Direct |
| 腾讯混元 | https://cloud.tencent.com/document/product/1729/97731 | Static HTML | ✅ Direct |
| 字节豆包 (火山引擎) | https://www.volcengine.com/docs/82379/1544106?lang=zh | Static HTML | ✅ Confirmed |
| MiniMax | https://platform.minimaxi.com/docs/guides/pricing-paygo | Static HTML | ✅ Confirmed |
| 百度文心 (千帆) | https://cloud.baidu.com/doc/qianfan-docs/s/Jm8r1826a | Static HTML | ✅ Confirmed |
| 阶跃星辰 Step | https://platform.stepfun.com/docs/zh/guides/pricing/details | Static HTML | ✅ Confirmed |
| 小米 MiMo | https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go | Static HTML | ✅ Confirmed |
| 美团 LongCat | https://longcat.chat/platform/product | JS-SPA | ⚠️ Browser needed |

## Benchmark Data Sources

| Source | URL | Covers |
|--------|-----|--------|
| LMSys Chatbot Arena | https://chat.lmsys.org/ | User preference (mainly overseas) |
| LiveCodeBench | https://livecodebench.github.io/ | Code capability |
| OpenCompass | https://opencompass.org.cn/ | Comprehensive (good domestic coverage) |
| SuperCLUE | https://www.superclueai.com/ | Chinese LLM benchmarks |
| C-Eval | https://cevalbenchmark.com/ | Chinese knowledge |
| AlignBench | https://llmbench.ai/align | Chinese alignment |
| FlagEval (BAAI) | https://flageval.baai.ac.cn/ | BAAI evaluation |

## Update Workflow

1. Check pricing pages for changes
2. Search for new model releases
3. Collect benchmark data from official sources
4. Update `models/seed-data.json`
5. Run `npm run seed:models` to sync to SQLite
6. Commit changes

## Data Flow

```
models/seed-data.json (source of truth)
    ↓ npm run seed:models
~/.minirouter/minirouter.db (SQLite, queried at runtime)
```

## Model ID Convention

Use `provider/model-name` format:
- `deepseek/v4-flash`
- `zhipu/glm-5.2`
- `alibaba/qwen3.6-max`
