#!/usr/bin/env bash
# MiniRouter 远程更新脚本
# 本地执行: 推送代码 + SSH 到服务器拉取 + 重启
# 用法: ./deploy/deploy.sh your-server-ip [ssh-port]
set -euo pipefail

SERVER_IP="${1:?Usage: $0 <server-ip> [ssh-port]}"
SSH_PORT="${2:-22}"
REMOTE_DIR="/opt/minirouter/minirouter"
SSH_DEST="root@${SERVER_IP}"

echo "=========================================="
echo " MiniRouter Deploy"
echo " Target: ${SERVER_IP}:${SSH_PORT}"
echo "=========================================="

# 1. 本地构建
echo "[1/3] Building locally..."
npm run build

# 2. 推送到 GitHub
echo "[2/3] Pushing to GitHub..."
git push origin HEAD

# 3. SSH 到服务器更新
echo "[3/3] Updating server..."
ssh -p "${SSH_PORT}" "${SSH_DEST}" "REMOTE_DIR='${REMOTE_DIR}' bash -s" <<'SCRIPT'
set -euo pipefail
cd "${REMOTE_DIR}"

echo "  Pulling code..."
BRANCH="$(git branch --show-current)"
if [[ -z "${BRANCH}" ]]; then
  echo "Deployment checkout is detached; check out a named branch first." >&2
  exit 1
fi
git pull --ff-only origin "${BRANCH}"

echo "  Installing deps..."
npm ci

echo "  Building..."
npm run build

echo "  Restarting service..."
systemctl restart minirouter

echo "  Status:"
systemctl status minirouter --no-pager | head -5
SCRIPT

echo ""
echo "✅ Deploy complete!"
echo "   Logs: journalctl -u minirouter -f"
