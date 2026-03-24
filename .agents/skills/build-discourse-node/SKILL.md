---
name: build-discourse-node
description: Build, modify, or troubleshoot the Discourse Extended n8n node when work touches packages/n8n-nodes-discourse, repo-root mirrored nodes/credentials files, or Discourse API-backed node behavior. Use for resource, operation, transport, credential, and node implementation work; not for release-only tasks or final verification-only handoff.
---

# Build Discourse Node

## Use this skill when

- The task changes code under `packages/n8n-nodes-discourse/**`.
- The prompt mentions `Discourse Extended`, new node operations, credentials, transport, or node UI metadata.
- The task points at repo-root `nodes/**` or `credentials/**`; those are mirrored outputs, so trace the source change back to the package first.

## Research workflow

1. Use the `n8nDocs` MCP server first for n8n architecture, node properties, parameter conventions, and custom-node standards.
2. If the task depends on Discourse API behavior, research official Discourse sources before implementing:
   - `https://docs.discourse.org`
   - `https://meta.discourse.org`
   - Discourse core on GitHub
3. Prefer official examples and current platform behavior over memory when endpoint semantics or payload shapes are unclear.

## Implementation guardrails

- Treat `packages/n8n-nodes-discourse/**` as the source of truth.
- Never hand-edit mirrored repo-root files under `credentials/` or `nodes/`.
- If a task appears to require changing a mirrored root file, make the change in the package source and then sync the mirror.
- If `packages/n8n-nodes-discourse/package.json` changes `n8n.credentials` or `n8n.nodes`, update the mirror in the same change.
- If node behavior, actions, resources, or credentials change, also use `$sync-discourse-node-docs` so docs stay aligned.

## Done when

- The package source reflects the intended node behavior.
- Any mirror-affecting change is followed by `npm --prefix packages/n8n-nodes-discourse run mirror:sync`.
- Any action-surface or behavior change is paired with the required README and CSV updates through `$sync-discourse-node-docs`.
