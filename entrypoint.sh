#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${PROJECT_ROOT}/apps/web"
DATA_DIR="${PROJECT_ROOT}/.data"
STANDALONE_DIR="${APP_DIR}/.next/standalone"
SYSTEM_HOSTNAME="$(hostname 2>/dev/null || true)"
DEVBOX_NODE_VERSION="${DEVBOX_NODE_VERSION:-$(tr -d '[:space:]' < "${PROJECT_ROOT}/.nvmrc" 2>/dev/null || printf '22.12.0')}"
PRISMA_BIN="${PROJECT_ROOT}/node_modules/.bin/prisma"
RAW_DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/app.db}"

RESOLVED_HOSTNAME="${HOSTNAME:-}"
if [[ -z "${RESOLVED_HOSTNAME}" || "${RESOLVED_HOSTNAME}" == "${SYSTEM_HOSTNAME}" ]]; then
  RESOLVED_HOSTNAME="0.0.0.0"
fi

normalize_database_url() {
  local db_url="$1"
  local sqlite_target suffix file_name

  if [[ "${db_url}" != file:* ]]; then
    printf '%s\n' "${db_url}"
    return
  fi

  sqlite_target="${db_url#file:}"
  if [[ "${sqlite_target}" == :memory:* ]]; then
    printf '%s\n' "${db_url}"
    return
  fi

  suffix=""
  if [[ "${sqlite_target}" == *\?* ]]; then
    suffix="?${sqlite_target#*\?}"
    sqlite_target="${sqlite_target%%\?*}"
  fi

  if [[ "${sqlite_target}" == /* ]]; then
    printf '%s\n' "${db_url}"
    return
  fi

  file_name="$(basename "${sqlite_target}")"
  printf 'file:%s/%s%s\n' "${DATA_DIR}" "${file_name}" "${suffix}"
}

prepare_node_runtime() {
  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh"
    nvm use "${DEVBOX_NODE_VERSION}" >/dev/null
  fi

  if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
    echo "Node $(node -v) is too old. Prisma 7.5.0 requires Node 20.19+ or 22.12+." >&2
    exit 1
  fi
}

export HOSTNAME="${RESOLVED_HOSTNAME}"
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"
export DATABASE_URL="$(normalize_database_url "${RAW_DATABASE_URL}")"

prepare_node_runtime
mkdir -p "${DATA_DIR}"

if [[ "${RAW_DATABASE_URL}" != "${DATABASE_URL}" ]]; then
  echo "Normalized SQLite DATABASE_URL from ${RAW_DATABASE_URL} to ${DATABASE_URL}"
fi

if [[ "${NODE_ENV}" == "production" ]]; then
  if [[ "${SECONDME_REDIRECT_URI:-}" == http://localhost* || "${SECONDME_REDIRECT_URI:-}" == https://localhost* ]]; then
    echo "Warning: SECONDME_REDIRECT_URI still points to localhost. Update it in DevBox console for OAuth callback." >&2
  fi
fi

STANDALONE_SERVER=""
for candidate in \
  "${STANDALONE_DIR}/server.js" \
  "${STANDALONE_DIR}/apps/web/server.js"
do
  if [[ -f "${candidate}" ]]; then
    STANDALONE_SERVER="${candidate}"
    break
  fi
done

if [[ -z "${STANDALONE_SERVER}" ]]; then
  echo "Missing standalone build output under ${STANDALONE_DIR}" >&2
  exit 1
fi

if [[ ! -x "${PRISMA_BIN}" ]]; then
  echo "Missing Prisma CLI: ${PRISMA_BIN}" >&2
  exit 1
fi

SERVER_DIR="$(dirname "${STANDALONE_SERVER}")"
mkdir -p "${SERVER_DIR}/.next"

if [[ -d "${APP_DIR}/.next/static" ]]; then
  rm -rf "${SERVER_DIR}/.next/static"
  ln -s "${APP_DIR}/.next/static" "${SERVER_DIR}/.next/static"
fi

if [[ -d "${APP_DIR}/public" ]]; then
  rm -rf "${SERVER_DIR}/public"
  ln -s "${APP_DIR}/public" "${SERVER_DIR}/public"
fi

echo "Preparing SQLite database at ${DATABASE_URL}"
(
  cd "${PROJECT_ROOT}"
  "${PRISMA_BIN}" db push --schema=prisma/schema.prisma
)

echo "Starting Next.js on ${HOSTNAME}:${PORT}"
cd "${PROJECT_ROOT}"
exec node "${STANDALONE_SERVER}"
