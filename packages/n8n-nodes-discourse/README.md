# @machinesch01ar/n8n-nodes-discourse

n8n community node package for managing Discourse AI artifacts, categories, posts, topics, personal messages, uploads, and Data Explorer queries, including presigned object storage workflows.

This package is currently optimized for private/internal use.

## Included Node

- **Discourse Extended** (`discourseExtended`)
  - **Resource: AI Artifact**
    - `Create`
    - `Delete`
    - `Get`
    - `Get Many`
    - `Update`
  - **Resource: AI Artifact Storage**
    - `Create`
    - `Delete`
    - `Get`
    - `Get Many`
    - `Set`
    - `Update`
  - **Resource: Category**
    - `Create`
    - `Delete`
    - `Get`
    - `Get Many`
    - `Update`
  - **Resource: Personal Message**
    - `Add Participant`
    - `Add Participants (Batch)`
    - `Create`
    - `Get Many (Inbox)`
    - `Get Many (Sent)`
    - `Invite Group`
    - `Remove Participant`
    - `Reply`
  - **Resource: Post**
    - `Bookmark`
    - `Create`
    - `Delete`
    - `Generate TTS Audio`
    - `Generate TTS Audio + Spaces Upload`
    - `Get`
    - `Get Many (All Posts)`
    - `Get Many (Topic)`
    - `Get Many (User)`
    - `Get Revision (Latest)`
    - `Get Revision (Version)`
    - `Like`
    - `Prepare for TTS`
    - `Recover`
    - `Unbookmark`
    - `Unlike`
    - `Update`
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
  - **Resource: Data Explorer**
    - `Create`
    - `Delete`
    - `Get`
    - `Get Many`
    - `Run`
    - `Update`

Node naming note: this package uses `Discourse Extended` to avoid confusion with n8n's built-in Discourse node.

Node capability note: `Discourse Extended` is marked `usableAsTool: true` in node metadata, so it can be used in n8n tool-capable workflow contexts.

## Skills Catalog CSV

This repository includes a skills catalog seed file at:

- [`../../discourse-extended-skills.csv`](../../discourse-extended-skills.csv)

The CSV is designed for workflows that import/sync skill rows into n8n Data Tables (for example, a table named `Discourse Extended Skills`), with progressive disclosure patterns such as:

- `List skill catalog` (metadata-only pass)
- `Load skill` (full skill payload by `skill_key`)

CSV schema (column order):

- `skill_key`
- `enabled`
- `scope`
- `name`
- `description_short`
- `catalog_line`
- `tags_json`
- `instructions_md`
- `resources_json`
- `version`
- `source_sha`
- `updated_at`

Maintenance requirement:

- Keep this CSV in sync with the action surface in `nodes/Discourse/actions/*/index.ts`.
- Maintain exactly one CSV row per action key using `resource.operation` format (for example, `topic.search`).
- Whenever an action is added, removed, renamed, or behaviorally changed, update this CSV in the same change as the node code and README updates.
- `instructions_md` is agent-facing documentation and must:
  - start at heading level `##` and never use `#`
  - include `## What This Tool Does`, `## Parameters`, `## How To Think About This Tool`, `## Examples`, and `## Output, Failure Modes, And Guardrails`
  - document all exposed node inputs for the action, including nested collection fields, conditional inputs, output toggles, and concrete usage/decision examples

Validation and scaffolding:

```bash
npm --prefix packages/n8n-nodes-discourse run skills:check
npm --prefix packages/n8n-nodes-discourse run skills:scaffold -- topic.search
```

## Installation

Community-node install behavior depends on package verification and deployment type:

- Unverified npm community packages install from npm on self-hosted n8n.
- Verified community nodes can be installed from the nodes panel, including supported n8n Cloud instances.

### Option A: Local development/private package via `npm link`

From the package directory (`packages/n8n-nodes-discourse` in this monorepo):

```bash
cd packages/n8n-nodes-discourse
npm install
npm run build
npm link
```

In your n8n custom extensions folder:

```bash
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y # only if package.json does not exist
npm link @machinesch01ar/n8n-nodes-discourse
```

Restart n8n and search for the node name `Discourse Extended` in the node picker.

Contributor runbook:

- [../../docs/local-dev.md](../../docs/local-dev.md) (start with `./scripts/dev-setup.sh`, then use `uv run --no-editable discoflow ...` from repo root)

### Option B: Install from npm in n8n UI (self-hosted)

If published to npm, install from **Settings > Community Nodes > Install** using package name:

```bash
@machinesch01ar/n8n-nodes-discourse
```

You can pin a published version when needed:

```bash
@machinesch01ar/n8n-nodes-discourse@<published-version>
```

For verified-community-node installs from the editor nodes panel, refer to the verified install docs in the resources section.

### Option C: Manual install in Docker/queue mode/private registries

Inside the n8n environment (for example, Docker shell), install the package in the node extensions directory and restart n8n:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm i @machinesch01ar/n8n-nodes-discourse
```

If you use a non-default custom extensions path, configure `N8N_CUSTOM_EXTENSIONS`.

## Credentials

- **Discourse API (Discourse Extended)** (`discourseExtendedApi`)
  - `Base URL` (example: `https://forum.example.com`)
  - `API Key`
  - `API Username`
- **ElevenLabs API** (`elevenLabsApi`) (used by `Post -> Generate TTS Audio` and `Post -> Generate TTS Audio + Spaces Upload`)
  - `API Key`
- **DigitalOcean Spaces API** (`digitalOceanSpacesApi`) (optional, used by `Post -> Generate TTS Audio + Spaces Upload`)
  - `Region` (example: `nyc3`)
  - `Access Key`
  - `Secret Key`

Credential selector visibility in the node editor:

- `Discourse API (Discourse Extended)` credential selector is always shown.
- `ElevenLabs API` credential selector is shown only for `Resource: Post` + `Operation: Generate TTS Audio` or `Generate TTS Audio + Spaces Upload`.
- `DigitalOcean Spaces API` credential selector is shown only for `Resource: Post` + `Operation: Generate TTS Audio + Spaces Upload`.

Auth headers sent on requests:

- `Api-Key`
- `Api-Username`

Credential test endpoint: `GET /latest.json?per_page=1`

Note for scoped artifact keys: keys scoped only to `discourse_ai:manage_artifacts` may fail this credential test (because `/latest.json` is out of scope) while artifact operations can still work.

Credential visibility note for n8n projects/node access:

- Credential dropdown visibility is filtered by credential type compatibility, the current node `Resource` + `Operation`, and credential access within the current project/workspace.
- If a `Discourse API (Discourse Extended)` credential is created from the global **Credentials** tab and does not appear in the `Discourse Extended` node dropdown, edit that credential and ensure it is allowed for the `Discourse Extended` node.
- Creating the credential directly from the `Discourse Extended` node (`Create new credential`) is recommended and usually auto-assigns the correct node access.

## Operations

### AI Artifact

- `Create`: creates an artifact via `POST /admin/plugins/discourse-ai/ai-artifacts.json`.
  - Requires `User ID`, `Post ID or URL`, `Name`, and `HTML`.
  - Supports optional `CSS`, `JavaScript`, and `Metadata JSON`.
  - `Public` toggle always sets/overrides `metadata.public`.
- `Get`: fetches an artifact via `GET /admin/plugins/discourse-ai/ai-artifacts/{id}.json`; supports simplify output.
- `Get Many`: lists artifacts via `GET /admin/plugins/discourse-ai/ai-artifacts.json`.
  - Supports `Return All`, `Limit`, `Page`, `Per Page` (capped at 100 by API), and `Simplify`.
  - Uses API paging metadata (`meta.has_more`) to fetch additional pages when `Return All` is enabled.
- `Update`: updates an artifact via `PUT /admin/plugins/discourse-ai/ai-artifacts/{id}.json`.
  - Supports partial updates for owner/post linkage, source fields (`HTML`, `CSS`, `JavaScript`), `Name`, `Public`, and `Metadata JSON`.
  - `Public` field overrides `metadata.public` when included in `Update Fields`.
  - Requires at least one update field.
- `Delete`: deletes an artifact via `DELETE /admin/plugins/discourse-ai/ai-artifacts/{id}.json`; returns `{ deleted: true }`.

For artifact selectors, ID and artifact URLs are supported through an n8n resource locator field.

### AI Artifact Storage

- `Create`: creates a storage key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.
  - Requires `Key`, `Value`, and artifact scope.
  - Uses strict guardrail checks: fails when key already exists for the current user/artifact.
  - Supports `Public` flag and `Output Mode` (`Key/Value` or `Raw`).
- `Get`: fetches one storage key from `GET /discourse-ai/ai-bot/artifact-key-values/{artifact_id}` using key filtering.
  - Uses strict guardrail checks: fails when key is missing.
  - Supports `Output Mode` (`Key/Value` or `Raw`).
- `Get Many`: reads storage rows via `GET /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.
  - Supports `Return All`, `Limit`, `Page`, `Per Page` (capped at 100), optional `Key` filter, `Keys Only`, and `All Users`.
  - Supports `Output Mode`:
    - `Rows`: emits one output item per returned key-value row.
    - `Response`: emits one output item containing response envelope (`key_values`, `users`, `total_count`, `has_more`).
- `Set`: writes or updates a key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.
  - Requires `Key` and string `Value`.
  - Supports `Public` flag for the stored key.
- `Update`: updates a storage key via `POST /discourse-ai/ai-bot/artifact-key-values/{artifact_id}`.
  - Requires existing `Key` and new `Value`.
  - Uses strict guardrail checks: fails when key is missing.
  - Supports optional `Update Public` override and `Output Mode` (`Key/Value` or `Raw`).
- `Delete`: deletes one key for current user via `DELETE /discourse-ai/ai-bot/artifact-key-values/{artifact_id}/{key}`; returns `{ deleted: true, artifact_id, key }`.

For artifact storage selectors, ID and artifact URLs are supported through an n8n resource locator field.

### Category

- `Create`: creates a category via `POST /categories.json`.
  - Requires `Name`.
  - Supports optional fields including `Slug`, `Color`, `Text Color`, `Description`, `Topic Template`, `Parent Category ID`, `Position`, `Search Priority`, `Read Restricted`, and `Permissions JSON`.
- `Delete`: deletes a category via `DELETE /categories/{id}.json`; returns `{ deleted: true }`.
  - Supports `Delete Topics Too` (maps to `delete_topics=true`).
- `Get`: fetches one category via `GET /c/{id}/show.json`; supports simplify output.
- `Get Many`: lists categories via `GET /categories.json`; supports simplify output.
- `Update`: updates a category via `PUT /categories/{id}.json` with selected fields.
  - Supports the same admin-oriented fields as `Create`, using `Update Fields`.
  - Requires at least one update field.

For category selectors, ID and full category URL are both supported through an n8n resource locator field.

### Personal Message

- `Create`: creates a private message topic via `POST /posts.json`.
  - Sends `archetype=private_message`, `title`, `raw`, optional `target_usernames`, `target_recipients`, `target_group_names`, and `tags`.
  - Requires at least one recipient username or recipient group name.
- `Reply`: posts a reply in a private message topic via `POST /posts.json`.
  - Sends `topic_id`, `raw`, and optional `reply_to_post_number`.
- `Get Many (Inbox)`: lists inbox personal message topics via `GET /topics/private-messages/{username}.json`.
  - Supports optional `Page` and `Simplify`.
  - `Mailbox Username` defaults to credential `API Username` when empty.
- `Get Many (Sent)`: lists sent personal message topics via `GET /topics/private-messages-sent/{username}.json`.
  - Supports optional `Page` and `Simplify`.
  - `Mailbox Username` defaults to credential `API Username` when empty.
- `Add Participant`: invites one user to a personal message topic via `POST /t/{id}/invite.json`.
- `Add Participants (Batch)`: invites multiple users (comma-separated usernames) via repeated `POST /t/{id}/invite.json` calls.
  - Returns one output item per invited username.
- `Remove Participant`: removes one user from a personal message topic via `DELETE /t/{id}/remove-allowed-user.json`.
- `Invite Group`: invites a group to a personal message topic via `POST /t/{id}/invite-group.json` with optional `should_notify`.

For personal message topic selectors, ID and full topic URL are both supported through an n8n resource locator field.

### Post

- `Create`: creates a reply post via `POST /posts.json`.
  - Requires `Topic ID or URL` and `Raw`.
  - Supports optional `Reply To Post Number`, `Auto Track`, and `Created At`.
- `Get`: fetches one post via `GET /posts/{id}.json`; supports simplify output.
- `Update`: updates a post via `PUT /posts/{id}.json` using `post.raw` and optional `post.edit_reason`.
- `Delete`: deletes a post via `DELETE /posts/{id}.json`; supports optional `force_destroy=true`.
  - Default behavior is soft delete (`Force Destroy = false`).
  - Returns `{ deleted: true, force_destroy: <boolean> }`.
- `Get Many (All Posts)`: lists posts via `GET /posts.json`.
  - Supports `Return All`, `Limit`, `Before`, `Page`, optional ordering fields (`Order`, `Ascending`, `Desc`), and `Simplify`.
- `Get Many (Topic)`: lists posts from a topic via `GET /t/{id}.json` plus batched `GET /t/{id}/posts.json`.
  - Supports `Return All`, `Limit`, and `Simplify`.
- `Get Many (User)`: lists user post activity via `GET /u/{username}/activity/posts.json` with fallback to `GET /user_actions.json?filter=5`.
  - Supports `Page`, `Return All`, `Limit`, and `Simplify`.
- `Like`: creates a like via `POST /post_actions(.json)` with `post_action_type_id=2`.
- `Unlike`: removes a like via `DELETE /post_actions/{id}(.json)` with `post_action_type_id=2`.
- `Bookmark`: creates a bookmark via `POST /post_actions(.json)` with `post_action_type_id=1`.
- `Unbookmark`: removes a bookmark via `DELETE /post_actions/{id}(.json)` with `post_action_type_id=1`.
- `Get Revision (Latest)`: fetches latest revision via `GET /posts/{id}/revisions/latest(.json)`; supports simplify output.
- `Get Revision (Version)`: fetches a specific revision via `GET /posts/{id}/revisions/{version}(.json)`; supports simplify output.
- `Recover`: recovers a deleted post via `PUT /posts/{id}/recover(.json)`.
- `Prepare for TTS`: prepares post content for text-to-speech workflows.
  - Input supports `Post ID or URL`, optional `Raw Text Override`, and optional metadata preamble.
  - Post fetch path: `GET /posts/{id}.json?include_raw=true`, with raw-text fallback to `/raw/{topic_id}/{post_number}` and `/raw/{post_id}` when needed.
  - Cleaning pipeline strips Markdown/BBCode/HTML, normalizes spacing and headings, and supports toggles for URLs, images, code blocks, mentions, and hashtags.
  - Output modes:
    - `Single Text` (default): returns one `text` field.
    - `Chunks Array`: returns one item containing `text` and `chunks`.
    - `Chunk Items`: returns one item per chunk with chunk metadata.
  - Chunking supports sentence-aware or paragraph-aware strategies with configurable `Max Chunk Length`.
- `Generate TTS Audio`: generates stitched ElevenLabs audio from cleaned text, with optional transcript artifacts.
- `Generate TTS Audio + Spaces Upload`: runs the same TTS synthesis/transcript pipeline and uploads generated artifacts to DigitalOcean Spaces.
- Both TTS operations:
  - Require `Cleaned Text`, `Voice ID`, and `Model ID`.
  - Use free-text `Model ID` plus optional dynamic model-limit lookup (`GET /v1/models`) for future model compatibility.
  - Support model-limit fallback, manual override, safety margin, and automatic split retries on text-length errors.
  - Support bounded parallel chunk synthesis via `Performance Options -> Max Chunk Concurrency` while preserving deterministic chunk order.
  - Support exponential backoff with jitter for retriable errors (`429`, `5xx`) via `Retry Options`.
  - Support final `MP3` or `WAV` output.
  - Support transcript generation with alignment timestamps (`with-timestamps`) and output modes:
    - `Text Only`
    - `Alignment JSON Only`
    - `Text and Alignment JSON`
  - Apply audio-duration fallback when chunk alignment timestamps are missing, to keep merged timeline offsets monotonic.
  - Emit sync guardrail warnings for MP3 transcript runs and include a strict-sync format recommendation in output metadata.
  - Support binary output fields for audio and transcript artifacts so output can be fed directly into downstream n8n nodes.
- `Generate TTS Audio + Spaces Upload` additionally uploads generated audio/transcript files to DigitalOcean Spaces with S3 Signature V4 signing.

For post selectors, ID, direct post URL (`/p/{id}`), and topic post URL (`/t/.../{topicId}/{postNumber}`) are supported through an n8n resource locator field.

### Topic

- `Create`: creates topic via `POST /posts.json` with `title`, `raw`, optional `category`, and optional additional fields: `Auto Track`, `Created At`, `Embed URL`, and `External ID`.
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

### Data Explorer

- `Get Many`: lists saved Data Explorer queries.
  - Endpoint fallback: `GET /api/query` -> `GET /admin/plugins/discourse-data-explorer/queries.json` -> `GET /admin/plugins/explorer/queries.json`.
  - Supports `Return All`, `Limit`, and `Simplify`.
- `Get`: fetches a query by ID.
  - Endpoint fallback: `GET /api/query/{id}` -> `GET /admin/plugins/discourse-data-explorer/queries/{id}.json` -> `GET /admin/plugins/explorer/queries/{id}.json`.
  - Supports `Query ID or URL` resource locator and simplify output.
- `Create`: creates a query with `Query Name`, `SQL`, and optional `Description` + `Params JSON`.
  - Endpoint fallback: `POST /api/query` -> `POST /admin/plugins/discourse-data-explorer/queries` -> `POST /admin/plugins/explorer/queries`.
- `Update`: updates an existing query by ID with selected fields.
  - Endpoint fallback: `PUT /api/query/{id}` -> `PUT /admin/plugins/discourse-data-explorer/queries/{id}` -> `PUT /admin/plugins/explorer/queries/{id}`.
- `Delete`: deletes a query by ID and returns `{ deleted: true }`.
  - Endpoint fallback: `DELETE /api/query/{id}` -> `DELETE /admin/plugins/discourse-data-explorer/queries/{id}` -> `DELETE /admin/plugins/explorer/queries/{id}`.
- `Run`: runs a query by ID with optional `Params JSON`.
  - Endpoint fallback: `GET /api/query/{id}/run` -> `GET /data-explorer/queries/{id}/run` -> `POST /admin/plugins/discourse-data-explorer/queries/{id}/run` -> `POST /admin/plugins/explorer/queries/{id}/run`.
  - Uses the non-admin/public Data Explorer run route when available, then falls back to admin routes.
  - Supports `Result Only` output mode (`{ columns, rows }`).

For Data Explorer query selectors, ID and full query URL are both supported through an n8n resource locator field.

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

### Pattern: Post to ElevenLabs audio + transcript + Spaces

1. Use `Discourse Extended -> Post -> Prepare for TTS` and output `Single Text`.
2. Use a second `Discourse Extended` node with `Post -> Generate TTS Audio + Spaces Upload`.
3. Map `Cleaned Text` to the prior node's `{{$json.text}}`, then set `Voice ID` and `Model ID`.
4. Enable `Generate Transcript` and choose transcript output mode as needed.
5. Configure `Spaces Options` (`Bucket Name`, folder/path, and optional transcript upload artifacts).

## Compatibility

- Uses n8n nodes API version `1` (`package.json -> n8n.n8nNodesApiVersion`).
- Intended for self-hosted n8n with community packages enabled during pre-release development.
- If this package becomes verified, install behavior on n8n Cloud follows n8n verified community node rules.
- Install/load behavior can be affected by:
  - `N8N_COMMUNITY_PACKAGES_ENABLED`
  - `N8N_COMMUNITY_PACKAGES_PREVENT_LOADING`
  - `N8N_CUSTOM_EXTENSIONS`

## Troubleshooting

- **Node not visible after install**
  - Restart n8n.
  - Verify you searched for node name `Discourse Extended` (not npm package name).
  - Confirm community packages are enabled in your n8n environment variables.
- **`Discourse API (Discourse Extended)` credential exists but is missing from the node dropdown**
  - Edit the credential and ensure node access includes `Discourse Extended`.
  - Create the credential directly from within the node as a fallback; this usually auto-assigns compatible node access.
  - Confirm workflow and credential are in the same project/workspace.
- **`Create` upload fails with missing binary**
  - Confirm the binary field exists and `Input Data Field Name` matches it.
- **`Create`/`Create From Source URL` avatar upload fails**
  - Provide `User ID` when `Type = Avatar`.
- **`Create From Source URL` fails**
  - Confirm URL is accessible and not expired.
- **`Upload to Object Storage` fails**
  - Confirm URL is presigned for `PUT`, not expired, and signed headers match request headers.
- **Category create/update fails with `400` validation errors**
  - Confirm required fields are present (`Name` for create) and optional JSON fields like `Permissions JSON` are valid JSON objects.
- **Category operations fail with `403`**
  - Confirm the API key/user has category admin/moderation permissions on the Discourse instance.
- **Category URL input fails**
  - Use a category URL that includes the numeric category ID (for example: `https://forum.example.com/c/support/12`).
- **Post URL input fails**
  - For topic-style URLs, include both topic ID and post number (for example: `https://forum.example.com/t/topic-slug/123/4`).
  - Direct post URLs like `https://forum.example.com/p/456` are also supported.
- **Post delete behavior is not permanent**
  - Enable `Force Destroy` in `Post -> Delete` if permanent deletion is required.
- **Post reactions (`Like`/`Bookmark`) fail with `403`**
  - Confirm the API key/user has permission to perform post actions on the target forum/post.
- **Post revision/recover operations fail with `404`**
  - Confirm the post exists, revisions are available for that post, and the acting user has visibility to the post history.
- **`Prepare for TTS` returns empty or weak text**
  - Prefer posts with `raw` available; some cooked-only content may lose detail during HTML cleanup.
  - If needed, provide `Raw Text Override` to force your own source text.
- **`Prepare for TTS` chunking splits in awkward places**
  - Increase `Max Chunk Length` and switch between `Sentence Aware` and `Paragraph Aware` strategies based on your TTS model behavior.
- **`Generate TTS Audio` fails with ElevenLabs auth errors**
  - Confirm an `ElevenLabs API` credential is attached and API key is valid.
- **`Generate TTS Audio` fails with model/chunk length errors**
  - Keep dynamic model-limit lookup enabled and increase safety margin.
  - If needed, manually lower `Max Characters Override`.
- **`Generate TTS Audio` is too slow for very long text**
  - Increase `Performance Options -> Max Chunk Concurrency` gradually (for example from `3` to `4`) while monitoring ElevenLabs rate limits.
- **`Generate TTS Audio` retries are still failing on `429`**
  - Increase `Retry Max Delay (MS)` and/or `Max Retries per Chunk`.
  - Keep jitter enabled (`Retry Jitter Ratio`) to reduce synchronized retry bursts.
- **`Generate TTS Audio` returns weak or missing transcript artifacts**
  - Ensure `Generate Transcript` is enabled and transcript output mode includes desired artifact type(s).
- **`Generate TTS Audio` transcript timing quality is critical**
  - Prefer `WAV` output and review `warnings` in output JSON.
  - MP3 is supported, but chunk-boundary encoder behavior can introduce slight timestamp drift.
- **`Generate TTS Audio` Spaces upload fails**
  - Confirm `DigitalOcean Spaces API` credential values and bucket name are correct.
  - Confirm the access key can write to the selected bucket path.
  - The `DigitalOcean Spaces API` selector is only shown for `Post -> Generate TTS Audio + Spaces Upload`.
- **Data Explorer operations fail with `404`/`405`**
  - Confirm the Data Explorer plugin is enabled on the Discourse instance.
  - Verify API base URL points to the forum root (for example `https://forum.example.com`).
  - The node already falls back across API/public/admin route variants for compatibility.
- **Data Explorer run/create/update/delete fails with `403`**
  - Confirm the API key/user has required Data Explorer permissions for the target query.
- **AI Artifact CRUD operations fail with `403`**
  - Confirm the API user is an admin. Artifact CRUD routes are under `/admin/plugins/discourse-ai`.
  - If using granular API keys, confirm `discourse_ai:manage_artifacts` scope is enabled.
- **Discourse credential test fails but AI Artifact operations work**
  - This can happen with narrow-scope granular keys because credential test uses `/latest.json`.
  - Keep current credential config and validate with an artifact operation.
- **AI Artifact private access behaves unexpectedly**
  - Confirm `metadata.public` is not set to `true` unless global viewer access is intended.
  - For group-restricted access, ensure backing post/category permissions match intended viewers.
- **AI Artifact Storage `all_users=true` returns limited rows**
  - Non-admin users are still restricted by server-side visibility rules.
  - Use an admin API user when full cross-user enumeration is required.
- **AI Artifact Storage `Create` fails with key already exists**
  - This is expected strict mode behavior. Use `Update` for existing keys or `Set` for upsert behavior.
- **AI Artifact Storage `Get`/`Update` fails with missing key**
  - This is expected strict mode behavior. Use `Create` first (or `Set` for upsert behavior).
- **Personal Message create/reply/participant operations fail with `403`**
  - Confirm the API key/user can create and manage private messages on the target Discourse instance.
- **`Invite Group` fails**
  - Confirm the group exists and the acting API user has permission to invite groups into the target PM topic.
- **Personal message mailbox list is empty unexpectedly**
  - Confirm `Mailbox Username` is correct and has visibility to the target PM threads.

## Implemented So Far

- Added `AI Artifact` resource with `Create`, `Delete`, `Get`, `Get Many`, and `Update`.
- Added `AI Artifact Storage` resource with `Create`, `Delete`, `Get`, `Get Many`, `Set`, and `Update`.
- Added `Category` resource with `Create`, `Delete`, `Get`, `Get Many`, and `Update`.
- Added `Personal Message` resource with `Create`, `Reply`, `Get Many (Inbox)`, `Get Many (Sent)`, `Add Participant`, `Add Participants (Batch)`, `Remove Participant`, and `Invite Group`.
- Added `Post` resource with explicit CRUD (`Create`, `Delete`, `Get`, `Update`) and practical post features (`Get Many` variants, reactions, revisions, and recover).
- Added `Post -> Prepare for TTS` with markup cleanup, optional metadata preamble, and optional chunking for downstream text-to-speech calls.
- Added `Post -> Generate TTS Audio` with ElevenLabs synthesis, robust chunk limit handling, chunk stitching, and transcript generation.
- Added `Post -> Generate TTS Audio + Spaces Upload` for Spaces-backed artifact upload in the same TTS pipeline.
- Added `Upload -> Create From Source URL`.
- Added `Upload -> Upload to Object Storage` for presigned `PUT` uploads.
- Added support for S3-compatible presigned workflows (including DigitalOcean Spaces).
- Kept existing `Upload -> Create` for direct multipart upload to Discourse.
- Topic operations continue to support ID/URL selectors and simplified outputs where applicable.
- Added `Data Explorer` resource with `Create`, `Delete`, `Get`, `Get Many`, `Run`, and `Update`.
- Added endpoint fallback coverage for newer Data Explorer API/public routes and legacy admin routes.

## Release Policy

- This package is currently pre-release and has no public release history yet.
- `packages/n8n-nodes-discourse/package.json` may contain a development target version, but that alone does not indicate a published release.
- Pre-release documentation for functionality lives in this README; `CHANGELOG.md` remains minimal until public releases begin.

## Docs Maintenance Checklist

During development and release prep:

- Verify operation list in README matches:
  - `nodes/Discourse/actions/aiArtifact/index.ts`
  - `nodes/Discourse/actions/aiArtifactStorage/index.ts`
  - `nodes/Discourse/actions/category/index.ts`
  - `nodes/Discourse/actions/dataExplorer/index.ts`
  - `nodes/Discourse/actions/personalMessage/index.ts`
  - `nodes/Discourse/actions/post/index.ts`
  - `nodes/Discourse/actions/topic/index.ts`
  - `nodes/Discourse/actions/upload/index.ts`
- Verify endpoint references still exist in Discourse OpenAPI.
- Verify install instructions still match current n8n docs.
- Once public releases begin, maintain versioned changelog entries aligned with published release tags.

## Development

Contributor workflow for this repository is managed from repo root through the DiscoFlow CLI:

```bash
# from repository root
./scripts/dev-setup.sh
uv run --no-editable discoflow start
uv run --no-editable discoflow watch
uv run --no-editable discoflow ui-refresh
```

Use explicit `--no-editable` for DiscoFlow CLI commands to avoid editable `.pth` import edge cases.

Use direct package commands only for package-level debugging or release work:

```bash
cd packages/n8n-nodes-discourse
npm install
npm run lint
npm run build
npm run dev
```

## Resources

- n8n community node installation:
  - https://docs.n8n.io/integrations/community-nodes/installation/
- n8n verified community node installation (nodes panel):
  - https://docs.n8n.io/integrations/community-nodes/installation/verified-install/
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
- Discourse Data Explorer plugin topic:
  - https://meta.discourse.org/t/data-explorer-plugin/32566
- Discourse Data Explorer API update topic:
  - https://meta.discourse.org/t/introducing-data-explorer-api-endpoints-for-query-creation-and-execution/350029
- Discourse AI artifact docs and API discussions:
  - https://meta.discourse.org/t/discourse-ai-web-artifacts/339972
  - https://meta.discourse.org/t/ai-artifact-user-storage/369822
  - https://github.com/discourse/discourse/pull/34193
  - https://github.com/discourse/discourse/commit/99207c0d5228be55e9efc0e0b3fd5948bc672666
  - https://github.com/discourse/discourse/commit/558389b5f0bb122a5e98a81d7dc28d397d341d98
- Discourse PM API usage and routes:
  - https://www.rubydoc.info/gems/discourse_api/DiscourseApi/API/PrivateMessages
  - https://meta.discourse.org/t/can-i-update-add-to-allowed-users-via-api/63062
- Discourse post API usage and routes:
  - https://www.rubydoc.info/gems/discourse_api/DiscourseApi/API/Posts
  - https://www.rubydoc.info/gems/discourse_api/DiscourseApi/API/PostActions
  - https://meta.discourse.org/t/how-to-use-api-to-edit-topic-post/210300
  - https://meta.discourse.org/t/if-a-user-can-delete-their-topic-and-or-replies-via-the-api/196863
  - https://meta.discourse.org/t/retrieving-post-raw-content/115094
  - https://meta.discourse.org/t/get-specific-post-from-a-topic-and-get-the-raw/54471
- ElevenLabs API references:
  - https://elevenlabs.io/docs/api-reference/models/get-all
  - https://elevenlabs.io/docs/api-reference/text-to-speech/convert
  - https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
- Discourse category API usage and routes:
  - https://www.rubydoc.info/gems/discourse_api/DiscourseApi/API/Categories
  - https://meta.discourse.org/t/create-a-category-using-api/242996
  - https://meta.discourse.org/t/delete-category-using-api/275641
- DigitalOcean Spaces API reference:
  - https://docs.digitalocean.com/products/spaces/reference/s3-api/

## License

This package is released under the MIT License. See [`LICENSE.md`](LICENSE.md).
