#!/usr/bin/env node
/**
 * MiniRouter 本地冒烟测试
 *
 * 验证本地运行的 MiniRouter 是否能正常处理不同类型的请求。
 * 前提：MiniRouter 在 localhost:8402 运行。
 *
 * Usage:
 *   node scripts/local-smoke.mjs [--all]
 *   node scripts/local-smoke.mjs --simple   # 仅基本请求
 *   node scripts/local-smoke.mjs --tool     # 仅工具调用 + tail 压缩
 */

const BASE = "http://localhost:8402";

async function simpleRequest() {
  const response = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "minirouter/auto",
      messages: [{ role: "user", content: "只回答 OK" }],
      temperature: 0,
      max_tokens: 8,
      stream: false,
    }),
  });
  const text = await response.text();
  console.log("=== Simple Request ===");
  console.log(JSON.stringify({ status: response.status, ok: response.ok, preview: text.slice(0, 500) }, null, 2));
}

async function toolRequest() {
  const longToolOutput = [
    "install started",
    "status: running",
    ...Array.from({ length: 260 }, (_, i) => `verbose install log line ${i}: ${"x".repeat(90)}`),
    "error: package mirror timeout",
    "path: C:\\tmp\\installer.log",
    "status: failed",
  ].join("\n");

  const body = {
    model: "minirouter/auto",
    messages: [
      { role: "system", content: "You are a concise engineering assistant." },
      { role: "user", content: "根据工具输出判断安装是否成功，用一句中文回答。" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_smoke_1", type: "function", function: { name: "shell", arguments: '{"cmd":"npm install"}' } }],
      },
      { role: "tool", tool_call_id: "call_smoke_1", content: longToolOutput },
    ],
    tools: [{
      type: "function",
      function: { name: "shell", description: "Run a shell command", parameters: { type: "object", properties: { cmd: { type: "string" } }, required: ["cmd"] } },
    }],
    tool_choice: "none",
    temperature: 0,
    max_tokens: 64,
    stream: false,
  };

  const response = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  console.log("=== Tool Call Request ===");
  console.log(JSON.stringify({ status: response.status, ok: response.ok, preview: text.slice(0, 500) }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all") || args.length === 0;
  const simple = all || args.includes("--simple");
  const tool = all || args.includes("--tool");

  if (simple) await simpleRequest();
  if (tool) await toolRequest();
  console.log("\nDone.");
}

main().catch((err) => { console.error("Smoke test failed:", err); process.exit(1); });