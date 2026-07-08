# Agent Step Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade MiniRouter routing from "classify the latest user message" to "classify the current Agent step", so one user task can dynamically use fast, balanced, and strong models across different internal LLM calls.

**Architecture:** Add a deterministic `CallIntent` extraction layer between protocol normalization and routing. It separates `globalGoal` from `currentStep`, classifies the current LLM call into a small `stepType`, feeds that step-aware text into the existing rules router, and persists the extracted intent into usage logs for audit and tuning. Keep the first version heuristic-only and metadata-compatible; do not add an extra LLM classifier.

**Tech Stack:** TypeScript, Hono, SQLite/Drizzle, Vitest, existing OpenAI/Anthropic protocol normalizers, existing rules router.

---

## 1. Problem Statement

The current routing path mostly uses `extractLastUserText()` as the classifier input. This works for single-turn chat, but it is wrong for Agent workflows.

In Agent usage, the user gives one global task, and the Agent turns it into many model calls:

- understand the task
- inspect files
- check fields
- write code
- run code
- inspect errors
- fix code
- compare results
- write final answer

The original user task may stay the same across these calls, but the quality requirement changes per step. A "check one field" step should not use the same model as "design the architecture" or "write final business conclusion".

The correct routing unit is:

> The current model call's work intent, not only the original user request.

## 2. Product-Level Routing Model

MiniRouter should reason with two layers:

### Global Goal

The broader user task. This provides context and a quality floor.

Examples:

- "按区县统计建筑开发量并和旧报告对比"
- "修复 MiniRouter 的路由策略"
- "生成最终分析报告"

Global goal should prevent silly downgrades, but it should not force every step to `strong`.

### Current Step

What this specific LLM call is doing now. This should drive the actual route.

Examples:

- "列目录并查看字段"
- "写统计脚本"
- "解释报错并修复"
- "比较新旧报告口径差异"
- "生成最终结论"
- "回复一句确认"

Current step should choose the tier.

## 3. Step Types

Use a small fixed enum. This keeps the first version explainable and testable.

```ts
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
```

Recommended routing behavior:

| Step Type | Typical Slot | Notes |
| --- | --- | --- |
| `housekeeping` | `fast` | short confirmations, titles, health checks, "reply only pong" |
| `lookup` | `fast` or `balanced` | list files, inspect fields, read small data; use balanced when long context/tools |
| `coding` | `balanced` | write scripts, transform data, patch files |
| `debugging` | `balanced` or `strong` | use strong for repeated errors, stack traces, complex diagnosis |
| `data_analysis` | `balanced` or `strong` | use strong for final interpretation,口径判断, report comparison |
| `planning` | `strong` | architecture, strategy, multi-step plan |
| `final_synthesis` | `strong` | final report, executive summary, business conclusion |
| `vision` | `vision` | image/screenshot/multimodal |
| `unknown` | existing rules | preserve compatibility |

## 4. CallIntent Shape

Create a new extracted object:

```ts
export type CallIntent = {
  globalGoal: string | null;
  currentStep: string | null;
  classifierText: string;
  stepType: StepType;
  qualityHint: "cheap" | "normal" | "strong" | null;
  confidence: number;
  signals: string[];
  source: "metadata" | "heuristic";
};
```

Field meaning:

- `globalGoal`: short summary of the broader task.
- `currentStep`: short summary of this specific call.
- `classifierText`: compact text fed into the rules router.
- `stepType`: deterministic category.
- `qualityHint`: explicit request such as cheap/fast/strong/high intelligence.
- `confidence`: heuristic confidence, 0 to 1.
- `signals`: why this intent was selected.
- `source`: whether it came from client metadata or heuristics.

## 5. Extraction Priority

### Priority 1: Client Metadata

If the client sends MiniRouter-specific metadata, trust it.

Example:

```json
{
  "model": "minirouter/auto",
  "metadata": {
    "minirouter": {
      "global_goal": "按区县统计建筑开发量并和旧报告对比",
      "current_step": "比较新旧报告口径差异并生成结论",
      "step_type": "final_synthesis",
      "quality_hint": "strong"
    }
  }
}
```

This is optional and backwards-compatible. Most clients will not send it initially, but future Agent integrations can.

### Priority 2: Heuristic Extraction

When metadata is absent:

1. Strip boilerplate:
   - `<system-reminder>...</system-reminder>`
   - local skill paths
   - "Base directory for this skill"
2. Build `globalGoal` from the earliest substantive user message.
3. Build `currentStep` from the latest meaningful message window:
   - latest user text
   - latest assistant text that contains next action / plan
   - latest tool result snippets
4. Classify `stepType` using keyword groups and structural signals.
5. Build `classifierText` as:

```text
Global goal: ...
Current step: ...
Step type: ...
Recent signals: ...
```

The router should score this compact intent text, not the raw huge conversation.

## 6. Step Classification Heuristics

Use transparent keyword groups, not an LLM.

### housekeeping

Signals:

- `reply only pong`
- `title for an agent chat session`
- `ok`, `好的`, `收到`, `继续`, `done`
- very short input, no tools, no recent error

Route:

- `SIMPLE -> fast`

### lookup

Signals:

- `查看`, `读取`, `列出`, `打开`, `看下字段`, `inspect`, `read`, `list`, `open`
- tool result is file listing or schema preview

Route:

- small context: `SIMPLE -> fast`
- long context or tools: `MEDIUM -> balanced`

### coding

Signals:

- `写代码`, `脚本`, `实现`, `patch`, `edit`, `modify`, `generate script`
- expected output is code or file change

Route:

- default `MEDIUM -> balanced`
- strong only if architecture/refactor/security/high-risk signals exist

### debugging

Signals:

- `报错`, `失败`, `stack trace`, `exception`, `fix`, `debug`
- latest tool result includes non-zero exit, traceback, TypeScript error, test failure

Route:

- first/simple error: `MEDIUM -> balanced`
- repeated failures or broad diagnosis: `COMPLEX -> strong`

### data_analysis

Signals:

- `统计`, `计算`, `对比`, `字段`, `口径`, `开发量`, `区县`, `建筑`, `QGIS`, `矢量`, `报告`
- tables, CSV-like data, geospatial/business metrics

Route:

- computation / script step: `MEDIUM -> balanced`
- interpretation / report comparison / business conclusion: `COMPLEX -> strong`

### planning

Signals:

- `方案`, `架构`, `设计`, `计划`, `strategy`, `architecture`, `roadmap`

Route:

- `COMPLEX -> strong`

### final_synthesis

Signals:

- `总结`, `最终`, `结论`, `报告`, `对外表达`, `executive summary`, `final answer`

Route:

- `COMPLEX -> strong`

## 7. Routing Policy

Keep the existing score router, but add step-aware feature extraction and tier policy around it.

Important design principle:

> CallIntent is not a second competing scoring system. It is a feature-extraction layer that turns raw Agent context into cleaner inputs for the existing 14-dimension router.

The 14-dimension classifier remains the main scoring engine. `CallIntent` should:

1. choose the right text to score (`classifierText`)
2. add structured dimensions that raw text matching cannot reliably infer
3. provide tier floors/ceilings only for high-confidence step types
4. persist explainability fields for future calibration

This avoids two independent routers giving conflicting answers.

## 7A. Relationship to the 14-Dimension Scorer

Current 14-dimension scoring already captures useful signals:

- token count
- code presence
- reasoning markers
- technical terms
- simple indicators
- multi-step patterns
- constraints
- output format
- references
- domain specificity
- agentic task signals

The problem is not that these dimensions are useless. The problem is that Agent requests pollute the text being scored:

- global user goal repeats across many calls
- system reminders and tool instructions dominate text
- the current step may be hidden in assistant/tool context
- short Chinese words such as "对/好" can look like simple signals
- long context often describes task history, not necessarily current difficulty

So the optimized design is:

```text
Raw request messages
  -> CallIntent extractor
      -> globalGoal
      -> currentStep
      -> stepType
      -> qualityHint
      -> cleaned classifierText
  -> 14-dim scorer
      -> weighted score
      -> raw tier
  -> step-aware calibration
      -> final tier
      -> slot/model
```

### Integrated Feature Model

`stepType` should be represented as additional dimensions or calibrated modifiers, not as a separate score.

Add these conceptual dimensions to the scoring model:

| Dimension | Source | Purpose |
| --- | --- | --- |
| `currentStepType` | CallIntent | distinguish lookup/coding/debugging/final synthesis |
| `stepQualityDemand` | CallIntent | cheap/normal/strong intent |
| `agentPhase` | CallIntent | early exploration, execution, debug, final answer |
| `recentFailureSignal` | messages/tool results | repeated error should raise tier |
| `finalizationSignal` | current step | final report/conclusion should raise tier |

These can initially be implemented as post-score calibration rules, then later folded into the weighted scorer as formal dimensions after enough logs are collected.

### Single Decision Pipeline

Avoid this:

```text
14-dim says MEDIUM
step router says STRONG
some ad hoc if/else picks one
```

Prefer this:

```text
14-dim score = 0.22
stepType = final_synthesis
calibration: final_synthesis min tier = COMPLEX
final tier = COMPLEX
reason = score MEDIUM + final_synthesis floor
```

Every final decision should be explainable as:

```json
{
  "score": 0.22,
  "rawTier": "MEDIUM",
  "stepType": "final_synthesis",
  "calibration": "minTier:COMPLEX",
  "finalTier": "COMPLEX"
}
```

This keeps one scoring system and one audit trail.

### Calibration, Not Override by Default

Step intent should usually calibrate the existing score rather than hard override it.

Recommended first-version rules:

- `housekeeping`: may downgrade to `SIMPLE` only when short, no tools, no vision, no recent failure
- `lookup`: no strong upgrade by itself
- `coding`: minimum `MEDIUM`
- `debugging`: minimum `MEDIUM`; upgrade to `COMPLEX` only with repeated failure or broad diagnosis
- `data_analysis`: minimum `MEDIUM`; upgrade to `COMPLEX` only for interpretation/report/口径/final signals
- `planning`: minimum `COMPLEX`
- `final_synthesis`: minimum `COMPLEX`
- `qualityHint=strong`: minimum `COMPLEX`

This prevents step labels from becoming another black box.

## 7B. Future Iteration Methodology

MiniRouter should evolve routing through measurement, not one-off prompt/rule tweaks.

### Iteration Loop

Use a repeatable calibration loop:

1. **Observe**
   - collect usage logs with raw tier, final tier, stepType, score, signals, latency, cost, status

2. **Label**
   - mark sampled logs as `too_cheap`, `too_strong`, or `correct`
   - optionally add expected slot labels for representative cases

3. **Analyze**
   - find patterns where routing is wrong
   - check whether error came from text extraction, step classification, score weights, or tier thresholds

4. **Adjust**
   - update keyword groups, step calibration, dimension weights, or thresholds
   - avoid changing multiple layers at once

5. **Replay**
   - run the same historical samples through the route debug function
   - compare before/after distribution

6. **Deploy**
   - deploy only when replay improves the target metric

### Routing Evaluation Dataset

Add a small checked-in fixture set later:

```text
fixtures/routing-cases/
  housekeeping.json
  lookup-fields.json
  coding-data-script.json
  debugging-stacktrace.json
  data-analysis-report-compare.json
  final-synthesis-business-summary.json
```

Each fixture should include:

```json
{
  "name": "final synthesis after data analysis",
  "request": {},
  "expected": {
    "stepType": "final_synthesis",
    "minTier": "COMPLEX",
    "slot": "strong"
  }
}
```

This lets routing strategy evolve like a testable product, not like hand-tuned guesses.

### Metrics to Watch

Track routing quality with these metrics:

- slot distribution: fast / balanced / strong share
- strong overuse rate
- balanced failure rate
- retry/error rate by slot
- user correction signals such as "不对", "重新", "太粗", "用高智"
- average cost per successful task
- latency per step type
- final answer quality proxy where available

### Versioned Routing Strategy

Store routing strategy version in logs:

```text
routing_strategy_version = step-intent-v1
```

This makes before/after analysis possible after each strategy change.

### Long-Term Direction

Phased evolution:

1. **v1: deterministic step extraction**
   - no extra LLM cost
   - transparent rules
   - enough for initial distribution correction

2. **v2: replay-based calibration**
   - fixtures and sampled production logs
   - threshold and weight tuning

3. **v3: optional lightweight classifier**
   - only if heuristics hit a ceiling
   - cheap model or local classifier
   - used for ambiguous cases only

4. **v4: client-native Agent metadata**
   - Codex/Claude Code/internal agents can explicitly send current step metadata
   - router becomes more accurate without guessing from raw context

This gives MiniRouter a method体系: observe -> label -> replay -> calibrate -> version -> deploy.

### Before `route()`

Replace current classifier input:

```ts
const classifierText = extractLastUserText(request.messages) ?? undefined;
```

with:

```ts
const callIntent = extractCallIntent(request);
const classifierText = callIntent.classifierText;
```

### After `route()`

Apply conservative step-type tier floors:

```ts
const minTierByStepType = {
  housekeeping: "SIMPLE",
  lookup: "SIMPLE",
  coding: "MEDIUM",
  debugging: "MEDIUM",
  data_analysis: "MEDIUM",
  planning: "COMPLEX",
  final_synthesis: "COMPLEX",
  vision: "COMPLEX",
  unknown: null,
};
```

Apply escalation rules:

- `qualityHint === "strong"` -> at least `COMPLEX`
- `stepType === "final_synthesis"` -> at least `COMPLEX`
- `stepType === "planning"` -> at least `COMPLEX`
- `stepType === "debugging"` and repeated error signals -> at least `COMPLEX`
- `stepType === "data_analysis"` and interpretation/report/口径/final signals -> at least `COMPLEX`

Apply downgrade rules:

- `stepType === "housekeeping"` and no tools/vision and estimated input tokens < 2000 -> `SIMPLE`
- explicit slot requests remain honored.

Important: global goal should not automatically upgrade every step. It should only prevent `housekeeping` false positives when a step is not actually short/simple.

## 8. Usage Log Additions

Persist call intent so routing can be audited.

Add columns to `usage_logs`:

```sql
global_goal_digest TEXT
current_step_digest TEXT
step_type TEXT
quality_hint TEXT
call_intent_debug TEXT
```

Dashboard Details should show:

- Global Goal
- Current Step
- Step Type
- Quality Hint
- Call Intent Signals

This is essential for tuning. Without these fields, we will not know whether the extractor or the router made the wrong decision.

## 9. Implementation Tasks

### Task 1: Add CallIntent Types and Tests

**Files:**
- Create: `src/routing/features/call-intent.ts`
- Create: `src/routing/features/call-intent.test.ts`

**Step 1: Write failing tests**

Test cases:

1. health check:
   - input: `reply only pong`
   - expected: `stepType = housekeeping`, `classifierText` includes current step

2. global task with lookup step:
   - first user: `帮我按区县统计建筑开发量`
   - latest user/assistant: `先看下有哪些字段`
   - expected: `globalGoal` is broader task, `currentStep` is field inspection, `stepType = lookup`

3. coding step:
   - latest text includes `写脚本统计`
   - expected: `stepType = coding`

4. debugging step:
   - latest tool result includes `Error`, `Traceback`, or `exit code 1`
   - expected: `stepType = debugging`

5. final synthesis:
   - latest text includes `最终结论`, `报告`, `业务解释`
   - expected: `stepType = final_synthesis`

6. metadata override:
   - `metadata.minirouter.step_type = "planning"`
   - expected: `source = metadata`, `stepType = planning`

**Step 2: Run tests**

```bash
npm.cmd test -- src/routing/features/call-intent.test.ts
```

Expected: fail because file does not exist.

**Step 3: Implement extractor**

Implement:

```ts
export function extractCallIntent(request: CanonicalRequest): CallIntent
```

Keep implementation deterministic:

- no external API
- no model call
- no mutation of original request

**Step 4: Run tests**

```bash
npm.cmd test -- src/routing/features/call-intent.test.ts
```

Expected: pass.

### Task 2: Preserve Metadata in Protocol Normalizers

**Files:**
- Modify: `src/protocols/ir.ts`
- Modify: `src/protocols/openai-chat.ts`
- Modify: `src/protocols/anthropic-messages.ts`
- Test: `src/protocols/openai-chat.test.ts`
- Test: `src/protocols/anthropic-messages.test.ts`

**Goal:** Carry optional request metadata into `CanonicalRequest.raw` or a typed `metadata` field.

**Design:**

Add to canonical request if not already present:

```ts
metadata?: Record<string, unknown>;
```

OpenAI:

```ts
metadata: body.metadata
```

Anthropic:

```ts
metadata: body.metadata
```

**Tests:**

- metadata survives normalization
- absence remains undefined

**Command:**

```bash
npm.cmd test -- src/protocols/openai-chat.test.ts src/protocols/anthropic-messages.test.ts
```

### Task 3: Integrate CallIntent Into OpenAI Chat Routing

**Files:**
- Modify: `src/server/routes/chat.ts`
- Test: `src/server/routes/debug-route.test.ts`
- Test: `src/providers/env.test.ts` if slot expectations change

**Current behavior:**

`getPromptParts()` uses `extractLastUserText()` for classifier text.

**New behavior:**

1. Normalize request.
2. Extract routing features.
3. Extract call intent.
4. Use call intent classifier text for rules routing.
5. Apply step-type tier policy.
6. Store call intent in `configured`.

Recommended shape:

```ts
type ConfiguredSlot = {
  slot: ModelSlot;
  tier: RoutedTier;
  profile: "auto" | "eco" | "premium" | undefined;
  effort?: string;
  debug: unknown;
  callIntent: CallIntent;
};
```

**Tests:**

- `reply only pong` through `minirouter/auto` selects `fast`
- `final_synthesis` metadata selects `strong`
- `lookup` metadata selects `fast` or `balanced` depending tools/length
- explicit `minirouter/slot/strong` still selects strong regardless of intent

### Task 4: Integrate CallIntent Into Anthropic Messages Routing

**Files:**
- Modify: `src/server/routes/anthropic-messages.ts`
- Test: `src/server/routes/anthropic-messages.test.ts`

Mirror the OpenAI route integration.

Important:

- Do not break native Anthropic tool/message conversion.
- Preserve same call intent debug fields in usage logs.

### Task 5: Add Step-Aware Tier Policy

**Files:**
- Create: `src/router/call-intent-policy.ts`
- Test: `src/router/call-intent-policy.test.ts`
- Modify: `src/server/routes/chat.ts`
- Modify: `src/server/routes/anthropic-messages.ts`

**Goal:** Keep policy separate from the rules classifier.

Function:

```ts
export function applyCallIntentTierPolicy(input: {
  tier: Tier;
  callIntent: CallIntent;
  features: RoutingFeatures;
}): {
  tier: Tier;
  upgraded: boolean;
  downgraded: boolean;
  reason?: string;
}
```

Policy tests:

- housekeeping short -> SIMPLE
- planning -> COMPLEX
- final_synthesis -> COMPLEX
- data_analysis + final/report/口径 -> COMPLEX
- coding -> at least MEDIUM
- explicit slot override does not depend on policy

### Task 6: Persist CallIntent Fields

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations.ts`
- Modify: `src/db/queries/usage.ts`
- Test: existing server route tests plus focused DB migration if available

Add columns:

```ts
globalGoalDigest
currentStepDigest
stepType
qualityHint
callIntentDebug
```

Add idempotent migrations:

```ts
addColumnIfMissing("usage_logs", "global_goal_digest", "global_goal_digest TEXT");
addColumnIfMissing("usage_logs", "current_step_digest", "current_step_digest TEXT");
addColumnIfMissing("usage_logs", "step_type", "step_type TEXT");
addColumnIfMissing("usage_logs", "quality_hint", "quality_hint TEXT");
addColumnIfMissing("usage_logs", "call_intent_debug", "call_intent_debug TEXT");
```

Extend `LogUsageInput`.

Update both success and error logging paths.

### Task 7: Expose CallIntent in Usage Logs API and Dashboard

**Files:**
- Modify: `src/server/routes/usage-logs.ts`
- Modify: `admin/dashboard.html`

API should return:

```ts
globalGoalDigest
currentStepDigest
stepType
qualityHint
callIntentDebug
```

Dashboard:

- Add `Step` column or show in Details first.
- Details panel should show:
  - Global Goal
  - Current Step
  - Step Type
  - Quality Hint
  - Call Intent Signals

Avoid making the table too wide. Put most fields in Details.

### Task 8: Update Debug Route

**Files:**
- Modify: `src/server/routes/debug-route.ts`
- Test: `src/server/routes/debug-route.test.ts`

`/debug/route?source=env-slot` should include:

```json
{
  "callIntent": {
    "globalGoal": "...",
    "currentStep": "...",
    "stepType": "data_analysis",
    "qualityHint": null,
    "signals": []
  }
}
```

This lets us test routing behavior without creating usage logs.

### Task 9: Backfill-Free Deployment and Validation

Do not backfill old logs. New columns can be null for old rows.

Local validation:

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Manual local route checks:

1. housekeeping:
   - expected: `SIMPLE -> fast`

2. lookup within global complex task:
   - expected: `SIMPLE/MEDIUM`, not always strong

3. final synthesis:
   - expected: `COMPLEX -> strong`

4. coding:
   - expected: `MEDIUM -> balanced`

5. debugging with stack trace:
   - expected: `MEDIUM` or `COMPLEX` depending repeated/severe signal

Cloud validation after deploy:

- Run `/debug/route?source=env-slot` for representative payloads.
- Run one real `minirouter/auto` call per step type using a test key.
- Check Usage Logs Details show `stepType` and current step.
- Confirm no old log rendering errors.

## 10. Important Non-Goals for First Version

Do not implement these yet:

- No LLM-based classifier.
- No vector memory of task sessions.
- No cross-request persistent Agent session state.
- No automatic backfill of old logs.
- No complex per-user custom routing policies.

The first version should prove whether step-aware extraction improves routing distribution and observability.

## 11. Expected Behavior After Implementation

For a single user task:

> "帮我按区县统计建筑开发量，并和旧报告对比"

MiniRouter should route different Agent steps differently:

| Agent Step | Step Type | Slot |
| --- | --- | --- |
| "先看下有哪些字段" | `lookup` | `fast` or `balanced` |
| "写脚本统计区县开发量" | `coding` | `balanced` |
| "运行报错，分析并修复" | `debugging` | `balanced` or `strong` |
| "比较新旧报告口径差异" | `data_analysis` | `strong` when interpretive |
| "生成最终业务结论" | `final_synthesis` | `strong` |
| "好的，继续" | `housekeeping` | `fast` |

This is the desired product behavior: one global task, multiple step-aware routing decisions.

## 12. Open Decisions Before Implementation

Need owner confirmation on these:

1. Should `planning` always go `strong`, or only when context is long/agentic?
   - Recommendation: always at least `COMPLEX -> strong`.

2. Should `lookup` in a complex global task be allowed to go `fast`?
   - Recommendation: yes if short/no tools; otherwise `balanced`.

3. Should data-analysis computation steps go `balanced` while interpretation/final conclusion goes `strong`?
   - Recommendation: yes.

4. Should explicit client metadata be trusted over heuristics?
   - Recommendation: yes, but validate enum values.

5. Should health checks and title-generation calls be hidden from Usage Logs by default?
   - Recommendation: not in this change. Add a later UI filter.
