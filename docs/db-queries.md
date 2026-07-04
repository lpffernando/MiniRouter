# MiniRouter 数据库查询指南

MiniRouter 用 SQLite 存储调用日志，路径固定在 `~/.minirouter/minirouter.db`。本文档列出常用查询，方便事后分析路由策略。

## 数据库位置

- **Windows**: `C:\Users\<用户名>\.minirouter\minirouter.db`
- **Linux/Mac**: `~/.minirouter/minirouter.db`

## 用 node + better-sqlite3 查询（推荐）

项目已装 `better-sqlite3`，直接用 node 跑 SQL 最方便。所有命令在项目根目录 `D:\MVP\MiniRouter` 下跑。

### 1. 看最近 N 条调用（含 prompt 摘要）

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT created_at,tier,model,has_tools,has_vision,input_tokens as tin,output_tokens as tout,prompt_digest FROM usage_logs WHERE prompt_digest IS NOT NULL AND prompt_digest != \"\" ORDER BY created_at DESC LIMIT 30').all())"
```

### 2. 看最近 N 条（全部，含失败的）

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT created_at,tier,model,status,input_tokens as tin,output_tokens as tout FROM usage_logs ORDER BY created_at DESC LIMIT 20').all())"
```

### 3. tier 分布统计

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT tier, COUNT(*) as n FROM usage_logs GROUP BY tier ORDER BY n DESC').all())"
```

### 4. 按模型分布

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT model, COUNT(*) as n, SUM(input_tokens) as tin, SUM(output_tokens) as tout FROM usage_logs GROUP BY model ORDER BY n DESC').all())"
```

### 5. 成功/失败统计

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT status, COUNT(*) as n FROM usage_logs GROUP BY status').all())"
```

### 6. 失败请求详情

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT created_at,model,tier,error_type,prompt_digest FROM usage_logs WHERE status=\"error\" ORDER BY created_at DESC LIMIT 20').all())"
```

### 7. 流式请求的 output_tokens（验证 SSE 埋点是否生效）

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT created_at,model,is_streaming,output_tokens FROM usage_logs WHERE is_streaming=1 ORDER BY created_at DESC LIMIT 10').all())"
```

重启服务后跑这条，看 `output_tokens` 是否不再是 0。

### 8. 时段对比（重启前后）

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.log('=== 指定时段后 ===');console.table(d.prepare('SELECT tier, COUNT(*) as n FROM usage_logs WHERE created_at > \"2026-07-04T07:00:00\" GROUP BY tier ORDER BY n DESC').all())"
```

把时间戳换成你重启的时间（UTC）。

### 9. 路由溯源：prompt vs tier

```bash
node -e "const D=require('better-sqlite3');const d=new D('C:/Users/fernando/.minirouter/minirouter.db',{readonly:true});console.table(d.prepare('SELECT tier,model,prompt_digest FROM usage_logs WHERE prompt_digest IS NOT NULL AND prompt_digest != \"\" ORDER BY created_at DESC LIMIT 30').all())"
```

看每条的 prompt 摘要和实际走的 tier，判断路由是否准确。

## 时间戳说明

- DB 里 `created_at` 是 **UTC 时间**（`2026-07-04T07:33:47Z`）
- **北京时间 = UTC + 8**（UTC 07:33 = 北京 15:33）
- 查询时段时记得用 UTC

## 表结构

`usage_logs` 表主要列：

| 列 | 含义 |
|---|---|
| `created_at` | 调用时间（UTC ISO 字符串）|
| `tier` | 路由档位：SIMPLE / MEDIUM / COMPLEX / REASONING |
| `model` | 实际走的 slot 模型名 |
| `status` | success / error |
| `error_type` | 失败时的错误类型 |
| `input_tokens` | 输入 token 数 |
| `output_tokens` | 输出 token 数（流式需 SSE 埋点生效才有值）|
| `is_streaming` | 1=流式，0=非流式 |
| `has_tools` | 1=带工具调用 |
| `has_vision` | 1=带图片/视频 |
| `prompt_digest` | 末条 user 消息前 200 字摘要 |
| `strategy` | 路由策略名（env-slot-native-anthropic / openai-chat）|

## 用 DB Browser for SQLite（GUI）

如果想用图形界面看，下载 [DB Browser for SQLite](https://sqlitebrowser.org/)，打开 `~/.minirouter/minirouter.db` 即可。注意先停掉服务或用只读模式，避免锁冲突（WAL 模式下一般没问题）。
