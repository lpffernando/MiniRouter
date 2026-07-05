# Headroom Integration Notes

MiniRouter has two context-optimization layers:

1. **Headroom proxy** (primary) — via `headroom-ai` npm package's `compress()` function.
   Calls `POST /v1/compress` on the Headroom proxy at `MINIROUTER_HEADROOM_URL`.
   Auto-detects message format (OpenAI / Anthropic / Gemini / Vercel AI SDK).

2. **Local tail compression** (fallback) — in-process head+tail+important-lines extraction
   for tool outputs when Headroom proxy is unreachable.

## Architecture

```

User request
  → MiniRouter routing (selectConfiguredSlot)
    → optimizeWithHeadroom()
      → Layer 1: headroom-ai compress(messages, { model, baseUrl })
        → POST /v1/compress to Headroom proxy (port 8787)
          ← compressed messages
      → Layer 2 (fallback): local tail compression via compressRequestTail()
    → execute provider API with compressed body
  → logUsage() records compression metrics
```

## Starting Headroom

The repository includes `start-headroom.bat` for running the official Headroom proxy.

```bat
start-headroom.bat
# or: npm run headroom:start
```

The script starts:
```bat
headroom proxy --port 8787 --mode cache --no-ccr-inject-tool --lossless
```

Why these defaults:
- `--mode cache` — freeze prior turns to protect provider prefix-cache hit rate.
- `--no-ccr-inject-tool` — avoid injecting retrieval tools into Agent requests
  (MiniRouter doesn't use the retrieval tool surface).
- `--lossless` — compress tool outputs with format-native lossless compaction
  without emitting CCR retrieval markers. No MCP retrieve tool needed.

## Lifecycle Management

Headroom is managed alongside MiniRouter via npm scripts:

| Command | What it does |
|---|---|
| `npm run restart` | Restart both Headroom + MiniRouter |
| `npm run headroom:start` | Start Headroom only |
| `npm run headroom:stop` | Stop Headroom only |
| `npm run headroom:restart` | Restart Headroom only |
| `start-headroom.bat` | Start Headroom (standalone) |

The `restart.bat` script kills both services (ports 8787 + 8402), starts Headroom
in a new terminal window, then starts MiniRouter in the foreground.

## Environment

```env
MINIROUTER_HEADROOM_ENABLED=true          # Master switch
MINIROUTER_HEADROOM_MODE=adaptive         # adaptive | force | off
MINIROUTER_HEADROOM_URL=http://localhost:8787  # Headroom proxy URL
MINIROUTER_HEADROOM_MIN_TOKENS=8000       # Minimum tokens to trigger compression
MINIROUTER_HEADROOM_CONTEXT_RATIO=0.85    # Context window threshold ratio
MINIROUTER_TAIL_COMPRESSION_ENABLED=true  # Local fallback when proxy unavailable
MINIROUTER_TAIL_COMPRESSION_MIN_CHARS=12000
MINIROUTER_TAIL_COMPRESSION_MAX_CHARS=2000
```

## Expected Savings

- **Headroom proxy**: 40–70% token reduction on tool outputs, logs, and RAG results.
  Uses SmartCrusher (JSON), CodeCompressor (AST), and Kompress-v2-base (ML text).
- **Local tail compression**: ~90% on long tool outputs — but a coarse cut that
  keeps head + tail + important lines. Only used when Headroom proxy is down.

## Recovery

If Headroom proxy fails (connection refused, timeout, non-200):
1. `optimizeWithHeadroom()` catches the error
2. Falls back to local tail compression automatically
3. Request is still compressed, just less intelligently
4. Logs show `"[MiniRouter] Headroom proxy compress failed: ... - falling back to local compression"`

## Troubleshooting

- **Headroom won't start**: Run `pip install "headroom-ai[proxy]"` in `.external/headroom/.venv/`
- **Wrong port**: Check `HEADROOM_PORT` or `MINIROUTER_HEADROOM_URL` in `.env`
- **Lossy compression concerns**: Add `--protect-tool-results Bash,Read` to `headroom proxy` args
