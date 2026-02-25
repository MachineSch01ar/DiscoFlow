# @dylanwardlow/n8n-nodes-discourse

n8n community node package for managing Discourse topics and uploads, including presigned object storage workflows.

This package is currently optimized for private/internal use.

## Included Node

- **Discourse Extended** (`discourseExtended`)
  - **Resource: Topic**
    - `Create`
    - `Delete`
    - `Get`
    - `Get Many (Latest)`
    - `Get Many (Top)`
    - `Search`
    - `Set Status`
    - `Update`
  - **Resource: Upload**
    - `Create`
    - `Create From Source URL`
    - `Upload to Object Storage`

Node naming note: this package uses `Discourse Extended` to avoid confusion with n8n's built-in Discourse node.

## Installation

Community nodes install from npm is for self-hosted n8n. Unverified npm community packages are not available the same way on n8n Cloud.

### Option A: Local development/private package via `npm link`

From this repository:

```bash
npm install
npm run build
npm link
```

In your n8n custom extensions folder:

```bash
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y # only if package.json does not exist
npm link @dylanwardlow/n8n-nodes-discourse
```

Restart n8n and search for the node name `Discourse Extended` in the node picker.

### Option B: Install from npm in n8n UI

If published to npm, install from **Settings > Community Nodes > Install** using package name:

```bash
@dylanwardlow/n8n-nodes-discourse
```

You can pin a published version when needed:

```bash
@dylanwardlow/n8n-nodes-discourse@0.1.0
```

### Option C: Manual install in Docker/queue mode/private registries

Inside the n8n environment (for example, Docker shell), install the package in the node extensions directory and restart n8n:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm i @dylanwardlow/n8n-nodes-discourse
```

If you use a non-default custom extensions path, configure `N8N_CUSTOM_EXTENSIONS`.

## Credentials

- **Discourse API** (`discourseApi`)
  - `Base URL` (example: `https://forum.example.com`)
  - `API Key`
  - `API Username`

Auth headers sent on requests:

- `Api-Key`
- `Api-Username`

Credential test endpoint: `GET /latest.json?per_page=1`

## Operations

### Topic

- `Create`: creates topic via `POST /posts.json` with `title`, `raw`, optional `category` and additional fields.
- `Delete`: deletes topic via `DELETE /t/{id}.json`; returns `{ deleted: true }`.
- `Get`: fetches topic via `GET /t/{id}.json`; supports simplify output.
- `Get Many (Latest)`: uses `GET /latest.json`; supports `Return All`, `Limit`, ordering fields, and simplify output.
- `Get Many (Top)`: uses `GET /top.json`; supports `Period`, `Return All`, `Limit`, and simplify output.
- `Search`: uses `GET /search.json` with `q`; supports paging and simplify output.
- `Set Status`: updates topic status via `PUT /t/{id}/status.json` with status + enabled flag and optional `until` for pinned status.
- `Update`: updates topic via `PUT /t/-/{id}.json` using `topic.title` and/or `topic.category_id`.

For topic selectors, ID and full topic URL are both supported through an n8n resource locator field.

### Upload

- `Create`: uploads n8n binary data directly to Discourse via multipart `POST /uploads.json`.
  - Supports `Type`, `Synchronous`, `User ID` (required for avatar), `Additional Fields`, and `Simplify`.
- `Create From Source URL`: downloads source file from URL, then uploads it to Discourse via `POST /uploads.json`.
  - Source URL must be public or presigned and unexpired.
  - Supports filename override, upload type, avatar user ID, additional fields, and simplify.
- `Upload to Object Storage`: uploads n8n binary data to a presigned `PUT` URL.
  - Compatible with S3-style presigned URLs, including DigitalOcean Spaces.
  - Supports optional content type override and metadata output.

## Usage Patterns

### Pattern: S3/Spaces object URL into Discourse upload

1. Generate a presigned or public object URL for a file.
2. In n8n, use `Discourse Extended -> Upload -> Create From Source URL`.
3. Set `Source URL` to that object URL.
4. Optional: set `Original Filename`, `Type`, and `Synchronous`.

### Pattern: n8n binary to DigitalOcean Spaces

1. Generate a presigned `PUT` URL for your Spaces object key.
2. In n8n, use `Discourse Extended -> Upload -> Upload to Object Storage`.
3. Map `Input Data Field Name` to your binary field (default `data`).
4. Set `Presigned PUT URL` and optional `Content Type`.

## Compatibility

- Uses n8n nodes API version `1` (`package.json -> n8n.n8nNodesApiVersion`).
- Intended for self-hosted n8n with community packages enabled.
- Install/load behavior can be affected by:
  - `N8N_COMMUNITY_PACKAGES_ENABLED`
  - `N8N_COMMUNITY_PACKAGES_PREVENT_LOADING`
  - `N8N_CUSTOM_EXTENSIONS`

## Troubleshooting

- **Node not visible after install**
  - Restart n8n.
  - Verify you searched for node name `Discourse Extended` (not npm package name).
  - Confirm community packages are enabled in your n8n environment variables.
- **`Create` upload fails with missing binary**
  - Confirm the binary field exists and `Input Data Field Name` matches it.
- **`Create`/`Create From Source URL` avatar upload fails**
  - Provide `User ID` when `Type = Avatar`.
- **`Create From Source URL` fails**
  - Confirm URL is accessible and not expired.
- **`Upload to Object Storage` fails**
  - Confirm URL is presigned for `PUT`, not expired, and signed headers match request headers.

## Implemented So Far

- Added `Upload -> Create From Source URL`.
- Added `Upload -> Upload to Object Storage` for presigned `PUT` uploads.
- Added support for S3-compatible presigned workflows (including DigitalOcean Spaces).
- Kept existing `Upload -> Create` for direct multipart upload to Discourse.
- Topic operations continue to support ID/URL selectors and simplified outputs where applicable.

## Release Policy

- This project has not yet had a public production release.
- The first public GitHub release will be `v0.1.0`.
- Semantic versioning cadence starts after `v0.1.0`.

## Docs Maintenance Checklist

During development and release prep:

- Verify operation list in README matches:
  - `nodes/Discourse/actions/topic/index.ts`
  - `nodes/Discourse/actions/upload/index.ts`
- Verify endpoint references still exist in Discourse OpenAPI.
- Verify install instructions still match current n8n docs.
- Once public releases begin, keep changelog entries aligned with published release tags.

## Development

```bash
npm install
npm run lint
npm run build
npm run dev
```

## Resources

- n8n community node installation:
  - https://docs.n8n.io/integrations/community-nodes/installation/
- n8n manual install:
  - https://docs.n8n.io/integrations/community-nodes/installation/manual-install/
- n8n nodes environment variables:
  - https://docs.n8n.io/hosting/configuration/environment-variables/nodes/
- n8n custom extensions location:
  - https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/
- n8n built-in Discourse node docs:
  - https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.discourse/
- Discourse API docs:
  - https://docs.discourse.org/
  - https://raw.githubusercontent.com/discourse/discourse_api_docs/main/openapi.json
- DigitalOcean Spaces API reference:
  - https://docs.digitalocean.com/reference/api/spaces/
