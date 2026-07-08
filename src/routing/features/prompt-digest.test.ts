import { describe, expect, it } from "vitest";

import { extractPromptDigest } from "./prompt-digest.js";

describe("extractPromptDigest", () => {
  it("skips local agent skill boilerplate before storing the user message digest", () => {
    const digest = extractPromptDigest([
      {
        role: "user",
        content:
          "Base directory for this skill: C:\\Users\\fernando\\AppData\\Local\\Claude-3p\\local-agent-mode-sessions\\skills-plugin\\abc\\skills\\pdf-reader\n\nAnalyze this PDF and summarize the routing issue.",
      },
    ]);

    expect(digest).toBe("Analyze this PDF and summarize the routing issue.");
  });

  it("supports text blocks", () => {
    const digest = extractPromptDigest([
      {
        role: "user",
        content: [
          { type: "text", text: "Base directory: D:\\tmp\\skills\\x" },
          { type: "text", text: "please use a strong model for this analysis" },
        ],
      },
    ]);

    expect(digest).toBe("please use a strong model for this analysis");
  });

  it("skips injected system reminder context before the visible user request", () => {
    const digest = extractPromptDigest([
      {
        role: "user",
        content:
          "<system-reminder>\nAs you answer the user's questions, you can use the following context:\n# currentDate\nToday's date is 2026/07/08.\n</system-reminder>\n\n帮我分析下这次调用为什么没走高智模型",
      },
    ]);

    expect(digest).toBe("帮我分析下这次调用为什么没走高智模型");
  });

  it("returns null when the user message only contains injected reminder context", () => {
    const digest = extractPromptDigest([
      {
        role: "user",
        content:
          "<system-reminder>\nAs you answer the user's questions, you can use the following context.\n</system-reminder>",
      },
    ]);

    expect(digest).toBeNull();
  });
});
