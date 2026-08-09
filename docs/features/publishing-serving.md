# Publishing & Site Serving

## Purpose

One-click publish to `{slug}.wandit.app` and safe serving of user-generated pages — always off `wandit.dev` (app/API). Publishing is a pointer update; rollback is pointing at an older version.

## Owns

- `apps/edge` (new): Cloudflare Worker routing by hostname — `{slug}.wandit.app` and `{token}.<preview-domain>` (noindex; dedicated preview domain, purchase pending — e.g. `wandit-preview.xyz`) → R2 files via a KV pointer.
- Wildcard DNS + cert setup for `*.wandit.app` and the preview domain; KV namespace; R2 bindings; wrangler config.
- `deployments` table: slug → version pointer, status, history.
- Publish API (synchronous in `SitesModule`; row lifecycle stays queue-shaped so an async swap is a drop-in): Meta/TikTok pixel injection from project settings, write to the R2 published path, write the slug KV pointer. No CSS compile — generated pages ship hand-written CSS.
- Unpublish, rollback, slug availability check.
- Settings tab publish section (slug input + availability, publish/unpublish, live URL, version history + rollback) and the publish button in the workspace header.

## Working model

Publish: validate slug (globally unique among live sites; reserved words blocked) → read the version HTML from R2 (`sites/{projectId}/{versionId}/index.html`) → verify Cloudflare KV is configured → inject pixels → write `published/{projectId}/v/{deploymentId}.html` (immutable archive) and overwrite `published/{projectId}/current.html` (the live bytes) → write or refresh KV `domain:{slug}.wandit.app → {projectId, source:"slug", slug}` → promote the deployment row to active (demote-then-promote in one transaction). The R2 key derives from projectId alone, so KV pointers are version-free, but every publish refreshes the slug pointer to heal sites first published before routing existed. The edge worker parses the hostname, does one `KV.get("domain:" + host)` (same prefix for slugs and custom domains; `projectId` is the only required pointer field), streams `published/{projectId}/current.html` from its R2 binding with `Cache-Control: public, max-age=60` + ETag (`caches.default`, never the host-blind `ctx.cache`). Rollback republishes an older deployment's archived bytes. Unpublish deletes `current.html` + the slug KV key and marks the row (custom-domain keys stay — they resume working on republish). The server/worker write KV through the Cloudflare REST API. Preview tokens per project serve the current draft version on `{token}.<preview-domain>` (replaces the MVP-interim authed preview from chat-generation). All user sites share the `wandit.app` registrable domain — post-launch, submit `wandit.app` to the Public Suffix List (like `pages.dev`) so user sites' cookies are isolated from each other.

All three server values `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`, and `CLOUDFLARE_ZONE_ID_WANDIT_APP` are required for publish and rollback. If any is absent, the API returns HTTP 503 with `PUBLISH_UNAVAILABLE` before creating a pending deployment or writing published bytes. API-only local development may set `ALLOW_PUBLISH_WITHOUT_KV=true` to restore the explicit warning-and-skip behavior; hosted environments and any environment with the edge worker must leave it false (the default).

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

`deployments` table + contracts. Endpoints (see `packages/contracts/src/v1/deployments.ts` for the final shapes): `POST /api/v1/projects/:id/deployments` ({ slug?, versionId? }), `DELETE .../deployments/active`, `POST .../deployments/rollback` ({ deploymentId }), `GET .../deployments/current`, `GET .../deployments`, `GET .../deployments/slug-availability?slug=`. Publish runs synchronously in the API: fetch version from R2 → require Cloudflare KV unless the local-only override is explicit → pixel injection from project settings → write published path → slug KV pointer via Cloudflare REST API → deployment row lifecycle (pending → active / failed) with a stale-pending self-heal. Preview-token issuance per project.

**Acceptance criteria**
- Publish → page live on the sites domain, byte-identical to the draft version plus pixel injection when configured.
- Rollback repoints to an older version and the live site changes; unpublish takes the site down; slugs are globally unique.
- Deployment history query returns ordered attempts with statuses.

### 3. Publish UI (Settings + header)

Settings publish section: slug input with debounced availability check, publish/unpublish buttons with job progress state, live URL with copy + open, version history list with per-version rollback. Workspace header publish button reflecting state (draft / publishing / published). Dashboard card status badge fed by deployment state. Canvas preview switches to the preview-domain URL once available.

**Acceptance criteria**
- Full flow from Settings: pick slug → publish → open live URL; unpublish and rollback both reflect in UI state and on the live domain.
- Invalid/taken slugs blocked client- and server-side with clear messages.

**Files:** `apps/edge/**`, `packages/db/src/schema/deployments.ts`, `packages/contracts/src/v1/deployments.ts`, `apps/server/src/modules/sites/**`, `apps/worker/src/processors/publish.processor.ts`, `apps/web/src/features/workspace/components/settings/**` (publish section), `apps/web/src/features/workspace/api/deployments.{services,queries,mutations}.ts`.

Source docs: docs/PRD.md, docs/features/publishing-serving.md
