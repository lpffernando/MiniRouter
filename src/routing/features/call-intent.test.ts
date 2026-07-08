import { describe, expect, it } from "vitest";

import { extractCallIntent } from "./call-intent.js";
import type { CanonicalRequest } from "../../protocols/ir.js";

function request(overrides: Partial<CanonicalRequest>): CanonicalRequest {
  return {
    protocol: "openai-chat",
    model: "minirouter/auto",
    messages: [],
    tools: [],
    maxOutputTokens: 4096,
    stream: false,
    raw: {},
    ...overrides,
  };
}

describe("extractCallIntent", () => {
  it("classifies health checks as housekeeping", () => {
    const intent = extractCallIntent(
      request({
        messages: [{ role: "user", content: [{ type: "text", text: "reply only pong" }] }],
      }),
    );

    expect(intent.stepType).toBe("housekeeping");
    expect(intent.currentStep).toBe("reply only pong");
    expect(intent.classifierText).toContain("Current step: reply only pong");
  });

  it("separates a broad global task from a field lookup step", () => {
    const intent = extractCallIntent(
      request({
        messages: [
          { role: "user", content: [{ type: "text", text: "帮我按区县统计建筑开发量，并和旧报告对比" }] },
          { role: "assistant", content: [{ type: "text", text: "我先确认数据字段。" }] },
          { role: "user", content: [{ type: "text", text: "先看下有哪些字段" }] },
        ],
      }),
    );

    expect(intent.globalGoal).toContain("按区县统计建筑开发量");
    expect(intent.currentStep).toBe("先看下有哪些字段");
    expect(intent.stepType).toBe("lookup");
  });

  it("classifies script-writing calls as coding", () => {
    const intent = extractCallIntent(
      request({
        messages: [{ role: "user", content: [{ type: "text", text: "写脚本统计各区县建筑开发量" }] }],
      }),
    );

    expect(intent.stepType).toBe("coding");
  });

  it("classifies traceback or failing tool-result calls as debugging", () => {
    const intent = extractCallIntent(
      request({
        messages: [
          { role: "user", content: [{ type: "text", text: "帮我修复脚本" }] },
          { role: "tool", content: [{ type: "text", text: "Traceback (most recent call last):\nError: exit code 1" }] },
        ],
      }),
    );

    expect(intent.stepType).toBe("debugging");
    expect(intent.signals).toContain("recent-failure");
    expect(intent.signals).toContain("tool-result");
  });

  it("classifies final business/report synthesis as final_synthesis", () => {
    const intent = extractCallIntent(
      request({
        messages: [
          { role: "user", content: [{ type: "text", text: "帮我分析今天的调用" }] },
          { role: "assistant", content: [{ type: "text", text: "数据已经查完。" }] },
          { role: "user", content: [{ type: "text", text: "生成最终结论和业务解释，写进报告" }] },
        ],
      }),
    );

    expect(intent.stepType).toBe("final_synthesis");
    expect(intent.currentStep).toContain("最终结论");
  });

  it("trusts validated MiniRouter metadata over heuristics", () => {
    const intent = extractCallIntent(
      request({
        metadata: {
          minirouter: {
            global_goal: "优化路由策略",
            current_step: "设计新的 Agent step 路由方案",
            step_type: "planning",
            quality_hint: "strong",
          },
        },
        messages: [{ role: "user", content: [{ type: "text", text: "ok" }] }],
      }),
    );

    expect(intent.source).toBe("metadata");
    expect(intent.stepType).toBe("planning");
    expect(intent.qualityHint).toBe("strong");
    expect(intent.currentStep).toBe("设计新的 Agent step 路由方案");
  });
});
