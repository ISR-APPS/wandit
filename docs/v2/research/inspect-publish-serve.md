# V1 publish and serve — inspection report

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev`).
All paths are relative to the repo root. Line numbers come from the files as read on this date.
Items marked UNVERIFIED were not confirmed from code or docs in the repo.

## 1. Summary

V1 publishes one HTML file per project. The API (NestJS) reads the draft HTML from R2, runs a chain of deterministic HTML transforms, writes the result to two R2 keys, writes one KV pointer per host, and promotes a `deployments` row. A single Cloudflare Worker (`apps/edge`) on the `*/*` route of the `wandit.app` zone serves every published site. It maps `Host` to a KV pointer, reads `published/{projectId}/current.html` from R2, and streams it. It ignores the URL path. It serves only GET and HEAD. It serves no assets. Assets live on a public R2 base URL (`https://assets.wandit.app`, production) and are referenced by absolute URLs inside the HTML.

Custom domains use Cloudflare for SaaS custom hostnames. `www.{domain}` is the canonical host. It CNAMEs to the fallback origin `customers.wandit.app`. The apex redirects to `www` inside the Worker. The domain pipeline (Trigger.dev tasks) writes the same KV pointer shape as publishing.

Lead capture is a script injected into the published HTML at publish time. It posts to `POST /api/public/leads/{publicFormId}` on the API with `origin: "*"` CORS, no cookies. Anti-spam is a honeypot field, an in-memory sliding-window throttle, and a phone-based duplicate window. Turnstile is not used on the capture endpoint.

## 2. Storage: where built HTML and assets go

### 2.1 Backend and client

- Storage is Cloudflare R2, accessed with the AWS S3 SDK (`@aws-sdk/client-s3`). Endpoint: `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`. See `apps/server/src/infrastructure/storage/r2.ts:42-61`.
- The client is a lazy singleton. Every caller must check `isR2Configured()` first (`r2.ts:29-36`). The env vars `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` are all optional in `packages/env/src/server.ts:164-167`.
- `R2_PUBLIC_BASE_URL` (`packages/env/src/server.ts:170`) is the browser-reachable base URL of the bucket. Production value: `https://assets.wandit.app` (`apps/server/scripts/republish-active-sites.ts:34,71`). How `assets.wandit.app` is bound to the bucket (R2 custom domain vs. r2.dev URL) is not in the repo. UNVERIFIED.
- Production bucket: `wandit-production` (`apps/edge/wrangler.jsonc:34`, `republish-active-sites.ts:33`). Local edge dev bucket: `wandit-pages-dev` (`apps/edge/wrangler.dev.jsonc:18`). Staging bucket name `wandit-staging` appears only in the republish guardrail (`republish-active-sites.ts:191`).
- The R2 module is plain functions, no NestJS, so the Trigger.dev tasks and the Nest API share it (`r2.ts:1-11`).

### 2.2 Key layout (all in `apps/server/src/infrastructure/storage/r2.ts`)

| Purpose | Key | Builder |
|---|---|---|
| Draft page HTML (one per version) | `sites/{projectId}/{versionId}/index.html` | `pageHtmlKey` (65-67) |
| Extra draft files beside index.html | `sites/{projectId}/{versionId}/{path}` | `siteFileKey` (71-77) |
| Live published bytes (mutable) | `published/{projectId}/current.html` | `publishedCurrentKey` (83-85) |
| Immutable publish archive | `published/{projectId}/v/{deploymentId}.html` | `publishedArchiveKey` (89-94) |
| Builder images/videos per attempt | `sites/{projectId}/assets/{attemptId}/img-{n}.{ext}`, `vid-{n}.{ext}` | `siteAssetKey` (99-106), `siteVideoKey` (110-117) |
| Video intermediates | `.../assets/{attemptId}/frames|segments|audio/...` | 123-147 |
| Build screenshots | `sites/{projectId}/shots/{attemptId}/p{pass}-{n}.jpg` | `siteShotKey` (153-160) |
| Dashboard thumbnail | `sites/{projectId}/thumbnails/{versionId}.jpg` | `projectThumbnailKey` (166-171) |
| Chat image generations | `images/{projectId}/{attemptId}/img-{n}.{ext}` | `imageGenerationKey` (177-184) |
| Marketing HTML | `marketing/{projectId}/{assetId}/index.html` | `marketingAssetKey` (188-190) |
| User uploads | `uploads/{userId}/{uuid}/{filename}` | `userUploadKey` (207-213) |
| Responsive renditions | `{directory}/{stem}.w{width}.webp` beside the primary | `variantKey` (230-238) |

- Media objects are written once and carry `Cache-Control: public, max-age=31536000, immutable` (`IMMUTABLE_ASSET_CACHE_CONTROL`, `r2.ts:251-252`). The comment at 246-250 states the consequence: a re-optimized object must get a new key.
- `publicAssetUrl(key)` builds `${R2_PUBLIC_BASE_URL}/${key}` (257-261). `publicAssetKeyFromUrl` and `isWanditHostedUrl` parse a URL back to a key with exact-origin and path-boundary checks (271-325).
- Content types are chosen by extension from a small map (`CONTENT_TYPES`, 364-380). Unknown extensions become `application/octet-stream` (384-388). The map lacks `.map`, `.wasm`, `.woff`, `.ttf`, `.webmanifest`, `.avif`, `.mjs`.
- Write helpers: `putSiteFile(key, body, contentType, cacheControl?)` (396-411), `putPageHtml(key, html)` (415-424). Read/list helpers: `getPageHtml` (548-562), `getObjectBytes` (444-459), `r2ObjectExists` (534-544), `listObjectsByPrefix` capped at 500 by default (573-610). Delete: `deleteObject` swallows `NoSuchKey` (428-440).

### 2.3 Draft is one file

- The builder writes `build.files` to R2. `index.html` goes to `pageHtmlKey`; any other path goes to `siteFileKey` (`apps/server/src/trigger/generate-page.task.ts:320-337`).
- In practice the builder allows only one file. The tool guard refuses any path other than `index.html`: "The site is exactly ONE file" (`apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts:351-354`).
- The `versions` row stores `r2Key` for that HTML (`packages/db/src/schema/artifacts.ts:76`). Versions are immutable (63-64). `artifacts.activeVersionId` is the draft pointer (32-33). One `landing_page` artifact per project (48-50).

### 2.4 Uploads and asset listing

- User uploads: `POST /api/v1/attachments` (`apps/server/src/modules/uploads/presentation/http/controllers/uploads.controller.ts:37-60`). The server proxies bytes to R2; the browser never talks to R2 (`uploads.service.ts:1-6`). It checks an allowlist of media types, size limits, and magic bytes (`uploads.service.ts:37-122, 194-221`). Raster images go through `sharp` (`optimize-image.ts:1-24`: max width 1920, WebP q80). Renditions at 480/960/1600 are written beside the primary (`store-image-variants.ts:22-53`).
- The Assets tab lists DB-backed generations plus an R2 prefix listing of `sites/{projectId}/assets/` (`project-assets.service.ts:62-160, 393-408`). Downloads are ownership-checked and limited to the project's prefixes (`project-assets.service.ts:352-375`).
- `apps/server/src/modules/storage` is an empty module shell (`storage.module.ts` is 4 lines, all subfolders hold `.gitkeep`).

## 3. Publish pipeline (API, synchronous)

### 3.1 Endpoints

All in `apps/server/src/modules/sites/presentation/http/controllers/sites.controller.ts`, prefix `/api/v1`:

| Route | Line | Notes |
|---|---|---|
| `GET projects/:projectId/deployments/current` | 46 | Polled by the web during publish |
| `GET projects/:projectId/deployments/slug-availability?slug=` | 59 | |
| `GET projects/:projectId/deployments` | 75 | History |
| `POST projects/:projectId/deployments` | 89 | Publish; needs workspace permission `publish:manage` (88) |
| `POST projects/:projectId/deployments/rollback` | 107 | |
| `DELETE projects/:projectId/deployments/active` | 124 | Unpublish |

Body/response contracts live in `packages/contracts/src/v1/deployments.ts`. Slug regex: `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, max 63 (39-42). Reserved slugs list (50-77) includes `customers`, `api`, `www`, `assets`, `preview`, `staging`, `cdn`.

### 3.2 The `deployments` table

`packages/db/src/schema/deployments.ts`:
- Status enum `pending | active | failed | superseded | unpublished` (19-25).
- Columns: `projectId`, `versionId`, `slug`, `status`, `error` (30-40).
- Partial unique index: one `active` row per slug (55-57) and one `active` row per project (59-61).
- Composite FK `(projectId, versionId) -> versions(projectId, id)` (66-70). A deployment can never publish another project's version.
- DB check for the slug DNS label (73-76).

### 3.3 Steps of `SitesService.runPublishPipeline`

File: `apps/server/src/modules/sites/application/services/sites.service.ts`.

1. Require R2 (`268-270`) and Cloudflare KV (`271`, `assertKvAvailableForPublish` 523-533). Missing KV → HTTP 503 `PUBLISH_UNAVAILABLE`, unless `ALLOW_PUBLISH_WITHOUT_KV=true` (`packages/env/src/server.ts:265`).
2. Find the active deployment and resolve the slug (`273-278`, `resolveSlug` 458-497). Order: explicit slug, then current live slug, then a slug derived from the project name with random suffixes on collision (`slugify.ts:10-42`).
3. Insert a `pending` row under `SELECT ... FOR UPDATE` on the project row (`deployments.repository.ts:148-177`).
4. Transform the HTML string, in this order:
   - `inlineKnownCdnScripts` — replaces GSAP 3.x CDN `<script src>` with vendored inline sources (`sites.service.ts:294`; `pages/domain/inline-cdn-scripts.ts:1-10`).
   - `optimizeFontLoading` — hoists Google Fonts / Fontshare links above inline `<style>`, adds preconnects and `display=swap` (`301`; `optimize-font-loading.ts:1-27`).
   - `optimizeImageMarkup` then `emitResponsiveImages` — one LCP image with `fetchpriority=high`, others lazy; a `srcset` only from renditions verified in R2 by HEAD (`311-314`; `optimize-image-markup.ts:1-45`; `publishedVariantExists` 78-82).
   - `injectPixels` — Meta/TikTok base code from `projects.metaPixelId/tiktokPixelId` (`318-321`; `pixel-injector.ts:35-85`).
   - `injectLeadsRuntime` — the lead capture script with the capture URL and the pending deployment id (`325-331`; see section 8).
   - `injectWanditBadge` — the "Made with Wandit" badge; hidden only when `hideWanditBadge && ownerIsEntitled` (`336-338`; `badge-injector.ts:57-85`). Entitlement is a subscription EXISTS query (`deployments.repository.ts:77-87`).
   - `assertNoEditorArtifacts` — refuses any `__wandit-` marker (`340`; `pixel-injector.ts:27-33`).
   Each injector replaces its own canonical block and returns the input untouched if an unknown carrier of its id survives.
5. Asset preflight `assertPublishedAssetsReachable` (`342`, `413-436`). It collects `img/src`, `srcset`, `video`, `poster`, preload images, and CSS `url()` (`asset-validator.ts:27-69`). Relative or root-relative URLs are structural failures because the edge serves the HTML for every path (`asset-validator.ts:1-12`, `207-238`). Absolute URLs are probed with HEAD/GET; only 404/410 block (`25`, `240-272`). Private/loopback targets are refused (SSRF guard, `276-344`). Env `SITE_PUBLISH_ASSET_CHECK=false` skips the check (`417-419`).
6. Write R2: archive first (`publishedArchiveKey`), then overwrite `publishedCurrentKey` (`346-351`). This flips the live site for every host of the project at once. R2 is strongly consistent.
7. Write the slug KV pointer `domain:{slug}.{SITES_DOMAIN}` → `{projectId, slug, source:"slug"}` (`356`, `537-556`). It is written on every publish to heal old sites.
8. Promote the row: demote `active` → `superseded`, then `pending` → `active` in one transaction (`358-361`; `deployments.repository.ts:186-235`). A unique violation on the slug becomes `SlugTakenError` (223-231).
9. If the slug changed, delete the old slug pointer (`364-367`).
10. On failure after the live flip but before promotion, `restorePreviousLiveState` rewrites `current.html` from the previous archive and removes a new slug pointer (`368-380`, `574-609`). Then `markFailed` (`384-396`). Errors surface as `PUBLISH_FAILED` (502), `SLUG_TAKEN` (409), `ASSETS_UNREACHABLE` (422), `NO_VERSION` (422), `PUBLISH_UNAVAILABLE` (503) (`site.errors.ts`).

Other behaviors:
- `healStalePending` marks pending rows older than 35 minutes as failed on every read (`deployments.repository.ts:62`, `329-344`).
- `rollback` reads the archived bytes of the target deployment (fallback: the version's draft) and runs the same pipeline with `requestedSlug: undefined` (`sites.service.ts:181-231`).
- `unpublish` marks the row `unpublished`, deletes `current.html`, and deletes the slug KV key. Custom-domain KV keys stay (`233-254`).
- `liveUrl` is `https://{slug}.{SITES_DOMAIN}` (`611-627`; `SITES_DOMAIN` default `wandit.app`, `packages/env/src/server.ts:271`). The web Settings tab shows it (`apps/web/src/features/workspace/components/settings/publish-section.tsx:152-181`).
- Publishing captures the `site_published` analytics event (`sites.service.ts:170-172`).

### 3.4 Async publish is a scaffold only

- `apps/worker/src/processors/publish.processor.ts:1-18` is a BullMQ processor that returns `{ processed: false, reason: "Processor scaffold only" }`. `PUBLISH_QUEUE` is defined in `packages/jobs/src/index.ts:15,78`. The real publish runs inside the API request. The doc says the row lifecycle is "queue-shaped so an async swap is a drop-in" (`docs/features/publishing-serving.md:12`).

### 3.5 Republish script

- `apps/server/scripts/republish-active-sites.ts` (`pnpm sites:republish-active`, `apps/server/package.json:16`). It selects every `active` deployment (243-267) and calls the private `runPublishPipeline` through a narrow cast (98-112, 313-318) so republished sites take the exact dashboard path. Guardrails refuse a non-production bucket, a localhost `BETTER_AUTH_URL`, or a non-production `R2_PUBLIC_BASE_URL` (188-207). Flags: `--dry-run`, `--project`, `--limit`, `--concurrency`, `--i-know-what-im-doing` (114-177).

## 4. Edge worker: how a hostname maps to a deployment

### 4.1 Deployment and bindings

- Worker name `wandit-edge`, route `*/*` on zone `wandit.app` (`apps/edge/wrangler.jsonc:2,24`). KV binding `PTR` (namespace id at line 29). R2 binding `SITES` → `wandit-production` (34). `nodejs_als` flag and `version_metadata` for Sentry (7-9). Source maps uploaded (13). No `SENTRY_DSN` in config; set as a secret (15-16).
- Local twin `wrangler.dev.jsonc` drops `routes` only and binds `wandit-pages-dev` (1-20). Scripts: `wrangler dev --config wrangler.dev.jsonc --port 8799`, `wrangler deploy`, `vitest run` (`apps/edge/package.json:5-11`).
- The deploy is manual with `wrangler deploy`. There is no CI workflow for the edge. The only workflows are `.github/workflows/trigger-deploy.yml` (Trigger.dev tasks) and `mobile-testflight.yml`. UNVERIFIED who deploys and when. Git history: `27ab3dcd` (first publish pipeline + edge), `40a8e5ce` (Sentry), `9a5faf00` (bind SITES to production bucket).

### 4.2 Request algorithm (`apps/edge/src/index.ts`)

1. `host = url.hostname.toLowerCase()` (121).
2. Passthrough for `wandit.app`, `www.wandit.app`, `api.wandit.app`: `fetch(request)` to the origin (45-50, 124-126). The dashboard must also add route exclusions for these hosts (`docs/features/edge-serving.md:64-70`). Note: the API lives at `api.wandit.dev` per `republish-active-sites.ts:35`, so `api.wandit.app` is a reserved label, not the live API. UNVERIFIED.
3. `customers.wandit.app` (the SaaS fallback origin) and bare local probes answer a plain-text health body (54, 129-137).
4. Any method other than GET/HEAD → 405 (140-145).
5. A host that is not under `.wandit.app` and does not start with `www.` → 301 to `https://www.{host}{path}{query}` (150-155). No apex KV key ever exists.
6. `caches.default.match(request)` — legacy Cache API, keyed on the full URL including host (164-169). The comment explains why the new host-blind `ctx.cache` must not be used (157-163; `wrangler.jsonc:35-41`).
7. KV get `domain:{host}` as JSON with `cacheTtl: 60` (171-174). The pointer type requires only `projectId`; other fields are optional (66-70; contract in 13-17).
8. No pointer → 404 branded page, `no-store` (176-178). `status: "suspended"` → 403 (180-182).
9. R2 get `published/{projectId}/current.html` (184). Missing → 404 "not published yet" (186-188).
10. `If-None-Match` equal to `object.httpEtag` → 304 (190-198).
11. Response: body stream, `cache-control: public, max-age=60`, `content-type: text/html; charset=utf-8` (hard-coded), `etag` (200-207).
12. `ctx.waitUntil(cache.put(...))` (212-217).
13. Any thrown error → console + Sentry + branded 500 (98-109). The handler is wrapped with `Sentry.withSentry` (113).

Consequences:
- The URL path is never read. `/pricing`, `/robots.txt`, `/favicon.ico`, `/assets/x.js` all return the same HTML document.
- The Worker serves no assets from R2. Every asset must be an absolute URL on another origin (`assets.wandit.app` or third party). This is why the publish preflight rejects relative URLs.
- No security headers (CSP, X-Frame-Options) are set on published pages. The web app's `frame-ancestors 'none'` applies only to the dashboard (`apps/web/vercel.json:5-24`).
- Branded fallback pages are fully inline (`apps/edge/src/pages.ts:1-104`).

### 4.3 Tests and local dev

- `apps/edge/test/router.spec.ts` runs on `@cloudflare/vitest-pool-workers` with real local KV/R2 bindings. It covers: slug host 200 + ETag + cache-control (37-51), 304 (53-69), two-field domain pointer (71-83), apex 301 with path/query (85-94), unknown host 404 `no-store` (96-104), suspended 403 (106-116), pointer without object 404 (118-129), fallback origin health (131-138), passthrough hosts (140-157), 405 (159-168), cache hit after object delete (170-186).
- `apps/edge/scripts/seed-local.mjs` seeds local R2 (`wandit-pages-dev/published/{projectId}/current.html`) and KV pointers for a slug host, `www.brand.com` (two-field shape), and `banned.wandit.app` (suspended) (68-108). `wrangler dev` rewrites `request.url` from a spoofed `Host` header (`apps/edge/README.md:28-36`).

### 4.4 One-time Cloudflare dashboard setup

From `docs/features/edge-serving.md:52-79`: wildcard proxied `*` AAAA `100::` and `customers` AAAA `100::`; SSL for SaaS enabled with fallback origin `customers.wandit.app`; Worker route exclusions for the three app hosts; KV namespace id and bucket name in `wrangler.jsonc`; Universal SSL covers first-level subdomains only (two-level hosts like `x.y.wandit.app` are NOT covered, 74-77); never onboard `*.wandit.app` as a SaaS hostname (78-79). Limits: Workers Free 100k req/day; SaaS hostnames first 100 free then $0.10/month; a freed slug can serve the old page for up to ~60 s (81-88).

## 5. KV pointer writers (server side)

`apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts`:
- `putHostPointer(host, pointer)` writes `domain:{host}` (27-32). `deleteHostPointer` (34-36). `putDomainPointer` and `deleteDomainPointer` canonicalize to `www.` first (38-47; `domain-hosts.ts:1-3`).
- KV writes go through the Cloudflare REST API `PUT/DELETE /accounts/{account}/storage/kv/namespaces/{ns}/values/{key}` with a 10 s timeout (77-127). The account id is resolved once from `CLOUDFLARE_ZONE_ID_WANDIT_APP` (129-167). Required env: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_ZONE_ID_WANDIT_APP` (`isKvConfigured` 69-75; `packages/env/src/server.ts:245-247`).
- `refreshProjectDomains` exists but is uncalled by design, because the R2 key derives from `projectId` alone (49-66). This is the hook to use if a pointer ever needs per-publish data.

Callers:
- Publishing: `sites.service.ts:571-573` (slug pointer), `586` (delete).
- Domain activation (Trigger task path): `domain-activation.step.ts:94-101` writes `{projectId, source:"domain"}`; then a compare-and-set to `active` (120-156). Failed activation deletes the pointer (`domain-assets-cleanup.ts:131-147`).
- Domain activation (API path, manual verify): `domains.service.ts:423-426`.
- Detach: deletes the pointer when the row is active (`domains.service.ts:340-342`), deletes the www and apex custom hostnames best-effort (344-354), never deletes the zone (356-366).

## 6. Custom domains

### 6.1 Data

`packages/db/src/schema/domains.ts`: `source` `purchased | external` (19); status `registering | configuring | active | failed | expired | transferred_out` (21-28); `projectId` nullable with `set null` on project delete (37-39); `isPrimary` with one primary per project (50, 90-92); `cfCustomHostnameId` (67); `dns` jsonb holds records, the Trigger verification cursor, and all apex-zone state (68); unique lowercase `name` (89, 93-96); `provider` `namecom | openprovider` (101-104).

### 6.2 Routes

`apps/server/src/modules/domains/presentation/http/controllers/domains.controller.ts`: `GET domains/search` (58), `GET projects/:projectId/domains` (67), `GET domains/:id/dns-status` (82), `POST projects/:projectId/domains/external` (98), `POST domains/:id/verify` (117), `POST domains/:id/auto-renew` (127), `POST domains/:id/primary` (139), `POST domains/:id/transfer-unlock` (154), `DELETE domains/:id` (166). Purchase checkout is in the orders module (`POST /api/v1/orders/domain`, `docs/features/custom-domains.md` API table).

### 6.3 Cloudflare for SaaS

- `CustomHostnameService` creates a custom hostname in the `wandit.app` zone with `ssl: { method: "http", type: "dv" }` (`custom-hostname.service.ts:20-30`), a bare-name apex hostname (37-45), exact-name lookup (55-71), a PATCH re-validation nudge (77-84), delete (86-88). API: `/zones/{CLOUDFLARE_ZONE_ID_WANDIT_APP}/custom_hostnames` (126).
- Required DNS for a BYO domain: `www CNAME customers.wandit.app` (`domain-provisioning-rules.ts:47-56`) plus ownership/validation TXT records extracted from the API response (`custom-hostname.service.ts:179-215`). `DOMAINS_FALLBACK_ORIGIN` default `customers.wandit.app` (`packages/env/src/server.ts:269`).
- Apex serving (`docs/features/custom-domains.md`, "Canonical host"): the pipeline creates a Cloudflare zone for the domain in Wandit's account (`CLOUDFLARE_ACCOUNT_ID`), writes DNS-only CNAMEs `@` and `www` → `customers.wandit.app` (`domain-provisioning-rules.ts:63-72`), creates an apex custom hostname, and delegates nameservers (purchased: via Name.com `setNameservers`; external: the owner switches nameservers, "Option A"). The Free-plan SaaS verifier requires a CNAME to the zone; a flattened ANAME at the registrar fails (PRs #173/#176 noted in the doc). Kill switch `DOMAINS_APEX_ZONE_ENABLED` (`server.ts:259`). Backfill script `pnpm domains:backfill-apex`.
- The Worker then 301s the apex to `www` (section 4.2 step 5).

### 6.4 Orchestration

- Trigger.dev v4 tasks in `apps/server/src/trigger/`: `domain-purchase.task.ts`, `domain-configuration.task.ts`, `order-refund.task.ts`, `reconcile-domain-purchases.task.ts`, `reconcile-order-refunds.task.ts`, `domain-renewal-notices.task.ts`, `domain-registrar-sync.task.ts`, `external-domain-delegation-reminders.task.ts`. Queues `domain-operations` and `order-refunds` with `concurrencyLimit: 1` (`docs/features/custom-domains.md`, "Tasks, queues, and schedules").
- Verification uses a durable cursor in `domains.dns.triggerConfiguration` with `wait.until`, 100 windows totaling about 24 h (doc, "Durable verification cursor").
- Registrar: Name.com CORE v1 behind a `DomainProvider` port (`apps/server/src/modules/domains/infrastructure/namecom/namecom.provider.ts`, `domain/ports/domain-provider.port.ts`). Wandit is the reseller; the customer is the registrant; payment via Stripe Checkout in the orders module.
- CI: `.github/workflows/trigger-deploy.yml` deploys tasks on push to `main` (prod) and `staging` (staging).

### 6.5 Serving is registrar-independent

Every active domain resolves through the same `domain:{host}` KV key and the same `published/{projectId}/current.html` object. Publishing never touches domain pointers. Unpublish deletes only `current.html` and the slug key; domain pointers then hit the "not published yet" page (`sites.service.ts:240-246`).

## 7. Caching and invalidation

- Edge HTTP cache: `caches.default` + `Cache-Control: public, max-age=60` + `ETag` (`index.ts:164-169, 200-217`). No purge on publish. Republish propagates within about 60 s (`docs/features/edge-serving.md:37-42`). Negative responses are `no-store`.
- KV read cache: `cacheTtl: 60` (`index.ts:172`). Combined with the HTTP cache, a slug freed and reclaimed can show the old page for up to ~60 s (`edge-serving.md:86-88`).
- Media objects: `immutable, max-age=31536000` on the R2 object; served through `assets.wandit.app`, not through the Worker.
- Browser: the ETag comes from the R2 object (`object.httpEtag`), so a 304 is possible after 60 s.

## 8. Lead and order capture from a published page

### 8.1 Injection at publish

- `injectLeadsRuntime(html, { captureUrl, deploymentId })` inserts `<script id="wandit-leads-runtime">` before the last `</body>` (`apps/server/src/modules/leads/runtime/inject-leads-runtime.ts:12, 22-57`). `captureUrl = BETTER_AUTH_URL + /api/public/leads/{publicFormId}` (64-69; `packages/contracts/src/v1/leads.ts:619`). `projects.publicFormId` is an unguessable uuid (`projects.ts:43`). The deployment id is the pending row id (`sites.service.ts:325-331`).
- The runtime is one inline IIFE with no dependencies (`leads-runtime-script.ts:1-25`). Two capture paths: the `wandit:lead` CustomEvent (464-485) and a heuristic capture-phase `submit` listener with a 2.5 s grace window (528-544). Send: `fetch(captureUrl, { method: "POST", mode: "cors", credentials: "omit", keepalive: true, headers: { "Content-Type": "application/json" } })` with retries on 429/5xx (282-310). `pagehide` → `navigator.sendBeacon` with the pending payload (442-455, 546-548). Payload cap 12 KiB (50, 235-257). It reads the honeypot `[data-wandit-hp]` and sends it as `_hp` (197-203, 396-397). It collects UTM, `fbclid`, `ttclid`, referrer, landing URL (170-195). After a 2xx it fires Meta `Lead`/`Purchase` and TikTok `Lead`/`CompletePayment` with `currency: "DZD"`, then calls `window.wanditFlushPixels()` (320-364).

### 8.2 The endpoint

- `POST /api/public/leads/:publicFormId` (`leads-capture.controller.ts:26-41`). `@Public()` (no auth), `@AllowCrossSiteWrite()` (bypasses the Origin guard), `@HttpCode(200)`. Client IP from the first `x-forwarded-for` hop, used only for the rate limiter (64-73).
- CORS: a route-scoped policy `origin: "*"`, `credentials: false`, methods `POST`, allowed header `Content-Type`, exposed `Retry-After`, `maxAge` 86400 (`public-leads-cors.ts:1-21`). `main.ts` installs it through a CORS delegator; every other URL keeps the app/admin policy with credentials (`main.ts:89-128`).
- `text/plain` bodies are parsed as strings with a 16 KiB limit for the beacon path (`main.ts:65-67`). `application/x-www-form-urlencoded` is removed globally (`main.ts:155-163`).
- Body schema `leadCaptureBodySchema`: `_hp`, `attribution`, `commune`, `deploymentId` (uuid, `.catch(undefined)`), `extras`, `name` (1-200), `phone` (6-40), `wilaya` (`packages/contracts/src/v1/leads.ts:471-480`). Response is always `{ ok: true }` (486).

### 8.3 Anti-spam and dedupe

- Honeypot: a filled `_hp` answers 200 and stores nothing (`leads-capture.service.ts:71-74`).
- Phone must normalize to E.164 or the request is 400 (76-79; `normalize-lead-phone.ts`).
- Throttle: in-memory sliding windows, 60 per form+IP per minute, 300 per IP per minute; single-instance only, "swap to Redis before running more than one API instance" (`leads-capture-throttle.ts:1-14`). 429 with `Retry-After` (`controller 56-58`).
- Duplicate window: same phone + project within 2 minutes updates the recent row (`leads-capture.service.ts:31, 105-119`).
- `deploymentId` from the page is validated against the project's deployments with no status filter; a missing id falls back to the active deployment (`88-103`; `leads.repository.ts:445-460`). It also stamps `productSku` from the published version (`110-114`).
- Turnstile is NOT used here. `TURNSTILE_SECRET_KEY` and the `x-captcha-response` header serve only email auth (`packages/env/src/server.ts:205`; `main.ts:115`; `packages/env/src/web.ts:31`).
- New leads trigger a push notification via `LeadPushDispatcherService` (123-138).

## 9. The `apps/web` `s.$slug` route is not site serving

- `apps/web/src/routes/s.$slug.tsx:1-20` is a TanStack Router file route `/s/$slug`. It redirects the browser to `storyLinksRoutes.click(slug)` = `/api/v1/s/{slug}` on the API (`packages/contracts/src/v1/story-links.ts:205`). It is the story-links (short link) click redirect, not a published-site route.
- `apps/web/vercel.json:26-38` rewrites `/api/*` and `/s/:slug` to `https://server-production-4214.up.railway.app/...` and everything else to `/index.html`. The SPA route is the fallback when the static host does not apply the rewrite.
- Published sites are never served by the web app. The web app only shows the `liveUrl` and previews drafts.

## 10. Draft preview path (for comparison)

- The web gets draft HTML as JSON from `GET /api/v1/pages/versions/:versionId/html` (`pages.controller.ts:194-207`). The comment states this is a JSON envelope on purpose so the document is never served as a page.
- The Page tab renders it with `<iframe srcDoc={html} sandbox="allow-scripts allow-forms">` (`apps/web/src/features/workspace/components/page/page-tab.tsx:705-708`). The preview-editor script is injected at render time (10). `projects.previewToken` exists for "future preview URLs" (`projects.ts:45`); no preview host exists in the Worker. The docs planned `{token}.<preview-domain>` with a dedicated domain "purchase pending" (`docs/features/publishing-serving.md:9`). UNVERIFIED whether the domain was bought.

## 11. Hosting and deploy scripts

- API and worker: Railway (`docs/observability.md:19-23`; the Vercel rewrite target `server-production-4214.up.railway.app`). API public URL `https://api.wandit.dev` (`republish-active-sites.ts:35`). Web origin `wandit.dev` (`main.ts:90-91`).
- Web: `apps/web/vercel.json` exists; `docs/observability.md:21` also lists a "Railway web service". UNVERIFIED which host serves `wandit.dev` today.
- Edge: `pnpm --filter edge deploy` → `wrangler deploy` with `wrangler.jsonc`; secrets via `wrangler secret put SENTRY_DSN` (`docs/observability.md:25`). No CI.
- Trigger.dev tasks: GitHub Actions on push to `main`/`staging` (`.github/workflows/trigger-deploy.yml`).
- Server scripts (`apps/server/package.json:5-21`): `sites:republish-active`, `domains:backfill-apex`, `images:backfill-variants`, `dev:trigger`.
- Root scripts are turbo wrappers only (`package.json:9-23`).
- Docs that were asked for but not present: `static-og-tags` and a "made-with-wandit badge" doc do not exist under `docs/`. The badge behavior is documented in code only (`badge-injector.ts:1-21`).

## 12. Assessment: can this serve a built Vite/React SPA?

A Vite build produces `index.html` plus hashed files under `assets/` and files copied from `public/`. Today's stack cannot serve that as-is. The list below separates what stays, what breaks, and what must change.

### 12.1 What works unchanged

- Host → project resolution: the `domain:{host}` KV pointer, the pointer contract, the Worker's host parsing, passthrough, apex redirect, suspended state, branded fallback pages, Sentry wrapper, and the vitest-pool-workers test harness (`apps/edge`).
- The whole custom-domain pipeline (SaaS hostnames, apex zones, Name.com, Trigger tasks, KV writes at activation). It never depends on the page format.
- The `deployments` table shape, slug rules, reserved slugs, one-active-per-slug and one-active-per-project indexes, `healStalePending`, demote-then-promote, and the compensation pattern in `SitesService`.
- The R2 client and key helpers, `IMMUTABLE_ASSET_CACHE_CONTROL`, `publicAssetUrl`, `publicAssetKeyFromUrl`, uploads and variants.
- The lead capture endpoint and its `origin: "*"` CORS policy. A React app can call `POST /api/public/leads/{publicFormId}` directly, or the injected runtime can stay in `index.html` and keep listening for `wandit:lead` events and form submits.
- The `injectPixels`, `injectLeadsRuntime`, and `injectWanditBadge` transforms. They only need a `<head>` and a `</body>` and work on a Vite `index.html`.
- The republish script pattern (reuse the service pipeline over the fleet).

### 12.2 What breaks

1. One object per site. `publishedCurrentKey` is a single HTML file (`r2.ts:83-85`). A SPA is many files.
2. Path is ignored. The Worker returns the same document for every path and hard-codes `text/html` (`index.ts:184, 200-207`). `/assets/index-abc123.js` would return HTML.
3. No asset serving from the Worker. Vite emits root-relative `/assets/...` URLs. The publish preflight rejects root-relative URLs by design (`asset-validator.ts:1-12, 207-238`).
4. The transform chain assumes a generated static page: `inlineKnownCdnScripts`, `optimizeFontLoading`, `optimizeImageMarkup`, `emitResponsiveImages` parse the whole page with cheerio and rewrite `<img>` tags. A SPA's `index.html` has no content images; those passes are no-ops at best and wrong at worst (React-rendered images are not in the HTML).
5. Rollback replays one archived HTML through the transforms (`sites.service.ts:181-231`). With many files, rollback must repoint to an immutable build prefix instead.
6. `deployments.versionId` has a composite FK to `versions` (`deployments.ts:66-70`), and `versions.r2Key` is one HTML key. V2 needs a "build" (source snapshot, build output prefix, tool version) instead of an HTML version.
7. Publish is synchronous in the API request (`sites.service.ts:1-14`). A build in a sandbox plus an upload of hundreds of files must run as a background task (Trigger.dev, like `generate-page.task.ts`), with the existing `pending → active | failed` row lifecycle.
8. Preview: `srcDoc` cannot host a SPA with routing and hashed assets. V2 needs a real URL: the sandbox dev server behind a preview proxy, or a preview deployment served by the Worker. Universal SSL does not cover two-level hosts (`edge-serving.md:74-77`), so a preview host must be first-level (`p-{token}.wandit.app`) or on a separate zone.
9. Content types: the extension map (`r2.ts:364-380`) lacks `.map`, `.wasm`, `.woff`, `.ttf`, `.webmanifest`, `.mjs`, `.avif`. The Worker must set the type per object, from R2 `httpMetadata` or from the extension.
10. The single-file builder guard (`site-builder-agent.ts:351-354`) and the one-`landing_page`-artifact invariant (`artifacts.ts:48-50`) do not fit a multi-file project.

### 12.3 What must change (proposed shape)

1. Storage layout: `published/{projectId}/d/{deploymentId}/{path}` — one immutable prefix per deployment, written once, `immutable` cache-control on hashed `assets/*`, short/no cache on `index.html`. Keep one small mutable flip object `published/{projectId}/current.json` → `{ deploymentId, indexKey, ... }` so a publish stays a single strongly consistent write, exactly like `current.html` today. Alternative: put `deploymentId` in the KV pointer. That is worse: KV is eventually consistent (60 s `cacheTtl`), and the domain pipeline writes pointers without deploy knowledge, so every publish would also need `refreshProjectDomains` (`domain-routing.service.ts:49-66`) for every active domain.
2. Worker routing: after the pointer lookup, read the flip object (cache it), then `SITES.get(prefix + path)`. If the object is missing and the request accepts HTML (or the path has no extension), serve `index.html` (SPA fallback). Otherwise 404 with `no-store`. Set `content-type` from `object.httpMetadata.contentType`, honor `Range` for media (R2 supports it), return `cache-control` from the object (`immutable` for hashed assets, `max-age=60` or `no-cache` + ETag for `index.html`). Keep `caches.default` (keys on host + path). Consider `Cache-Control` per path prefix inside the Worker so a misconfigured upload cannot pin `index.html` for a year.
3. Publish task: build in the sandbox, collect `dist/`, run the HTML injectors on `dist/index.html` only, upload all files in parallel to the immutable prefix (S3 SDK, parallelism ~8), verify the upload manifest (every file listed exists; replaces the URL probe of `asset-validator.ts`), then write the flip object, then promote the row. Rollback = write the flip object for an older deployment (no transform replay needed if `index.html` is stored already injected; the leads runtime's `deploymentId` then reports the old deployment, which the capture endpoint already accepts, `leads.repository.ts:445-460`).
4. Unpublish = delete the flip object (and the slug key). Domain pointers stay, as today.
5. Deployments schema: add `kind` (`static_page | web_app | ...`), `buildId`/`prefix`, `fileCount`, `bytes`; relax the FK to `versions` for the new kind.
6. Edge deploy in CI (wrangler action) and a vitest matrix for path routing, SPA fallback, content types, ranges, and cache headers.
7. Cookie isolation: all sites share the `wandit.app` registrable domain. The doc already plans a Public Suffix List submission (`publishing-serving.md:19`). Apps that set cookies make this urgent. `localStorage`-based auth (Supabase default) is per origin and is fine.
8. Optional: security headers per site (a default CSP, `X-Content-Type-Options`), configurable per project.

### 12.4 What changes for full-stack apps

- The Worker serves static bytes only and answers 405 to non-GET (`index.ts:140-145`). Server logic must live elsewhere.
- Lovable Cloud model (Supabase per app): the SPA talks to Supabase directly (auth, database, storage, edge functions). The publish task must inject the app's public config (`VITE_SUPABASE_URL`, anon key) at build time in the sandbox; secrets must never enter the bundle. Domain activation and publish must register `https://{slug}.wandit.app` and each active custom domain as allowed auth redirect/site URLs in the app's backend. The natural hook points are `DomainActivationStep.execute` (`domain-activation.step.ts:63-104`) and the promote step in `SitesService`.
- Cloudflare-native alternative: run per-app server code (SSR, API routes, cron) with Workers for Platforms (a dispatch namespace). The current `*/*` Worker would become the dispatcher: host → pointer → `env.DISPATCHER.get(scriptName)`. This keeps custom domains and KV as they are. Pricing and limits UNVERIFIED in this repo; nothing in the code prepares for it today.
- CORS for the app's own API: not a Wandit concern if the app's backend is Supabase; if Wandit hosts the backend, it must allow the slug host and every active custom domain.
- Leads: keep `POST /api/public/leads/{publicFormId}` as a Wandit-hosted capture API for COD templates. A V2 template can call it from React without a database of its own.
- Emails, jobs, logs, secrets, connectors: these belong to the backend layer, not to serving. The serving layer only needs to expose the app's public URL(s) to that layer.
- Mobile (Expo): not served by the edge. The `deployments` table could gain a `kind: "mobile"` row for EAS builds, but that is a separate publish path.

## 13. Reusable as-is

- `apps/edge` skeleton: host parsing, passthrough set, apex redirect, `caches.default` strategy, KV pointer read with `cacheTtl`, suspended/404/500 pages, Sentry wrapper, seed script, vitest-pool-workers setup, `wrangler.jsonc` + `wrangler.dev.jsonc` split.
- `DomainRoutingService` (REST KV writer) and the pointer contract `{projectId, ...}`.
- The entire `domains` module and its Trigger tasks (Cloudflare for SaaS, apex zones, Name.com, Stripe orders, reconcilers).
- `deployments` table, `DeploymentsRepository` (FOR UPDATE insert, demote-then-promote, stale heal, slug checks), `slugify`, reserved slugs, `site.errors`.
- `SitesService` structure: KV/R2 gates, slug resolution, pending row, archive-then-flip order, pointer write, promote, compensation, unpublish, `buildCurrent` UI state.
- `r2.ts` client and key/content-type helpers, `putSiteFile` with per-call cache-control, `listObjectsByPrefix`, `publicAssetKeyFromUrl` boundary checks.
- Uploads service (allowlist, magic bytes, sharp optimization, variants) and the Assets tab listing.
- Lead capture endpoint, CORS policy, throttle, duplicate window, `deploymentId` fallback logic, the leads runtime script and its injector.
- `injectPixels`, `injectWanditBadge` (entitlement rule in `DeploymentsRepository.getAccessibleProject`).
- `republish-active-sites.ts` pattern and guardrails.
- Dashboard setup runbook in `docs/features/edge-serving.md`.

## 14. Open questions

1. How is `assets.wandit.app` bound to the `wandit-production` bucket (R2 custom domain? cache rules?). Not in the repo.
2. Who deploys `wandit-edge` and from where? No CI exists. Is the account on Workers Paid?
3. Was the preview domain bought? Is a first-level `p-{token}.wandit.app` acceptable for V2 previews, given Universal SSL limits?
4. Will V2 apps run on Supabase per project (Lovable Cloud model) or on Cloudflare (Workers for Platforms)? The answer decides whether the Worker stays static-only.
5. Should the per-publish flip live in an R2 manifest object (recommended) or in the KV pointer (requires `refreshProjectDomains` on every publish)?
6. Should V2 keep the leads runtime injection into `index.html`, or ship a small SDK that templates import?
7. Public Suffix List submission for `wandit.app`: needed before apps set cookies on `{slug}.wandit.app`.
8. Which host serves `wandit.dev` in production (Vercel per `vercel.json`, or Railway per `docs/observability.md:21`)?
9. Does the `api.wandit.app` passthrough in the Worker still matter, given the API is at `api.wandit.dev`?
10. Should hashed-asset requests bypass `caches.default` (they are already immutable at the browser) to reduce Cache API writes, or keep them for R2 cost?
