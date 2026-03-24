---
name: sync-discourse-node-docs
description: Update Discourse Extended documentation when node actions, resources, credentials, parameter surfaces, or user-visible behavior change. Use after or alongside node implementation work that changes the action surface or docs-visible behavior; not for component-only work, routine refactors with no behavior impact, or release-only tasks.
---

# Sync Discourse Node Docs

## Use this skill when

- A Discourse Extended action is added, removed, renamed, or behaviorally changed.
- A resource, credential, or parameter surface changes in a way users need documented.
- A mirror-affecting package metadata change also needs package docs and contributor guidance kept in sync.

## Required updates

- Update `packages/n8n-nodes-discourse/README.md` so it remains a complete feature description of the node package.
- Update `discourse-extended-skills.csv` in the same change whenever the Discourse Extended action surface changes.
- Keep exactly one CSV row per action key using the `resource.operation` convention from `packages/n8n-nodes-discourse/nodes/Discourse/actions/*/index.ts`.
- If release guardrails, mirror scripts, or contributor workflows change, update `CONTRIBUTING.md` in the same change.

## Workflow

1. Inspect the action keys in `packages/n8n-nodes-discourse/nodes/Discourse/actions/*/index.ts`.
2. If a new action needs a CSV row, start from:
   - `npm --prefix packages/n8n-nodes-discourse run skills:scaffold -- <resource.operation>`
3. Validate documentation parity with:
   - `npm --prefix packages/n8n-nodes-discourse run skills:check`
4. If `packages/n8n-nodes-discourse/package.json` changes `n8n.credentials` or `n8n.nodes`, run:
   - `npm --prefix packages/n8n-nodes-discourse run mirror:sync`
   - `npm --prefix packages/n8n-nodes-discourse run mirror:check`

## Guardrails

- Treat README and CSV updates as part of the feature, not follow-up cleanup.
- Preserve the current CSV schema and header order.
- Keep docs changes specific to the real action surface; do not invent undocumented capabilities.
