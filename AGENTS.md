Always use the n8nDocs MCP server to search documentation, read node properties, and check n8n architectural standards whenever I ask you to build or troubleshoot n8n custom nodes. Do this automatically without me having to explicitly ask.

When working with the Discourse JSON REST API, use your web search tool to search the offical Discourse docs (https://docs.discourse.org), the Discourse community (https://meta.discourse.org), or Discourse's open-source GitHub repo.

The node package README at `packages/n8n-nodes-discourse/README.md` must always be up-to-date. Whenever functionality is added, removed, or changed in the Discourse node, update that README accordingly. It must contain a complete feature description for the node (an explanation of each feature/functionality it has).

The skills catalog CSV at `discourse-extended-skills.csv` is required documentation and must stay in sync with the Discourse Extended action surface. Whenever a node action is added, removed, renamed, or behaviorally changed, update this CSV in the same change.

The CSV must maintain exactly one row per Discourse Extended action key using the `resource.operation` convention from `packages/n8n-nodes-discourse/nodes/Discourse/actions/*/index.ts` (for example `topic.search`).

The Creator Portal compatibility mirror is required documentation and packaging infrastructure. Keep repository-root mirrored files (for example `credentials/*.credentials.ts` and `nodes/**/*.node.ts`) in sync with package sources under `packages/n8n-nodes-discourse/**` by running `npm --prefix packages/n8n-nodes-discourse run mirror:sync`.

Never hand-edit mirrored root files. They are generated artifacts and must only be updated via `scripts/sync-creator-portal-mirror.mjs`.

Whenever `packages/n8n-nodes-discourse/package.json` `n8n.credentials` or `n8n.nodes` entries change, update and verify the mirror in the same change.
