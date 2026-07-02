# Publishing & Site Serving

## Purpose

One-click publish to `{slug}.wandit.app` and safe serving of user-generated pages — always off `wandit.dev` (app/API). Publishing is a pointer update; rollback is pointing at an older version.

## Owns

- `apps/edge` (new): Cloudflare Worker routing by hostname — `{slug}.wandit.app` and `{token}.<preview-domain>` (noindex; dedicated preview domain, purchase pending — e.g. `wandit-preview.xyz`) → R2 files via a KV pointer.
- Wildcard DNS + cert setup for `*.wandit.app` and the preview domain; KV namespace; R2 bindings; wrangler config.
- `deployments` table: slug → version pointer, status, history.
- Publish API + BullMQ publish job: Tailwind CLI compile (replace Play CDN with a small compiled CSS), Meta/TikTok pixel injection from project settings, strip any preview-only markup, write to R2 published path, update KV pointer.
- Unpublish, rollback, slug availability check.
- Settings tab publish section (slug input + availability, publish/unpublish, live URL, version history + rollback) and the publish button in the workspace header.

## Working model

Publish: validate slug (globally unique; reserved words blocked) → job fetches the version HTML from R2 → compiles Tailwind via CLI → injects pixels → writes `published/{slug}/…` to R2 → writes KV `slug → r2 key` → marks the deployment active. The edge worker parses the hostname, looks up KV (sites) or preview token, streams the R2 file with proper cache headers (`X-Robots-Tag: noindex` on previews). Rollback re-runs the job for an older version and repoints. Unpublish deletes the KV key and marks the row. The server/worker write KV through the Cloudflare REST API. Preview tokens per project serve the current draft version on `{token}.<preview-domain>` (replaces the MVP-interim authed preview from chat-generation). All user sites share the `wandit.app` registrable domain — post-launch, submit `wandit.app` to the Public Suffix List (like `pages.dev`) so user sites' cookies are isolated from each other.

## Does not own

- Version creation and R2 draft layout (→ chat-generation).
- Custom domains (post-MVP, Cloudflare for SaaS).
- Lead capture the published form posts to (→ leads-crm).

## Issue breakdown

### 1. Edge worker + domains infra (`apps/edge`)

New workspace app: Cloudflare Worker with R2 + KV bindings, hostname parsing, site route (KV pointer → R2 stream, cache headers), preview route (token → project draft pointer, noindex), 404 page. Wrangler config + local dev story; document wildcard DNS/cert setup for `*.wandit.app` and the preview domain. **Dependencies to add (ask first): wrangler (+ hono only if needed).**

**Acceptance criteria**
- A file placed in R2 + KV pointer is served on `{slug}.wandit.app` with correct content-type and caching.
- Preview hostnames serve the draft with `X-Robots-Tag: noindex`; unknown hostnames get a clean 404.
- `pnpm dev` story documented for the edge app; deploy via wrangler works.

### 2. Publish pipeline slice (DB → API → job)

`deployments` table + contracts. Endpoints: `POST /projects/:id/publish` ({ slug, versionId }), `POST /projects/:id/unpublish`, `POST /projects/:id/rollback` ({ deploymentId | versionId }), `GET /slug-availability`. Publish BullMQ job: fetch version from R2 → Tailwind CLI compile → pixel injection from project settings → write published path → KV pointer via Cloudflare REST API → deployment row lifecycle (pending → active / failed). Preview-token issuance per project.

**Acceptance criteria**
- Publish → page live on the sites domain with compiled CSS (no Play CDN script) and pixels present when configured.
- Rollback repoints to an older version and the live site changes; unpublish takes the site down; slugs are globally unique.
- Deployment history query returns ordered attempts with statuses.

### 3. Publish UI (Settings + header)

Settings publish section: slug input with debounced availability check, publish/unpublish buttons with job progress state, live URL with copy + open, version history list with per-version rollback. Workspace header publish button reflecting state (draft / publishing / published). Dashboard card status badge fed by deployment state. Canvas preview switches to the preview-domain URL once available.

**Acceptance criteria**
- Full flow from Settings: pick slug → publish → open live URL; unpublish and rollback both reflect in UI state and on the live domain.
- Invalid/taken slugs blocked client- and server-side with clear messages.

**Files:** `apps/edge/**`, `packages/db/src/schema/deployments.ts`, `packages/contracts/src/deployments.ts`, `apps/server/src/modules/sites/**`, `apps/worker/src/processors/publish.processor.ts`, `apps/web/src/features/workspace/components/settings/**` (publish section), `apps/web/src/features/workspace/api/deployments.{services,queries,mutations}.ts`.

Source docs: docs/PRD.md, docs/features/publishing-serving.md
