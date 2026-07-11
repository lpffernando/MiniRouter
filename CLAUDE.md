# MiniRouter

智能 LLM 路由网关 — 面向国内大模型，自动识别任务难度选择最优性价比模型。

## 项目结构

```
src/
├── auth/                # API Key 认证与用户身份
├── config/              # .env 加载与运行时配置
├── context/             # 可选 Headroom 上下文优化
├── db/                  # SQLite、迁移与查询层
├── protocols/           # OpenAI / Anthropic 请求标准化
├── providers/           # 环境槽位、渠道选择与上游适配器
├── router/              # 14 维规则路由引擎
├── routing/             # 特征提取与路由调试回执
└── server/              # Hono HTTP API 与 SSE 用量采集
```

## 数据维护

- `models/dashboard.html` — 模型评分可视化表格
- `models/seed-data.json` — 模型评分种子数据
- `.claude/skills/update-model-registry/` — 模型数据更新 Skill
