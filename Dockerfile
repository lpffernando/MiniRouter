# ── Stage 1: Build ────────────────────────────────────────────────────
FROM node:22-bookworm AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsup.config.ts ./
COPY src/ ./src/

RUN npm run build -- --no-dts

# ── Stage 2: Production ──────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist/serve.js ./dist/serve.mjs
COPY models/ ./models/
# 把 去密钥的路由调参文件 打进镜像为 /app/.env, 使重新打包后边界/调参依然生效
# (loadDotEnv 读 /app/.env; 运行时 -e 注入的密钥/provider 变量会覆盖同名项, 故此处不冲突)
# 注意: 绝不 COPY 含密钥的 .env, 密钥只通过运行时 -e 提供
COPY .env.tuning /app/.env

RUN mkdir -p /data/.minirouter

ENV HOME=/data
ENV NODE_ENV=production
ENV BLOCKRUN_PROXY_PORT=8402

EXPOSE 8402

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8402/health || exit 1

CMD ["node", "dist/serve.mjs"]
