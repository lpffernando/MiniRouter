# MiniRouter — Agent Guide

This file helps AI coding agents understand the MiniRouter codebase. It
replaces the legacy `.claude/` and `.agents/` skill directories (removed).
Agents should start here, then read the relevant `docs/` file for details.

## Project structure

```
src/
├── auth/                # API Key authentication & user identity
├── config/              # .env loading & runtime configuration
├── context/             # Optional Headroom context optimization
├── db/                  # SQLite, migrations, query layer
├── protocols/           # OpenAI / Anthropic request normalization
├── providers/           # Slot env vars, channel selection, upstream adapters
├── router/              # 14-dimension rule routing engine
├── routing/             # Feature extraction & routing debug receipts
└── server/              # Hono HTTP API & SSE usage collection
```

## Where to look

### How routing works → `docs/routing-strategy.md`

The 14-dimension classifier, tier boundaries, slot selection, and all
configuration parameters. README has a quick summary; this doc has the
full strategy.

### How to deploy → `README.md` (Docker section)

Docker Compose is the recommended deployment method. See also:
- `docker-compose.yml` — runtime config
- `deploy/deploy.sh` — upload + deploy script
- `deploy/nginx-minirouter.conf` — reverse proxy template

### Environment variables → `.env.example`

All configurable variables with sensible defaults in comments. The code
reads them via `src/config.ts` → `getConfig()`.

### Routing tuning → `README.md` (Routing tuning section)

Parameters that control SIMPLE / MEDIUM / COMPLEX / REASONING tier ratios.
Edit in `docker-compose.yml` → `environment:` and `docker compose up -d`.

### Database queries → `docs/db-queries.md`

SQLite schema, query recipes for usage logs, spend tracking, user management.

### Headroom context optimization → `docs/headroom.md`

External proxy + local tail compression for long contexts.

### Infrastructure management → `docs/infra-management-design.md`

Channel management, provider instances, cost tracking architecture.

### Model registry maintenance → `docs/model-maintenance/update-model-registry.md`

How to update pricing, benchmarks, and model scores.

### Roadmap → `docs/roadmap.md`

What's planned: Headroom integration, admin dashboard, multi-tenancy, etc.

## Model data

- `models/seed-data.json` — Pricing & benchmark seed data
- `models/seed-models.ts` — Script to import into SQLite
- `models/dashboard.html` — Model comparison table (served at `/models/dashboard`)

## Key files to read first

| File | Why |
|------|-----|
| `src/router/config.ts` | DEFAULT_ROUTING_CONFIG + env var overrides |
| `src/providers/env.ts` | Slot selection logic |
| `src/router/rules.ts` | 14-dimension scoring |
| `src/server/routes/chat.ts` | OpenAI-compatible request handling |
| `src/server/routes/anthropic-messages.ts` | Anthropic Messages API handling |
| `src/server/routes/channel-execution.ts` | Channel failover logic |