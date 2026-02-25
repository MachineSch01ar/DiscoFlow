## Unreleased (Pre-release Development)

Formal semantic versioned changelog entries will begin at public release `v0.1.0`.

- Added `Upload -> Create From Source URL` to fetch a public/presigned source object URL and upload it to Discourse via `POST /uploads.json`.
- Added `Upload -> Upload to Object Storage` to upload incoming n8n binary data to a presigned `PUT` URL (S3-compatible, including DigitalOcean Spaces presigned URLs).
- Kept and documented `Upload -> Create` multipart upload behavior for direct binary-to-Discourse uploads.
- Updated documentation coverage for installation methods, compatibility constraints, troubleshooting, and operation parameter behavior.
