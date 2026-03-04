# Contributing to DiscoFlow

DiscoFlow uses a Python Typer CLI as the primary contributor interface.

## First-Time Setup

Run from repository root:

```bash
./scripts/dev-setup.sh
```

`dev-setup.sh` enforces `UV_NO_EDITABLE=1` so the Python `discoflow` CLI installs in non-editable mode by default.
Daily commands should still use explicit `--no-editable` to avoid editable `.pth` import edge cases.

If you run sync manually, use:

```bash
UV_NO_EDITABLE=1 uv sync --dev --reinstall-package discoflow-cli
```

Before running manual `uv run --no-editable discoflow ...` commands from outside repo root, export:

```bash
export DISCOFLOW_REPO_ROOT="/absolute/path/to/DiscoFlow"
```

Run all `uv run --no-editable discoflow ...` commands from repository root.

## Daily Development Commands

```bash
uv run --no-editable discoflow doctor
uv run --no-editable discoflow start
uv run --no-editable discoflow watch
uv run --no-editable discoflow status
```

Inspect managed process output with `uv run --no-editable discoflow logs n8n --follow` or `uv run --no-editable discoflow logs watch --follow`.

## Canonical Contributor Runbook

- [docs/local-dev.md](docs/local-dev.md)

## Node Package Implementation Docs

- [packages/n8n-nodes-discourse/README.md](packages/n8n-nodes-discourse/README.md)

## Creator Portal Verification Mirror

To support n8n Creator Portal repository checks while keeping this repo as a monorepo, DiscoFlow maintains a root-level mirror of the Discourse node base/credential TypeScript files.

Source of truth remains under:

- `packages/n8n-nodes-discourse/credentials/*.credentials.ts`
- `packages/n8n-nodes-discourse/nodes/**/*.node.ts`

Mirrored output is generated at repo root (for example):

- `credentials/*.credentials.ts`
- `nodes/**/*.node.ts`

Mirror maintenance commands (run from repo root):

```bash
npm --prefix packages/n8n-nodes-discourse run mirror:sync
npm --prefix packages/n8n-nodes-discourse run mirror:check
```

Rules:

- Do not hand-edit mirrored root files.
- Always run `mirror:sync` after changing credential/base-node source files or changing `n8n.credentials` / `n8n.nodes` in package.json.
- `mirror:check` must pass before publishing or opening a PR.

## Documentation Consistency Checklist

- Root [README.md](README.md) quality-gate commands must match `.github/workflows/ci.yml`.
- CI includes an inline node README parity check; contributors should run the same grep checks locally before opening a PR.
- [docs/local-dev.md](docs/local-dev.md) is the canonical contributor workflow; package docs must not conflict with it.
- If Discourse node resources/operations/credentials change, update [packages/n8n-nodes-discourse/README.md](packages/n8n-nodes-discourse/README.md) and [`discourse-extended-skills.csv`](discourse-extended-skills.csv) in the same change.
- For Discourse Extended action-surface changes, keep node code, package README, and skills CSV aligned in one PR.
- The skills catalog CSV must keep exactly one row per Discourse Extended action key using `resource.operation` format from `packages/n8n-nodes-discourse/nodes/Discourse/actions/*/index.ts`.
- If AI Artifact Storage CRUD or guardrail semantics change, update both package docs and README parity grep assertions in CI/docs.
- If setup, process-management, or troubleshooting behavior changes, update [docs/local-dev.md](docs/local-dev.md) in the same change.
- Keep Creator Portal mirror files in sync: run `npm --prefix packages/n8n-nodes-discourse run mirror:sync` when credential/base-node source files or package `n8n` paths change.

Run the same parity checks CI enforces:

```bash
grep -Fq 'Supports `Return All`, `Limit`, `Before`, `Page`, optional ordering fields (`Order`, `Ascending`, `Desc`), and `Simplify`.' packages/n8n-nodes-discourse/README.md
grep -Fq 'optional additional fields: `Auto Track`, `Created At`, `Embed URL`, and `External ID`.' packages/n8n-nodes-discourse/README.md
grep -Fq -- '- `Create`: creates a storage key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.' packages/n8n-nodes-discourse/README.md
grep -Fq -- '- `Update`: updates a storage key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.' packages/n8n-nodes-discourse/README.md
npm --prefix packages/n8n-nodes-discourse run mirror:check
```

Manual skills CSV parity check (no helper script file):

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let i = 0;
	let inQuotes = false;

	while (i < text.length) {
		const c = text[i];

		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}

		if (c === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (c === ',') {
			row.push(field);
			field = '';
			i++;
			continue;
		}
		if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			i++;
			continue;
		}
		if (c === '\r') {
			i++;
			continue;
		}
		field += c;
		i++;
	}

	if (field.length || row.length) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

const actionsRoot = 'packages/n8n-nodes-discourse/nodes/Discourse/actions';
const actionKeys = [];

for (const entry of fs.readdirSync(actionsRoot)) {
	const indexPath = path.join(actionsRoot, entry, 'index.ts');
	if (!fs.existsSync(indexPath)) continue;

	const source = fs.readFileSync(indexPath, 'utf8');
	const resource = (source.match(/resource\s*=\s*'([^']+)'/) || [])[1] ?? entry;
	const optionsBlock = source.match(/options:\s*\[(.*?)\]\s*,\s*default:/s);
	if (!optionsBlock) continue;

	for (const match of optionsBlock[1].matchAll(/value:\s*'([^']+)'/g)) {
		actionKeys.push(`${resource}.${match[1]}`);
	}
}

const csvRows = parseCsv(fs.readFileSync('discourse-extended-skills.csv', 'utf8'));
const header = csvRows[0] ?? [];
const skillKeyIndex = header.indexOf('skill_key');

if (skillKeyIndex === -1) {
	console.error('CSV missing skill_key column');
	process.exit(1);
}

const skillKeys = csvRows
	.slice(1)
	.map((row) => row[skillKeyIndex])
	.filter(Boolean);

const actionSet = new Set(actionKeys);
const skillSet = new Set(skillKeys);
const missingInCsv = actionKeys.filter((key) => !skillSet.has(key));
const extraInCsv = skillKeys.filter((key) => !actionSet.has(key));

if (missingInCsv.length || extraInCsv.length) {
	console.error('CSV/action key mismatch detected.');
	if (missingInCsv.length) console.error('Missing in CSV:', missingInCsv.join(', '));
	if (extraInCsv.length) console.error('Extra in CSV:', extraInCsv.join(', '));
	process.exit(1);
}

console.log(`CSV/action key parity OK (${actionSet.size} keys).`);
NODE
```
