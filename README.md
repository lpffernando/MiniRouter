# MiniRouter

MiniRouter 是一个智能 LLM 路由器。

它解决的不是“怎么再做一个 API Proxy”，而是一个更真实的模型使用问题：

> 全部走高智模型太贵，全部走便宜模型又不够好用。  
> MiniRouter 让每次 LLM 调用自动选择最合适的模型。

你仍然只需要调用一个统一入口：

```text
model = minirouter/auto
```

MiniRouter 会根据请求场景，把任务路由到不同价位和能力的模型档位：

```text
简单任务 -> fast
常规任务 -> balanced
复杂任务 -> strong
视觉任务 -> vision
```

目标很简单：

**复杂任务保效果，简单任务省成本。**

## 核心思路

大模型使用里最常见的矛盾是：

- 用强模型：效果更稳，但所有请求都贵。
- 用便宜模型：成本低，但复杂任务容易失败。

MiniRouter 提供第三种方式：

**不固定使用某一个模型，而是让路由器根据场景自动选择模型。**

它会综合判断：

- 任务是否简单
- 是否需要复杂推理
- 是否是 Agent 多步任务
- 是否包含工具调用
- 上下文是否很长
- 是否有图片或视觉输入
- 用户是否明确要求“高智”“强模型”“深度分析”

然后选择对应档位。

## 两个核心特色

### 1. 按场景自动选模型

MiniRouter 把模型选择从“人工经验”变成“自动路由”。

默认档位：

| 场景 | Slot | 典型模型 |
| --- | --- | --- |
| 简单问答、轻量改写、低成本请求 | `fast` | DeepSeek V4 Flash |
| 常规分析、普通 Agent 步骤、较长上下文 | `balanced` | DeepSeek V4 Pro |
| 高智诉求、复杂分析、困难代码任务 | `strong` | GLM-5.2 |
| 图片、截图、多模态输入 | `vision` | 视觉模型 |

这样可以避免两种浪费：

- 简单任务也走高智模型，成本被拉高。
- 复杂任务误走便宜模型，质量和稳定性下降。

MiniRouter 的价值不是“永远选最便宜”，而是选“刚好合适”的模型。

### 2. 路由结果可解释

MiniRouter 不只记录“用了哪个模型”，还记录“为什么这么选”。

Usage Logs 里可以看到：

- 入口模型：`minirouter/auto`、`minirouter/eco`、`minirouter/premium`
- 路由结果：`fast`、`balanced`、`strong`、`vision`
- 最终模型：例如 `deepseek-v4-flash`、`deepseek-v4-pro`、`glm-5.2`
- tier：`SIMPLE`、`MEDIUM`、`COMPLEX`、`REASONING`
- routing score
- 规则命中项
- 是否 tools / vision / agentic
- prompt token / output token
- latency / cost / status
- provider channel id

这让路由策略可以复盘和调优。

比如某类请求没有走高智模型，你可以直接查看它当时的上下文长度、任务 tier、规则命中项和 routing score，而不是只能猜。

## 和普通 API Proxy 的区别

普通 API Proxy 的核心是转发：

```text
用户指定 model -> proxy 转发到对应模型
```

MiniRouter 的核心是选择：

```text
用户提交任务 -> MiniRouter 判断场景 -> 自动选择合适模型
```

对比：

| 能力 | 普通 API Proxy | MiniRouter |
| --- | --- | --- |
| API 转发 | 有 | 有 |
| 多模型接入 | 有 | 有 |
| 自动判断任务难度 | 通常没有 | 有 |
| 按 fast / balanced / strong 分档 | 通常没有 | 有 |
| 路由原因可解释 | 通常没有 | 有 |
| 根据日志调路由策略 | 较难 | 支持 |

所以 MiniRouter 更适合作为“模型选择层”，而不只是“模型转发层”。

## 通用路由能力

除了两个核心特色，MiniRouter 也提供一套路由网关的基础能力。

### OpenAI / Anthropic 兼容入口

- OpenAI Chat Completions: `/v1/chat/completions`
- Anthropic Messages: `/v1/messages`
- Models: `/v1/models`

客户端只需要修改 base URL：

```text
Base URL = http://your-server:8402/v1
API Key  = mr_sk_xxx
Model    = minirouter/auto
```

### 显式指定档位

如果你不想自动路由，也可以直接指定：

```text
minirouter/slot/fast
minirouter/slot/balanced
minirouter/slot/strong
minirouter/slot/vision
```

### 多渠道和权重分流

同一个 slot 可以配置多个 provider channel：

```text
balanced
├── channel A / weight 1
├── channel B / weight 2
└── channel C / weight 1
```

MiniRouter 会根据健康状态、冷却时间、能力要求和权重选择 channel。

### 多用户和 API Key

支持：

- 用户创建和启停
- 独立 `mr_sk_...` API key
- key 吊销
- 用户级用量统计
- 日/月费用限制

### 用量和费用统计

Usage Logs 会记录：

- 输入/输出 token
- 估算成本
- 请求延迟
- 状态和错误类型
- 使用的 slot、模型、provider channel

模型价格通过 `pricingModelId` 或 alias 映射到价格表，便于处理不同渠道价格差异。

### 管理后台

后台入口：

```text
/admin/dashboard
```

包括：

- Overview
- Users
- Keys
- Channels
- Usage Logs

## 典型使用场景

### AI 工具统一入口

把 Codex、Claude Code、OpenAI SDK 或内部 Agent 接到 MiniRouter。

以后客户端不需要关心具体模型名，只需要：

```text
model = minirouter/auto
```

模型选择、渠道切换、用量统计都由 MiniRouter 处理。

### Agent / Coding 场景

Agent 调用天然有层次：

- 简单确认、短回复：走 `fast`
- 常规文件分析、普通工具调用：走 `balanced`
- 复杂排查、长上下文、多步任务：走 `strong`

MiniRouter 的目标是让 Agent 调用既不盲目省钱，也不盲目烧钱。

### 团队内部模型治理

为不同用户、项目或业务线分配独立 key：

- 看谁在调用
- 看谁花钱最多
- 限制异常用量
- 禁用问题 key
- 汇总整体费用

## 最小部署

MiniRouter 可以用 Docker 部署。

环境文件示例：

```env
MINIROUTER_SOLO=false
NODE_ENV=production
BLOCKRUN_PROXY_PORT=8402
MINIROUTER_CNY_PER_USD=7.2

MINIROUTER_FAST_PROVIDER=openai-compatible
MINIROUTER_FAST_BASE_URL=https://api.example.com/v1
MINIROUTER_FAST_API_KEY=replace-me
MINIROUTER_FAST_MODEL=deepseek-v4-flash
MINIROUTER_FAST_SUPPORTS_TOOLS=true

MINIROUTER_BALANCED_PROVIDER=openai-compatible
MINIROUTER_BALANCED_BASE_URL=https://api.example.com/v1
MINIROUTER_BALANCED_API_KEY=replace-me
MINIROUTER_BALANCED_MODEL=deepseek-v4-pro
MINIROUTER_BALANCED_SUPPORTS_TOOLS=true

MINIROUTER_STRONG_PROVIDER=openai-compatible
MINIROUTER_STRONG_BASE_URL=https://api.example.com/v1
MINIROUTER_STRONG_API_KEY=replace-me
MINIROUTER_STRONG_MODEL=glm-5.2
MINIROUTER_STRONG_SUPPORTS_TOOLS=true
```

启动：

```bash
docker build -t minirouter:latest .

mkdir -p /opt/minirouter-data

docker run -d \
  --name minirouter \
  --restart unless-stopped \
  --env-file /root/minirouter.env \
  -p 8402:8402 \
  -v /opt/minirouter-data:/data \
  minirouter:latest
```

数据目录：

```text
/opt/minirouter-data/.minirouter/minirouter.db
```

## API 示例

```bash
curl http://localhost:8402/v1/chat/completions \
  -H "Authorization: Bearer mr_sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "minirouter/auto",
    "messages": [
      { "role": "user", "content": "帮我分析这个问题，并给出下一步建议" }
    ],
    "max_tokens": 1024
  }'
```

OpenAI SDK：

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MINIROUTER_API_KEY,
  baseURL: "http://localhost:8402/v1",
});

const result = await client.chat.completions.create({
  model: "minirouter/auto",
  messages: [{ role: "user", content: "总结这段材料" }],
});

console.log(result.choices[0]?.message?.content);
```

## 技术文档

- [Routing MVP](docs/routing-mvp.md)
- [Routing strategy](docs/routing-strategy.md)
- [Infra management design](docs/infra-management-design.md)
- [Headroom integration notes](docs/headroom.md)
- [DB queries](docs/db-queries.md)
- [Environment example](docs/minirouter-env.example)

