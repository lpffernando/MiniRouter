import type { CanonicalMessage, CanonicalRequest } from "../../protocols/ir.js";

export type StepType =
  | "housekeeping"
  | "lookup"
  | "coding"
  | "debugging"
  | "data_analysis"
  | "planning"
  | "final_synthesis"
  | "vision"
  | "unknown";

export type QualityHint = "cheap" | "normal" | "strong";

export type CallIntent = {
  globalGoal: string | null;
  currentStep: string | null;
  classifierText: string;
  stepType: StepType;
  qualityHint: QualityHint | null;
  confidence: number;
  signals: string[];
  source: "metadata" | "heuristic";
};

const STEP_TYPES: StepType[] = [
  "housekeeping",
  "lookup",
  "coding",
  "debugging",
  "data_analysis",
  "planning",
  "final_synthesis",
  "vision",
  "unknown",
];

const QUALITY_HINTS: QualityHint[] = ["cheap", "normal", "strong"];
const MAX_DIGEST_CHARS = 240;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? cleanText(value) : null;
}

function textFromMessage(message: CanonicalMessage): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function cleanText(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/^Base directory for this skill:.*$/gim, " ")
    .replace(/[A-Z]:\\[^\s]+local-agent-mode-sessions[^\s]*/gi, " ")
    .replace(/\/[^\s]+local-agent-mode-sessions[^\s]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DIGEST_CHARS);
}

function firstSubstantiveUserText(messages: CanonicalMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = cleanText(textFromMessage(message));
    if (text.length > 0) return text;
  }
  return null;
}

function latestMeaningfulText(messages: CanonicalMessage[]): { text: string | null; role: string | null } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "system") continue;
    const text = cleanText(textFromMessage(message));
    if (text.length > 0) return { text, role: message.role };
  }
  return { text: null, role: null };
}

function inferQualityHint(text: string): QualityHint | null {
  if (/(高智|强模型|最强|深度|复杂推理|strong|best model|high intelligence)/i.test(text)) return "strong";
  if (/(便宜|低价|省钱|快速|cheap|fast|low cost)/i.test(text)) return "cheap";
  return null;
}

function classifyStep(text: string, role: string | null): { stepType: StepType; confidence: number; signals: string[] } {
  const signals: string[] = role === "tool" ? ["tool-result"] : [];
  const lower = text.toLowerCase();

  if (/(traceback|exception|error:|exit code 1|failed|test failure|ts\d{4}|报错|失败|修复|debug)/i.test(text)) {
    signals.push("recent-failure");
    return { stepType: "debugging", confidence: role === "tool" ? 0.9 : 0.8, signals };
  }
  if (/(最终|总结|结论|业务解释|对外表达|executive summary|final answer|final conclusion)/i.test(text)) {
    signals.push("finalization");
    return { stepType: "final_synthesis", confidence: 0.85, signals };
  }
  if (/(方案|架构|设计|计划|规划|strategy|architecture|roadmap|plan\b)/i.test(text)) {
    signals.push("planning");
    return { stepType: "planning", confidence: 0.8, signals };
  }
  if (/(写脚本|写代码|实现|修改|编辑|patch|code|script|generate script|modify|edit)/i.test(text)) {
    signals.push("coding");
    return { stepType: "coding", confidence: 0.75, signals };
  }
  if (/(查看|读取|列出|打开|看下|有哪些字段|inspect|read|list|open|show me)/i.test(text)) {
    signals.push("lookup");
    return { stepType: "lookup", confidence: 0.75, signals };
  }
  if (/(统计|计算|对比|字段|口径|开发量|区县|建筑|qgis|矢量|报告|data analysis|analy[sz]e)/i.test(text)) {
    signals.push("data-analysis");
    return { stepType: "data_analysis", confidence: 0.7, signals };
  }
  if (/^(reply only pong|pong|ok|好的|收到|继续|done|thanks?|谢谢)[.!。！\s]*$/i.test(lower)) {
    signals.push("housekeeping");
    return { stepType: "housekeeping", confidence: 0.9, signals };
  }

  return { stepType: "unknown", confidence: 0.35, signals };
}

function buildClassifierText(intent: Omit<CallIntent, "classifierText">): string {
  return [
    intent.globalGoal ? `Global goal: ${intent.globalGoal}` : null,
    intent.currentStep ? `Current step: ${intent.currentStep}` : null,
    `Step type: ${intent.stepType}`,
    intent.qualityHint ? `Quality hint: ${intent.qualityHint}` : null,
    intent.signals.length > 0 ? `Recent signals: ${intent.signals.join(", ")}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function fromMetadata(request: CanonicalRequest): CallIntent | null {
  const root = request.metadata;
  if (!isRecord(root) || !isRecord(root["minirouter"])) return null;
  const mini = root["minirouter"];
  const stepTypeRaw = mini["step_type"];
  const stepType = typeof stepTypeRaw === "string" && STEP_TYPES.includes(stepTypeRaw as StepType)
    ? (stepTypeRaw as StepType)
    : "unknown";
  const qualityRaw = mini["quality_hint"];
  const qualityHint =
    typeof qualityRaw === "string" && QUALITY_HINTS.includes(qualityRaw as QualityHint)
      ? (qualityRaw as QualityHint)
      : null;
  const globalGoal = asString(mini["global_goal"]);
  const currentStep = asString(mini["current_step"]) ?? latestMeaningfulText(request.messages).text;
  const base = {
    globalGoal,
    currentStep,
    stepType,
    qualityHint,
    confidence: 1,
    signals: ["metadata"],
    source: "metadata" as const,
  };
  return { ...base, classifierText: buildClassifierText(base) };
}

export function extractCallIntent(request: CanonicalRequest): CallIntent {
  const metadataIntent = fromMetadata(request);
  if (metadataIntent) return metadataIntent;

  const globalGoal = firstSubstantiveUserText(request.messages);
  const latest = latestMeaningfulText(request.messages);
  const currentStep = latest.text ?? globalGoal;
  const qualityHint = inferQualityHint([globalGoal, currentStep].filter(Boolean).join("\n"));
  const classified = classifyStep(currentStep ?? "", latest.role);
  const base = {
    globalGoal,
    currentStep,
    stepType: classified.stepType,
    qualityHint,
    confidence: classified.confidence,
    signals: classified.signals,
    source: "heuristic" as const,
  };
  return { ...base, classifierText: buildClassifierText(base) };
}
