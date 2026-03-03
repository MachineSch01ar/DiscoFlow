# DiscoFlow Local Development Runbook (Canonical)

This is the single source of truth for local contributor setup and testing.

Repository assumptions:

- Node package path: `packages/n8n-nodes-discourse`
- npm package name: `@machinesch01ar/n8n-nodes-discourse`
- n8n node display name: `Discourse Extended`
- Primary dev interface: `uv run --no-editable discoflow ...`

## 1) Prerequisites

Supported environments:

- macOS
- Linux
- WSL

Required tools:

- `git`
- `node` and `npm` (Node 22 recommended)
- `curl` (for first-time `uv` bootstrap)

`n8n` and `uv` are installed/validated by `scripts/dev-setup.sh`.

## 2) One-Time Setup

From repository root:

```bash
./scripts/dev-setup.sh
```

This script:

- Installs `uv` if missing.
- Validates `node` and `npm`.
- Installs global `n8n` if missing.
- Enforces `UV_NO_EDITABLE=1` for Python package sync.
- Exports `DISCOFLOW_REPO_ROOT` for deterministic path resolution.
- Runs `uv sync --dev --reinstall-package discoflow-cli`.
- Runs `uv run --no-editable discoflow bootstrap`.

Manual sync command (if needed outside the setup script):

```bash
UV_NO_EDITABLE=1 uv sync --dev --reinstall-package discoflow-cli
```

Canonical command form is `uv run --no-editable discoflow ...`.
It does not depend on shell-exported `UV_NO_EDITABLE` and avoids editable `.pth` import edge cases.

Before running commands from outside repository root, set:

```bash
export DISCOFLOW_REPO_ROOT="/absolute/path/to/DiscoFlow"
```

Persist these in your shell profile if you work on DiscoFlow regularly.

## 3) Daily Workflow

Start n8n in background:

```bash
uv run --no-editable discoflow start
```

Start package rebuild watcher:

```bash
uv run --no-editable discoflow watch
```

Check status:

```bash
uv run --no-editable discoflow status
```

Open local n8n:

- `http://localhost:5678`

## 4) Process and Log Files

`uv run --no-editable discoflow start` and `uv run --no-editable discoflow watch` run managed background processes.

Managed state path:

- `.tmp/dev`

PID files:

- `.tmp/dev/n8n.pid`
- `.tmp/dev/watch.pid`

Log files:

- `.tmp/dev/n8n.log`
- `.tmp/dev/watch.log`

Behavior:

- Logs are opened in append mode, so new output is added to the end.
- Files are written when the process emits output (event-driven), not on a fixed heartbeat.
- Log files grow over time until stopped/reset/cleaned.

Inspect logs:

```bash
uv run --no-editable discoflow logs n8n
uv run --no-editable discoflow logs watch
uv run --no-editable discoflow logs n8n --follow
```

## 5) Command Reference

Diagnostics:

```bash
uv run --no-editable discoflow doctor
```

Link package only:

```bash
uv run --no-editable discoflow link
```

Restart managed n8n process:

```bash
uv run --no-editable discoflow restart
```

Stop processes:

```bash
uv run --no-editable discoflow stop
uv run --no-editable discoflow stop n8n
uv run --no-editable discoflow stop watch
```

View logs:

```bash
uv run --no-editable discoflow logs n8n
uv run --no-editable discoflow logs watch
uv run --no-editable discoflow logs n8n --follow
```

UI metadata refresh flow:

```bash
uv run --no-editable discoflow ui-refresh
```

Full local reset:

```bash
uv run --no-editable discoflow clean-reset --force
```

## 6) Critical Rule: When Restart Is Required

Browser refresh alone is not enough for node description metadata changes.

Examples:

- `description.properties`
- `description.credentials`
- `displayOptions`
- resource/operation option labels

Use:

```bash
uv run --no-editable discoflow ui-refresh
```

This aligns with n8n documentation for node development troubleshooting.

## 7) Quick Verification Checklist

1. Search the node picker for `Discourse Extended`.
2. Add the node to a test workflow.
3. Confirm credential selectors appear only for relevant operations.
4. Execute a safe read operation first (`Get`, `Get Many`).

## 8) Troubleshooting

Node not visible in n8n:

- Run `uv run --no-editable discoflow doctor`.
- Confirm link target matches `packages/n8n-nodes-discourse`.
- Run `uv run --no-editable discoflow link`.
- Restart n8n with `uv run --no-editable discoflow restart`.

UI changes not visible:

- Run `uv run --no-editable discoflow ui-refresh`.
- Hard refresh the browser.

Global link fails with permissions errors:

- Re-run `npm link` manually to inspect error details.
- Ensure your global npm prefix is writable for your user.
- If needed, configure npm prefix to a user-owned directory.

Community package loading disabled:

- Check `N8N_COMMUNITY_PACKAGES_ENABLED` is not `false`.
- Check `N8N_COMMUNITY_PACKAGES_PREVENT_LOADING` is not `true`.
- Restart n8n after env var updates.

Custom extensions path mismatch:

- Confirm `N8N_CUSTOM_EXTENSIONS` value.
- `discoflow` uses the first configured path.
- Re-link package into that first path.

Stale process state:

- If `status` reports running but process is gone, run `uv run --no-editable discoflow stop`.
- Re-run `uv run --no-editable discoflow start` and `uv run --no-editable discoflow watch`.

Corrupt local state:

- Run `uv run --no-editable discoflow clean-reset --force`.

Log files too large:

- Stop processes with `uv run --no-editable discoflow stop`.
- Remove log files in `.tmp/dev` if needed.
- Restart with `uv run --no-editable discoflow start` and `uv run --no-editable discoflow watch`.

`ModuleNotFoundError: No module named 'discoflow_cli'` (often after running plain `uv run discoflow ...` or after path/case changes):

- Run diagnostics with explicit non-editable mode:
  - `uv run --no-editable discoflow doctor`
- If doctor reports hidden editable `.pth` files, repair in non-editable mode:
  - `UV_NO_EDITABLE=1 uv sync --dev --reinstall-package discoflow-cli`
- Retry commands with explicit non-editable mode:
  - `uv run --no-editable discoflow start`
  - `uv run --no-editable discoflow watch`

`Unable to locate DiscoFlow repository root`:

- Run commands from repository root.
- Or set:
  - `export DISCOFLOW_REPO_ROOT=\"$(pwd)\"`

## 9) Known Good vs Wrong Patterns

Normal:

- Built-in Discourse and `Discourse Extended` can both exist.
- npm audit warnings in development dependencies may appear.

Wrong:

- Searching only `Discourse` and assuming the built-in node is custom node output.
- Mixing unrelated startup methods and expecting deterministic behavior.
- Running plain `uv run discoflow ...` instead of `uv run --no-editable discoflow ...`.

## 10) Official References

- Run node locally:
  - https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/
- Using n8n-node CLI:
  - https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/
- Troubleshooting custom node development:
  - https://docs.n8n.io/integrations/creating-nodes/test/troubleshooting-node-development/
- Custom nodes location:
  - https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/
- Node environment variables:
  - https://docs.n8n.io/hosting/configuration/environment-variables/nodes/
