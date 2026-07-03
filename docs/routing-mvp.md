# MiniRouter Routing MVP

This MVP runs the router as a local OpenAI-compatible gateway with optional
Anthropic Messages ingress.

## Required Env Slots

Configure these three slots in `.env`:

```env
MINIROUTER_SOLO=true
BLOCKRUN_PROXY_PORT=8402

MINIROUTER_BALANCED_BASE_URL=https://...
MINIROUTER_BALANCED_API_KEY=...
MINIROUTER_BALANCED_MODEL=...
MINIROUTER_BALANCED_SUPPORTS_TOOLS=true
MINIROUTER_BALANCED_SUPPORTS_VISION=false

MINIROUTER_STRONG_BASE_URL=https://...
MINIROUTER_STRONG_API_KEY=...
MINIROUTER_STRONG_MODEL=...
MINIROUTER_STRONG_SUPPORTS_TOOLS=true
MINIROUTER_STRONG_SUPPORTS_VISION=false

MINIROUTER_VISION_BASE_URL=https://...
MINIROUTER_VISION_API_KEY=...
MINIROUTER_VISION_MODEL=...
MINIROUTER_VISION_SUPPORTS_TOOLS=true
MINIROUTER_VISION_SUPPORTS_VISION=true
```

`FAST` is optional. Leave it unset until a cheap local or hosted fast model is
ready. Simple requests fall back to `BALANCED`.

## Start

```powershell
npm.cmd run serve
```

## Check Readiness

```powershell
Invoke-RestMethod http://localhost:8402/health/ready
```

Ready means `balanced`, `strong`, and `vision` are configured. `fast` should
appear as optional.

## Inspect Routing

```powershell
Invoke-RestMethod http://localhost:8402/debug/route?source=env-slot `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"model":"minirouter/auto","messages":[{"role":"user","content":"summarize this short note"}]}'
```

## List Client Models

```powershell
Invoke-RestMethod http://localhost:8402/v1/models
```

With env slots configured, the list includes:

- `minirouter/auto`
- `minirouter/eco`
- `minirouter/premium`
- `minirouter/slot/balanced`
- `minirouter/slot/strong`
- `minirouter/slot/vision`

## Smoke Chat

```powershell
Invoke-RestMethod http://localhost:8402/v1/chat/completions `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"model":"minirouter/auto","messages":[{"role":"user","content":"Say ok in one word."}],"max_tokens":8}'
```

Use `minirouter/slot/strong` or `minirouter/slot/vision` when you want to force a
specific configured slot.

