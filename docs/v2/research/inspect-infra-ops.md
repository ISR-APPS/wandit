# V2 research: infrastructure, environments, deploy, observability

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev`).
Author: Claude Fable agent (infra-ops probe). Read-only. No code was changed.

Evidence marks: `path:line` = read in this worktree. `[live]` = read through the Railway, Vercel, or Trigger.dev MCP on 2026-09-03. `UNVERIFIED` = not confirmed by code, config, or a live read.

---

## 0. Summary in ten lines

1. The product runs on five deploy targets: Vercel (web, admin), Railway (API server, Redis), Trigger.dev (background tasks bundled from `apps/server/src/trigger`), Cloudflare (edge Worker, R2, KV), and Expo EAS (iOS).
2. There are three git stages: `dev` -> `staging` -> `main`. Each stage has its own hosted environment. "Preview" in the docs means the `staging` stage. There is no per-feature-branch API environment.
3. Railway project `Wandit` has two environments (`staging`, `production`) and two services (`server`, `Redis`) `[live]`. There is no `worker` service in Railway `[live]`. The BullMQ worker (`apps/worker`) is a legacy path.
4. The API is one NestJS + Fastify process. Every module is registered in `apps/server/src/app.module.ts`. Global guards run in this order: `CrossSiteWriteGuard`, `AuthGuard`, `WorkspaceContextGuard`.
5. Long AI work does not run in the API process. The `generate_page` tool writes an attempt row and calls `tasks.trigger("generate-page")`. Trigger.dev runs the builder on a `medium-1x` machine with a 1800 s ceiling.
6. All env vars are validated at boot by `packages/env/src/server.ts` (t3-env + zod). Most integrations are optional at boot and checked at call time.
7. Feature gating today uses a single `product_settings` DB row exposed at `GET /api/v1/settings/public` and toggled from the admin app. There is no PostHog flag usage in app code, but the SDK hooks are exported.
8. Sentry is wired for every runtime through `packages/observability`. PostHog is wired for web and server through `packages/analytics`. No DSN or key = fully off.
9. Migrations run as a Railway pre-deploy command (`pnpm db:migrate`) on both environments `[live]`.
10. A V2 module can be added as one NestJS module mounted only when `V2_BUILDER_ENABLED=true`, one contracts folder, one web feature folder with one thin route, and a public setting or PostHog flag for per-user rollout. New env groups: sandbox provider, Anthropic/harness key, Supabase management token, app-secret encryption key, deploy tokens, EAS/simulator streaming.

---

## 1. Runtime topology

### 1.1 Applications in the monorepo

| App | Runtime | Hosted where | Entry | Notes |
| --- | --- | --- | --- | --- |
| `apps/web` | Vite + React SPA, TanStack Router | Vercel project `wandit-web` `[live]` | `apps/web/src/main.tsx` | Domains `wandit.dev`, `www.wandit.dev`, `wandit-web-git-main-isrgroups.vercel.app` `[live]` |
| `apps/admin` | Vite + React SPA | Vercel project `wandit-admin` `[live]` | `apps/admin/src/main.tsx` | Domain `admin.wandit.dev` `[live]` |
| `apps/server` | NestJS 11 on Fastify 5, Node ESM | Railway service `server` `[live]` | `apps/server/src/main.ts` | Also the source of all Trigger.dev tasks (`apps/server/trigger.config.ts:44`) |
| `apps/worker` | NestJS application context + BullMQ | No Railway service found `[live]` | `apps/worker/src/main.ts` | Legacy chat path. See section 6. |
| `apps/edge` | Cloudflare Worker | Cloudflare account `6b421048e434497bce142970530e4eb1`, zone `wandit.app` (`apps/edge/wrangler.jsonc:5,24`) | `apps/edge/src/index.ts` | Serves published sites. Deployed by `wrangler deploy` (`apps/edge/package.json:7`). No CI workflow deploys it. |
| `apps/native` | Expo SDK 56, React Native 0.85 | EAS build + TestFlight | `expo-router/entry` | Scheme `wandit://` (`apps/native/app.json:3`). EAS project id in `app.json:38`. |

### 1.2 Shared packages that matter for infra

| Package | Purpose | Evidence |
| --- | --- | --- |
| `@wandit/env` | Zod-validated env for server, web, native, plus CORS and cookie helpers | `packages/env/package.json:6-13` |
| `@wandit/jobs` | BullMQ queue names and payload types shared by API and worker | `packages/jobs/src/index.ts:9-23` |
| `@wandit/db` | Drizzle + `pg` pool; `createDb()` reads `DATABASE_URL`; migrations in `packages/db/src/migrations` | `packages/db/src/index.ts:43-55`, `packages/db/drizzle.config.ts:8-15` |
| `@wandit/observability` | Sentry entry points per runtime | `packages/observability/package.json:6-15` |
| `@wandit/analytics` | PostHog browser, node, react | `packages/analytics/package.json:6-10` |
| `@wandit/contracts` | Zod schemas and route constants per API version (`src/v1/*`) | `packages/contracts/package.json:6-13` |
| `@wandit/auth` | Better Auth server config (app + admin instances) | `packages/auth/src/index.ts:429,776` |

### 1.3 External services

| Service | Used for | Config source |
| --- | --- | --- |
| PostgreSQL | Main DB. PRD names Neon (`docs/PRD.md:116`). Provider UNVERIFIED. | `DATABASE_URL` (`packages/env/src/server.ts:180`) |
| Redis | BullMQ queues, chat event streams, Better Auth rate-limit storage | Railway service `Redis`, image `redis:8.2.9`, volume at `/data`, region `sfo` `[live]` |
| Cloudflare R2 | Draft and published HTML, images, videos, uploads | `apps/server/src/infrastructure/storage/r2.ts:29-50`; bucket `wandit-production` in `apps/edge/wrangler.jsonc:34` |
| Cloudflare KV | Host -> project pointer for the edge Worker | `apps/edge/wrangler.jsonc:29`; writes through REST in `apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts:69-75` |
| Cloudflare for SaaS | Custom hostnames for customer domains | `docs/features/edge-serving.md:56-79` |
| Vercel AI Gateway, OpenRouter | LLM and media calls | `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `AI_PROVIDER` (`packages/env/src/server.ts:74-93`) |
| Trigger.dev cloud | Background tasks, Realtime run streaming | `TRIGGER_SECRET_KEY` (`server.ts:151`); project `proj_stzpldofqndpuwhwrdlw` (`apps/server/trigger.config.ts:44`) |
| Stripe | Billing, webhooks | `server.ts:236-238` |
| Resend | Auth and lifecycle mail | `server.ts:198-202` |
| Name.com | Domain purchase | `server.ts:242-244` |
| Serper.dev | Lead scraping | `server.ts:155-163` |
| Linear | In-app feedback tickets | `server.ts:292-293` |
| Chatwoot | Live chat widget | `server.ts:210`, `packages/env/src/web.ts:35-36` |
| Cloudflare Turnstile | Captcha on email auth | `server.ts:205`, `web.ts:31` |
| Google OAuth | Sign-in | `server.ts:192-193` |
| Sentry | Errors, traces, logs | section 10 |
| PostHog EU | Product analytics, replay | section 10 |

### 1.4 Request path summary

- Browser -> `https://api.wandit.dev` directly. The Vite bundle bakes `VITE_SERVER_URL` at build time (`docs/deployments/web-environments.md:32-38`).
- `apps/web/vercel.json:27-34` still rewrites `/api/:path*` and `/s/:slug` to `https://server-production-4214.up.railway.app`. Normal traffic does not use it. Every Vercel preview inherits this production upstream (`web-environments.md:50`). The owner deferred the decision to remove it (`web-environments.md:54`).
- Published customer sites: visitor -> Cloudflare `wandit.app` zone -> `wandit-edge` Worker -> KV `domain:{host}` -> R2 `published/{projectId}/current.html` (`apps/edge/src/index.ts:2-22`).

---

## 2. Deploy targets and how each one deploys

### 2.1 Vercel (web and admin)

- Team `ISR` (`isrgroups`), plan `hobby` `[live]`.
- `wandit-web`: framework `vite`, Node `24.x`, linked to GitHub `ISR-APPS/wandit` `[live]`.
- `wandit-admin`: framework `vite`, Node `24.x` `[live]`.
- Production deployments come from `main` (`target: "production"`, `githubCommitRef: "main"`) `[live]`.
- Every other branch gets a preview deployment with a branch alias, for example `wandit-web-git-staging-isrgroups.vercel.app`, `wandit-web-git-dev-isrgroups.vercel.app`, `wandit-web-git-feat-cod-builder-batch-isrgroups.vercel.app` `[live]`.
- Security headers and SPA fallback: `apps/web/vercel.json:3-25,35-38`, `apps/admin/vercel.json:3-31`.
- Build-time source maps go to Sentry only when `SENTRY_AUTH_TOKEN` is set (`apps/web/vite.config.ts:23,44`, `packages/observability/src/vite.ts:13-30`). Release name is `wandit-web@<VERCEL_GIT_COMMIT_SHA>` (`vite.ts:20-24`).
- No `vercel.json` `builds` or `git` section exists. Root directory and env values live in the Vercel dashboard. UNVERIFIED: which env values apply to non-production previews.

### 2.2 Railway (API server and Redis)

Project `Wandit` (`8594c636-d290-4f69-ac34-684136923ce8`), workspace "Isr Admin's Projects" `[live]`.

Environments `[live]`:

| Environment | Branch | Service domain | Custom domain |
| --- | --- | --- | --- |
| `production` (`49243738-...`) | `main` | `server-production-4214.up.railway.app:3100` | `api.wandit.dev` |
| `staging` (`5796a413-...`) | `staging` | `server-staging-5979.up.railway.app:3100` | `api-staging.wandit.dev` |

Service `server` config, same in both environments `[live]`:

- Builder `RAILPACK`, build environment `V3`, build command `pnpm --filter server build`.
- Start command `pnpm --filter server start`, which runs `node --enable-source-maps --import ./dist/instrument.mjs dist/main.mjs` (`apps/server/package.json:17`).
- Pre-deploy command `pnpm db:migrate` (root script -> `drizzle-kit migrate`, `package.json:21`, `packages/db/package.json:17`).
- Region `europe-west4-drams3a`, 1 replica.
- Staging has watch patterns: `/apps/server/**`, `/packages/**`, `/pnpm-lock.yaml`, `/package.json`, `/turbo.json`, `/apps/admin/**`. Production has no watch patterns.
- No `railway.json`, `nixpacks.toml`, `Dockerfile`, or `Procfile` exists in the repo. All build settings live in the Railway dashboard.

Service `Redis` `[live]`: image `redis:8.2.9`, volume mount `/data`, `--requirepass`, RDB save every 60 s, TCP proxy on 6379, private endpoint `redis`, region `sfo`. Note: the API runs in `europe-west4` and Redis runs in `sfo`. Every Redis round trip crosses the Atlantic. This is a latency risk for BullMQ and for the auth rate-limit storage. Mark this as an infra finding, not a code finding.

Env var NAMES present on the Railway `server` service in production `[live]` (values not read): `ADMIN_EMAILS ADMIN_ORIGIN AI_BUILDER_REASONING AI_CHAT_MODEL AI_GATEWAY_API_KEY AI_IMAGE_EDIT_MODEL AI_IMAGE_MODEL AI_PAGE_DESIGN_MODEL AI_PAGE_DESIGN_REASONING AI_PROVIDER_OVERRIDES AI_USD_PER_CREDIT AI_VIDEO_INSPECT_MODEL AI_VIDEO_MODEL BETTER_AUTH_SECRET BETTER_AUTH_URL CHATWOOT_HMAC_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN CLOUDFLARE_KV_NAMESPACE_ID CLOUDFLARE_ZONE_ID_WANDIT_APP CORS_ORIGIN DATABASE_URL EMAIL_FROM GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET LINEAR_API_KEY LINEAR_FEEDBACK_TEAM_ID NAMECOM_API_TOKEN NAMECOM_ENVIRONMENT NAMECOM_USERNAME OPENROUTER_API_KEY PORT POSTHOG_KEY QUEUE_ENABLED QUEUE_PREFIX R2_ACCESS_KEY_ID R2_ACCOUNT_ID R2_BUCKET R2_PUBLIC_BASE_URL R2_SECRET_ACCESS_KEY REDIS_URL RESEND_API_KEY SENTRY_DSN SENTRY_ENVIRONMENT SENTRY_RELEASE SERPER_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET TRIGGER_SECRET_KEY TRUSTED_PROXY_CIDRS TURNSTILE_SECRET_KEY`.

Staging has the same names minus `AI_PROVIDER_OVERRIDES` and `AI_VIDEO_INSPECT_MODEL` `[live]`.

Two names are not in the schema: `AI_BUILDER_REASONING` is read nowhere in `apps/server/src` or `packages/env/src`. `AI_VIDEO_MODEL` is read only through `process.env` in `apps/server/src/trigger/billing-maintenance.config.ts:40`. Treat `AI_BUILDER_REASONING` as stale.

Two other Railway projects exist in the same workspace: `spectacular-tenderness` (services `server`, `web`, created 2026-08-31) and `keen-spirit` (services `bbs-textiles`, `server`) `[live]`. Their purpose is UNVERIFIED. They are not referenced by the repo.

### 2.3 Trigger.dev

- Project `wandit` (`proj_stzpldofqndpuwhwrdlw`) in org `ISR` `[live]`. A second project `wandit-v2-experiment` (`proj_kfpxnefqjarhcvrrospy`) already exists, created 2026-07-14 `[live]`. Nothing in the repo references it.
- Config: `apps/server/trigger.config.ts`. Tasks dir `./src/trigger` (line 45). Runtime `node-22` (line 49). `maxDuration: 1800` (line 53). Default `retries.default.maxAttempts: 1` (line 62). Build extensions: `ffmpeg()`, custom `playwrightChromium()` layer that installs Playwright 1.61.1 Chromium into the image (lines 16-39, 70-71), and `sentryEsbuildPlugin` for source maps on deploy (lines 75-83). Externals `playwright`, `sharp` (line 88).
- Deploy: `.github/workflows/trigger-deploy.yml`. Push to `main` deploys `--env prod`; push to `staging` deploys `--env staging` (lines 8-10, 38). Concurrency group per branch (lines 13-15). Uses `npx trigger.dev@4.5.3 deploy` with `TRIGGER_ACCESS_TOKEN`, `SENTRY_ORG`, `SENTRY_AUTH_TOKEN` secrets (lines 38-42). Installs only `--filter server...` (line 31).
- Live deploys confirm the flow: prod deploys carry "Merge pull request ... from ISR-APPS/staging"; staging deploys carry "Merge pull request ... from ISR-APPS/dev" `[live]`.
- Runtime env for tasks comes from the Trigger.dev dashboard, not from Railway (`docs/observability.md:24`).
- Local dev: `pnpm dev:pipeline` runs `dev` and `dev:trigger` for `server` and `web` (`package.json:11`); `dev:trigger` = `npx trigger.dev@4.5.3 dev` (`apps/server/package.json:12`).

### 2.4 Cloudflare (edge Worker, R2, KV)

- `apps/edge/wrangler.jsonc`: name `wandit-edge`, `compatibility_flags: ["nodejs_als"]`, `upload_source_maps: true`, `vars.SENTRY_ENVIRONMENT = "production"`, route `*/*` on zone `wandit.app`, KV binding `PTR` id `10d1db8c7def488ba5397727c1e4ef6d`, R2 binding `SITES` bucket `wandit-production`, `observability.enabled = true` (lines 3-41).
- `SENTRY_DSN` is a Worker secret, set by `wrangler secret put` (line 15-16).
- `apps/edge/wrangler.dev.jsonc` is the local twin without `routes`; R2 bucket `wandit-pages-dev` (lines 17-18).
- Deploy is manual: `pnpm --filter edge deploy` -> `wrangler deploy` (`apps/edge/package.json:7`). No GitHub workflow touches the Worker. UNVERIFIED: who deploys it and when.
- Manual dashboard steps that code cannot apply: wildcard DNS `*` and `customers` AAAA `100::`, SSL for SaaS fallback origin `customers.wandit.app`, route exclusions for `wandit.app/*`, `www.wandit.app/*`, `api.wandit.app/*` (`docs/features/edge-serving.md:52-79`).
- Staging and local publish to their own buckets. The deployed Worker serves only `wandit-production` (`wrangler.jsonc:30-33`). So a staging publish is not reachable through the Worker. This is a known gap for testing publish end to end on staging.

### 2.5 Expo EAS (iOS)

- `.github/workflows/mobile-testflight.yml`: on push to `main` or `staging` with mobile path changes (lines 10-23). `eas build --platform ios --profile <production|staging> --non-interactive --no-wait --auto-submit` (line 59). Needs `EXPO_TOKEN` secret (line 51).
- `apps/native/eas.json`: `staging` profile points at `https://api-staging.wandit.dev`; `production` at `https://api.wandit.dev`; both use `EXPO_PUBLIC_WEB_APP_URL=https://wandit.dev` (lines 15-27). App Store Connect app id `6804269467` (lines 32, 37).
- Native env schema: `packages/env/src/native.ts:7-15` (`EXPO_PUBLIC_SERVER_URL`, `EXPO_PUBLIC_TRIGGER_API_URL`, `EXPO_PUBLIC_WEB_APP_URL`).

### 2.6 CI

- Only two workflows exist: `trigger-deploy.yml` and `mobile-testflight.yml`.
- There is no CI job for `pnpm check`, `check-types`, or `vitest`. Tests run only on developer machines. Railway and Vercel builds are the only automated build checks.

---

## 3. Environment story: how a feature ships to preview first

### 3.1 Branch stages

| Stage | Branch | Web | API | Trigger.dev | iOS |
| --- | --- | --- | --- | --- | --- |
| Feature | `feat/*` | Vercel preview `wandit-web-git-<branch>-isrgroups.vercel.app` `[live]` | none | none | none |
| Dev | `dev` | Vercel preview `wandit-web-git-dev-isrgroups.vercel.app` `[live]` | none | none | none |
| Staging ("preview") | `staging` | Vercel preview `wandit-web-git-staging-isrgroups.vercel.app` `[live]` | Railway env `staging` -> `api-staging.wandit.dev` `[live]` | env `staging` via workflow | EAS `staging` profile, TestFlight |
| Production | `main` | Vercel production -> `wandit.dev` `[live]` | Railway env `production` -> `api.wandit.dev` `[live]` | env `prod` via workflow | EAS `production` profile |

Evidence for the promotion ritual: PR titles "Promote dev to staging" and "Promote staging to main" in Vercel and Trigger deploy lists `[live]`; `git log origin/staging` shows "Merge branch 'dev' into staging"; `git log origin/main` shows "Merge pull request #321 from ISR-APPS/staging".

### 3.2 What happens on each push

1. Push to `feat/*` or `dev`: Vercel builds a preview of web and admin. Nothing else deploys. The preview bundle uses the Vercel "Preview" env values. UNVERIFIED: the value of `VITE_SERVER_URL` for these previews. The docs say the verified staging bundle contains `https://api-staging.wandit.dev` (`web-environments.md:36`).
2. Push to `staging`: Vercel preview for the staging alias; Railway rebuilds the `staging` server when watch patterns match, runs `pnpm db:migrate` against the staging `DATABASE_URL`, then starts; GitHub Actions deploys Trigger.dev `staging`; EAS builds the staging iOS app if mobile paths changed.
3. Push to `main`: same as staging, but Vercel production, Railway `production`, Trigger `prod`, EAS `production`.

### 3.3 Cross-site constraints on staging

- Update 2026-09-07: the staging web app is on `preview.wandit.dev`, same site as `api-staging.wandit.dev`, cookies `SameSite=Lax` (checked live). The three points below describe the older setup and the docs of that time.
- Staging web lives on `*.vercel.app`. `vercel.app` is on the Public Suffix List. So staging web and `api-staging.wandit.dev` are cross-site (`web-environments.md:16-18`).
- Result: auth cookies must be `SameSite=None` on staging. `resolveAuthCookieSameSite()` picks `none` when any browser origin is on a multi-tenant suffix (`packages/env/src/cookie-same-site.ts:24-43,87-104`). `AUTH_COOKIE_SAME_SITE` overrides it (`server.ts:191`).
- CORS is an exact allowlist: `CORS_ORIGIN` + `CORS_EXTRA_ORIGINS` + `ADMIN_ORIGIN` (`apps/server/src/main.ts:92-95`). A feature-branch Vercel preview origin is not in that list unless someone adds it to the staging server. So a feature preview cannot log in against the staging API. Only the `staging` branch alias works. This is the practical meaning of "preview environment" today.
- Recommended fix in the docs: attach `staging.wandit.dev` to the staging branch and set `CORS_ORIGIN=https://staging.wandit.dev` (`web-environments.md:20-28`). UNVERIFIED whether this was done. The live domain list for `wandit-web` does not include `staging.wandit.dev` `[live]`, so it is probably not done.

### 3.4 Environment naming in observability

- `SENTRY_ENVIRONMENT` accepts `production | preview | development` (`server.ts:281-283`; `web.ts:12-14`). The docs call the non-production Railway environment "preview env" (`docs/observability.md:23`). Railway calls it `staging` `[live]`. UNVERIFIED: the value set on the staging service.
- PostHog reuses the same environment string (`docs/observability.md:110`, `apps/web/src/main.tsx:49-58`).

### 3.5 Local development

- Server env file search order: `ENV_FILE`, `apps/server/.env`, `./apps/server/.env`, `./.env` (`server.ts:23-37`). Local `apps/server/.env` exists in the worktree with 34 keys (names listed in the probe; values not read).
- Web env: `apps/web/.env` with `PORT`, `VITE_SERVER_URL`. Default web port 3001, admin 3002 (`apps/web/vite.config.ts:11`, `apps/admin/vite.config.ts:9`). API default port 3000 (`server.ts:225`).
- `QUEUE_ENABLED` defaults to `false`; the API boots without BullMQ and returns 503 on the legacy queue path (`apps/server/src/infrastructure/queues/queues.module.ts:16-41`, `generation-queue.service.ts:83-85`).
- `SKIP_ENV_VALIDATION=true` bypasses the schema for tests (`server.ts:298`, `apps/server/vitest.config.ts:7-12`).
- Edge worker local: `wrangler dev --config wrangler.dev.jsonc --port 8799` with Miniflare KV/R2 (`apps/edge/package.json:6`, `apps/edge/README.md:17-41`).
- Worktree rule from `CLAUDE.md`: run dev servers in one tmux session named after the worktree, on free ports.

### 3.6 Database migrations

- `drizzle-kit generate` writes SQL into `packages/db/src/migrations` (latest `0066_signup-grant-7.sql`). `drizzle-kit migrate` applies them.
- Railway runs `pnpm db:migrate` as a pre-deploy step in both environments `[live]`. A migration therefore ships to staging first, then to production, in the same order as the branches.
- Staging and production each have their own `DATABASE_URL` variable `[live]`. UNVERIFIED: whether they point at separate databases or separate branches of one Neon project.

---

## 4. API server process (`apps/server`)

### 4.1 Boot sequence (`apps/server/src/main.ts`)

1. `import "./instrument"` first. It calls `initNestSentry` (`apps/server/src/instrument.ts:11-16`). In the built bundle `instrument.mjs` is a separate entry preloaded with `node --import` so Sentry patches externals before Nest loads (`apps/server/tsdown.config.ts:4-9`, `package.json:17`).
2. Fastify adapter with logger on outside tests (lines 30-32). `NestFactory.create(AppModule, adapter, { bufferLogs: true, rawBody: true })` (lines 35-42).
3. `app.useLogger(new SentryNestLogger())` mirrors warn/error to Sentry Logs (line 46; `packages/observability/src/nestjs-setup.ts:23-33`).
4. `enableShutdownHooks()` (line 48). Multipart uploads, max 15 MiB, one file (lines 50-58).
5. `text/plain` parser with 16 KiB limit for the lead beacon (lines 63-71). Feedback route body limit 4 MiB (lines 76-82). Default JSON limit stays Fastify's 1 MiB.
6. Global prefix `api`, root `GET /` excluded (lines 84-86).
7. CORS: exact origins, credentials, exposed `Content-Disposition`, allowed headers include `Last-Event-ID`, `sentry-trace`, `baggage`, `x-wandit-workspace`, `x-captcha-response`, `maxAge 86400` (lines 89-118). Public lead capture gets its own policy through a delegator (lines 122-129).
8. Global `ValidationPipe` with whitelist + transform (lines 131-137).
9. `onSend` hook adds `X-Content-Type-Options: nosniff` and HSTS when `BETTER_AUTH_URL` is https (lines 140-150).
10. `app.init()`, then remove the urlencoded parser (lines 158-162). Listen on `0.0.0.0:PORT` (line 165).

### 4.2 Module wiring (`apps/server/src/app.module.ts`)

- `SentryModule.forRoot()` first (line 51). `ConfigModule.forRoot({ isGlobal, load: [appConfig, queueConfig] })` (lines 52-56).
- Infra modules: `AnalyticsModule`, `DatabaseModule`, `QueuesModule` (lines 57-59).
- `AuthModule` before `WorkspacesModule` on purpose. Global guards run in module registration order (lines 64-67; `workspaces.module.ts:17-19`).
- 30+ feature modules follow. Add a new module by importing it in this array.
- Global providers: `APP_FILTER = ApiExceptionFilter`, `APP_INTERCEPTOR = ApiResponseEnvelopeInterceptor` (lines 95-104).

### 4.3 Cross-cutting HTTP behavior

- Guards: `CrossSiteWriteGuard` then `AuthGuard` (both `APP_GUARD` in `auth.module.ts:256-266`), then `WorkspaceContextGuard` (`workspaces.module.ts:35-38`). Deny by default. `@Public()` opts out (`docs/api-security.md:3-10`). `@AllowCrossSiteWrite()` opts out of the CSRF guard (`docs/features/csrf-and-security-headers.md:23`).
- Response envelope `{ data, meta: { requestId, timestamp } }` for every route unless `@SkipResponseEnvelope()` (`api-response-envelope.interceptor.ts:36-70`).
- Error envelope `{ error: { code, message, path, requestId, statusCode, timestamp, details? } }`. 5xx are sent to Sentry; 4xx are not (`api-exception.filter.ts:57-76`).
- Input validation: `ZodValidationPipe` with contracts from `@wandit/contracts` (`docs/api-security.md:39-40`).
- Admin surface: separate Better Auth instance at `/api/admin-auth`, memory rate limit, `@AdminOnly()` + `@AdminPermission()` (`packages/auth/src/index.ts:776-786`, `docs/api-security.md:20-35`).
- Better Auth app instance: `basePath /api/auth`, rate limit storage `database` by default, Redis `customStorage` that fails open (`packages/auth/src/index.ts:229-234,429-437`; `better-auth-redis-secondary-storage.ts:88-158`). `trustedOrigins` = CORS web origins + `wandit://` + `exp://` + localhost Expo dev (`index.ts:476-483`).
- `TRUSTED_PROXY_CIDRS` is required behind a proxy so rate limits key on the real client IP (`server.ts:211-219`).

### 4.4 Streaming patterns (two exist)

1. Legacy relay: `GET /api/v1/chats/:chatId/stream`, `@SkipResponseEnvelope()`, `@PersonalWorkspaceOnly()`, reads `Last-Event-ID`, relays Redis Stream events to the Fastify reply (`chats.controller.ts:127-152`). Producer is the BullMQ worker (`apps/worker/src/infrastructure/redis/chat-events.publisher.ts:148-165`).
2. AI SDK stream: `POST /api/v1/chats/:chatId/ai-stream`, `@SkipResponseEnvelope()`, `reply.hijack()`, then `pipeUIMessageStreamToResponse({ response: reply.raw, headers: manual CORS })` (`ai-chat.controller.ts:89-150`; `ai-chat.service.ts:1447-1463`). The request `close` event aborts the run (controller line ~143). This is the pattern V2 should copy for harness output streaming.

### 4.5 Health

- `GET /` and `GET /api/health` return `{ status: "ok" }` (`health.controller.ts:5-19`). Both are `@Public()`. Sentry traces drop any name that includes `/health` (`packages/observability/src/internal/shared.ts:91-99`). No Railway health check path is configured `[live]`.

---

## 5. `apps/server/src/infrastructure/*`

| Folder | What it does | Evidence |
| --- | --- | --- |
| `database/` | `DATABASE` symbol; provider calls `createDb()` once per Nest app | `database.module.ts:6-15`, `database.constants.ts:3-5` |
| `redis/` | `createRedisConnectionOptions(REDIS_URL, { commandTimeout, lazyConnect, maxRetriesPerRequest })`; `rediss://` enables TLS | `redis-connection.ts:26-47` |
| `queues/` | BullMQ `forRoot` with `lazyConnect`, 3 attempts, exponential backoff 1 s, `removeOnComplete 1000`, `removeOnFail 5000`, prefix `QUEUE_PREFIX` (default `isr-ai`); registers all names from `@wandit/jobs`; empty when `QUEUE_ENABLED=false` | `queues.module.ts:18-48` |
| `storage/` | Plain functions, no Nest, shared with Trigger tasks. S3 client on `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`. Key builders: `pageHtmlKey`, `siteFileKey`, `publishedCurrentKey`, `publishedArchiveKey`, `siteAssetKey`, `siteVideoKey`, `projectThumbnailKey`, `imageGenerationKey`, `marketingAssetKey`, `leadScrapeFileKey`, `userUploadKey`, `feedbackScreenshotKey`, `variantKey`. `publicAssetUrl()` needs `R2_PUBLIC_BASE_URL`. `IMMUTABLE_ASSET_CACHE_CONTROL`. Image variants via `sharp` | `r2.ts:29-50,65-258,396-573`, `store-image-variants.ts`, `optimize-image.ts` |
| `http/` | Exception filter, envelope interceptor, `@SkipResponseEnvelope()`, `ZodValidationPipe`, request country and device class helpers, Fastify header helpers | files listed in section 4 |
| `analytics/` | `AnalyticsModule`, `AnalyticsService` (PostHog node), `generation-events.ts` (`generation_completed`, `generation_failed`) | `analytics.module.ts`, `generation-events.ts` |

---

## 6. `apps/worker` and `packages/jobs`

### 6.1 What the worker is

- Nest application context, no HTTP port (`apps/worker/src/main.ts:18-34`). Sentry preload like the server (`instrument.ts:10-15`, runtime tag `worker`).
- Module wiring imports server code by relative path (`worker.module.ts:9-19`) and aliases `DATABASE` to `WORKER_DATABASE` so reused services share one pool (`database-alias.provider.ts:7-10`).
- BullMQ `forRoot` with the same defaults as the API but without `lazyConnect` (`worker-queues.module.ts:16-31`).

### 6.2 Queues and jobs (`packages/jobs/src/index.ts`)

| Queue | Job names | Processor | Status |
| --- | --- | --- | --- |
| `ai-generation` (line 9) | `generate-site`, `revise-site`, `generate-copy` (lines 26-29) | `ai-generation.processor.ts` | Only `generate-copy` is handled (lines 80-86). Runs `streamText` with `AI_CHAT_MODEL`, publishes deltas to Redis Streams, settles metering. |
| `media-generation` (line 11) | `generate-image`, `generate-video` | `media-generation.processor.ts` | Scaffold: returns `processed: false` (lines 13-20) |
| `lead-processing` (line 13) | `normalize-lead`, `send-lead-notification` | `lead-processing.processor.ts` | Scaffold |
| `publish` (line 15) | `publish-site` | `publish.processor.ts` | Scaffold. Real publish runs synchronously in `SitesModule` (`docs/features/publishing-serving.md:12`). |

### 6.3 Deploy status

- `docs/observability.md:20` describes a Railway `worker` service. Railway project `Wandit` has no such service `[live]`. Either it was removed or it never existed. UNVERIFIED which.
- The chat path on web uses the AI SDK stream, not the queue (`apps/web/src/features/workspace/lib/ai-chat-context.tsx:16-24`; `docs/features/ai-error-normalization-and-observability.md:31` calls the BullMQ chat path "dormant on web").
- `docs/features/billing.md:152-156`: billing jobs moved to Trigger.dev; the worker keeps only four non-billing queue contracts.
- Conclusion for V2: do not build on BullMQ. Trigger.dev is the active job runtime. Redis stays useful for short-lived streams and locks.

---

## 7. Trigger.dev tasks (`apps/server/src/trigger`)

### 7.1 Shared runtime facts

- `init.ts` is auto-loaded before any task. It initializes Sentry (errors-only) and a PostHog node client with `flushImmediately`, and flushes on `tasks.onComplete` (`init.ts:12-29`).
- Sentry for Trigger: `defaultIntegrations: false`, `skipOpenTelemetrySetup: true`, `tasks.onFailure` captures one event per failed run with `runId`, `taskId`, `attempt`, and `userId` (`packages/observability/src/trigger.ts:25-76`).
- Tasks create a fresh `createDb()` pool per run and end it in `finally` (`generate-page.task.ts:97-103`).
- `undici-timeouts.ts` raises fetch header/body timeouts to one hour for slow reasoning models (lines 13-22). It must be the first import of any task that streams from a model.
- `generate-page` runs on `machine: "medium-1x"` (2 GB) with `maxDuration: 1800` and `retry.maxAttempts: 1` (`generate-page.task.ts:83-91`).
- Realtime: the API mints a read-scoped public token for one run, valid 2 h, and returns `{ publicAccessToken, runId }` to the web (`page-build-handoff.ts:105-134`). The web subscribes with `@trigger.dev/react-hooks` and falls back to polling (`apps/web/src/features/workspace/components/chat/parts/scrape-leads-part.tsx:145-160`).
- Every dispatcher checks `TRIGGER_SECRET_KEY` at call time and degrades when it is missing (for example `generate-page.tool.ts:178`).

### 7.2 Task inventory

Event tasks (called with `tasks.trigger`): `generate-page`, `generate-image`, `animate-image`, `generate-video`, `edit-video`, `extend-video`, `product-video`, `generate-marketing-asset`, `run-connector-generation`, `scrape-leads`, `send-lead-push`, `domain-purchase`, `domain-configure`, `order-refund`, `affiliate-attribution-retry`, `billing-webhook-retry-event`, `signup-grant-outbox-delivery`.

Scheduled tasks (`schedules.task`, UTC):

| Task id | Cron | File |
| --- | --- | --- |
| `metering-reconciliation-sweep` | `* * * * *` | `reconcile-metering.task.ts:15-16` |
| `reconcile-order-refunds` | `*/5 * * * *` | `reconcile-order-refunds.task.ts:10-11` |
| `reconcile-image-animations` | `*/5 * * * *` | `reconcile-image-animations.task.ts:19-20` |
| `signup-grant-outbox-sweep` | `*/5 * * * *` | `sweep-signup-grants.task.ts:10-11` |
| `lifecycle-events-sweep` | `*/5 * * * *` | `sweep-lifecycle-events.task.ts:7-8` |
| `manual-subscription-expiry` | `*/10 * * * *` | `manual-subscription-expiry.task.ts:9-10` |
| `billing-webhook-dead-letter-retry-sweep` | `*/10 * * * *` | `retry-billing-webhooks.task.ts:11-12` |
| `financial-reconciliation-outbox-sweep` | `*/10 * * * *` | `sweep-financial-reconciliation.task.ts:14-15` |
| `subscription-refill-sweep` | `*/10 * * * *` | `subscription-refill.task.ts:9-10` |
| `reconcile-domain-purchases` | `*/15 * * * *` | `reconcile-domain-purchases.task.ts:9-10` |
| `metering-stranded-reservation-recovery` | `*/15 * * * *` | `recover-stranded-metering.task.ts:15-16` |
| `model-price-refresh` | `0 * * * *` | `refresh-model-prices.task.ts:9-10` |
| `domain-renewal-notices` | `0 2 * * *` | `domain-renewal-notices.task.ts:9-10` |
| `external-domain-delegation-reminders` | `30 2 * * *` | `external-domain-delegation-reminders.task.ts:9-10` |
| `affiliate-commission-approval-sweep` | `0 4 * * *` | `affiliate-approval.task.ts:9-10` |
| `domain-registrar-sync` | `0 3 * * 0` | `domain-registrar-sync.task.ts:9-10` |
| `lead-sheet-auto-sync` | cron object | `lead-sheet-auto-sync.task.ts:15-16` |

Named queues: `billingFinancialQueue`, `meteringMaintenanceQueue`, `modelPricingQueue` (`billing-task-queues.ts`), `domainOperationsQueue`, `orderRefundsQueue` (`domain-task-queues.ts`), `imageGenerationQueue`, `imageAnimationQueue`, `marketingAssetQueue`, `videoGenerationQueue`, `lifecycleEventsQueue`, `leadSheetAutoSyncQueue`.

Note: the same schedules run in both `staging` and `prod` Trigger environments because the same code deploys to both. Each environment needs its own `DATABASE_URL` and secrets in the Trigger dashboard. UNVERIFIED that staging tasks point at the staging database.

---

## 8. Environment variables, grouped by purpose

Source: `packages/env/src/server.ts` unless noted. "Opt" = optional at boot. "Req" = required.

### 8.1 Core API and auth

| Var | Req/Opt | Line | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Req | 180 | Postgres |
| `BETTER_AUTH_SECRET` | Req (min 32) | 181 | Session signing |
| `BETTER_AUTH_URL` | Req | 182 | API origin; also drives HSTS and Expo dev origin trust |
| `CORS_ORIGIN` | Req | 185 | Canonical web origin; base for redirects and invite links |
| `CORS_EXTRA_ORIGINS` | Opt | 187 | Comma list of extra exact origins |
| `ADMIN_ORIGIN` | Opt | 177 | Admin app origin |
| `ADMIN_EMAILS` | Opt | 179 | Auto-promote to admin |
| `AUTH_COOKIE_SAME_SITE` | Opt | 191 | `lax` or `none` override |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Req | 192-193 | OAuth |
| `TRUSTED_PROXY_CIDRS` | Opt (required behind a proxy) | 219 | Client IP for rate limits |
| `NODE_ENV` | Opt | 222 | `development` default |
| `PORT` | Opt | 225 | 3000 default; Railway uses 3100 `[live]` |
| `TURNSTILE_SECRET_KEY` | Opt | 205 | Captcha |
| `CHATWOOT_HMAC_TOKEN` | Opt | 210 | Live chat identity |
| `META_APP_ID`, `META_APP_SECRET` | Opt | 220-221 | Meta connector |

### 8.2 AI models and providers

| Var | Line | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | 74 | Vercel AI Gateway |
| `AI_PROVIDER` | 80 | `vercel` or `openrouter` |
| `AI_PROVIDER_OVERRIDES` | 85 | Per-task provider (`packages/env/src/llm-routing.ts:11-18`) |
| `OPENROUTER_API_KEY` | 93 | OpenRouter |
| `AI_CHAT_MODEL`, `AI_TITLE_MODEL`, `AI_PROMPT_REFINER_MODEL`, `AI_TRANSCRIPTION_MODEL`, `AI_MARKETING_MODEL`, `AI_IMAGE_MODEL`, `AI_IMAGE_EDIT_MODEL`, `AI_VIDEO_DIRECTOR_MODEL`, `AI_VIDEO_INSPECT_MODEL` | 72-150 | Model ids per task |
| `AI_PAGE_BUILDER_MODEL`, `AI_PAGE_DESIGN_MODEL` (fallback), `AI_PAGE_DESIGN_REASONING` | 127-141 | Builder model and reasoning |
| `AI_USD_PER_CREDIT` | 118 | Credit pricing anchor |

### 8.3 Background work and storage

| Var | Line | Purpose |
| --- | --- | --- |
| `TRIGGER_SECRET_KEY` | 151 | Trigger.dev server key; checked at call time |
| `QUEUE_ENABLED`, `QUEUE_PREFIX`, `REDIS_URL` | 227-232 | BullMQ; `REDIS_URL` also used by chat streams and auth rate limits |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | 164-170 | Cloudflare R2 |
| `SERPER_API_KEY`, `SERPER_USD_MICROS_PER_SEARCH` | 155-163 | Lead scraping |

### 8.4 Publishing, domains, Cloudflare

| Var | Line | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_ZONE_ID_WANDIT_APP` | 245-247 | KV pointer writes; all three required for publish or API returns 503 `PUBLISH_UNAVAILABLE` |
| `CLOUDFLARE_ACCOUNT_ID` | 252 | Zone creation for custom domains |
| `NAMECOM_ENVIRONMENT`, `NAMECOM_USERNAME`, `NAMECOM_API_TOKEN` | 242-244 | Registrar |
| `DOMAINS_APEX_ZONE_ENABLED`, `DOMAINS_FALLBACK_ORIGIN`, `SITES_DOMAIN`, `SITE_PUBLISH_ASSET_CHECK`, `ALLOW_PUBLISH_WITHOUT_KV` | 259-278 | Publish behavior switches |

### 8.5 Billing and email

| Var | Line | Purpose |
| --- | --- | --- |
| `GENERATION_BILLING_MODE` | 234 | `enforce` or `off`; `off` is refused in production (`server.ts:53-64`) |
| `STRIPE_SECRET_KEY`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_WEBHOOK_SECRET` | 236-238 | Stripe |
| `RESEND_API_KEY`, `EMAIL_FROM` | 198-202 | Mail |
| `LINEAR_API_KEY`, `LINEAR_FEEDBACK_TEAM_ID` | 292-293 | Feedback tickets |

### 8.6 Observability

| Var | Line | Purpose |
| --- | --- | --- |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | 280-285 | Server, worker, Trigger |
| `POSTHOG_KEY`, `POSTHOG_HOST` | 287-289 | Server, Trigger |
| Build-time only: `SENTRY_ORG`, `SENTRY_AUTH_TOKEN`, `RAILWAY_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA` | `turbo.json:9-24`, `packages/observability/src/vite.ts:15-24`, `internal/release.ts:17-22` | Source map upload and release naming |

### 8.7 Web (`packages/env/src/web.ts`)

`VITE_SERVER_URL` (req), `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_TURNSTILE_SITE_KEY`, `VITE_CHATWOOT_BASE_URL`, `VITE_CHATWOOT_WEBSITE_TOKEN` (lines 7-36).

### 8.8 Native (`packages/env/src/native.ts`)

`EXPO_PUBLIC_SERVER_URL` (req), `EXPO_PUBLIC_TRIGGER_API_URL` (default cloud), `EXPO_PUBLIC_WEB_APP_URL` (lines 7-15).

### 8.9 Edge Worker bindings (`apps/edge/src/index.ts:31-39`)

`PTR` (KV), `SITES` (R2), `SENTRY_DSN` (secret), `SENTRY_ENVIRONMENT` (var), `CF_VERSION_METADATA` (binding).

---

## 9. Security posture (relevant to V2)

- Deny by default: `AuthGuard` global; `@Public()` opt-out (`docs/api-security.md:3-10`).
- CSRF: `SameSite=Lax` in production, `CrossSiteWriteGuard` on every non-safe method, no urlencoded parser (`docs/features/csrf-and-security-headers.md:15-24`).
- Headers: API sends `nosniff` and HSTS; web and admin send `X-Frame-Options: DENY` and `frame-ancestors 'none'` (`csrf-and-security-headers.md:34-37`). These headers stop other sites from framing the web app. They do not stop the web app from embedding an iframe of another origin. V2 preview iframes must point at a non-`wandit.dev` origin (PRD rule: never serve user content from `wandit.dev`, `docs/PRD.md:88`).
- Better Auth rate limit uses Redis with fail-open (`better-auth-redis-secondary-storage.ts:100-116`).
- Public endpoints are limited to lead capture with honeypot and tight body limits (`docs/api-security.md:61`).
- Expo authorization proxy target is pinned (`csrf-and-security-headers.md:26-30`).
- Planned but not done: `@fastify/helmet`, explicit global `bodyLimit` (`docs/api-security.md:16-18`). UNVERIFIED whether these landed after the doc.

---

## 10. Observability wiring

### 10.1 Sentry per runtime

| Runtime | Init | Traces | Logs | Release |
| --- | --- | --- | --- | --- |
| Server (Nest) | `initNestSentry` (`packages/observability/src/nestjs.ts:29-51`) | `tracesSampler` 0.2, drops `/health` | warn+error via console integration and `SentryNestLogger`; `vercelAIIntegration` records inputs and outputs | `server@<sha>` (`internal/release.ts:9-23`) |
| Worker | `initNodeSentry` (`node.ts:27-44`) | 0.1 | warn+error | `worker@<sha>` |
| Trigger | `initTriggerSentry` (`trigger.ts:25-76`) | none, errors only | none | `server@<sha>` |
| Browser (web, admin) | `initBrowserSentry` (`browser.ts:83-151`) | 1.0, propagates to `VITE_SERVER_URL` | n/a | injected by Vite plugin or `VITE_SENTRY_RELEASE` |
| Edge | `Sentry.withSentry` + `edgeSentryOptions` (`cloudflare.ts:17-25`, `apps/edge/src/index.ts:122`) | 0.1 | Workers Logs | from `CF_VERSION_METADATA` |

- `beforeSend` scrubs cookies and auth headers and drops duplicate Vercel AI events (`internal/shared.ts:58-83`).
- Explicit capture rule: import `Sentry` from `@wandit/observability/<runtime>`, never from `@sentry/*` directly (`docs/observability.md:61`).
- Sentry projects: `wandit-server`, `wandit-web`, `wandit-admin`, `wandit-edge` (`docs/observability.md:10`; `trigger.config.ts:78`; `apps/web/vite.config.ts:44`; `apps/admin/vite.config.ts:35`).
- Known gaps: server, worker, and edge stacks are not source-mapped in Sentry; env boot crashes are not captured; browser events under-count without a tunnel (`docs/observability.md:93-97`). No `/api/tunnel` route exists in `apps/server/src`.

### 10.2 PostHog

- One project, EU host by default (`packages/analytics/src/internal/shared.ts:2`).
- Browser: `initBrowserAnalytics` before Sentry so the Sentry link integration works (`apps/web/src/main.tsx:53-71`). Session replay with inputs masked (`browser.ts:39-46`). URL query strings stripped (`shared.ts:25-44`).
- Server: `AnalyticsService` and `generation-events.ts`. Trigger: `triggerAnalytics` in `init.ts:18-23`.
- `@wandit/analytics/react` re-exports `PostHogProvider`, `useFeatureFlagEnabled`, `useFeatureFlagPayload`, `useFeatureFlagVariantKey` (`react.ts:1-7`). No file in `apps/web/src` imports them today. `createNodeAnalytics().isFeatureEnabled(flag, distinctId)` exists on the server side (`node.ts:71-72`).

### 10.3 Feature gating that exists today

- `product_settings` single row with booleans `emailAuthEnabled`, `organizationsEnabled`, `paidSubscriptionsEnabled`, `topupsEnabled`, `manualPaymentsEnabled`, `lifecycleEmailsEnabled`, `signupGrantEnabled` (`apps/server/src/modules/settings/domain/product-settings.constants.ts:3-20`).
- Public read: `GET /api/v1/settings/public` (`public-settings.controller.ts:7-18`), schema `publicSettingsSchema` (`packages/contracts/src/v1/settings.ts:38-59`).
- Server guards per toggle: `SubscriptionsEnabledGuard`, `TopupsEnabledGuard`, `OrganizationsEnabledGuard`, `ManualPaymentsEnabledGuard` (`settings.module.ts:9-12`). `SettingsModule` is `@Global()`.
- Web read: `usePublicSettingsQuery()` (`apps/web/src/features/settings/api/settings.queries.ts:10-15`), used by the auth modal to show or hide email sign-in (`auth-modal.tsx:280-283`).
- Admin write: `AdminSettingsController` with optimistic `version` (`settings.ts:61-74`); UI in `apps/admin/src/features/settings/components/product-controls-card.tsx`.
- Cache TTL 30 s (`product-settings.constants.ts:22`).
- Env-level module gating pattern: `QueuesModule` imports nothing when `QUEUE_ENABLED=false` (`queues.module.ts:18-41`).

---

## 11. How to add the V2 module

### 11.1 Server: one NestJS module, mounted by env

1. Add to `packages/env/src/server.ts`: `V2_BUILDER_ENABLED` (`"true" | "false"`, default `"false"`, same transform as `QUEUE_ENABLED` at lines 227-230). Keep every V2 secret optional at boot, checked at call time. This matches the R2 and Trigger contract (`server.ts:119-123`).
2. Create `apps/server/src/modules/app-builder/` with the light-DDD layout from `apps/server/src/modules/README.md`. Controllers use `@Controller("v2/apps")` so routes land under `/api/v2/...` and never collide with `v1`.
3. In `apps/server/src/app.module.ts` add `...(env.V2_BUILDER_ENABLED ? [AppBuilderModule] : [])` after `WorkspacesModule` (line 67). Global guards then apply unchanged.
4. Reuse: `@CurrentUser()`, `@CurrentWorkspace()`, `ZodValidationPipe`, `ApiExceptionFilter`, the envelope interceptor, `AnalyticsService`, `Sentry` from `@wandit/observability/nestjs`, `MeteringService` for credits.
5. Streaming endpoint: copy the `ai-stream` pattern. `@SkipResponseEnvelope()`, `reply.hijack()`, `pipeUIMessageStreamToResponse({ response: reply.raw, headers: manual CORS })`, abort on request `close` (`ai-chat.controller.ts:89-150`, `ai-chat.service.ts:1447-1463`). Add any new request header to the CORS allowlist in `main.ts:99-116` before the web sends it.
6. Long runs: do not run the harness inside the API request. The API has one replica `[live]`, and a browser disconnect aborts the run. Two options fit the existing shape:
   - Option A: a Trigger.dev task (`apps/server/src/trigger/build-app.task.ts`) that drives the sandbox and streams progress through Trigger Realtime. The web already knows how to consume a `{ publicAccessToken, runId }` handle (`page-build-handoff.ts:105-134`). Raise `maxDuration` per task if 30 min is too short (`trigger.config.ts:53` is the global ceiling; a task can set its own).
   - Option B: the API starts the sandbox, stores the sandbox id on the app row, and the web reconnects to a resumable stream. Redis Streams with `Last-Event-ID` already implement resume (`chats.controller.ts:127-152`, `chat-events.publisher.ts:148-165`).
   - Use the already existing Trigger project `wandit-v2-experiment` only if V2 needs different secrets or machine presets. Otherwise one project with a new queue is simpler because `trigger-deploy.yml` deploys one `trigger.config.ts`.
7. Contracts: `packages/contracts/src/v2/*.ts` with route constants like `settingsRoutes` (`packages/contracts/src/v1/settings.ts:129`). Export from `packages/contracts/src/index.ts`.
8. DB: new tables under `packages/db/src/schema/` (for example `apps`, `app_builds`, `app_secrets`). Migrations ship through the existing Railway pre-deploy step, so a V2 migration reaches staging first.
9. Storage: new R2 key prefix `apps/{appId}/...` in `r2.ts`. Keep `published/{projectId}/current.html` untouched so the edge Worker keeps working.

### 11.2 Web: one feature folder, one thin route, one gate

1. `apps/web/src/features/app-builder/` per `docs/frontend-structure.md:41-62` (`api/`, `components/`, `lib/`, `pages/`, `index.ts`).
2. Route file `apps/web/src/routes/_auth/apps.$appId.tsx` (or `build.$appId.tsx`). `_auth/route.tsx` already enforces session and onboarding (lines 7-40).
3. Gate in `beforeLoad`: read `getPublicSettings()` (`settings.services.ts:5-9`) and `throw redirect({ to: "/dashboard" })` when `appBuilderEnabled` is false. Hide the entry point in the dashboard with `usePublicSettingsQuery()`.
4. Preview: an iframe whose `src` is a sandbox URL or a `*.<preview-domain>` host. Never `wandit.dev`. Keep `sandbox` attributes as the existing canvas does (`docs/PRD.md:51`).
5. Mobile preview: a second iframe or WebRTC view fed by the simulator streaming service (section 11.4).

### 11.3 Per-user rollout flag

Three mechanisms exist. Use two together:

| Mechanism | Scope | Cost | Fit |
| --- | --- | --- | --- |
| `V2_BUILDER_ENABLED` env | Whole environment (staging on, production off) | One schema line, one `app.module.ts` line | Mount or hide the module |
| `product_settings.appBuilderEnabled` | Whole product, admin toggle, 30 s cache | Migration + contract + admin card + guard class | Global kill switch, same as `paidSubscriptionsEnabled` |
| PostHog flag `app-builder` | Per user or cohort, no deploy | Mount `PostHogProvider` in `__root.tsx`; server check with `isFeatureEnabled(flag, userId)` | Beta cohort and gradual migration |

Recommended: env var for mounting, PostHog flag for per-user access, and a server guard `AppBuilderEnabledGuard` that checks both. A user who passes the flag also passes the server guard, so the web cannot be tricked by a client-only flag.

### 11.4 New infra and env groups V2 needs

| Group | Env var names (proposed) | Where set | Why |
| --- | --- | --- | --- |
| Module switch | `V2_BUILDER_ENABLED` | Railway staging (`true`), production (`false` at first) | Mount the module |
| Coding harness | `ANTHROPIC_API_KEY` or `ANTHROPIC_BASE_URL` + gateway key; `CLAUDE_CODE_OAUTH_TOKEN` if the harness uses OAuth | Railway server; Trigger dashboard; sandbox env | The current stack only has `AI_GATEWAY_API_KEY` and `OPENROUTER_API_KEY`. The AI SDK harness needs a provider the harness supports. UNVERIFIED which auth form the AI SDK harness feature accepts. |
| Sandbox provider | one of `E2B_API_KEY`, `VERCEL_SANDBOX_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`, `DAYTONA_API_KEY`, or Cloudflare Sandbox bindings; plus `SANDBOX_TEMPLATE_ID`, `SANDBOX_TIMEOUT_MS` | Railway server; Trigger dashboard | Runs the harness, dev server, and builds in isolation. Public preview ports give the iframe URL. |
| Supabase (hidden from users) | `SUPABASE_ACCESS_TOKEN` (management PAT), `SUPABASE_ORG_ID`, `SUPABASE_REGION` | Railway server; Trigger dashboard | Create one project per user app; read keys; run migrations; edge functions; logs; secrets |
| App secret storage | `APP_SECRETS_ENCRYPTION_KEY` (32 bytes) | Railway server; Trigger dashboard | Per-app Supabase service keys and user connector secrets must not sit in plain text in Postgres |
| Git (optional) | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | Railway server | Only if V2 keeps a hidden repo per app. Otherwise keep snapshots in R2. |
| Web hosting | `CLOUDFLARE_V2_DEPLOY_TOKEN` (Workers + Pages scopes), `V2_APPS_DOMAIN` (for example `apps.wandit.app`) | Railway server; Trigger dashboard | The existing `CLOUDFLARE_API_TOKEN` scopes are UNVERIFIED and the edge Worker serves static HTML only. Full apps need Workers or Pages deploys. |
| Mobile | `EXPO_TOKEN` (EAS builds and updates), simulator streaming: `APPETIZE_API_TOKEN` or a self-hosted streaming service URL and secret | Railway server; Trigger dashboard | Expo builds and preview streaming |
| Payments for user apps | `STRIPE_CONNECT_CLIENT_ID` | Railway server | Only if user apps take payments through Wandit |
| Web | none new if the server drives the gate | Vercel | Keep `VITE_*` count low |

Infra actions outside env:

1. Create a sandbox provider account and a base template with Node, pnpm, Expo CLI, and the harness preinstalled.
2. Create a Supabase organization for tenant projects and a management PAT.
3. Create a Cloudflare zone or subdomain for V2 previews and deploys. The current `*/*` Worker route on `wandit.app` will catch any new `*.wandit.app` host (`wrangler.jsonc:24`). Either add route exclusions or use a separate zone.
4. Add a Trigger.dev queue (or the second project) and set its env in the dashboard for both `staging` and `prod`.
5. Add Sentry tags `surface: v2` and PostHog events `app_build_started`, `app_build_completed`, `app_build_failed`, `app_published`.
6. Consider a Railway `server-v2` service only if the harness must run in the API process. Otherwise the existing single service is enough.

### 11.5 Ship-to-preview-first checklist for V2

1. Branch `feat/v2-builder` -> PR into `dev`. Vercel preview builds the web; the API module is not mounted anywhere yet.
2. Set `V2_BUILDER_ENABLED=true` and the V2 secrets on Railway `staging` and on Trigger `staging`.
3. PR `dev` -> `staging`. Railway staging redeploys and migrates. Trigger staging deploys. Test at `wandit-web-git-staging-isrgroups.vercel.app` against `api-staging.wandit.dev` (or `staging.wandit.dev` after the same-site fix).
4. PR `staging` -> `main` with `V2_BUILDER_ENABLED` still `false` in production. The module code ships but does not mount.
5. Flip `V2_BUILDER_ENABLED=true` in production. Keep the PostHog flag off for everyone. Enable per user. Migrate V1 users in cohorts.

---

## 12. Risks and open questions

1. Redis in `sfo` and the API in `europe-west4` `[live]`. Every queue, stream, and rate-limit call pays transatlantic latency. Move Redis or confirm the region before V2 adds more Redis traffic.
2. No CI for tests or type checks. A V2 regression can reach staging without any automated check.
3. Update 2026-09-07: done in a different form. The staging web is on `preview.wandit.dev`, same site as the staging API. Feature-branch previews on `vercel.app` still cannot log in. WANDIT-160 updates the docs.
4. `apps/worker` has no Railway service `[live]`. Decide whether to delete the worker or keep it as a dormant scaffold. V2 should not depend on it.
5. The edge Worker serves only the production bucket (`wrangler.jsonc:30-34`). Staging publish tests never reach a real Worker. V2 web-app hosting needs its own staging path.
6. `apps/edge` deploys by hand. Any V2 change to the Worker needs a deploy workflow or a documented manual step.
7. `AI_BUILDER_REASONING` is set in Railway and local `.env` but no code reads it. Remove it or wire it.
8. Sentry AI spans do not exist for Trigger tasks (`docs/features/ai-error-normalization-and-observability.md:466`). V2 harness runs inside Trigger or a sandbox will have the same gap unless the task adds its own spans.
9. UNVERIFIED: scopes of the existing `CLOUDFLARE_API_TOKEN`; whether `SENTRY_ENVIRONMENT=preview` is set on staging; whether staging and production use separate databases; whether the Trigger staging environment points at the staging database; purpose of the two extra Railway projects; whether Vercel preview env values differ from production.
10. The AI SDK "harness" feature and the Claude Agent SDK inside a sandbox were not read in this probe. Their auth and streaming contracts are UNVERIFIED here and belong to a separate probe.

---

## 13. Key file index

| Path | Role |
| --- | --- |
| `apps/server/src/main.ts` | API bootstrap, CORS, headers, body limits |
| `apps/server/src/app.module.ts` | Module registration order, global filter and interceptor |
| `apps/server/src/instrument.ts`, `apps/server/tsdown.config.ts`, `apps/server/package.json` | Sentry preload and build/start commands |
| `apps/server/src/modules/auth/auth.module.ts`, `apps/server/src/modules/workspaces/workspaces.module.ts` | Global guard order |
| `apps/server/src/infrastructure/queues/queues.module.ts` | Env-gated module pattern |
| `apps/server/src/infrastructure/storage/r2.ts` | R2 client and key layout |
| `apps/server/src/infrastructure/http/*` | Envelope, errors, validation |
| `apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts`, `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts` | AI SDK streaming over Fastify |
| `apps/server/src/modules/generation/presentation/http/controllers/chats.controller.ts` | Resumable SSE relay |
| `apps/server/src/modules/settings/*`, `packages/contracts/src/v1/settings.ts` | Product settings gate |
| `apps/server/src/modules/pages/application/page-build-handoff.ts` | Trigger Realtime token minting |
| `apps/server/trigger.config.ts`, `apps/server/src/trigger/init.ts`, `apps/server/src/trigger/generate-page.task.ts`, `apps/server/src/trigger/undici-timeouts.ts` | Trigger.dev runtime |
| `.github/workflows/trigger-deploy.yml`, `.github/workflows/mobile-testflight.yml` | CI deploys |
| `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/src/routes/_auth/route.tsx` | Web hosting, headers, observability init, auth layout |
| `apps/edge/wrangler.jsonc`, `apps/edge/wrangler.dev.jsonc`, `apps/edge/src/index.ts` | Edge Worker |
| `apps/native/eas.json`, `apps/native/app.json` | Mobile build profiles |
| `apps/worker/src/worker.module.ts`, `apps/worker/src/processors/*`, `packages/jobs/src/index.ts` | Legacy BullMQ path |
| `packages/env/src/server.ts`, `web.ts`, `native.ts`, `cors-origins.ts`, `cookie-same-site.ts`, `llm-routing.ts` | Env schemas and helpers |
| `packages/observability/src/*`, `packages/analytics/src/*` | Sentry and PostHog |
| `packages/db/src/index.ts`, `packages/db/drizzle.config.ts` | DB client and migrations |
| `docs/deployments/web-environments.md`, `docs/observability.md`, `docs/api-security.md`, `docs/features/csrf-and-security-headers.md`, `docs/features/edge-serving.md`, `docs/features/publishing-serving.md` | Source docs |
