  [![CI](https://github.com/MachineSch01ar/DiscoFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/MachineSch01ar/DiscoFlow/actions/workflows/ci.yml)
  [![License](https://img.shields.io/github/license/MachineSch01ar/DiscoFlow)](LICENSE.md)
  [![Python](https://img.shields.io/badge/python-3.12-blue.svg)](#contributor-quick-start)
  [![Node](https://img.shields.io/badge/node-22.x-339933.svg)](#contributor-quick-start)
  [![uv](https://img.shields.io/badge/uv-required-6e56cf.svg)](#contributor-quick-start)

# DiscoFlow

DiscoFlow is an open-source project for building reliable, programmatic, and cognitively aware workflows around Discourse.

## Get Started (Discourse Admins)

This section is for Discourse admins/operators setting up DiscoFlow on a forum instance. Contributor setup for local development is documented later in this file under `Contributor Quick Start`.

### 1) Choose your n8n path

- **Self-hosted n8n (recommended today):**
  Use this path for `Discourse Extended` right now. Install and manage community nodes from npm on self-hosted n8n:
  https://docs.n8n.io/integrations/community-nodes/installation/
- **n8n Cloud:**
  n8n Cloud supports installing verified community nodes from the nodes panel:
  https://docs.n8n.io/integrations/community-nodes/installation/verified-install/
  If `Discourse Extended` is not listed there yet, use self-hosted n8n for now. We are currently working toward node verification for broader cloud availability.

### 2) Install Discourse Extended

- Package name: `@machinesch01ar/n8n-nodes-discourse`
- Node name in picker: `Discourse Extended`
- Self-hosted install path in n8n UI: `Settings -> Community Nodes -> Install` (GUI install details:
  https://docs.n8n.io/integrations/community-nodes/installation/gui-install/)

### 3) Create credentials

- In Discourse, create an API key for admin automation:
  https://meta.discourse.org/t/create-and-configure-an-api-key/230124
- In n8n, create credential type `Discourse API (Discourse Extended)` and set:
  - `Base URL` (for example, `https://forum.example.com`)
  - `API Key`
  - `API Username`
- Recommended: create the credential from inside the `Discourse Extended` node editor so node access is assigned correctly.

### 4) Run your first test workflow (5 minutes)

1. Add `Manual Trigger`.
2. Add `Discourse Extended`.
3. Set:
   - `Resource = Topic`
   - `Operation = Get Many (Latest)`
   - `Limit = 5`
   - `Simplify = true`
4. Execute the workflow.
5. Success criteria: you get recent topics from your forum without auth/permission errors.

### 5) Next steps

- For full operation coverage and advanced behavior, use the package README:
  [`packages/n8n-nodes-discourse/README.md`](packages/n8n-nodes-discourse/README.md)
- Discourse API reference:
  https://docs.discourse.org/

## Mission

DiscoFlow exists to help communities run on Discourse with deeper automation, stronger operational reliability, and progressively more intelligent behavior.

## Vision

DiscoFlow is built on a simple long-term thesis:

- Discourse is one of the strongest communication/community platforms available today.
- Discourse being open source with a complete JSON REST API makes it an ideal foundation for advanced automation.
- Cognitive systems are becoming essential infrastructure, not optional features.
- Community operators should be able to integrate new intelligence capabilities without brittle custom glue code.

Our goal is to make a Discourse instance increasingly "cognitive" and "cognizant" over time through practical tooling, not hype cycles.

## Why Discourse

DiscoFlow is intentionally Discourse-first because Discourse offers:

- A mature open-source core.
- A rich JSON REST API that is straightforward to integrate through HTTP workflows.
- A strong product and community mission focused on healthy discourse.
- A fast-moving AI feature surface that can be extended and orchestrated externally.

## What DiscoFlow Tries To Solve

Today, many Discourse teams face one or more of these problems:

- Repetitive admin/moderation operations performed manually.
- One-off scripts with weak observability and poor portability.
- Limited integration between Discourse operations and modern AI systems.
- Difficulty operationalizing research-grade ideas from AI and cognitive science in production workflows.

DiscoFlow addresses this by combining an n8n-native node package with deterministic contributor tooling and a clear architecture for growth.

## Strategic Objectives

- Build high-coverage, production-usable Discourse automation primitives in n8n.
- Make local development and testing reproducible for all contributors.
- Support practical integrations with state-of-the-art AI tooling, including LLM-based workflows.
- Incorporate concepts from AI as a scientific field and from cognitive science when they improve real community outcomes.
- Continuously align and interoperate with Discourse's core AI capabilities.

## Current Scope (Today)

DiscoFlow currently centers on one package:

- `packages/n8n-nodes-discourse` providing the **Discourse Extended** n8n community node.

Current supported resources include:

- `AI Artifact`
- `AI Artifact Storage`
- `Category`
- `Personal Message`
- `Post`
- `Topic`
- `Upload`
- `Data Explorer`

Full feature and operation details:

- [`packages/n8n-nodes-discourse/README.md`](packages/n8n-nodes-discourse/README.md)

## Long-Term Direction

DiscoFlow is intentionally structured as a multi-component system over time. The node package is phase one.

Future components may include:

- Higher-level orchestration services around Discourse workflows.
- Cognitive pipelines for moderation, synthesis, memory, and retrieval.
- Evaluation and feedback loops to measure real community impact.
- Research-to-production adapters for experimentally grounded AI/cognitive methods.

## Alignment with Discourse AI

DiscoFlow is designed to complement, not compete with, Discourse core AI functionality.

Project posture:

- Track Discourse AI feature evolution continuously.
- Integrate with Discourse AI capabilities where it improves user/admin outcomes.
- Keep external automation and cognition layers interoperable with core platform behavior.

## Architecture Overview

Repository structure:

- `packages/n8n-nodes-discourse`
  TypeScript n8n community node package (`Discourse Extended`).
- `src/discoflow_cli`
  Python Typer CLI used as the primary contributor interface.
- `scripts/dev-setup.sh`
  One-time bootstrap script for contributors.
- `scripts/sync-creator-portal-mirror.mjs`
  Generates and validates root-level TypeScript mirror files used by n8n Creator Portal repository checks.
- `docs/local-dev.md`
  Canonical local setup and testing runbook.
- `discourse-extended-skills.csv`
  Skill catalog seed file (one row per Discourse Extended action) for n8n Data Table imports/sync workflows.
- `.github/workflows/ci.yml`
  CI checks for Python tooling and node package quality.

Local development lifecycle:

1. `./scripts/dev-setup.sh`
2. `uv run --no-editable discoflow bootstrap` (handled by setup script)
3. `uv run --no-editable discoflow start`
4. `uv run --no-editable discoflow watch`
5. Validate behavior in n8n at `http://localhost:5678`

## Creator Portal Compatibility Mirror

DiscoFlow keeps node source-of-truth in the monorepo package directory:

- `packages/n8n-nodes-discourse/credentials/*.credentials.ts`
- `packages/n8n-nodes-discourse/nodes/**/*.node.ts`

To satisfy n8n Creator Portal repository verification checks, we also maintain a generated root-level mirror:

- `credentials/*.credentials.ts`
- `nodes/**/*.node.ts`

Mirror workflow:

```bash
npm --prefix packages/n8n-nodes-discourse run mirror:sync
npm --prefix packages/n8n-nodes-discourse run mirror:check
```

Rules:

- Do not hand-edit mirrored root files.
- Treat `packages/n8n-nodes-discourse/**` as the only source of truth.
- After credential/base-node source changes (or `package.json` `n8n.credentials` / `n8n.nodes` changes), run `mirror:sync`.
- `mirror:check` must pass before publish/PR.

## Contributor Quick Start

From repository root:

```bash
./scripts/dev-setup.sh
```

Canonical command form is `uv run --no-editable discoflow ...`.
This avoids editable `.pth` import edge cases seen on some macOS environments.
`UV_NO_EDITABLE=1` remains a valid shell-level fallback when needed.

If you run commands from outside repo root, set:

```bash
export DISCOFLOW_REPO_ROOT="/absolute/path/to/DiscoFlow"
```

Daily workflow:

```bash
uv run --no-editable discoflow start
uv run --no-editable discoflow watch
```

For node description/UI metadata changes:

```bash
uv run --no-editable discoflow ui-refresh
```

Diagnostics:

```bash
uv run --no-editable discoflow doctor
uv run --no-editable discoflow status
```

Managed logs:

- `.tmp/dev/n8n.log`
- `.tmp/dev/watch.log`

Follow logs:

```bash
uv run --no-editable discoflow logs n8n --follow
uv run --no-editable discoflow logs watch --follow
```

## Development Standards

- Use `uv run --no-editable discoflow ...` as the primary local interface.
- Do not rely on `UV_NO_EDITABLE` exports alone; prefer explicit `--no-editable` command usage.
- Run commands from repository root.
- Keep documentation synchronized with behavior changes.
- CI enforces node README parity for selected high-risk operation details; keep docs and implementation in the same change.
- Keep Creator Portal mirror files synchronized by running `mirror:sync` after credential/base-node source changes.
- If Discourse node functionality changes, update:
  - `packages/n8n-nodes-discourse/README.md`
  - `discourse-extended-skills.csv` (maintain exactly one row per `resource.operation` action key)
  - `docs/local-dev.md` if setup/test behavior changes

## Documentation Map (Single Source of Truth Model)

- Root `README.md` (this file): admin onboarding, mission, vision, architecture, contributor orientation.
- [`docs/local-dev.md`](docs/local-dev.md): operational local setup/testing workflow.
- [`packages/n8n-nodes-discourse/README.md`](packages/n8n-nodes-discourse/README.md): node functionality, credentials, operations, API behavior.
- [`discourse-extended-skills.csv`](discourse-extended-skills.csv): skill catalog dataset aligned 1:1 with Discourse Extended action keys.
- [`CONTRIBUTING.md`](CONTRIBUTING.md#version-bumping-playbook-multi-artifact-repo): canonical version-bumping policy for npm package, CLI, and repo-only changes.
- [`CONTRIBUTING.md`](CONTRIBUTING.md#package-release-runbook-n8n-nodes-discourse): canonical package release runbook (mirror checks, npm publish, git tags).

## Quality Gates

Python tooling:

```bash
UV_NO_EDITABLE=1 uv sync --dev --reinstall-package discoflow-cli
uv run --no-editable pytest
```

Node package:

```bash
cd packages/n8n-nodes-discourse
npm run lint
npm run build
npm run mirror:check
```

Documentation parity (enforced in CI):

```bash
grep -Fq 'Supports `Return All`, `Limit`, `Before`, `Page`, optional ordering fields (`Order`, `Ascending`, `Desc`), and `Simplify`.' packages/n8n-nodes-discourse/README.md
grep -Fq 'optional additional fields: `Auto Track`, `Created At`, `Embed URL`, and `External ID`.' packages/n8n-nodes-discourse/README.md
grep -Fq -- '- `Create`: creates a storage key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.' packages/n8n-nodes-discourse/README.md
grep -Fq -- '- `Update`: updates a storage key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.' packages/n8n-nodes-discourse/README.md
```

## License

DiscoFlow is released under the MIT License. See [`LICENSE.md`](LICENSE.md).
