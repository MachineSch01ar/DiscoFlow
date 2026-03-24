---
name: verify-discoflow-change
description: Run the correct verification stack near the end of a DiscoFlow task. Use when implementation is mostly done and you need the right checks for the touched surface before handoff; not for initial exploration, release tagging, or choosing implementation strategy.
---

# Verify DiscoFlow Change

## Use this skill when

- The task is near handoff and needs validation.
- You know which repo surface changed and need the matching checks.
- You need to summarize what was verified and what could not be run.

## Verification matrix

### Discourse Extended node changes

Run from repo root:

- `npm --prefix packages/n8n-nodes-discourse run lint`
- `npm --prefix packages/n8n-nodes-discourse run build`
- `npm --prefix packages/n8n-nodes-discourse run mirror:check`
- `npm --prefix packages/n8n-nodes-discourse run skills:check`

If the change touches README parity-sensitive node behavior, also run:

- `grep -Fq 'Supports \`Return All\`, \`Limit\`, \`Before\`, \`Page\`, optional ordering fields (\`Order\`, \`Ascending\`, \`Desc\`), and \`Simplify\`.' packages/n8n-nodes-discourse/README.md`
- `grep -Fq 'optional additional fields: \`Auto Track\`, \`Created At\`, \`Embed URL\`, and \`External ID\`.' packages/n8n-nodes-discourse/README.md`
- `grep -Fq -- '- \`Create\`: creates a storage key via \`POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}\`.' packages/n8n-nodes-discourse/README.md`
- `grep -Fq -- '- \`Update\`: updates a storage key via \`POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}\`.' packages/n8n-nodes-discourse/README.md`

### CLI changes

Run the repo's Python tests:

- `uv run --no-editable pytest`

### Theme component changes

- Validate that component `README.md`, `about.json`, locales, and install notes still match the shipped behavior.
- Run any component-specific checks that exist for the touched component.
- If no automated check exists, say so explicitly and report the manual consistency checks you performed.

## Reporting

- Report exactly which checks ran.
- Report failures clearly.
- If a check was skipped because tooling or scope did not require it, say why.
