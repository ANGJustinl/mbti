#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DEVBOX_HOST="${DEVBOX_HOST:-bja.sealos.run_ns-rtv1o4jt_mbti}"
DEVBOX_REMOTE_DIR="${DEVBOX_REMOTE_DIR:-/home/devbox/project}"
DEVBOX_PORT="${DEVBOX_PORT:-3000}"
DEVBOX_NODE_OPTIONS="${DEVBOX_NODE_OPTIONS:---max-old-space-size=1024}"
DEVBOX_NODE_VERSION="${DEVBOX_NODE_VERSION:-$(tr -d '[:space:]' < "${ROOT_DIR}/.nvmrc" 2>/dev/null || printf '22.12.0')}"
DEVBOX_IGNORE_FILE="${ROOT_DIR}/.devboxignore"

log() {
  printf '[push-devbox] %s\n' "$1"
}

fail() {
  printf '[push-devbox] %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_cmd ssh
require_cmd tar
[[ -f "${DEVBOX_IGNORE_FILE}" ]] || fail "Missing ignore file: ${DEVBOX_IGNORE_FILE}"
REMOTE_RUNTIME_DIR="${DEVBOX_REMOTE_DIR}/.devbox-runtime"
REMOTE_LOG_FILE="${REMOTE_RUNTIME_DIR}/app.log"

case "${DEVBOX_REMOTE_DIR}" in
  ""|"/"|"/home"|"/home/devbox")
    fail "Refusing to deploy to unsafe DEVBOX_REMOTE_DIR=${DEVBOX_REMOTE_DIR}"
    ;;
esac

log "Checking SSH connectivity to ${DEVBOX_HOST}"
if ! ssh_output="$(ssh -o BatchMode=yes "${DEVBOX_HOST}" "echo connected >/dev/null" 2>&1)"; then
  if [[ "${ssh_output}" == *"is not running"* ]]; then
    fail "DevBox is not running yet. Open or wake the DevBox in Sealos, then rerun this script."
  fi
  fail "SSH connectivity check failed: ${ssh_output}"
fi

log "Stopping old app process if present"
ssh "${DEVBOX_HOST}" "set -eu
if [ -f '${DEVBOX_REMOTE_DIR}/.devbox-runtime/app.pid' ]; then
  pid=\$(cat '${DEVBOX_REMOTE_DIR}/.devbox-runtime/app.pid' || true)
  if [ -n \"\${pid}\" ] && kill -0 \"\${pid}\" 2>/dev/null; then
    kill \"\${pid}\" || true
  fi
fi
pkill -f '[a]pps/web/.next/standalone' 2>/dev/null || true
pkill -f '${DEVBOX_REMOTE_DIR}/[e]ntrypoint.sh' 2>/dev/null || true"

log "Resetting remote code in ${DEVBOX_REMOTE_DIR} while preserving .data and node_modules"
ssh "${DEVBOX_HOST}" "set -eu
mkdir -p '${DEVBOX_REMOTE_DIR}' '${DEVBOX_REMOTE_DIR}/.data' '${DEVBOX_REMOTE_DIR}/node_modules'
for path in '${DEVBOX_REMOTE_DIR}'/* '${DEVBOX_REMOTE_DIR}'/.[!.]* '${DEVBOX_REMOTE_DIR}'/..?*; do
  [ -e \"\${path}\" ] || continue
  case \"\$(basename \"\${path}\")\" in
    .data|node_modules)
      continue
      ;;
  esac
  rm -rf \"\${path}\"
done"

log "Syncing project files via tar over SSH"
tar -C "${ROOT_DIR}" --exclude-from="${DEVBOX_IGNORE_FILE}" -cf - . \
  | ssh "${DEVBOX_HOST}" "tar -xf - -C '${DEVBOX_REMOTE_DIR}'"

log "Skipping local .env upload; configure runtime envs in DevBox console"

log "Running remote install, build, restart, and health check"
ssh "${DEVBOX_HOST}" "set -euo pipefail
cd '${DEVBOX_REMOTE_DIR}'
chmod +x ./entrypoint.sh ./scripts/push-devbox.sh
mkdir -p '${REMOTE_RUNTIME_DIR}'
if [ -s \"\$HOME/.nvm/nvm.sh\" ]; then
  export NVM_DIR=\"\$HOME/.nvm\"
  . \"\$NVM_DIR/nvm.sh\"
  nvm install '${DEVBOX_NODE_VERSION}' >/dev/null
  nvm use '${DEVBOX_NODE_VERSION}' >/dev/null
fi
node -v
npm -v
if ! pnpm -v >/dev/null 2>&1; then
  npm install -g --force pnpm@9.13.2 >/dev/null 2>&1
  hash -r
fi
pnpm -v
CI=1 pnpm install --frozen-lockfile --reporter=append-only --child-concurrency=1 --network-concurrency=4
NODE_OPTIONS='${DEVBOX_NODE_OPTIONS}' pnpm db:generate
NODE_OPTIONS='${DEVBOX_NODE_OPTIONS}' pnpm --filter web build
if [ ! -f apps/web/.next/standalone/server.js ] && [ ! -f apps/web/.next/standalone/apps/web/server.js ]; then
  echo 'Missing standalone build output' >&2
  exit 1
fi
nohup ./entrypoint.sh > '${REMOTE_LOG_FILE}' 2>&1 &
echo \$! > '${REMOTE_RUNTIME_DIR}/app.pid'
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS 'http://127.0.0.1:${DEVBOX_PORT}/api/health' >/dev/null; then
    exit 0
  fi
  sleep 2
done
tail -n 120 '${REMOTE_LOG_FILE}' >&2
exit 1"

log "Deployment succeeded"
ssh "${DEVBOX_HOST}" "curl -fsS 'http://127.0.0.1:${DEVBOX_PORT}/api/health'"
