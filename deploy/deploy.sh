#!/usr/bin/env bash
# MiniRouter deploy entrypoint.
# Delegates to the de-keyed Node deploy script (deploy/deploy.mjs),
# which reads SSH creds from the local .env (gitignored) and recreates
# the container via docker compose on the server.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node deploy/deploy.mjs "$@"
