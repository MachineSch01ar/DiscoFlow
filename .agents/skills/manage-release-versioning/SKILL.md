---
name: manage-release-versioning
description: Handle publish, release, tag, and version-bump tasks for DiscoFlow artifacts. Use only when the task is specifically about releasing, publishing, tagging, or choosing a version bump; not for ordinary feature implementation, docs-only edits, or final verification-only handoff.
---

# Manage Release Versioning

## Use this skill when

- The task asks for a publish or release flow.
- The task asks whether to bump a version.
- The task asks for release tags or packaging guidance for a specific DiscoFlow artifact.

## Versioning rules

- DiscoFlow is a multi-artifact repo. Do not assume one global version.
- Bump `packages/n8n-nodes-discourse/package.json` only when cutting an npm package release.
- Bump `pyproject.toml` only when cutting a `discoflow-cli` release.
- For repo-only docs, process, workflow, or catalog changes, do not bump package versions by default.
- If a substantial non-package repo milestone needs marking, use `discoflow-repo-milestone-YYYYMMDD-<short-slug>`.

## n8n node release workflow

- Preferred release command:
  - `npm --prefix packages/n8n-nodes-discourse run release`
- Manual guarded fallback from `packages/n8n-nodes-discourse`:
  - `RELEASE_MODE=true npm publish --access public`
- `prepublishOnly` already enforces `npm run mirror:check` and `n8n-node prerelease`.
- Package release tags use `n8n-nodes-discourse-vX.Y.Z`.

## Guardrails

- Keep `CONTRIBUTING.md` aligned with the real release scripts and guardrails whenever they change.
- If release work changes `n8n.credentials` or `n8n.nodes`, sync and verify the Creator Portal mirror in the same change.
- Do not trigger this skill for ordinary coding work unless the task explicitly shifts into release/versioning decisions.
