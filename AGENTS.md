## Repo Overview

DiscoFlow is a multi-artifact repository with three active surfaces:

- `packages/n8n-nodes-discourse` for the `Discourse Extended` n8n node package
- `components/<slug>/` for Discourse theme components
- `src/discoflow_cli` for the contributor CLI

Codex-only reusable workflows live in `.agents/skills/`. Keep this file small and use the repo skills for detailed procedures.

## Mandatory Skill Usage

Use the matching root skill whenever the task fits:

- `build-discourse-node` for work in `packages/n8n-nodes-discourse`, `nodes/`, or `credentials/`
- `sync-discourse-node-docs` when Discourse node actions, resources, credentials, or behavior change
- `maintain-theme-component` for any work under `components/*`
- `manage-release-versioning` for publish, release, tag, or version-bump tasks
- `verify-discoflow-change` near handoff to choose the correct verification stack

These Codex skills are separate from `discourse-extended-skills.csv`, which is product documentation for the Discourse Extended action surface.

## Always-True Invariants

- Always use the `n8nDocs` MCP server first for n8n custom node implementation or troubleshooting.
- For Discourse API or theme-component behavior, research official Discourse docs, Meta topics, and core GitHub sources instead of relying on memory.
- Treat `packages/n8n-nodes-discourse/**` as the source of truth for the node package. Never hand-edit mirrored root files under `credentials/` or `nodes/`; update them only via `npm --prefix packages/n8n-nodes-discourse run mirror:sync`.
- Keep `packages/n8n-nodes-discourse/README.md` and `discourse-extended-skills.csv` in sync with Discourse Extended action-surface changes. The CSV must keep exactly one row per `resource.operation` action key.
- Treat `components/<slug>/` as the source of truth for each theme component. When component behavior, install requirements, UI behavior, or user-facing functionality changes, update that component's `README.md`, `about.json`, relevant `locales/*.yml`, and related install notes in the same change.
- Versioning is artifact-specific. Bump `packages/n8n-nodes-discourse/package.json` only for npm package releases, bump `pyproject.toml` only for CLI releases, and usually skip version bumps for repo-only docs/process/workflow changes.

## Verify and Release Reminders

- Prefer the active skill's workflow over ad hoc checklists; keep `CONTRIBUTING.md` aligned with real scripts, guardrails, and release steps whenever they change.
- Preferred n8n node release command: `npm --prefix packages/n8n-nodes-discourse run release`.
- Manual npm publish fallback: `RELEASE_MODE=true npm publish --access public` from `packages/n8n-nodes-discourse`.
- Package release tags use `n8n-nodes-discourse-vX.Y.Z`. Substantial repo-only milestones may use `discoflow-repo-milestone-YYYYMMDD-<short-slug>`.
