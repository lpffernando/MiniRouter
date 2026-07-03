# MiniRouter Design

MiniRouter is an Agent-oriented LLM routing gateway. Its job is not only to rank
models, but to decide which model can satisfy a request at the best cost-quality
point, then execute it with an explainable fallback plan.

## Product Positioning

MiniRouter serves three connected needs:

1. Maintain a real model catalog: pricing, capability, benchmark scores,
   modality support, context window, tool support, and health.
2. Route each request automatically: detect task type and hard capability
   requirements, then pick the best value model.
3. Learn from production telemetry: route receipts, failures, latency, cost,
   retries, and user overrides.

The first target scenario is Agent usage, including Claude Code, Codex, OpenAI
SDK-compatible tools, Anthropic SDK-compatible tools, and domestic model
gateways. Agent workloads make tool calling, long context, fallback stability,
and session consistency more important than simple chat quality.

## Core Principle

Routing must be constraint-first:

```txt
Can the model satisfy the request?
  -> If no, filter it out.

Among capable models, which one is best value?
  -> Rank by ability, reliability, latency, cost, and policy preference.
```

Price is not a hard substitute for capability. A cheap text-only model must not
compete for an image request. A model without stable tool calling must not be
selected for Agent tool loops unless the policy explicitly allows that risk.

## Architecture

MiniRouter is split into three planes.

```txt
Control Plane
  Model catalog, benchmark data, pricing, provider instances, policy config.

Data Plane
  Per-request parsing, feature extraction, routing, fallback, provider execution.

Learning Plane
  Telemetry, route receipts, feedback, score calibration, learned routers.
```

The MVP focuses on the Control Plane model database and the Data Plane routing
core. The Learning Plane should remain telemetry-first until enough real traffic
exists.

## Request Flow

```txt
Client request
  -> Protocol adapter
  -> Canonical Request IR
  -> Feature extractor
  -> Capability gate
  -> Task classifier
  -> Policy engine
  -> Model selector
  -> Provider adapter
  -> Telemetry and route receipt
```

### Protocol Adapter

The routing core should not depend on OpenAI or Anthropic raw request shapes for
classification. Each input protocol is normalized into a canonical internal
representation for feature extraction only.

The proxy path must preserve native API semantics. MiniRouter should not rewrite
an OpenAI Chat request into Anthropic Messages by default, or rewrite Anthropic
Messages into OpenAI Chat. Native request bodies, provider-specific parameters,
streaming semantics, and tool-call formats should pass through the matching
native endpoint.

Initial protocols:

- OpenAI Chat Completions
- Anthropic Messages
- OpenAI Responses

The MVP implements OpenAI Chat and Anthropic Messages as separate native
ingress endpoints.

### Canonical Request IR

The internal request shape captures:

- protocol
- requested model or routing profile
- messages and content blocks
- text, image, audio, and video inputs
- tools and tool choice
- structured output or JSON mode
- max output tokens
- stream flag

This lets one routing pipeline serve many clients.

### Feature Extractor

The feature extractor identifies:

- estimated input and total token count
- vision, audio, and video requirements
- tool calling requirement
- JSON or structured output requirement
- long-context requirement
- agentic workload signals
- prompt text for rule-based task classification

### Capability Gate

The capability gate performs hard filtering before scoring:

- inactive model
- vision required but unsupported
- audio or video required but unsupported
- tools required but unsupported
- JSON mode required but unsupported
- context window too small
- max output too small

Filtered models should be returned in the route receipt with exact reasons.

### Task Classifier

The existing rule classifier remains useful for MVP. It maps requests into:

- SIMPLE
- MEDIUM
- COMPLEX
- REASONING

For Agent workloads, routing should also consider capability profiles:

- AGENTIC_SIMPLE
- AGENTIC_CODE
- AGENTIC_REASONING
- AGENTIC_VISION

The MVP starts with feature extraction plus existing rule routing. Learned
classification can come later.

### Policy Engine

Policy decides which candidate pool and ranking weights apply.

Suggested profiles:

- eco: aggressive cost optimization
- auto: balanced cost-quality routing
- premium: quality and reliability first

Future subscription tiers can map onto these profiles, but the internal routing
engine should stay profile-based.

### Model Selector

After hard filtering, the selector ranks eligible models by value.

Initial score:

```txt
route_score =
  ability_score * ability_weight
  + cost_score * cost_weight
  + speed_score * speed_weight
  + reliability_score * reliability_weight
  + priority_score * priority_weight
```

Weights vary by profile:

- eco raises cost weight
- premium raises ability and reliability weight
- auto keeps a balanced mix

The selector returns:

- selected primary model
- ordered fallback chain
- estimated cost
- route score
- filtered-out reasons

## MVP Scope

The first MVP should make routing explainable before making execution complex.

Implemented or planned in this slice:

1. Canonical Request IR for OpenAI Chat.
2. Feature extraction for tools, vision, JSON mode, context, and Agent signals.
3. Database-backed catalog mapping from `model_scores`.
4. `POST /debug/route` to inspect model selection and fallback.
5. `.env`-driven model slots for real OpenAI-compatible and Anthropic-native
   calls.

Out of scope for the first slice:

- learned routing
- automatic score calibration
- billing

## `/debug/route`

This endpoint is the main MVP inspection tool.

Request example:

```json
{
  "model": "minirouter/auto",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Analyze this screenshot and return JSON." },
        { "type": "image_url", "image_url": { "url": "https://example.com/ui.png" } }
      ]
    }
  ],
  "tools": [
    { "type": "function", "function": { "name": "save_result" } }
  ],
  "response_format": { "type": "json_object" },
  "max_tokens": 2048
}
```

Response should include:

- extracted features
- selected model
- fallback chain
- filtered models and reasons
- model count
- profile

This endpoint is intentionally public in the local MVP so routing behavior can
be debugged from the dashboard and development tools.

## Real Routing MVP

The first runnable gateway path uses environment-configured model slots instead
of the model-score database. This keeps model data maintenance separate from the
core routing/proxy work.

Supported slots:

- `FAST`: optional cheap and low-latency slot for simple chat. Initial model:
  GLM-4.7-Flash. It is reserved for later local/cheap routing and is not
  required for the first MVP run.
- `BALANCED`: default workhorse for code, tools, and normal Agent steps.
  Initial model: DeepSeek V4 Flash.
- `STRONG`: complex reasoning, hard coding, planning, and multi-step
  debugging. Initial model: GLM-5.2.
- `VISION`: screenshots, images, and multimodal tasks. Initial model:
  GLM-4.6V.

Agent and code are not standalone slots in the MVP. They are routing signals:
tool use or code-like work routes a request to at least `BALANCED`; complex
planning or explicit reasoning upgrades it to `STRONG`. Until `FAST` is
configured, simple text requests also use `BALANCED`.

Each slot is configured with:

```txt
MINIROUTER_<SLOT>_BASE_URL=https://...
MINIROUTER_<SLOT>_API_KEY=...
MINIROUTER_<SLOT>_MODEL=...
MINIROUTER_<SLOT>_SUPPORTS_TOOLS=true | false
MINIROUTER_<SLOT>_SUPPORTS_VISION=true | false
```

`MINIROUTER_<SLOT>_PROVIDER` is optional. The default is `auto`, which means the
protocol is selected from the incoming API shape. OpenAI Chat requests are sent
to `{BASE_URL}/chat/completions`; Anthropic Messages requests are sent to
`{BASE_URL}/messages`. Set `PROVIDER=anthropic` only when a slot must always use
the native Anthropic Messages API.

Routing order:

```txt
1. Accept either OpenAI Chat (`/v1/chat/completions`) or Anthropic Messages
   (`/v1/messages`).
2. Normalize the request internally for routing signals only.
3. Extract requirements: tools, vision, JSON mode, context, agentic signals.
4. Classify task tier with the existing rules classifier.
5. Pick the best configured slot:
   vision -> VISION
   tool/agentic + simple/medium tier -> BALANCED
   complex/reasoning tier -> STRONG
   simple tier -> FAST if configured, otherwise BALANCED
   medium tier -> BALANCED
6. Forward the original request shape to the matching native upstream endpoint.
```

If no slots are configured, both `/v1/chat/completions` and `/v1/messages`
return an explicit configuration error. MiniRouter should not return a fake
successful chat completion when no upstream model is configured.

For the first execution MVP, configure only these required slots:

```txt
BALANCED = DeepSeek V4 Flash
STRONG   = GLM-5.2
VISION   = GLM-4.6V
```

`FAST = GLM-4.7-Flash` can be added after the proxy path, logging, and fallback
behavior are stable.

## Context Optimization

MiniRouter reserves a Headroom-compatible context optimization layer between
routing and provider execution.

Default behavior is pass-through:

```txt
MINIROUTER_HEADROOM_ENABLED=false
```

When enabled, Headroom is controlled by:

```txt
MINIROUTER_HEADROOM_MODE=off | adaptive | force
MINIROUTER_HEADROOM_URL=http://localhost:8787
MINIROUTER_HEADROOM_MIN_TOKENS=8000
MINIROUTER_HEADROOM_CONTEXT_RATIO=0.85
```

Policy:

```txt
off:
  pass through unchanged

adaptive:
  short requests pass through unchanged
  long tool/log/RAG/file payloads can be sent to Headroom
  requests near the selected slot context window can be sent to Headroom
  static prefix should be protected to preserve provider cache hits

force:
  every routed request is sent to Headroom for experiments and pressure tests
```

MiniRouter sends Headroom the native protocol name, original body, selected
slot, and policy hints such as `protectStaticPrefix` and
`preserveNativeApiShape`. Headroom should return the same API shape with an
optimized body. If Headroom is disabled, unavailable, or returns an error,
MiniRouter uses the original body.

## External Design References

MiniRouter should borrow selectively:

- RouteLLM: threshold-based strong/weak routing after enough preference data.
- LiteLLM: production gateway reliability, fallback, retry, timeout, cooldown.
- OpenRouter: provider routing, model/provider constraints, session consistency.
- Agent routing papers: route receipts, feedback loops, and agentic context.

Cold-start MiniRouter should not depend on learned routing. It should first be
correct, observable, and stable.

## Development Roadmap

### Phase 1: Explainable Router MVP

- OpenAI Chat canonical request normalization
- feature extraction
- DB-backed candidate loading
- capability gate
- `/debug/route`
- unit tests for request normalization and route selection

### Phase 2: Real Gateway Execution

- OpenAI-compatible provider adapter
- Anthropic Messages adapter
- streaming transform
- usage accounting
- fallback retry
- provider error normalization

### Phase 3: Agent Reliability

- session sticky model selection
- tool-call stability metrics
- route receipt storage
- provider health checks
- per-user and per-team policy overrides

### Phase 4: Data-Driven Routing

- collect route outcomes
- analyze retries and user overrides
- calibrate model scores from production
- add RouteLLM-style threshold routing for well-observed tasks
