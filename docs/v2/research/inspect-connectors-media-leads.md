# Inspection: connectors, media and leads — what a V2 generated app must keep working with

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev`). Worktree: `.claude/worktrees/v2-builder`.
All paths are repo-relative. Line numbers come from the files as read on this date.
Items I could not prove from code are marked **UNVERIFIED**.

---

## 1. Short summary

- "Connectors" in V1 are **agent-side MCP integrations**. A user connects Meta Ads, TikTok Ads or Higgsfield with OAuth. The chat agent then gets the provider's MCP tools. Nothing from a connector is injected into a generated page. This is not the Lovable Cloud meaning of "connector" (Supabase, Stripe, Resend wired into the generated app). V2 needs a new concept for that.
- The **lead pipeline** is the one feature that lives inside the generated page. The page dispatches a `wandit:lead` DOM event. A script injected at publish time posts the lead to `POST /api/public/leads/{publicFormId}`. The server stores the lead, sends an Expo push to the owner's phone, and (on demand or every 30 minutes) rewrites a Google Sheet. The Leads tab is the CRM.
- **COD orders are leads.** There is no order table for COD. The `orders` module is for Stripe domain purchases only.
- **Image generation** has two entry points: the site builder's `generate_image` tool (during a build) and the chat's `generate_image` tool (background, Trigger.dev). Both write to R2 through one key layout. Video runs through Kling on the AI Gateway or through the Higgsfield connector.
- V2 must keep: the public lead capture endpoint and contract, the pixel conversion behaviour, the R2 key layout for assets, and the image generator as a server-side tool. V2 must replace the publish-time HTML injection with an SDK or generated helper file, because a bundled React app or an Expo app has no `</body>` to patch.

---

## 2. What "connectors" means today

### 2.1 Catalog and seeds

- Catalog table `mcp_connectors` and per-user table `mcp_connections`: `packages/db/src/schema/mcp-connectors.ts:24-92`.
- Seed script: `apps/server/scripts/seed-mcp-connectors.ts:4-41`. It upserts three rows by `slug`:
  - `tiktok-ads` — `authKind: "mcp_dcr"`, MCP server `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer` (lines 5-16).
  - `meta-ads` — `authKind: "oauth_prereg"`, MCP server `https://mcp.facebook.com/ads`, Facebook OAuth v25.0, scopes `ads_management,ads_read,ads_mcp_management,business_management` (lines 17-28).
  - `higgsfield` — `authKind: "mcp_dcr"`, MCP server `https://mcp.higgsfield.ai/mcp` (lines 29-40).
- Two auth kinds (`packages/db/src/schema/mcp-connectors.ts:19-22`):
  - `mcp_dcr`: OAuth Dynamic Client Registration discovered from the MCP server at connect time. Client: `apps/server/src/modules/mcp-connectors/infrastructure/oauth/mcp-dcr.client.ts`.
  - `oauth_prereg`: pre-registered OAuth app. Wandit needs `META_APP_ID` / `META_APP_SECRET` (`packages/env/src/server.ts:220-221`). Adapter: `infrastructure/oauth/provider-adapters.ts:46-50`. When the credentials are missing, the connector shows as `available: false` ("Coming soon") — `application/services/mcp-oauth.service.ts:502-520`.
- The `tool_policy` jsonb column can carry an `allowlist` (`domain/mcp-tool-policy.ts:3-7`).
- Tokens are encrypted at rest with `BETTER_AUTH_SECRET` (`infrastructure/persistence/token-crypto.ts:13-29`). Refresh is single-flight per connection (`application/services/mcp-connections.service.ts:36-78`).

### 2.2 HTTP API

`apps/server/src/modules/mcp-connectors/presentation/http/controllers/mcp-connectors.controller.ts`:
- `GET /api/v1/mcp/connectors` — list with status (line 45).
- `POST /api/v1/mcp/connectors/:slug/connect` — returns `authorizeUrl` (line 50).
- `GET /api/v1/mcp/connectors/callback` — public OAuth callback, 302 back to the app (line 75).
- `POST /api/v1/mcp/connectors/complete` — mobile finish with code+state (line 65).
- `DELETE /api/v1/mcp/connectors/:slug` — disconnect (line 108).
- Contract: `packages/contracts/src/v1/mcp-connectors.ts:14-76`. The UI never says "MCP" (comment at lines 48-53).
- Web client: `apps/web/src/features/connectors/api/connectors.services.ts`. Native client: `apps/native/features/connectors/api/connectors.requests.ts`.

### 2.3 How connector tools reach the chat agent

`apps/server/src/modules/mcp-connectors/application/services/mcp-chat-tools.service.ts` (3292 lines):
- `resolveToolsForUser(subject, parentEventId, chatId)` (line 646) loads the user's connections, opens one MCP client per connector with `createMCPClient` from `@ai-sdk/mcp` (imports at lines 3-7), and returns `{ tools, approvalMap, notices, connectedSlugs, configuredSlugs, close }` (lines 779-789).
- Tools are `dynamicTool` wrappers (import line 16). A "discovery door" `run_platform_tool` exposes hidden operations (lines 760-777).
- The chat service calls it at `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:718-722` and passes `mcpResult.tools` and `mcpResult.approvalMap` into the agent at lines 895-896.
- Catalogs are cached 10 minutes; TikTok hidden catalog 60 minutes (`application/services/mcp-runtime-cache.service.ts:4-6`).

### 2.4 Guards and telemetry

- USD budget guard: `domain/ad-budget-guard.ts`, called at `mcp-chat-tools.service.ts:1806`.
- Money-based approvals: `domain/ads-approval-policy.ts:1-36` (comment states the rule: card only when money can move or work is destroyed).
- 72-hour change window: `domain/ads-change-window-guard.ts:1-28`, called at `mcp-chat-tools.service.ts:2022`.
- Telemetry rows: `connector_operation_events` with `feature` enum `ads_analysis | ads_launch | other` and `target_entity_ids text[]` (`packages/db/src/schema/connector-operation-events.ts:13-76`).
- Lifecycle hooks: `ads_connected` after token save (`mcp-oauth.service.ts` imports `LifecycleEventsService` at line 26), `ads_analysis_completed` and `campaign_launched` from `mcp-chat-tools.service.ts` (`domain/campaign-launch.ts`). Documented in `docs/features/lifecycle-emails.md:122-125`.

### 2.5 Background connector generations (Higgsfield)

- Tools in `IMAGE_GENERATION_TOOLS` (`generate_image`, `outpaint_image`, `remove_background`, `upscale_image`) and `VIDEO_GENERATION_TOOLS` (`generate_video`, `motion_control`, ...) are intercepted (`domain/connector-generation-metering.ts:18-32`). `higgsfield` is the only monetized connector (line 48-50).
- The intercept writes a `connector_generation_attempts` row (`packages/db/src/schema/connector-generation-attempts.ts:16-50`) and hands off to Trigger.dev task `run-connector-generation` (`apps/server/src/trigger/run-connector-generation.task.ts:1-15`).
- The task replays the MCP call with the user's token, follows the provider job, and extracts media URLs from the result (`extractMediaUrls`, lines 336, 369, 1040). The extractor collects `https` URLs with media extensions (`apps/server/src/modules/connector-generations/domain/extract-media-urls.ts:11-14`).
- I found no R2 upload in that task (`grep putSiteFile` returned nothing). **UNVERIFIED:** connector media appears to stay on provider URLs.
- Read endpoint for the chat card: `GET /api/v1/connector-generations/:attemptId` (`connector-generations.controller.ts:25`).
- Prompt refiner rewrites Higgsfield prompts with `AI_PROMPT_REFINER_MODEL` (`packages/env/src/server.ts:105-108`). Preferred Higgsfield models: `domain/higgsfield-models.ts:2-11`.

### 2.6 Ads brain

- Six skills as TS constants: `apps/server/src/modules/ai-chat/agent/ads/index.ts:29-36`.
- `composeAdsBlock()` appends connected platforms, tracking facts and the skill index to the system context (`ai-chat.service.ts:391, 808`).
- Tracking facts come from `LeadsRepository.getAdsTrackingFacts` (`leads.repository.ts:487-505`): `metaPixelSet`, `tiktokPixelSet`, `published`.
- `read_lead_performance` tool reads funnel counts from the leads table (`agent/tools/read-lead-performance.tool.ts:1-38`, `leads.repository.ts:514-519`).
- Full design in `docs/features/ads-brain.md`.

### 2.7 Is this Lovable-style?

No. Compare:

| Aspect | Wandit V1 connectors | Lovable Cloud / Base44 "connectors" |
|---|---|---|
| Who uses the token | The chat agent (server-side MCP calls) | The generated app at runtime (Supabase, Stripe, Resend keys) |
| Scope | Per user (`mcp_connections.userId`, `packages/db/src/schema/mcp-connectors.ts:57`) | Per project / per app |
| Effect on the generated page | None | Code + env vars in the app |
| Purpose | Media buying, media generation | App backend and third-party APIs |

The PRD names this feature "Campaign integrations + entity tagging" and asks for a dedicated connections table (`docs/PRD.md:82`). The one integration that touches page data is Google Sheets sync, and it does not use `mcp_connectors`. It uses better-auth `linkSocial` with the `drive.file` scope (`packages/contracts/src/v1/lead-sheet-sync.ts:1-16`).

---

## 3. The lead pipeline: from a published form to the CRM

### 3.1 Page contract (what the generated HTML must do)

Source of truth: `docs/features/leads-crm.md:17-19` and the builder prompt `apps/server/src/modules/ai-chat/agent/site-builder/builder-prompt.ts:155`.

- The page makes **no network request**. On valid submit, it runs `document.dispatchEvent(new CustomEvent("wandit:lead", { detail: fields }))`.
- `fields` is flat. Canonical keys: `name`, `phone` (raw), `wilaya`, `commune`. Order keys: `product`, `quantity`, `price`, `delivery`, `total`. Any other field rides under its own key.
- Exactly one honeypot input: `<input type="text" name="website" data-wandit-hp tabindex="-1" autocomplete="off" aria-hidden="true">`.
- The page may listen to `wandit:lead:result` (`{ ok: boolean }`) to show the real success state. The feature-starter vendor script uses it for confetti and stock counters (`apps/server/src/modules/pages/domain/vendor/wandit-feature-starter-js.ts:5`, search `wandit:lead:result`).
- Build-time enforcement for COD pages: `assertValidSite` in `apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts:2211` checks zero `<nav>`, exactly one `<form>`, a `tel` input, a name-capable input, a script that dispatches `wandit:lead`, exactly one honeypot, and a `wandit:lead:result` handler (lines 2260-2345).
- 46 COD worlds and the COD genre layer repeat this contract (`docs/features/cod-worlds.md:74-80`; `agent/worlds/cod/genre.ts`).

### 3.2 Publish-time injection

`apps/server/src/modules/sites/application/services/sites.service.ts:292-335` runs the html→html chain in this order:
1. `inlineKnownCdnScripts` (line 292)
2. `optimizeFontLoading` (line 299)
3. `optimizeImageMarkup` then `emitResponsiveImages` (lines 308-311)
4. `injectPixels` with `project.metaPixelId` / `project.tiktokPixelId` (lines 315-318; injector `sites/domain/pixel-injector.ts:35-80`)
5. `injectLeadsRuntime` with `captureUrl = buildLeadsCaptureUrl(env.BETTER_AUTH_URL, project.publicFormId)` and `deploymentId = pending.id` (lines 322-328; injector `modules/leads/runtime/inject-leads-runtime.ts:22-69`)
6. `injectWanditBadge` (line 333; `sites/domain/badge-injector.ts`)
7. `assertNoEditorArtifacts`, asset preflight, then write `published/{projectId}/v/{deploymentId}.html` and `published/{projectId}/current.html` (lines 337-347).

Key facts:
- The API origin is **baked at publish time** from `BETTER_AUTH_URL` (`docs/features/lead-flow-bugs-and-fixes.md:52-56`).
- `publicFormId` is a random uuid per project with a unique index (`packages/db/src/schema/projects.ts:43,82`).
- Injection inserts one `<script id="wandit-leads-runtime">` before the last `</body>` (`inject-leads-runtime.ts:12,44-56`). An unrecognised carrier of that id returns the document unchanged (line 42).
- The edge worker serves `current.html` from R2 by a KV host pointer with `Cache-Control: public, max-age=60` (`apps/edge/src/index.ts:10-11,171-207`). The worker sets no CSP header, so the injected `fetch` to the API is allowed.

### 3.3 The injected runtime

`apps/server/src/modules/leads/runtime/leads-runtime-script.ts:26-551` builds one dependency-free IIFE:
- Event path: listens to `wandit:lead`, clips values, keeps `name/phone/wilaya/commune`, moves other keys to `extras` (max 25 keys, 80-char key, 300-char value) (lines 155-168, 464-485). It ignores a detail with fewer than 8 phone digits (line 481).
- Heuristic fallback: a capture-phase `submit` listener reads the form, classifies fields by name/label (`phone|tel|هاتف`, `name|nom|اسم`, `wilaya|ولاية`, `commune|بلدية`), and sends after 2.5 s unless the event path fired (lines 487-544).
- Attribution: `utm_*`, `fbclid`, `ttclid`, `referrer`, `landing_url` from the page URL (lines 170-195).
- Honeypot value goes as `_hp` (lines 197-203, 396-397).
- Payload cap 12 KB; extras then attribution are dropped last-key-first (lines 235-257).
- Transport: `fetch(captureUrl, { method: "POST", mode: "cors", credentials: "omit", keepalive: true, headers: { "Content-Type": "application/json" } })`, retries on 429/5xx up to 2 times with `Retry-After` (lines 282-310). On `pagehide`, pending payloads go by `navigator.sendBeacon` (lines 442-455, 547).
- Dedupe by phone digits for 120 s (lines 48, 371-377).
- After a 2xx and no honeypot: `fbq("track","Lead")`, `fbq("track","Purchase",{value,currency:"DZD"})`, `ttq.track("Lead")`, `ttq.track("CompletePayment",...)`, then `window.wanditFlushPixels()` (lines 320-364). Value = `total` or `price*quantity` (lines 137-147).
- Emits `wandit:lead:result` with `{ ok }` (lines 422-428).

### 3.4 Capture endpoint

- Route: `POST /api/public/leads/:publicFormId`, decorated `@Public()` and `@AllowCrossSiteWrite()`, returns HTTP 200 always (`leads-capture.controller.ts:26-61`).
- CORS for this one URL: `origin: "*"`, `credentials: false`, methods `POST`, exposes `Retry-After` (`presentation/http/public-leads-cors.ts:1-21`), wired in `apps/server/src/main.ts:25,126`.
- Service `leads-capture.service.ts:58-141`:
  1. Resolve project by `publicFormId` (line 63-67; repo `leads.repository.ts:417-432`). Unknown → 404.
  2. Parse body; a `text/plain` string is JSON-parsed (lines 143-159). Schema `leadCaptureBodySchema` (`packages/contracts/src/v1/leads.ts:471-480`): `name` 1-200, `phone` 6-40, optional `wilaya`, `commune`, `extras` (≤40 scalar keys), `attribution` (whitelist, lines 47-57), `deploymentId`, `_hp`.
  3. Honeypot → `{ ok: true }` and no row (lines 71-74).
  4. `normalizeLeadPhone` → E.164 or 400 (line 76-79; `domain/normalize-lead-phone.ts`).
  5. Rate limit: 60 valid submits per form per IP per minute, 300 per IP (`leads-capture-throttle.ts:11-13`). In-memory; the comment says to move to Redis before running more than one API instance (lines 6-7).
  6. Snapshot `deploymentId` and `productSku` from the deployment (lines 88-103).
  7. `upsertCaptureLead` with a 2-minute duplicate window keyed by project+phone (lines 105-119; repo `leads.repository.ts:521-530`). Raw phone is kept in `extras._rawPhone` (line 111).
  8. If the row is new, dispatch a push (lines 123-138).
- Table `leads`: `packages/db/src/schema/leads.ts:19-90`. Status enum `to_confirm | confirmed | shipped | delivered | returned | cancelled`. E.164 CHECK `^\+[1-9][0-9]{7,14}$` (line 88). Composite FK to `deployments` (lines 81-85).
- Source is derived from attribution on read: `fbclid`/`utm_source` in `facebook, fb, instagram, ig, meta` → facebook; `ttclid`/`tiktok, tt` → tiktok; else direct (`domain/derive-lead-source.ts:13-20`; contract `leads.ts:35-42`).

### 3.5 Push notifications

- `LeadPushDispatcherService.dispatchLeadCaptured` triggers Trigger.dev task `send-lead-push` with idempotency key `lead-push:{leadId}`; skips when `TRIGGER_SECRET_KEY` is unset (`push-notifications/infrastructure/trigger/lead-push-dispatcher.service.ts:20-41`).
- Task: `apps/server/src/trigger/send-lead-push.task.ts:7-23` (3 attempts). Runtime `send-lead-push.runtime.ts:62-150`: recipients = project owner or all org members (lines 86-89); tokens from `push_tokens`; POST to `https://exp.host/--/api/v2/push/send` in chunks of 100 (lines 7-8, 132-137); message title `New lead`, body `name · phone · wilaya`, data `{ type: "lead.captured", projectId, leadId }` (lines 40-50, 108-121). Invalid tokens are pruned (line 122).
- Token registration: `POST/DELETE /api/v1/push-tokens` (`push-tokens.controller.ts:16-43`); table `push_tokens` keyed by token (`packages/db/src/schema/push-tokens.ts:18-36`).
- Native hook: `apps/native/features/notifications/lib/use-push-notifications.ts:28-60` (Expo Notifications, opens the lead on tap).
- The BullMQ `LeadProcessingProcessor` in `apps/worker/src/processors/lead-processing.processor.ts:9-21` is a scaffold that does nothing.

### 3.6 CRM endpoints

`apps/server/src/modules/leads/presentation/http/controllers/leads.controller.ts`:
- `GET /api/v1/leads` — workspace-wide keyset page (line 45).
- `GET /api/v1/projects/:projectId/leads` — per-project page with server-side search, filters and counters (line 60).
- `PATCH .../leads/:leadId/status` and `PATCH .../leads/:leadId/archive` (lines 75, 94).
- Exports (CSV/Sheets) promote `product, quantity, price, delivery, total` from extras with a FR/AR/EN synonym recognizer (`packages/contracts/src/v1/leads.ts:255-265, 349-362`; `docs/features/leads-crm.md:31`).

### 3.7 Google Sheets sync

- `GET/POST /api/v1/projects/:projectId/leads/sheet-sync` (`lead-sheet-sync.controller.ts:22-48`).
- One spreadsheet per project created in the merchant's Drive under `drive.file`; every sync is a full rewrite through a hidden staging tab and one atomic `batchUpdate` swap (`lead-sheet-sync.service.ts:1-9`; `infrastructure/google/google-sheets.client.ts:1-10`). Tokens come from better-auth `getAccessToken`.
- Table `lead_sheet_syncs` (`packages/db/src/schema/lead-sheet-syncs.ts:19-42`).
- Auto-sync: Trigger.dev schedule `lead-sheet-auto-sync`, cron `*/30 * * * *`, `maxDuration` 1500 s (`apps/server/src/trigger/lead-sheet-auto-sync.task.ts:14-22`). Rules in `docs/features/leads-crm.md:37-45`.

### 3.8 Known limits recorded in the docs

- The `Lead` pixel event carries no `value`/`eventID`; only `Purchase`/`CompletePayment` carry value (`docs/features/ads-brain.md:47`).
- Pages published before the retry fix run the old fire-and-forget script until republished (`docs/features/lead-flow-bugs-and-fixes.md:60-62`).
- Rate limiter is single-instance (`leads-capture-throttle.ts:6-7`).

---

## 4. COD and order flows

### 4.1 COD orders are leads

- There is no COD order table. A COD order is a `leads` row whose `extras` carry `product, quantity, price, delivery, total` (`docs/features/cod-worlds.md:96-103`, "Lead order database columns" is listed as deliberately not built).
- The status pipeline is the order pipeline: `to_confirm → confirmed → shipped → delivered / returned`, plus `cancelled` (`packages/db/src/schema/leads.ts:16-26`).
- `productSku` is snapshotted from the deployment onto the lead (`leads-capture.service.ts:114`). **UNVERIFIED:** where `productSku` is set on a deployment; I did not read the deployments schema.
- Locale facts (phone regex `/^0[567]\d{8}$/`, DZD, 58 wilayas, commune, home/stopdesk fees) are brief variables with Algeria as default (`docs/features/cod-worlds.md:52-58`). The DB phone CHECK is not Algeria-only (`leads.ts:86-88`).
- The pixel currency is hard-coded to `DZD` (`leads-runtime-script.ts:333`).

### 4.2 The `orders` module is not COD

- `apps/server/src/modules/orders` owns `payment_orders` for Stripe checkout of **domain registrations** only: `paymentOrderKind` enum has one value `domain_registration` (`packages/db/src/schema/orders.ts:26-28`). Endpoints: `POST /api/v1/orders/domain`, `POST /api/v1/orders/reconcile-session`, `GET /api/v1/orders/:orderId` (`orders.controller.ts:35-79`). Refunds run on Trigger.dev (`orders.module.ts:34-37`).
- V2 should not confuse this module with e-commerce orders inside generated apps.

### 4.3 COD page generation

- COD mode: brain collects product, offer, price, variants, delivery fees and photos; calls `get_direction_candidates` with `pageKind: "cod"`; picks one base world and 2-3 donors; calls `generate_page` once (`docs/features/cod-worlds.md:62-80`).
- The 30-id block vocabulary lives in `agent/worlds/cod/blocks.ts` (`docs/features/cod-worlds.md:26-40`).
- Design worlds contract and taste cards: `docs/features/design-worlds.md`.

---

## 5. Image generation and the asset pipeline

### 5.1 Paths into R2 (from `docs/features/image-pipeline.md:6-18`)

| Path | Entry point | Key |
|---|---|---|
| User upload | `POST /api/v1/attachments` → `UploadsService.uploadAttachment` | `uploads/{userId}/{uuid}/{filename}` |
| Builder image | site-builder `generate_image` → `generateBuildImage` | `sites/{projectId}/assets/{attemptId}/img-{n}.{ext}` |
| Standalone image | chat `generate_image` → `generateStandaloneImage` | `images/{projectId}/{attemptId}/img-{n}.{ext}` |
| Builder video | site-builder `animate_image` → `generateBuildVideo` | `sites/{projectId}/assets/{attemptId}/vid-{n}.{ext}` |

All key builders live in `apps/server/src/infrastructure/storage/r2.ts` (`pageHtmlKey` 65, `siteAssetKey` 99, `siteVideoKey` 110, `imageGenerationKey` 177, `marketingAssetKey` 188, `leadScrapeFileKey` 196, `userUploadKey` 207, `variantKey` 230, `publishedCurrentKey` 83). Published HTML: `published/{projectId}/current.html`.

### 5.2 Providers

- Images: AI SDK `generateImage` through the AI Gateway model `AI_IMAGE_MODEL` (gpt-image class, `1024x1024 | 1024x1536 | 1536x1024`); edit mode with source photos uses `generateText` on `AI_IMAGE_EDIT_MODEL` (Gemini image model) — `apps/server/src/modules/image-generations/application/services/image-generator.ts:1-13, 39-52`; env comments `packages/env/src/server.ts:94-101`. Model ids seen in code: `gpt-image-2`, `gemini-3-pro-image` (grep over trigger + modules).
- Video: Kling models on the gateway (`klingai/kling-v3.0-t2v`, `klingai/kling-v2.6-i2v`, `klingai/kling-v3.0-i2v`), kinds `image-animation | text-to-video | video-product | video-edit | video-extension` (`packages/db/src/schema/media-generation-attempts.ts:43-49`). Higgsfield video goes through the connector (section 2.5).

### 5.3 Inside a page build

- The site builder agent exposes `generate_image` and `animate_image` tools to the builder model (`agent/site-builder/site-builder-agent.ts:434-443, 506, 901`). `generateBuildImage` never throws; it uploads to R2 under the attempt and returns a public URL plus real `width`/`height` (`agent/site-builder/generate-image.ts:1-8, 60-75`). Budget: `MAX_IMAGES = 6` (line 33).
- Every raster goes through `optimizeImage` (WebP q80, max width 1920) and gets 480/960/1600 renditions beside the primary key (`docs/features/image-pipeline.md:22-62`).
- Publish adds `fetchpriority`/`loading` normalization and a verified `srcset` (`pages/domain/optimize-image-markup.ts`; `docs/features/image-pipeline.md:88-140`).

### 5.4 Standalone (chat) image generation

- Tool `generate_image` (`agent/tools/generate-image.tool.ts:1-12, 67-110`): 1-6 separate images, optional `placement` by `data-wid` into the current page, optional `sourceImageUrls` that must match user attachments. Requires `AI_GATEWAY_API_KEY`, `AI_IMAGE_MODEL`, `R2_PUBLIC_BASE_URL`, R2 and `TRIGGER_SECRET_KEY` (lines 101-107).
- Runs on Trigger.dev (`apps/server/src/trigger/generate-image.task.ts`, runtime `image-generation.runtime.ts`), rows in `image_generation_attempts`.
- Placement applies an AI edit op to the page HTML through `PageEditsService.applyAiOps` (`image-generation-placement.service.ts:1-80`).
- Read/download: `GET /api/v1/image-generations/:attemptId[/download/:index]` (`image-generations.controller.ts:33-71`).
- Billing: `createImageGenerationBilling` with `GENERATION_BILLING_MODE` (`generate-image.tool.ts:70-73`).

### 5.5 Assets tab and marketing assets

- `ProjectAssetsService` lists DB-backed generations plus page-build files by R2 prefix; renditions are hidden by `VARIANT_FILENAME_PATTERN` (`project-assets/application/services/project-assets.service.ts:1-47`).
- Marketing assets are HTML documents (`ad-copy | marketing-strategy | video-script | creative-brief | html-asset`) stored at `marketing/{projectId}/{assetId}/index.html` and shown in a sandboxed iframe (`packages/db/src/schema/marketing-assets.ts:19-55`; `marketing-assets.controller.ts:1-4, 30-78`).

---

## 6. Other modules in scope

| Module | What it is | Page-facing? |
|---|---|---|
| `lead-scrapes` | Chat tool `scrape_leads`: Google Maps prospecting + email discovery → XLSX in R2 (`lead-scrapes/domain/lead-scrape-spec.ts:12-26`; controller `lead-scrapes.controller.ts:20-67`). Runs on Trigger.dev `scrape-leads.task.ts`. | No. Prospecting for the merchant. |
| `story-links` | Admin short links `GET /api/v1/s/:slug` that set a UTM attribution cookie and redirect into the Wandit app (`story-link-redirect.controller.ts:17-64`; schema `story-links.ts:10-31`). | No. Wandit's own marketing. |
| `email` | Resend client. Transactional: magic link, OTP, invitation, domain reminder, offline request (`email.service.ts:52-100`). Lifecycle: `resend.events.send` (lines 102-116); outbox + Trigger sweep every 5 min (`docs/features/lifecycle-emails.md:150-185`). `EMAIL_FROM`, `RESEND_API_KEY`. | No. Emails go to Wandit users, never to leads. |
| `push-notifications` | Section 3.5. | Yes, indirectly (new lead → owner phone). |
| `media-generations` | Video attempts and downloads (`media-generations.controller.ts:14-56`). | Yes when the builder embeds a video URL. |
| `marketing-assets` | Section 5.5. | No. |
| `connector-generations` | Section 2.5. | No. |

---

## 7. What V2 generated apps must keep supporting, and how

### 7.1 Must keep (product value loop)

1. **Lead capture into the Wandit CRM.** The Leads tab, push, Sheets, exports, `read_lead_performance` and the ads brain all read the `leads` table. A V2 web app or Expo app with a lead/order form must post to the same endpoint or an equivalent that writes the same row.
2. **Pixel conversions after an accepted lead.** Meta `Lead` + `Purchase(DZD)`, TikTok `Lead` + `CompletePayment`, deduped by phone, never on honeypot (`leads-runtime-script.ts:312-364`). Ads diagnostics depend on `metaPixelSet` / `tiktokPixelSet` (`leads.repository.ts:487-505`).
3. **Owner push notification** on a new lead. This is server-side and stays as is if the row is created by `LeadsCaptureService`.
4. **Assets in R2 under the existing key layout** so the Assets tab, the immutable cache rule, and the rendition pipeline keep working (`docs/features/image-pipeline.md:64-86`).
5. **Image generation as a tool** for the coding agent, billed through metering.

### 7.2 Must replace: publish-time HTML injection

The V1 mechanism patches `</body>` in one static HTML file (`inject-leads-runtime.ts:44-56`). A V2 app is a bundle (Vite/Next), often SSR, or an Expo app with no DOM. The heuristic form fallback (`leads-runtime-script.ts:528-544`) also cannot see a React controlled form that calls `preventDefault` before the capture-phase listener runs in every framework. So:

- **Option A (recommended): a small SDK / generated helper.** Ship `@wandit/leads` (or let the harness write `lib/wandit-leads.ts` into the app) that:
  - Posts `leadCaptureBodySchema` JSON to `${WANDIT_API_ORIGIN}/api/public/leads/${WANDIT_PUBLIC_FORM_ID}` with `credentials: "omit"`, retries on 429/5xx with `Retry-After`, and `keepalive: true`. The endpoint already accepts this cross-origin with `origin: "*"` (`public-leads-cors.ts:3-10`).
  - Adds `attribution` from the URL on web; on Expo adds nothing or a small `platform` extra.
  - Adds the honeypot as `_hp` when a hidden field exists; on mobile omits it.
  - Fires the pixel events on web and dispatches `wandit:lead:result` for compatibility.
  - The two config values are public and safe to embed: `publicFormId` is an unguessable uuid (`projects.ts:43`), and the API origin is public. V1 already bakes both into every page (`sites.service.ts:323-326`).
- **Option B: keep the event contract for the web preview.** Web apps can still `document.dispatchEvent(new CustomEvent("wandit:lead", …))` and the SDK can listen. This keeps the COD worlds' prompt text valid.
- The `deploymentId` field should stay optional. V2 deployments are different rows; the server falls back to the active deployment when the id does not resolve (`leads-capture.service.ts:88-103`).

### 7.3 Per-project API keys

- **Capture** needs no secret. `publicFormId` is the public key. Do not issue secrets to generated apps for this.
- **Reading or updating leads from inside a generated app** (an "admin" screen in the merchant's own app) is not supported today. All CRM routes sit behind the session `AuthGuard` (`leads.controller.ts:1-2`). If V2 wants it, it needs a new scoped token type (project-scoped, read/write leads) — new work. Keep out of V2.0.
- Pixels: V1 injects from `projects.metaPixelId` / `tiktokPixelId` at publish (`sites.service.ts:315-318`). For V2, expose them as public env values (`WANDIT_META_PIXEL_ID`, `WANDIT_TIKTOK_PIXEL_ID`) that the SDK reads, so `getAdsTrackingFacts` keeps its meaning.

### 7.4 Image generation as a tool in the V2 harness

- Reuse `generateImageFromPrompt` / `editImageFromSources` (`image-generator.ts`, plain functions with no Nest DI) and `storeImageVariants` / `optimizeImage`. The sandbox must not hold provider keys, so run the tool server-side (an MCP tool or a harness tool that calls the Wandit API) and return an R2 public URL plus `width`/`height`. The Trigger.dev path in `generate-image.tool.ts` already returns a receipt and finishes in the background; V2 needs a synchronous or awaitable variant for the coding agent, like `generateBuildImage` (`agent/site-builder/generate-image.ts:75`).
- Choose a key layout for app assets. `siteAssetKey` uses `sites/{projectId}/assets/{attemptId}/...`. Either reuse it or add `apps/{projectId}/assets/...` in `r2.ts` and teach `ProjectAssetsService` the new prefix (`project-assets.service.ts:40-46`).
- Keep `IMMUTABLE_ASSET_CACHE_CONTROL` and the write-once rule (`docs/features/image-pipeline.md:64-74`).

### 7.5 Connectors in V2

- The MCP connectors (Meta, TikTok, Higgsfield) attach to the **chat**, not to the app. `McpChatToolsService.resolveToolsForUser` and its guards can be reused as-is in the V2 chat endpoint (they are exported from `McpConnectorsModule`, `mcp-connectors.module.ts:21`).
- Lovable-Cloud-style connectors for the generated app (Supabase, Stripe, Resend, storage) are a **new domain**: per-project, with secrets that reach the sandbox and the deployed app as env vars. They need a new table (for example `project_integrations`) and must not reuse `mcp_connections` (per-user, agent-side).
- Higgsfield media URLs are provider-hosted (section 2.5, UNVERIFIED). If a V2 app must embed them, V2 should copy them into R2 first.

### 7.6 Leads data model vs app-native databases

- V2 apps may get their own database (Supabase). Decide where "orders" live. Recommendation: the Wandit `leads` table stays the CRM of record for the Leads tab, push and Sheets; app-native tables are the app's own business data. The SDK can dual-write when the app has both.
- `wilaya`/`commune` are first-class Algeria columns; other markets go into `extras` (`leads.ts:45-47`). The pixel currency is fixed to DZD (`leads-runtime-script.ts:333`). V2 SDK should take `currency` from config.

### 7.7 Modules V2 can leave untouched

`orders` (domain purchases), `story-links`, `email` (transactional + lifecycle), `lead-scrapes`, `marketing-assets`, `connector-generations`. None of them touches generated app code.

---

## 8. Reusable as-is

- `POST /api/public/leads/:publicFormId` endpoint, throttle, honeypot, phone normalization, duplicate window, deployment snapshot (`modules/leads/application/services/leads-capture.service.ts`, `leads-capture-throttle.ts`, `domain/normalize-lead-phone.ts`).
- `leadCaptureBodySchema`, `leadAttributionSchema`, `leadExtrasSchema`, `leadsRoutes.capture` (`packages/contracts/src/v1/leads.ts:44-76, 471-488, 613-629`).
- `LeadPushDispatcherService` + `send-lead-push` task + `push_tokens`.
- `LeadSheetSyncService`, `GoogleSheetsClient`, `lead-sheet-auto-sync` task.
- Leads CRM controllers and web/native Leads tab API clients (`apps/web/src/features/workspace/api/leads.*.ts`, `lead-sheet-sync.*.ts`).
- `McpConnectorsModule` (OAuth, token refresh, tool resolution, guards, telemetry) for the V2 chat.
- Ads brain skills, `composeAdsBlock`, `read_lead_performance`, `getAdsTrackingFacts`.
- `image-generator.ts`, `optimize-image.ts`, `store-image-variants.ts`, `r2.ts` key layout, `IMMUTABLE_ASSET_CACHE_CONTROL`.
- `pixel-injector.ts` snippets (the `fbq`/`ttq` stub + deferred SDK + `wanditFlushPixels`) as the reference for the SDK's web pixel code.
- The `leads-runtime-script.ts` logic (phone digit folding, purchase value, retry, dedupe, beacon) as the reference implementation for the SDK.

---

## 9. Open questions

1. Where should the V2 SDK live: an npm package in the monorepo (`packages/leads-sdk`) published to the sandbox, or a file the harness writes into every app? A package keeps one source of truth; a file works offline in the sandbox.
2. Mobile attribution: an Expo app has no `fbclid`/`ttclid`. Do we accept `direct` for all app leads, or add an app-install attribution field?
3. Should V2 app leads carry `deploymentId`? V2 deployments are new rows; the composite FK `leads_project_deployment_fk` (`leads.ts:81-85`) requires the deployment to belong to the same project.
4. Do we copy Higgsfield outputs into R2 before an app can embed them? (Provider URL lifetime is UNVERIFIED.)
5. Should pixels in V2 be injected by the SDK from public env, or by a Next/Vite plugin? The `getAdsTrackingFacts` query reads project columns, so both must write the same project fields.
6. The capture rate limiter is in-process (`leads-capture-throttle.ts:6-7`). V2 preview environments with more than one API instance need Redis.
7. Does V2 need lead read/write access from inside generated apps (merchant admin screens)? If yes, a project-scoped token type is new work.
8. `productSku` on deployments: where it is set today is UNVERIFIED in this pass.

---

## Appendix A — file index

- Connectors: `apps/server/src/modules/mcp-connectors/**`, `apps/server/scripts/seed-mcp-connectors.ts`, `packages/db/src/schema/mcp-connectors.ts`, `packages/db/src/schema/connector-operation-events.ts`, `packages/contracts/src/v1/mcp-connectors.ts`, `apps/server/src/trigger/run-connector-generation.task.ts`, `apps/server/src/modules/connector-generations/**`, `packages/db/src/schema/connector-generation-attempts.ts`.
- Ads brain: `apps/server/src/modules/ai-chat/agent/ads/index.ts`, `agent/tools/read-lead-performance.tool.ts`, `docs/features/ads-brain.md`.
- Leads: `apps/server/src/modules/leads/**` (runtime, capture, CRM, Sheets), `packages/db/src/schema/leads.ts`, `packages/db/src/schema/lead-sheet-syncs.ts`, `packages/contracts/src/v1/leads.ts`, `packages/contracts/src/v1/lead-sheet-sync.ts`, `apps/server/src/main.ts:25,126`, `apps/server/src/trigger/lead-sheet-auto-sync.task.ts`, `docs/features/leads-crm.md`, `docs/features/lead-flow-bugs-and-fixes.md`.
- Publish injection: `apps/server/src/modules/sites/application/services/sites.service.ts:292-347`, `sites/domain/pixel-injector.ts`, `sites/domain/badge-injector.ts`, `apps/edge/src/index.ts`, `docs/features/publishing-serving.md`, `docs/features/edge-serving.md`.
- Page contract enforcement: `apps/server/src/modules/ai-chat/agent/site-builder/builder-prompt.ts:155`, `site-builder-agent.ts:2211-2345`, `agent/worlds/cod/genre.ts`, `pages/domain/vendor/wandit-feature-starter-js.ts`.
- Push: `apps/server/src/modules/push-notifications/**`, `apps/server/src/trigger/send-lead-push.{task,runtime}.ts`, `packages/db/src/schema/push-tokens.ts`, `apps/native/features/notifications/lib/use-push-notifications.ts`.
- Orders (domains, not COD): `apps/server/src/modules/orders/**`, `packages/db/src/schema/orders.ts`.
- Images/media: `apps/server/src/modules/image-generations/**`, `apps/server/src/modules/ai-chat/agent/site-builder/generate-image.ts`, `generate-video.ts`, `agent/tools/generate-image.tool.ts`, `apps/server/src/modules/media-generations/**`, `apps/server/src/modules/project-assets/**`, `apps/server/src/infrastructure/storage/r2.ts`, `docs/features/image-pipeline.md`, `packages/env/src/server.ts:94-108`.
- Marketing/email/other: `apps/server/src/modules/marketing-assets/**`, `apps/server/src/modules/email/**`, `apps/server/src/modules/lifecycle-events/**`, `apps/server/src/modules/lead-scrapes/**`, `apps/server/src/modules/story-links/**`, `docs/features/lifecycle-emails.md`, `docs/features/cod-worlds.md`, `docs/features/design-worlds.md`.
