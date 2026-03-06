Always use the n8nDocs MCP server to search documentation, read node properties, and check n8n architectural standards whenever I ask you to build or troubleshoot n8n custom nodes. Do this automatically without me having to explicitly ask.

When working with the Discourse JSON REST API, use your web search tool to search the offical Discourse docs (https://docs.discourse.org), the Discourse community (https://meta.discourse.org), or Discourse's open-source GitHub repo.

The node package README at `packages/n8n-nodes-discourse/README.md` must always be up-to-date. Whenever functionality is added, removed, or changed in the Discourse node, update that README accordingly. It must contain a complete feature description for the node (an explanation of each feature/functionality it has).

The skills catalog CSV at `discourse-extended-skills.csv` is required documentation and must stay in sync with the Discourse Extended action surface. Whenever a node action is added, removed, renamed, or behaviorally changed, update this CSV in the same change.

The CSV must maintain exactly one row per Discourse Extended action key using the `resource.operation` convention from `packages/n8n-nodes-discourse/nodes/Discourse/actions/*/index.ts` (for example `topic.search`).

The Creator Portal compatibility mirror is required documentation and packaging infrastructure. Keep repository-root mirrored files (for example `credentials/*.credentials.ts` and `nodes/**/*.node.ts`) in sync with package sources under `packages/n8n-nodes-discourse/**` by running `npm --prefix packages/n8n-nodes-discourse run mirror:sync`.

Never hand-edit mirrored root files. They are generated artifacts and must only be updated via `scripts/sync-creator-portal-mirror.mjs`.

Whenever `packages/n8n-nodes-discourse/package.json` `n8n.credentials` or `n8n.nodes` entries change, update and verify the mirror in the same change.

Discourse node package release guardrails are mandatory: `packages/n8n-nodes-discourse/package.json` `prepublishOnly` runs `npm run mirror:check` and `n8n-node prerelease`, so direct `npm publish` is blocked unless `RELEASE_MODE=true` is set.

Preferred release command is `npm --prefix packages/n8n-nodes-discourse run release`. Manual fallback for guided releases is `RELEASE_MODE=true npm publish --access public` from `packages/n8n-nodes-discourse`.

When creating package release tags, use `n8n-nodes-discourse-vX.Y.Z`. Keep `CONTRIBUTING.md` release instructions synchronized with actual scripts and publish guardrails.

DiscoFlow is a multi-artifact repository. Do not assume one global version must be bumped on every change.

Versioning decisions are commit-by-commit:

- Bump `packages/n8n-nodes-discourse/package.json` version only when cutting an npm package release.
- Bump `pyproject.toml` `project.version` only when cutting a `discoflow-cli` release.
- For repo-only changes (for example docs, `discourse-extended-skills.csv`, workflow JSON assets), no package version bump is required by default.

If a non-package repo change is substantial and should be marked, use an optional repository milestone tag format: `discoflow-repo-milestone-YYYYMMDD-<short-slug>`.

npm package and CLI versions do not need to match. Keep `CONTRIBUTING.md` versioning playbook synchronized with this policy.
