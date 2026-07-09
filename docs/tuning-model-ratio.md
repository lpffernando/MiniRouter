# 模型比例调优指南（历史数据分析 + 高低档参数调节）

本文档说明如何通过历史调用日志分析各 tier 的真实分布，并调节「fast / 中等 / 高智」模型的请求占比。
适用于运营期调参：发现 MEDIUM 占比过高、想让 fast 模型多承担流量时的标准流程。

> 配套源码：`src/router/rules.ts`（14 维打分）、`src/router/config.ts`（边界与权重）、`src/db/schema.ts`（`routing_debug` 列）。

---

## 一、背景：占比由什么决定

auto 模式下，每次请求经 14 维加权打分得到 `weightedScore`，再按边界映射到 tier：

```
score < simpleMedium        → SIMPLE   (fast 模型：deepseek-v4-flash)
simpleMedium ≤ score < mc   → MEDIUM  (深智模型：deepseek-v4-pro)
mc ≤ score < cr             → COMPLEX (高智：glm-5.2)
score ≥ cr                  → REASONING
```

**关键认知**：tier 占比 = score 分布 与 边界位置 的叠加结果。
调占比不是改模型本身，而是**移动边界**把某一分数段的流量重新划档。

边界默认（`.env` 未覆盖时）：

| 参数 | 默认 | 含义 |
|---|---|---|
| `MINIROUTER_BOUNDARY_SIMPLE_MEDIUM` | 0.0 | SIMPLE/MEDIUM 分界 |
| `MINIROUTER_BOUNDARY_MEDIUM_COMPLEX` | 0.3 | MEDIUM/COMPLEX 分界 |
| `MINIROUTER_BOUNDARY_COMPLEX_REASONING` | 0.5 | COMPLEX/REASONING 分界 |

> 实测经验：**线上 score 几乎全部 ≥ 0**（历史最小仅约 -0.10），且 70%+ 集中在 0~0.3。
> 因此「想让 fast 更多」的正确做法是**抬高** `simpleMedium`（把中低分也划给 SIMPLE），
> 而不是降低它（负分区间几乎没有流量）。

---

## 二、第一步：拉取并分析历史 score 分布

### 2.1 数据库位置

- 本地开发库 `~/.minirouter/minirouter.db` 通常为空，真实数据在部署机：
  `/opt/minirouter-data/.minirouter/minirouter.db`（含 WAL）。
- 用 `better-sqlite3` 只读打开即可；若需跨机，可 SFTP 下载到本地分析。

### 2.2 提取每次请求的 score

`usage_logs.routing_debug` 列存了完整的 14 维审计 JSON：

```json
{ "score": 0.126, "tierRaw": "MEDIUM", "confidence": 0.91,
  "agenticScore": 0, "signals": [...], "dimensions": [{ "name": "...", "score": 0.5 }] }
```

解析脚本（Node，需 `better-sqlite3`）：

```js
import Database from "better-sqlite3";
const db = new Database("/path/to/minirouter.db", { readonly: true });
const rows = db.prepare(
  "SELECT routing_debug FROM usage_logs WHERE routing_debug IS NOT NULL"
).all();
const scores = [];
for (const r of rows) {
  const d = JSON.parse(r.routing_debug);
  if (typeof d.score === "number") scores.push(d.score);
}
scores.sort((a, b) => a - b);
const n = scores.length;
const pct = (p) => scores[Math.min(n - 1, Math.floor(p * n))];
console.log("min", scores[0], "max", scores[n-1], "p50", pct(0.5), "p90", pct(0.9));
```

### 2.3 直方图 + tier 占比现状

把 score 分桶统计，并与 DB 实际 `tier` 列对比（注意：实际分布还包含
`ambiguousDefaultTier`→MEDIUM、结构化输出最小档等 override，会比纯分数模拟更偏 MEDIUM）：

```sql
SELECT tier, COUNT(*) n FROM usage_logs GROUP BY tier;
```

典型线上分布（示例）：

```
SIMPLE   16.3%   ← fast
MEDIUM   57.1%   ← 深智（pro）
COMPLEX   7.6%
REASONING 19.0%
```

---

## 三、第二步：模拟调参效果（不改代码，先算）

移动 `simpleMedium` 边界，用历史 score 直接重算各 tier 占比：

```js
function dist(sm, mc = 0.30, cr = 0.50) {
  let s = 0, m = 0, c = 0, rr = 0;
  for (const v of scores) {
    if (v < sm) s++; else if (v < mc) m++; else if (v < cr) c++; else rr++;
  }
  const n = scores.length;
  return [s, m, c, rr].map(x => (x / n * 100).toFixed(1) + "%");
}
for (const sm of [0.0, 0.10, 0.15, 0.20]) console.log(sm, dist(sm));
```

实测模拟表（基于某日 1835 条 scored 样本）：

| simpleMedium | SIMPLE(fast) | MEDIUM | COMPLEX | REASONING |
|---|---|---|---|---|
| 0.00（默认） | 12.6% | 63.0% | 10.9% | 13.5% |
| 0.10（推荐起步） | 48.3% | 27.3% | 10.9% | 13.5% |
| 0.15 | 53.5% | 22.1% | 10.9% | 13.5% |
| 0.20（激进） | 66.6% | 9.0% | 10.9% | 13.5% |

> 观察：边界每抬高一点，fast 占比就大量上升，因为 0~0.2 区间堆积了海量中低分请求。
> `mediumComplex` 抬高（0.3→0.4）则能让真正复杂的请求留在 MEDIUM、少进 COMPLEX/REASONING，
> 但**不会**增加 fast 占比。

---

## 四、第三步：落地到 `.env` 并重启

边界参数走环境变量，运行时由 `getConfig()` 读取，**无需改代码**：

```bash
# /opt/minirouter-src/.env
MINIROUTER_BOUNDARY_SIMPLE_MEDIUM=0.10      # 改这一行
MINIROUTER_BOUNDARY_MEDIUM_COMPLEX=0.3
MINIROUTER_BOUNDARY_COMPLEX_REASONING=0.5
```

操作流程：

1. 备份原 `.env`：`cp .env .env.bak-$(date +%Y%m%d)`
2. 修改 `MINIROUTER_BOUNDARY_SIMPLE_MEDIUM`（建议从 `0.10` 起步试水）
3. **重启服务**使 `.env` 生效（`.env` 仅启动时读取）
4. 跑至少一天真实流量

> 安全边际提醒：fast 模型（deepseek-v4-flash）失败率本身偏高，激进抬高到 0.20
> 会把带代码/推理信号的「中等偏难」请求也丢给它，**质量风险高**。建议 0.10 起步，
> 次日用本文第二节方法复测实际 tier 分布与错误率后再决定是否继续。

---

## 五、第四步：次日复评闭环

每天重复：拉数据 → 算 score 分布 + 实际 tier 占比 + 各模型失败率 → 决定是否再调。

关注指标：

- **fast 实际占比**是否达到预期（模拟值 vs DB 实际值会有 override 偏差）
- **fast 失败率**（flash 当前约 1/3 失败，需监控别因占比升高而放大）
- **平均延迟 / 总成本**：fast 占比升高应带来延迟与成本下降

若 fast 占比达标但质量下滑 → 回调 `simpleMedium`（如 0.10→0.08），或改用
「保持 tier 不变、把 MEDIUM 主模型从 pro 换成更快模型」的替代思路（见 `src/router/config.ts` 注释里的 tier 映射表）。

---

## 六、相关命令速查

```bash
# 当日概览（模型分布 / tier / 错误），脚本已内置
node scripts/today.mjs

# 读远程库（示例，凭据另行管理）
# 1) 下载 /opt/minirouter-data/.minirouter/minirouter.db(+ -wal) 到本地
# 2) 用本文 2.2/2.3 脚本分析

# 改完参数后重启
systemctl restart minirouter     # 或项目自身的启动方式
```

---

## 七、避坑小结

1. **降 `simpleMedium` 无效**：线上 score 无负分区，fast 不会因此变多。
2. **要 fast 更多 → 抬高 `simpleMedium`**，推荐 0.10 起步。
3. **`.env` 改完必须重启**，否则不生效。
4. **DB 实际 tier 分布 ≠ 纯分数模拟**：ambiguous→MEDIUM 等 override 会让 MEDIUM 偏多，复评以 DB 实际值为准。
5. **每次只动一个边界**，隔天看数据再动下一个，避免多变量混淆。
