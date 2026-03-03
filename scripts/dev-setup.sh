#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

info() {
  echo "[dev-setup] $*"
}

warn() {
  echo "[dev-setup][warn] $*" >&2
}

die() {
  echo "[dev-setup][error] $*" >&2
  exit 1
}

ensure_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    die "Required command not found: ${cmd}"
  fi
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    info "uv already installed: $(uv --version)"
    return
  fi

  ensure_cmd curl

  info "Installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh

  export PATH="${HOME}/.local/bin:${PATH}"
  if ! command -v uv >/dev/null 2>&1; then
    die "uv installation completed but command is not in PATH. Add ${HOME}/.local/bin to your shell profile and re-run."
  fi

  info "uv installed: $(uv --version)"
}

ensure_node_toolchain() {
  ensure_cmd node
  ensure_cmd npm
  info "Node: $(node -v)"
  info "npm: $(npm -v)"
}

ensure_n8n() {
  if command -v n8n >/dev/null 2>&1; then
    info "n8n already installed: $(n8n --version)"
    return
  fi

  info "Installing n8n globally via npm"
  npm install -g n8n
  info "n8n installed: $(n8n --version)"
}

main() {
  ensure_cmd git
  ensure_uv
  ensure_node_toolchain
  ensure_n8n

  cd "${REPO_ROOT}"

  # Enforce non-editable installs to avoid hidden .pth import issues on some Python builds.
  export UV_NO_EDITABLE=1
  export DISCOFLOW_REPO_ROOT="${REPO_ROOT}"
  info "Using UV_NO_EDITABLE=1 for reproducible DiscoFlow CLI installs"

  info "Syncing Python environment with uv"
  uv sync --dev --reinstall-package discoflow-cli

  info "Running DiscoFlow bootstrap"
  uv run --no-editable discoflow bootstrap

  cat <<'EOT'

Setup complete.

Daily workflow:
  uv run --no-editable discoflow start
  uv run --no-editable discoflow watch

When node description metadata changes:
  uv run --no-editable discoflow ui-refresh

Diagnostics and status:
  uv run --no-editable discoflow doctor
  uv run --no-editable discoflow status
EOT
}

main "$@"
