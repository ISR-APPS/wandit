# V2 architecture proposal: fastest path to Lovable parity

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev` at `1b2a9a1e`).
Author: Claude Fable principal-engineer agent. Read-only. No code changed. No commit.

Angle: reuse the maximum of the existing stack (NestJS/Fastify, Trigger.dev, Redis, Cloudflare edge, Better Auth, credits). Pick the least-risky vendor per component. Ship web V2 first and mobile V2 second. Optimize for weeks-to-preview.

Evidence marks:
- `path:line` = read in this worktree on 2026-09-03.
- URL = fetched by a sibling research report on 2026-09-03 (the report name follows the URL).
- `UNVERIFIED` = not confirmed from a primary source.
- `ESTIMATE` = a planning number, not a vendor number.

Inputs: the 19 files in `docs/v2/research/` (nine `inspect-*.md` V1 inspections and ten research topic files). This proposal cites them by file name. The full evidence for each claim lives in those files.

---

## 0. Decision summary

| # | Component | Choice | Why this is the fastest safe path |
|---|---|---|---|
| 1 | Agent runtime and harness | AI SDK v7 `HarnessAgent` + `@ai-sdk/harness-claude-code`. One harness session per chat. Sonnet 5 at medium effort. The V1 Brain persona becomes a `CLAUDE.md` plus skills inside the sandbox. | The adapter emits the same UI-message stream `useChat` already consumes. It reuses `createUIMessageStream` and `toolApproval` from V1 unchanged. Only the Vercel Sandbox provider is shipped, so this pairs with component 2. |
| 2 | Sandbox provider and lifecycle | Vercel Sandbox, Pro plan, `cdg1`, custom image. One persistent sandbox per project named by `projectId`. Snapshot on stop, resume on demand, 20-minute idle stop, git as the durable copy. | The only first-party harness sandbox adapter. Firecracker isolation, credential brokering at the firewall, active-CPU billing. E2B is the fallback and needs a custom provider. |
| 3 | Web app template | Vite + React + TypeScript + Tailwind + shadcn/ui + React Router (library mode) + `@supabase/supabase-js` + a small `@wandit/leads` SDK. AR/FR/RTL baked into the template. | Output is plain static files. The existing Cloudflare edge stack serves it after one Worker change. It matches Lovable. |
| 4 | Mobile template and preview | Expo (SDK pinned to the store Expo Go) + expo-router + react-native-web. Preview = Expo web in the same iframe plus a QR code to Expo Go. Phase 1.5 = wandit dev client + Appetize on demand. Simulator streaming deferred. | Zero new infrastructure for the first mobile slice. Every mobile competitor starts here. |
| 5 | Backend-on-behalf | Supabase, one project per app, in a wandit-owned Pro organization, provisioned lazily by an `ensure_backend` host tool. Supabase Auth, Resend (domain-scoped key per tenant), pg_cron, user-owned Stripe restricted key. Cloud tab on a Management API proxy. | The Lovable Cloud and Bolt Cloud model. The Management API covers about 90 percent of what the dashboard needs. Pause idle projects to control the about $9.8 per month list price. |
| 6 | Versioning and git | Git inside the sandbox. One server-made commit per assistant turn, tagged `msg/<messageId>`. Incremental git bundles plus patch and numstat to R2. Postgres `app_commits`, `app_bundles`, `app_branches`. Restore is copy-forward. Git hidden from users. | Copies the V1 immutable-version plus CAS pointer shape. R2 is the cheapest durable store and is already integrated. |
| 7 | Preview and preview auth | New registrable preview domain (for example `wanditpreview.app`), wildcard DNS, one small Cloudflare Worker that maps `{token}.{domain}` to a sandbox port through KV and forwards HTTP and WebSocket traffic. Token in the hostname, so the iframe and Expo Go work with no cookies. | Vercel preview URLs are public, so a proxy is mandatory. A hostname token needs no header and keeps Universal SSL happy (one level). It reuses the KV pointer pattern of `apps/edge`. |
| 8 | Publish and hosting | Keep `wandit-edge`, KV pointers, R2, Cloudflare for SaaS and the `domains` module. Extend the Worker to serve a per-deployment prefix with a manifest and SPA fallback. One mutable flip object `published/{projectId}/current.json`. Build runs in the sandbox in a Trigger task. Workers for Platforms only in a later phase for SSR. | Cloudflare charges zero egress. The Worker, the custom-domain pipeline and the `deployments` table already exist. |
| 9 | Streaming, events, jobs | Phase 1: host the harness turn inside the API request with the V1 `ai-stream` pattern. Phase 2: move the turn host to a Trigger.dev task `builder-turn` with a Redis Stream relay, a custom `ChatTransport` with `reconnectToStream`, a Redis lock and a cancel route. Long jobs (build, publish, provision) always run in Trigger tasks with Realtime tokens. | Phase 1 reuses `ai-chat.controller.ts` almost verbatim to reach staging in weeks. Phase 2 reuses the legacy Redis relay code and the Trigger patterns before production. |
| 10 | Metering and credits | Keep 1 credit = $0.04. Add operation `agent_session` with checkpoint debits. Price from harness token counts with the server price table. Add `sandbox` (measured, minute) with `customerBillable: false` at first. Backends are plan entitlements. Add `projectId` to `ai_usage_events` and a project cap. | The ledger, reserve/settle/reconcile, sweeps, Stripe and product settings are reused as they are. Only the registry and one service path grow. |
| 11 | Security | Firecracker VM per project, non-root, deny-by-default egress with an allowlist, no platform secret in the VM (firewall credential brokering), `disallowedTools` plus a `PreToolUse` deny hook for config paths, separate preview domain, publish gate (advisors, anonymous RLS probe, secret scan, phishing rules), `suspended` pointer, `audit_events` table, Redis rate limits, separate Anthropic workspace with a spend cap. | Every control maps to a documented vendor feature or to an existing V1 hook. |
| 12 | Module and rollout | One NestJS module `app-builder` mounted when `V2_BUILDER_ENABLED=true`, routes under `/api/v2`, contracts in `packages/contracts/src/v2`, tables added with defaults, `projects.engine` discriminator, one web route that swaps the workspace body by engine, `product_settings.v2BuilderEnabled` plus a PostHog flag plus a server guard. Rollout: `dev` to `staging` with the switch on, then `main` with the switch off, then per-user enable. | Copies the `QueuesModule` env-gate and the `organizationsEnabled` toggle chain. |
| 13 | Migration and leads | V1 projects keep `engine = v1_page`. A one-way "Upgrade to app" import writes the latest HTML into the template as the home route. Leads keep the same `POST /api/public/leads/{publicFormId}` endpoint through the SDK. V2 publishes keep writing `deployments` rows so `leads.deploymentId` and the KV contract hold. | No V1 table changes. No V1 user is forced to move. |
| 14 | Phases | Phase 0 spikes (1.5 weeks), Phase 1 chat + preview in staging (5 weeks), Phase 2 publish + durability (4 weeks), Phase 3 Cloud (5 weeks), Phase 4 mobile (4 + 3 weeks). About 20 engineer-weeks to web Lovable parity; about 27 with mobile. | See section 15. |
| 15 | Cost per active project | About $5 to $35 per month of AI for a web project (10 to 60 messages on Sonnet 5), plus about $3 of sandbox, plus about $9.8 per month when a Supabase backend is live and not paused, plus cents of hosting. | See section 16. |

---

## 1. Principles that drive every choice

1. Reuse before rewrite. V1 already has the shell, the chat transport, the credits ledger, the edge Worker, the custom-domain pipeline, the leads endpoint, the attempt-row pattern and the Trigger.dev deploy flow. V2 adds one module and one Worker branch. It does not fork the platform. Evidence: `docs/v2/research/inspect-ai-pipeline.md` section 15, `inspect-publish-serve.md` section 13, `inspect-web-builder-ui.md` section 11, `inspect-auth-billing-credits.md` section 11.
2. Buy the agent loop. V1 hand-builds tools, a virtual file system, an edit engine, validation, a stall watchdog and a transcript repair path (`inspect-ai-pipeline.md` section 14). The harness gives all of that. The product code becomes prompts, skills, host tools and UI cards.
3. One vendor decision per component, and the one with a shipped adapter wins. The AI SDK harness ships only `@ai-sdk/sandbox-vercel` (https://ai-sdk.dev/providers/ai-sdk-harnesses, `sandboxes.md` section 6.1). So Vercel Sandbox is the sandbox. Cloudflare stays the host. Supabase is the backend. Trigger.dev stays the job runner.
4. Static output first. A Vite SPA plus Supabase Edge Functions means the host never runs user server code. This removes most isolation work from publish and keeps the edge Worker static-only (`hosting-publish.md` section 9).
5. Ship to staging early, harden before production. Phase 1 accepts three known gaps (turn dies with the API process, no resume, no per-run LLM budget token). Phase 2 closes them. Each gap has a named fix and a named reused piece of code.
6. Say what is not verified. Two items block launch and are not code: the Anthropic terms for running the Claude Code CLI inside a hosted sandbox paid by wandit's key, and the Supabase for Platforms pricing. Both need a written answer from the vendor.

---

## 2. Component 1: agent runtime and harness

### 2.1 Choice

- `HarnessAgent` from `@ai-sdk/harness@1.0.100` with `@ai-sdk/harness-claude-code@1.0.104` and `@ai-sdk/sandbox-vercel` (https://registry.npmjs.org/@ai-sdk/harness/latest, https://registry.npmjs.org/@ai-sdk/harness-claude-code/latest; `ai-sdk-harness.md` section 2.2).
- Upgrade `apps/server` and `apps/web` from `ai@^7.0.19` (`apps/server/package.json:45`, `apps/web/package.json:31`) to `ai@7.0.91` or newer. `@ai-sdk/harness` pins `ai@7.0.91` as a hard dependency (`ai-sdk-harness.md` section 1). Two copies of `ai` would break stream typing.
- One harness session per chat. `createSession({ sessionId: chatId })` on the first turn. Persist the opaque `resumeState` from `session.detach()` per chat. Resume with `createSession({ sessionId: chatId, resumeFrom })` (https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent; `ai-sdk-harness.md` sections 2.4 and 2.7).
- Do not resubmit the full transcript. "A harness session owns its native conversation history" (same page). Postgres keeps the display copy in `messages.parts` as today (`packages/db/src/schema/chats.ts:55-89`).
- Model: Sonnet 5 at `effort: medium`. Opus 5 as an explicit "Max" mode with a visible 2.5x multiplier. No Fable 5.1 for end users (3.5x, always-on thinking, 30-day retention). Source: `unit-economics.md` sections 6.3 and 7.4.
- `permissionMode: 'allow-all'` for built-in tools. The sandbox is the blast radius. Approvals on every shell command would make the product unusable for non-technical users (`agent-runtime-patterns.md` section 16.6).
- `toolApproval` only for host tools that spend money or publish. This is the same `approvalMap` mechanism V1 passes at `apps/server/src/modules/ai-chat/agent/chat-agent.ts:476`.
- Credentials: `auth: 'ai-gateway'` with credential forwarding, so the model key never enters the VM (`ai-sdk-harness.md` section 2.9; https://vercel.com/docs/sandbox/concepts/firewall). Phase 2 adds a per-run token through an own proxy (section 11).

### 2.2 What replaces the V1 Brain and Builder

The V1 chat is two `ToolLoopAgent`s and one hand-built handoff (`inspect-ai-pipeline.md` section 0). For V2 projects:

- The Builder (`apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`, 2,440 lines) is replaced by the harness loop. Nothing of it is ported.
- The Brain persona is not a second agent. Its content moves into the sandbox:
  - `CLAUDE.md` in the template repo: interface contract, pinned stack, discussion-first turn policy, language rules (FR/AR/EN), DZD prices, COD lead contract, design-system rules. Use `docs/prompts/lovable.md` as the checklist (`inspect-product-docs-and-references.md` section 8.2).
  - Skills (`skills` option of `HarnessAgent`): the design worlds library, the COD block vocabulary, the ads skills. The worlds are prose "bibles" already (`inspect-ai-pipeline.md` section 3.4).
  - Host tools (`tools` option): `ask_user` (client tool, no `execute`), `get_direction_candidates`, `generate_image` (server-side, R2 key layout), `read_preview_diagnostics`, `take_screenshot`, `ensure_backend`, `publish`, `read_lead_performance`, and the MCP connector tools from `McpChatToolsService.resolveToolsForUser` (`inspect-connectors-media-leads.md` section 7.5).
- V1 projects keep the V1 Brain and Builder untouched. The `projects.engine` column decides which path the chat route takes (section 13).

### 2.3 What stays exactly as it is

- `createUIMessageStream` writer and the custom data parts `data-ai-error`, `data-billing-error`, `data-credits-settled` (`apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:1020`, `:933-983`). The harness stream merges into the same writer with `writer.merge(toUIMessageStream(...))` (https://ai-sdk.dev/docs/ai-sdk-harnesses/ui).
- `useChat` + `DefaultChatTransport` on the web (`apps/web/src/features/workspace/lib/use-ai-chat.ts:166-200`). Phase 1 changes only the URL and the tools map.
- The `ai-errors` module and Sentry capture (`inspect-ai-pipeline.md` section 12). Add `getHarnessErrorMessage` as one more classifier input.
- `ask_user` request tray and MCP approval cards on the web (`inspect-web-builder-ui.md` section 3.7).

### 2.4 Fallback

Claude Agent SDK direct (`@anthropic-ai/claude-agent-sdk@0.3.259`) in wandit-run containers. Same prompts, skills and host tools. It costs an SDK-message-to-UI-part mapper (about the size of Vercel's bridge) and container lifecycle work (`ai-sdk-harness.md` section 5, Option B). Choose it only if the harness proves unstable in Phase 0.

### 2.5 Open items to close in Phase 0

- `VERCEL_OIDC_TOKEN` is listed as required by the Claude Code adapter page (`ai-sdk-harness.md` section 2.9). The sandbox report says access tokens work outside Vercel (`sandboxes.md` section 5.1). The API runs on Railway. UNVERIFIED which token form the adapter accepts off-Vercel. The spike must prove it.
- Whether `harnessMetadata['claude-code']` exposes `total_cost_usd`, `modelUsage`, hooks or `maxBudgetUsd`. UNVERIFIED (`ai-sdk-harness.md` section 6). The metering design does not depend on it (section 10).
- Behaviour of the bridge when the host aborts without `detach()`. UNVERIFIED (`agent-runtime-patterns.md` section 18). Always call `detach()` or `stop()` and set a step cap.
- Legal: the Agent SDK is governed by the Commercial Terms for products sold to end users; the Claude Code CLI clause forbids paying for Claude on end users' behalf; the bridge installs `@anthropic-ai/claude-code@2.1.245` inside the sandbox (https://code.claude.com/docs/en/legal-and-compliance; `ai-sdk-harness.md` section 3.12; `unit-economics.md` section 8.1). UNVERIFIED which clause applies. Get it in writing before any external user.

---

## 3. Component 2: sandbox provider and lifecycle

### 3.1 Choice: Vercel Sandbox

Reasons (all from `sandboxes.md` sections 5.1 and 7):

1. Only first-party harness adapter.
2. Firecracker microVM with a dedicated kernel (https://vercel.com/docs/sandbox/concepts).
3. Persistence by default: stop snapshots the filesystem, any SDK call resumes, `Sandbox.getOrCreate({ name })`, `onResume` hook, `keepLastSnapshots: { count: 1 }` (https://vercel.com/docs/sandbox/concepts/persistent-sandboxes).
4. Firewall with domain allowlists and credential brokering (https://vercel.com/docs/sandbox/concepts/firewall).
5. Up to 15 exposed ports, 64 GB disk, 24 h sessions on Pro, 10,000 concurrent (https://vercel.com/docs/sandbox/pricing).
6. Paris region `cdg1` (https://vercel.com/docs/sandbox/concepts/regions). Regional rates UNVERIFIED.
7. Active-CPU billing fits an idle-heavy builder: about $0.11-0.15 per hour at 2 vCPU / 4 GB and realistic CPU use (`unit-economics.md` section 3).

Known costs of the choice: preview URLs are public (component 7 fixes this), no memory snapshot (dev servers restart on resume), exposed-port traffic at $0.15/GB, and a second cloud next to Cloudflare and Railway.

### 3.2 Image

A custom OCI image on the Vercel Container Registry with: Node 22 (Expo SDK 57 needs 22.13+, https://docs.expo.dev/versions/latest/), pnpm 11.7.0 and a warm pnpm store, git (not confirmed in the managed images, UNVERIFIED, `git-versioning.md` section 4.2), Playwright Chromium (`npx playwright install --with-deps chromium`), Expo CLI, the template repos, and the harness bridge pre-installed so `pnpm install --frozen-lockfile` of the bridge does not run on every create (`ai-sdk-harness.md` section 2.9). Rebuild the image on a schedule.

### 3.3 Lifecycle

| Event | Action | Evidence |
|---|---|---|
| Project created | Nothing. The sandbox is created on the first turn. | cost |
| First turn | `Sandbox.getOrCreate({ name: projectId, ports: [4000, 5173, 8081], timeout: 30 min, keepLastSnapshots: { count: 1 }, onCreate, onResume })`. `onCreate` clones the template, runs `pnpm install`, starts the dev server as a detached command. | `agent-runtime-patterns.md` section 16.3 |
| Turn running | Heartbeat from the open tab extends `last_active_at`; the host calls `sandbox.extendTimeout()`. | https://vercel.com/docs/sandbox/sdk-reference |
| Between turns, user active | `session.detach()`; the sandbox stays warm. | `ai-sdk-harness.md` section 2.7 |
| 20 minutes idle | A Trigger schedule (1 min) calls `session.stop()`; Vercel snapshots the filesystem. | `agent-runtime-patterns.md` section 16.3 step 7 |
| User returns | `getOrCreate` resumes from the snapshot; `onResume` restarts the dev server and Playwright. | https://vercel.com/docs/sandbox/concepts/persistent-sandboxes |
| Snapshot expired (30 days) or sandbox removed (14 idle days) | Rebuild from the git bundles in R2 (section 7). | `git-versioning.md` section 6.4 |
| Project deleted | `destroy()`, delete snapshots, delete R2 prefixes. | security checklist |

Data model: `sandbox_sessions` (provider id, region, image, status, ports, `expiresAt`, `lastActiveAt`) and `builder_sessions` (`harness_resume_state` encrypted, `claude_session_id`, `dev_server_cmd_id`) as proposed in `inspect-data-model.md` section 6.3 and `agent-runtime-patterns.md` section 16.2.

### 3.4 Fallback

E2B (Firecracker, memory-preserving pause, EU cluster on Pro at $150 per month). It needs a custom `HarnessV1SandboxProvider` (`specificationVersion: 'harness-sandbox-v1'`, `createSession`, `resumeSession`, one exposed port plus a WebSocket) against an interface with no public third-party example (`ai-sdk-harness.md` section 2.9; `sandboxes.md` section 7). Budget 2 engineer-weeks if forced. Daytona is third.

---

## 4. Component 3: generated-app stack template for web

### 4.1 Choice

Vite + React + TypeScript + Tailwind + shadcn/ui + React Router in library mode + `@supabase/supabase-js` + `@wandit/leads` SDK.

Reasons (`hosting-publish.md` section 9): output is a directory of static files; server logic lives in Supabase Edge Functions; it matches Lovable's stack (`competitor-architectures.md` section 2.1); the V1 edge Worker serves it after one change; no script size limit, no cold start.

Not chosen for phase 1: Next.js via OpenNext (10 MB compressed Worker cap, most caveats), TanStack Start or React Router framework mode (need Workers for Platforms; phase 2 option for SSR).

### 4.2 Template contents

- `CLAUDE.md` with the product rules (section 2.2).
- `vite.config.ts` with `server.host: true`, `server.allowedHosts: ['.wanditpreview.app', '.vercel.sh']` (never `true`), `server.strictPort: true`, and `server.hmr` set for the proxied `wss` origin (https://vite.dev/config/server-options.html; `agent-runtime-patterns.md` section 12). A wrong value shows a blank iframe with no error.
- i18n scaffold: `fr` and `ar` dictionaries, `dir="rtl"` switch, logical Tailwind utilities, `formatCurrencyDZD` (`docs/localization.md` rules per `inspect-product-docs-and-references.md` section 3.2).
- Design tokens as CSS variables and shadcn variants (semantic tokens only, Lovable rule; `docs/prompts/lovable.md:210-281`).
- A COD lead form component that calls the `@wandit/leads` SDK and dispatches `wandit:lead` for compatibility with the worlds (`inspect-connectors-media-leads.md` section 7.2).
- Public env: `VITE_WANDIT_PUBLIC_FORM_ID`, `VITE_WANDIT_API_ORIGIN`, `VITE_WANDIT_META_PIXEL_ID`, `VITE_WANDIT_TIKTOK_PIXEL_ID`, and after provisioning `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Only publishable values (security section 6.3).
- A tiny error bridge that forwards `window.onerror`, `unhandledrejection` and `console.error` to the parent by `postMessage` for the "Try to fix" flow (`agent-runtime-patterns.md` section 13.1).
- `.gitignore` with `.env*`, `node_modules`, `dist`, media directories.
- `.claude/settings.json` with deny rules for `git push`, `git reset --hard`, `git checkout`, `git switch`, `git rebase`, `git tag` (exact rule syntax to confirm at implementation, `git-versioning.md` section 6.2).

### 4.3 Verification loop in the sandbox

Dev server logs (detached command), a long-lived Playwright service inside the sandbox for screenshots and console errors (V1 already captures `pageerror`, `console`, `requestfailed` at `apps/server/src/modules/ai-chat/agent/site-builder/screenshot.ts:110-122`), `pnpm tsc --noEmit` and `pnpm build` on demand. The harness gets one host tool `read_preview_diagnostics` and a skill that says "after edits, call it once and fix errors". The user gets a "Try to fix" button when diagnostics are non-empty after a turn. Bound automatic fix turns to two per user turn (`agent-runtime-patterns.md` section 13).

---

## 5. Component 4: mobile template and preview path

### 5.1 Choice

- Template: Expo with `expo-router`, `react-native-web`, `@expo/metro-runtime`, pinned to the SDK that the store Expo Go runs. `expo.dev/go` lists SDK 57 today. Whether the App Store binary is SDK 57 is UNVERIFIED (`expo-mobile.md` section 2.2). Check at implementation and re-pin when the store build moves.
- Module allow-list: only modules that work in Expo Go and on web. Native-only components look broken in the web preview.
- UI kit: plain React Native primitives plus `expo-router` first. HeroUI Native + Uniwind is a pinned working set in `apps/native/package.json` and `_heroui-example`, but whether Zack wants it in generated apps is UNVERIFIED (`inspect-product-docs-and-references.md` section 8.5).
- Project type (web or mobile) is chosen at creation. Bolt states "Projects created for web do not easily switch over to mobile" (https://support.bolt.new/integrations/expo).

### 5.2 Preview path (Phase 4a, zero new vendors)

1. The sandbox runs `npx expo start --web --port 8081` (one Metro serves web and native).
2. The iframe shows the web target inside a phone-frame chrome (CSS only, 390x844).
3. `EXPO_PACKAGER_PROXY_URL=https://{token}-8081.wanditpreview.app` so the QR code carries the wandit proxy URL, not the vendor host (https://docs.expo.dev/more/expo-cli/; `sandboxes.md` section 6.4). No ngrok tunnel.
4. The user scans the QR with Expo Go. The proxy passes WebSockets for Fast Refresh.
5. OAuth in Expo Go cannot round-trip (the repo hit this itself: `apps/native/lib/dev-auth-bypass.ts`). The template falls back to email OTP or magic link in Expo Go.

### 5.3 Phase 4b: wandit preview app and Appetize

- Build one `expo-dev-client` app per runtime with EAS (`ios.simulator: true` for Appetize, a device build for TestFlight, an APK for Android). Rebuild only when the native module set changes. The repo already has the EAS pipeline (`apps/native/eas.json`, `.github/workflows/mobile-testflight.yml:59`).
- Upload the simulator `.app` and APK once with `POST https://api.appetize.io/v1/apps`; embed `https://appetize.io/embed/{buildId}` with the Metro URL in `launchUrl` or `params` (https://docs.appetize.io/rest-api/v1/create-new-app.md; https://docs.appetize.io/platform/embedding-apps.md). Expo Snack does exactly this (`expo-mobile.md` section 3.3).
- Price: Starter $59 per month for 500 minutes and 3 concurrent devices, then $0.06 per minute (read through a render proxy, PLAUSIBLE, `expo-mobile.md` section 3.3). Keep it on demand with a 10 to 15 minute session cap.

### 5.4 Deferred: wandit-owned simulator or emulator streaming

Not in any competitor's main preview (`competitor-architectures.md` section 3.3). iOS needs macOS hosts under an Apple SLA that limits virtualization and bans terminal sharing (https://www.apple.com/legal/sla/docs/macOSSequoia.pdf). Android needs KVM, which Firecracker guests do not expose. `serve-sim` proves the browser protocol but is a single-developer tool with no auth (`inspect-native-and-simulator.md` section 4). Revisit after mobile V2 has users.

### 5.5 Publish for mobile

"Install on your phone" first: EAS internal distribution (Android APK link, iOS TestFlight through the user's Apple account). Store submission with `eas build --auto-submit` after a guided account flow. Users need Apple ($99 per year) and Google ($25, plus 12 testers for 14 days on new personal accounts) accounts (`expo-mobile.md` section 2.6). A `mobile_builds` table records builds and install URLs (`inspect-data-model.md` section 6.3).

---

## 6. Component 5: backend-on-behalf and provisioning flow

### 6.1 Choice: Supabase, platform-owned

- One Supabase project per wandit app, in a wandit-owned Pro organization. Users never see Supabase. This is the Lovable Cloud and Bolt Cloud model (https://supabase.com/blog/lovable-cloud-launch; https://supabase.com/blog/bolt-cloud-launch; `backend-on-behalf.md` section 3.3).
- Build the "claim" export path from day one so users can leave (Bolt's model, not Lovable's). The OpenAPI entries `GET /v1/projects/{ref}/claim-token` and `GET /v1/oauth/authorize/project-claim` exist; the guide page returned 404 (UNVERIFIED details, `backend-on-behalf.md` section 3.2).
- Keep a `BackendProvider` interface so a Neon scale-to-zero tier can be added if idle cost stays high after the Supabase deal (`backend-on-behalf.md` section 4.1).

### 6.2 Per-need choices

| Need | Choice | Evidence |
|---|---|---|
| Database | Supabase Postgres in the tenant project. SQL through `POST /v1/projects/{ref}/database/query` (Beta) with a direct-Postgres fallback using the stored `db_pass`. | https://supabase.com/docs/reference/api/v1-run-a-query |
| Auth | Supabase Auth in the tenant project. Configured with `PATCH /v1/projects/{ref}/config/auth` (site URL, redirect allow list, SMTP, providers, CAPTCHA, OTP expiry). No Clerk. | https://supabase.com/docs/reference/api/v1-update-auth-service-config |
| Storage | Supabase Storage. Buckets default to private. Create with the Storage API or SQL. | https://supabase.com/docs/guides/storage/buckets/creating-buckets |
| Secrets | Supabase Edge Function secrets (`POST /v1/projects/{ref}/secrets`, write-only in the UI) for values the app's functions need. Wandit-side `project_secrets` table (encrypted with `APP_SECRETS_ENCRYPTION_KEY`) for values wandit injects. Never in the sandbox `.env`. | https://supabase.com/docs/reference/api/v1-bulk-create-secrets |
| Edge functions | Deployed with `POST /v1/projects/{ref}/functions/deploy` from the sandbox `supabase/functions` directory by a host tool. | https://supabase.com/docs/reference/api/v1-deploy-a-function |
| Jobs | Supabase Cron (`pg_cron`). History from `cron.job_run_details`. | https://supabase.com/docs/guides/cron |
| Email | One wandit Resend account. Default sender on a shared wandit domain. Custom domain per tenant with `POST /domains` and a `sending_access` key scoped by `domain_id`, stored as a tenant secret. Auth SMTP set to Resend. Resend SMTP host and port UNVERIFIED. | https://resend.com/docs/api-reference/api-keys/create-api-key |
| Payments | Phase 1: the user's own Stripe restricted key (`rk_live_`) entered in a form, stored as a secret, checkout in an edge function (Lovable's documented flow). Phase 2: Stripe Connect. Stripe availability in Morocco UNVERIFIED. COD stays leads. | https://docs.lovable.dev/integrations/stripe; https://docs.stripe.com/keys |
| Logs | `GET /v1/projects/{ref}/analytics/endpoints/logs` with ClickHouse SQL in 24-hour windows; 7-day retention on Pro; 30 requests per minute. | https://supabase.com/docs/reference/api/v1-get-project-logs |
| Analytics | Cloudflare Web Analytics beacon injected by the edge Worker for published apps. PostHog project per app later. | https://developers.cloudflare.com/web-analytics/ |

### 6.3 Provisioning flow

Create lazily. The harness calls the host tool `ensure_backend` when the user asks for accounts, saved data, uploads, emails, payments or schedules, or when the code imports `@supabase/supabase-js`. Landing pages and lead forms never provision; they keep the V1 leads path.

Sequence (a Trigger task `provision-backend`, with an `app_backends` attempt row):

1. `POST /v1/projects` with `name = wandit-<projectId>`, `organization_slug`, a generated `db_pass`, `region` from the user's locale (default `eu-west-3` Paris; no Africa or Middle East region exists), `desired_instance_size = micro` (or Nano under a platform deal).
2. Poll `GET /v1/projects/{ref}` every 5 s until `ACTIVE_HEALTHY`; time out at 10 minutes. Creation duration UNVERIFIED.
3. `GET /v1/projects/{ref}/api-keys?reveal=true`; store the publishable key on the row and the secret key in `project_secrets`.
4. `PATCH /v1/projects/{ref}/config/auth` with the preview and published URLs, SMTP, CAPTCHA, OTP expiry, `disable_signup = false`.
5. `POST /v1/projects/{ref}/database/query`: enable `pg_cron`, apply the RLS conventions.
6. `POST /v1/projects/{ref}/secrets`: `RESEND_API_KEY`, `APP_URL`.
7. Write `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` into the sandbox `.env` and into the build env.
8. Mark `ready`. The Cloud tab appears. The chat card shows "Setting up your backend" while it runs (reuse the `useLiveRun` card pattern).

All Management API calls go through one queue with per-project (120 per minute) and per-org buckets and retry on `X-RateLimit-Reset` (https://supabase.com/docs/reference/api/introduction).

### 6.4 Cost control

- Pause after 7 days without traffic and no cron jobs (`POST /v1/projects/{ref}/pause`); restore on demand with a "waking up" state; delete after a grace period after project deletion. Paused projects cost no compute (https://supabase.com/docs/guides/platform/manage-your-usage/compute).
- List price is $0.01344 per hour per Micro, about $9.8 per month. 1,000 always-on projects is about $9.8k per month (`backend-on-behalf.md` section 3.5). Contact Supabase partnerships in Phase 0 for Nano scale-to-zero and project caps (https://supabase.com/solutions/ai-builders).
- Backends are plan entitlements, not credits: Starter 0, Pro 1, Business 3, more as an add-on (`unit-economics.md` section 7.4 rule 8).

### 6.5 Agent access to the backend

The sandbox holds only the publishable key. Schema changes, function deploys, secrets and advisors run through control-plane host tools (`supabase_apply_migration`, `supabase_deploy_function`, `supabase_get_advisors`) that check `projectId` to `ref` ownership. A project-scoped, read-only Supabase MCP config is an option for query help (https://supabase.com/docs/guides/getting-started/mcp). The service-role key never enters the VM (`security.md` section 6).

### 6.6 Cloud tab

Panels in delivery order: Database (tables with `n_live_tup` counts, rows, SQL editor with confirmation on DDL and DELETE), Users, Secrets (write-only), Logs (24-hour pages), Functions, Storage, Jobs. Data comes from a server-side proxy that holds the platform token. Port the hooks of the Supabase Platform Kit rather than the Next.js components; `apps/web` is Vite (https://supabase.com/ui/docs/platform/platform-kit; `backend-on-behalf.md` section 3.7).

---

## 7. Component 6: versioning and git

### 7.1 Choice

Git inside the sandbox is the file source of truth. Postgres holds the version list. R2 holds the durable git data. The sandbox snapshot is only a warm cache. Full design in `git-versioning.md` section 6.

Why not the alternatives: Claude Code checkpoints track only Write/Edit tools and die with the session (https://code.claude.com/docs/en/agent-sdk/file-checkpointing). Per-message sandbox snapshots would cost about $32 per project-month at 2 GB (ESTIMATE). GitHub as the internal store hits a 100,000-repo cap and 500 content-creating requests per hour (https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits). Gitea is a good phase-2 upgrade if collaboration needs it.

### 7.2 Mechanics

- After each assistant turn the server (not the model) runs in the sandbox: `git add -A && git commit --allow-empty -m "<summary>" --trailer "Wandit-Message: <id>"`, `git tag -f msg/<id>`, `git diff --numstat HEAD~1 HEAD`, a capped unified patch, and an incremental bundle `git bundle create b.bundle ^<last> --all` (full bundle every 50 commits), then `git bundle verify`. Upload the three files to presigned R2 PUT URLs under `git/{projectId}/` (`git-versioning.md` section 6.3). Cancel or crash also commits a `wip` so work is not lost (`agent-runtime-patterns.md` section 5.4).
- Tables: `app_commits` (per-project sequence, sha, parent, summary, numstat, patch key, `source` enum `agent|restore|merge|import|manual`), `app_bundles`, `app_branches` with `head_commit_id`. Head updates use the V1 compare-and-swap rule (`apps/server/src/modules/pages/infrastructure/persistence/pages.repository.ts:1007-1068`, `expectedHeadCommitId`, 409 on mismatch).
- Restore is copy-forward: `git read-tree -u --reset <sha> && git commit`, exactly like V1 `restoreVersion` (`apps/server/src/modules/pages/application/services/page-edits.service.ts:188-234`). The UI says "Restore does not change your app's data" (Lovable and Bolt rule).
- Rebuild a lost sandbox: clone the full bundle, fetch the incrementals, `pnpm install`, start the dev server. Seconds for git, tens of seconds for install.
- UI words: Versions, Restore, Compare, Try an idea, Bring into main, Copy project, Export code. `VersionSwitcher` and the historical banner keep their shape (`inspect-web-builder-ui.md` section 4.3).

### 7.3 Later

Branch per chat with `Sandbox.fork` for parallel previews and an agent turn to resolve merge conflicts (Base44 pattern). One-way GitHub export by `git push --all --tags` with a GitHub App user token. Two-way sync last, with a fallback branch on rejected pushes (Lovable rule).

Cost at 10,000 projects: about $15 per month in R2 (`git-versioning.md` section 6.11).

---

## 8. Component 7: preview and preview auth

### 8.1 Problem

Vercel Sandbox exposed ports are public URLs with no token (https://vercel.com/docs/sandbox/sdk-reference). An iframe cannot add headers. A V2 app needs `allow-same-origin` for `localStorage` and same-origin fetch, so the preview must not share a registrable domain with the builder (`security.md` section 9.2). The V1 `srcDoc` path cannot host a dev server (`inspect-web-builder-ui.md` section 12).

### 8.2 Choice

- Buy a dedicated preview domain (the PRD already planned one; purchase status UNVERIFIED, `inspect-publish-serve.md` section 10). Example `wanditpreview.app`. Wildcard DNS. Submit it to the Public Suffix List early; there is no SLA (https://github.com/publicsuffix/list/wiki/Guidelines).
- One small Cloudflare Worker `wandit-preview` on that zone, built from the `apps/edge` skeleton (host parsing, KV read with `cacheTtl`, Sentry wrapper, vitest-pool-workers).
- Hostname token: `{token}-{port}.wanditpreview.app`. The API mints `token` (random 128-bit) when the user opens a project and writes KV `preview:{token}` -> `{ projectId, sandboxHost, ports, expiresAt }`. The Worker reads the pointer, forwards the request to `https://<sandbox>-<port>.vercel.sh` (the value of `sandbox.domain(port)`), and passes WebSocket upgrades through for Vite HMR and Metro. Expiry is hours; revocation is a KV delete. One-level hostnames stay inside Universal SSL (`docs/features/edge-serving.md`, item 5, cited by `hosting-publish.md` section 1).
- Why a hostname token: it works in the iframe, in Expo Go on a phone, and in a new browser tab with no cookie dance. It mirrors the `domain:{host}` KV pointer contract of `apps/edge/src/index.ts:61-70`. It hides the vendor host, so a later sandbox vendor change needs no client change.
- Headers set by the Worker: `Content-Security-Policy: frame-ancestors https://wandit.dev https://*.wandit.dev`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex`.
- Builder iframe: `sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"`, no `allow-top-navigation`, minimal `allow` policy (`security.md` section 9.3). The builder sets `frame-src https://*.wanditpreview.app`.
- Drop `viewport` from the iframe remount key so the desktop/mobile toggle does not reload the app (`inspect-web-builder-ui.md` section 13).
- Loading state: a "starting your preview" route while the sandbox boots, as v0 recommends (https://vercel.com/blog/introducing-the-new-v0-api).
- `postMessage` from the preview to the builder checks `event.origin` against the exact preview origin and validates with Zod, like the V1 bridge (`apps/web/src/features/workspace/lib/preview-editor/use-preview-bridge.ts:45-50`).

Residual risk: the vendor URL itself stays public until a request-transforming firewall rule or app-level check exists. The sandbox id is random. Add a check in the dev-server template for a `X-Wandit-Preview` header that only the Worker sets (defense in depth) in Phase 2.

### 8.3 Mobile stream

Phase 4b embeds the Appetize iframe. No wandit-owned streaming.

### 8.4 The V1 inline editor

`packages/preview-editor` works only on server-stamped single-file HTML. Treat it as V1-only. Click-to-target for V2 comes later as a runtime overlay with a Vite plugin that maps DOM nodes to source locations (`inspect-web-builder-ui.md` section 12 item 1). Phase 1 ships "select an element and describe" through screenshots and the diagnostics tool instead.

---

## 9. Component 8: publish, hosting and custom domains

### 9.1 Choice

Keep the whole V1 edge stack and extend it. Cloudflare charges zero egress and static requests are free or $0.30 per million; Vercel or Netlify would cost 20 to 60 times more at 10 TB per month (`hosting-publish.md` section 11).

### 9.2 Storage and pointer contract

Two research files disagree. `hosting-publish.md` section 10.1 puts `deploymentId` in the KV pointer with content-addressed blobs. `inspect-publish-serve.md` section 12.3 keeps KV version-free and adds an R2 flip object. Decision: the R2 flip object.

- Layout: `published/{projectId}/d/{deploymentId}/{path}` (immutable per deployment) and `published/{projectId}/d/{deploymentId}/manifest.json` (`{ files: { "/assets/x.js": { contentType, size, hash } }, spaFallback: "/index.html" }`).
- Flip: `published/{projectId}/current.json` -> `{ deploymentId }`. One strongly consistent write, exactly like `current.html` today (`apps/server/src/modules/sites/application/services/sites.service.ts:346-351`).
- KV pointer stays `domain:{host} -> { projectId, status? }`. The custom-domain pipeline writes pointers without deploy knowledge (`apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts:49-66`), and KV is eventually consistent. A version in KV would need `refreshProjectDomains` on every publish for every domain.
- Content-addressed dedupe (`apps/blobs/{sha256}`) is a later optimization.

### 9.3 Worker change (`apps/edge/src/index.ts`)

Today the Worker ignores the path, reads `published/{projectId}/current.html` and hard-codes `text/html` (`apps/edge/src/index.ts:184`, `:200-207`). New branch after the pointer lookup:

1. Read `current.json` (cache by project for 60 s). If absent, fall back to the V1 `current.html` path. V1 sites keep working with no republish.
2. Read the manifest (immutable, cache long).
3. Match the path. If missing and the request accepts HTML or has no extension, serve `/index.html` with 200 (SPA fallback). Otherwise 404 `no-store`.
4. Stream the object with `Content-Type` from the manifest, `Range` support, `Cache-Control: public, max-age=31536000, immutable` for hashed `assets/*`, `max-age=60` with ETag for `index.html`.
5. Keep `caches.default` (host-keyed). Never the host-blind `ctx.cache` (`apps/edge/src/index.ts:157-164`).
6. Add baseline security headers (`nosniff`, `Referrer-Policy`, `Permissions-Policy` off for camera, microphone, geolocation).
7. Add CI for `wrangler deploy` and a vitest matrix for path routing, SPA fallback, content types, ranges and cache headers. Today the edge deploys by hand (`inspect-infra-ops.md` section 2.4).

### 9.4 Publish task

A Trigger task `publish-app` (pattern: `apps/server/src/trigger/generate-page.task.ts` and `page-build-handoff.ts:37-86`):

1. Insert a `pending` `deployments` row with `kind = web_app` under `SELECT ... FOR UPDATE` (reuse `DeploymentsRepository`). Add columns `kind`, `commitId`, `buildPrefix`, `fileCount`, `bytes`, `buildLogKey`; make `versionId` nullable for the new kind (`inspect-data-model.md` section 6.2).
2. Ensure the sandbox, check out the commit, write the production `.env` (public values only), run `vite build`.
3. Run the security gate (section 12.5). Block on a critical finding.
4. Run `injectPixels` and `injectWanditBadge` on `dist/index.html` only. Skip `inlineKnownCdnScripts`, `optimizeFontLoading`, `optimizeImageMarkup`, `emitResponsiveImages` and the relative-URL rejection for `kind = web_app` (`inspect-publish-serve.md` section 12.2).
5. Upload `dist/` in parallel to the immutable prefix with per-object content types (extend the map at `apps/server/src/infrastructure/storage/r2.ts:364-380` with `.map`, `.wasm`, `.woff`, `.ttf`, `.webmanifest`, `.mjs`, `.avif`). Verify the manifest instead of probing URLs.
6. Write `current.json`, write the slug KV pointer, promote the row (demote-then-promote, compensation on failure), register the slug URL and each active custom domain in the tenant Supabase auth allow list.
7. Rollback = write `current.json` for an older deployment. Unpublish = delete `current.json` and the slug key.

Publish stays a durable-row job followed by `useLiveRun` and the existing `deployment.uiState` machine with two new states, `building` and `deploying` (`inspect-web-builder-ui.md` section 12 item 8).

### 9.5 Custom domains

No change. Cloudflare for SaaS custom hostnames, the customer-zone apex workaround, Name.com purchase, Trigger verification tasks (`inspect-publish-serve.md` section 6). Budget $0.10 per hostname per month after 100 (https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/).

### 9.6 Later

Workers for Platforms with one user Worker per deployment for SSR apps ($25 per month, 1,000 scripts then $0.02 per script; https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/). "Deploy to your own Vercel" as an export through Claim Deployments. Submit `wandit.app` to the Public Suffix List before apps set cookies on `{slug}.wandit.app`.

---

## 10. Component 9: streaming, events, background jobs and reconnect

### 10.1 Phase 1 (staging): turn inside the API request

Reuse the V1 pattern verbatim: `POST /api/v2/chats/:chatId/stream`, `@SkipResponseEnvelope()`, `reply.hijack()`, `pipeUIMessageStreamToResponse` with manual CORS headers, abort on request `close` (`apps/server/src/modules/ai-chat/presentation/http/controllers/ai-chat.controller.ts:89-168`; `ai-chat.service.ts:1447-1463`). Inside the stream: admission and credit hold, `createSession` or resume, `agent.stream`, `writer.merge(toUIMessageStream(...))`, the git commit at `onEnd`, `session.detach()`, persist `resumeState`.

Accepted gaps in staging: a browser disconnect or a Railway deploy aborts the turn (single replica, `inspect-infra-ops.md` section 11.1 item 6); no resume after reload; the 35-minute stream cap (`ai-chat.service.ts:182`). These are acceptable for internal testing and are closed in Phase 2.

Progress and logs travel as custom data parts on the same stream: `data-phase`, `data-files` (reconciled by id), `data-preview` (URL and ready flag), `data-screenshot`, `data-logs` (transient) (`agent-runtime-patterns.md` section 8). One transport, one hook, no new channel.

### 10.2 Phase 2 (before production): Trigger task host plus Redis relay

- Task `builder-turn` on a queue with `concurrencyKey: projectId`, `concurrencyLimit: 1`, `idempotencyKey: turnId`, machine `small-2x` (the heavy work runs in the sandbox). `run()` gets `signal`; `onCancel` has 30 s to commit `wip`, detach and write a terminal chunk (https://trigger.dev/docs/tasks/overview; https://trigger.dev/docs/queue-concurrency).
- Sinks: `XADD turn:{turnId}` per UI chunk (batched 50 ms) plus a Trigger.dev v2 stream as the durable copy (https://trigger.dev/docs/tasks/streams).
- API: `POST /api/v2/projects/:id/turns` (202 with `turnId`), `GET .../turns/:turnId/stream` (SSE with `Last-Event-ID` replay from Redis, reusing `apps/server/src/modules/generation/application/services/chat-stream-relay.service.ts:26-127`), `POST .../cancel` (`runs.cancel`).
- Web: a `BuilderTransport` that implements `sendMessages` (POST then GET stream) and `reconnectToStream` (GET with `Last-Event-ID`). `useChat({ resume: true })` then works with no React changes (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams; `agent-runtime-patterns.md` section 4).
- Lock: Redis `SET builder:lock:{projectId} {turnId} NX PX` with heartbeat and compare-and-delete (V1 has the same lease at `ai-chat.service.ts:455-483`), a partial unique index on active turns, and a fencing `turnId` in every write. A second message while a turn runs is queued and auto-submitted at the end (409 plus a queued-message row).
- Rule: never call `wait.*` inside the turn task while the bridge socket is open; Trigger checkpoints kill it (https://trigger.dev/docs/wait).
- Move Redis from `sfo` to a Europe region before Phase 2 adds relay traffic. Today the API runs in `europe-west4` and Redis in `sfo` (`inspect-infra-ops.md` section 2.2).

### 10.3 Long jobs

Build, publish, provision and mobile builds are Trigger tasks with attempt rows, `runs.cancel`, the `page_generation_attempts` lifecycle shape (claim CAS, stop, retry, dead-run settle) and a read-scoped Realtime token for the chat card (`apps/server/src/modules/pages/application/page-build-handoff.ts:37-86`). The web already follows such runs with `useLiveRun` plus polling (`apps/web/src/features/workspace/lib/use-live-run.ts:1-148`). Native does the same with an Electric shape stream (`apps/native/features/workspace/lib/use-live-run.ts`).

### 10.4 Not used

BullMQ: no Railway worker service exists (`inspect-infra-ops.md` section 6). Inngest: cannot interrupt a running step. Durable Objects: a third runtime for the chat protocol; keep for later multi-user presence.

---

## 11. Component 10: metering and credits

### 11.1 Keep

The anchor 1 credit = $0.04 of provider cost (`packages/env/src/server.ts:118`), `usdMicrosToCentiCredits`, the ledger, plan holds, settled balance, reserve, settle, reconcile, refund, execution leases, the Trigger sweeps, Stripe billing, product settings, gateway attribution tags, `data-billing-error` and `data-credits-settled` parts, per-message usage metadata (`inspect-auth-billing-credits.md` section 11).

### 11.2 Add

1. Operation `agent_session` in `ai_usage_operation` (`packages/db/src/schema/credits.ts:34-44`) and in `OPERATION_REGISTRY`. Reserve floor 500 to 1,000 cc (5 to 10 credits), tuned in staging. Children: `image`, `video`, `sandbox`, `backend_provision`.
2. Checkpoint debits: `MeteringService.checkpoint(eventId, { usageDelta, modelId })` with key `checkpoint:<eventId>:<n>`, `allowOverdraft: true`, lease renewal, balance and cap re-check. Call it on every harness `step-finish` part. Stop the turn (abort the stream) when the check fails (`inspect-auth-billing-credits.md` section 10.1).
3. Pricing source: token counts from the harness `finish.totalUsage` and `step-finish` parts, priced with the server `model_prices` table (the gateway catalog lists `anthropic/*` ids). Never bill from `total_cost_usd`; Anthropic says it is a client-side estimate (https://code.claude.com/docs/en/agent-sdk/cost-tracking). Store per-model usage in `rawUsage`.
4. Reconciliation: if the harness calls go through the Vercel AI Gateway with attribution tags, capture generation ids like `generate-page.task.ts:246-252` and let the existing sweep reprice. Whether gateway generation ids surface per Claude Code call is UNVERIFIED. Fallback: one `ai_provider_call_evidence` row per turn with a new transport `anthropic` and `costStatus: "measured"`. Daily reconciliation with the Anthropic Usage and Cost API (https://platform.claude.com/docs/en/manage-claude/usage-cost-api).
5. Budget per turn: `maxBudgetUsd` if the adapter exposes it (UNVERIFIED), else a step cap (`stopWhen: isStepCount(n)`) plus the checkpoint kill. Plan ceiling about $2 on Pro per turn (`unit-economics.md` section 7.4 rule 2). Cap subagents: depth 1, concurrency 3.
6. Cache: `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` for the main conversation so pauses under one hour do not rewrite the context (`unit-economics.md` section 6.2).
7. Operation `sandbox` (measured, `unit: "minute"`), rate from the vendor, evidence rows with `customerBillable: false` while minutes are included in the plan. This keeps margins visible.
8. `projectId` on `ai_usage_events` with a partial index, a `project_cost_caps` table, enforcement at reserve and at each checkpoint (hard) and at settle (soft), error `PROJECT_CREDIT_CAP_REACHED` (403) and a `data-billing-error` variant (`inspect-auth-billing-credits.md` section 10.4).
9. Backends and mobile preview minutes are entitlements per plan, not credits. A Supabase Micro is 250 credits per month of cost at the anchor, more than the Pro base tier (`unit-economics.md` section 4.1).
10. Show an estimate before the turn ("about 10 credits") and a receipt after ("used 8.4 credits"). This is the complaint every credit-based competitor gets (`unit-economics.md` section 5.1).

### 11.3 The founder decision

At the anchor a typical Sonnet 5 message costs about $0.44 all-in, about 10 credits. Pro at $25 (175 credits) buys about 17 typical messages at a 72 percent AI margin. Lovable sells about 100 messages for $25 at a reported 35 percent margin (secondary source, UNVERIFIED). Either a cheaper loop (Haiku or Sonnet at low effort, shorter contexts) or a lower margin per tier is needed. Measure real step counts in staging for two weeks before pricing (`unit-economics.md` section 7.3).

---

## 12. Component 11: security controls

All items are "must have before any external user" unless marked later. Full checklist in `security.md` section 16.

### 12.1 Sandbox

- Firecracker VM per project (Vercel). No plain containers on shared hosts (runc CVE-2024-21626, https://cveawg.mitre.org/api/cve/CVE-2024-21626).
- Claude Code as a non-root user; `bypassPermissions` refuses root (https://code.claude.com/docs/en/sandbox-environments).
- Egress: user-defined policy, deny by default. Allow only the AI gateway or proxy host, `registry.npmjs.org`, the project's `<ref>.supabase.co`, `api.stripe.com` when connected, and `api.anthropic.com` only if the WebFetch preflight stays. Deny `169.254.0.0/16`, RFC1918, `100.64.0.0/10`, loopback. No `subnets.allow` ranges (DNS exfiltration). Two-phase policy: wide for install, narrow before running app code (https://vercel.com/docs/sandbox/concepts/firewall; `security.md` section 7).
- No platform secret in the VM. The gateway key is brokered by a firewall `transform` rule. Supabase secret keys, Stripe keys and the Supabase PAT live only in the control plane. The workspace `.env` holds publishable values only.
- Hard session timeout, idle stop, CPU and memory caps. A sustained 100 percent CPU run with no file writes ends the run and flags the account (mining signal).

### 12.2 Agent

- `disallowedTools` for `WebFetch` and `WebSearch` when not needed, `Bash(curl *)`, `Bash(wget *)`, `Bash(sudo *)`, `Bash(nc *)`, `Bash(ssh *)`, `Bash(docker *)`, and the git rules from section 7.2. Deny rules apply even in `bypassPermissions` (https://code.claude.com/docs/en/agent-sdk/permissions).
- A `PreToolUse` hook that denies writes to `.claude/`, `.mcp.json`, `.git/hooks`, `.git/config`, shell rc files and any path outside the workspace. Whether the harness adapter forwards `hooks` is UNVERIFIED; the fallback is the same deny list as `disallowedTools` patterns plus a read-only bind of those paths in the image.
- `settingSources: []` so an imported repo cannot load settings. Strip `.claude/`, `.mcp.json`, `.git/hooks` on import.
- Untrusted content (fetched pages, uploads, DB rows) is wrapped as data. Keep the V1 attachment marker pattern (`apps/server/src/modules/ai-chat/agent/attachment-text.ts`).
- Secret-shape scanner (gitleaks rules) on every file write and chat message; redact before logging.
- A separate Anthropic workspace for V2 with its own spend cap, so a V2 bug cannot stop V1 (https://platform.claude.com/docs/en/api/rate-limits).

### 12.3 Backend

- Every migration enables RLS and adds policies in the same migration; a host-tool check rejects `create table` in an exposed schema without RLS.
- Disable legacy JWT keys on new projects once the client uses `sb_publishable_` keys (https://supabase.com/docs/guides/api/api-keys).
- Stripe: accept restricted keys only; refuse `sk_live_` by prefix.

### 12.4 Preview

Separate registrable domain, hostname token, `frame-ancestors`, no `allow-top-navigation`, Public Suffix List request (section 8).

### 12.5 Publish gate

Run before the pointer flips (10 to 15 seconds like Lovable; https://docs.lovable.dev/features/security):

1. `GET /v1/projects/{ref}/advisors/security`; block on any ERROR lint (`0013_rls_disabled_in_public`, `0024_permissive_rls_policy`, `0025_public_bucket_allows_listing`, and so on; https://supabase.com/docs/guides/database/database-advisors).
2. Anonymous RLS probe: `select` each public table with the publishable key and expect zero rows unless the table is marked public. This catches the CVE-2025-48757 class (https://cveawg.mitre.org/api/cve/CVE-2025-48757).
3. Secret-shape scan of `dist/`.
4. Phishing rules: login forms that post to a domain other than the project's Supabase or a known provider, bank and Microsoft and Google brand names next to a password field, hidden iframes, obfuscated JS; a cheap-model classifier on the transcript and routes; hold for review on hit.
5. Slug rules: reject brand look-alikes (`login-microsft`, `paypa1`).
6. Per-account publish rate limit in Redis. Verified email before the first publish; a payment method before a custom domain.

Takedown: keep the `suspended` pointer (`apps/edge/src/index.ts:180-182`), add `suspended_reason`, an audit row and a user notice, plus an `abuse@wandit.app` inbox and a public form. Cloudflare disables hosted content on valid notices (https://www.cloudflare.com/trust-hub/reporting-abuse/), so wandit must catch abuse first.

### 12.6 Control plane

- `audit_events` table (actor, action, target, ip, before and after JSON) for project create, publish, unpublish, suspend, secret set, backend create, pause, delete, domain attach, key rotation, plan change. V1 has none (`security.md` section 13).
- Move the in-memory rate limiters to Redis (`apps/server/src/modules/domains/presentation/http/guards/rate-limit.guard.ts:30`; `leads-capture-throttle.ts:6-7`).
- Data: Anthropic retains inputs 30 days by default and offers only `global` and `us` residency; Supabase offers six EU regions; publish a subprocessor list and update the privacy policy before external users (`security.md` section 14).

---

## 13. Component 12: how V2 lives in the monorepo and the rollout

### 13.1 Server

- `packages/env/src/server.ts`: `V2_BUILDER_ENABLED` (same transform as `QUEUE_ENABLED` at `server.ts:227`). New optional-at-boot groups: `VERCEL_SANDBOX_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` (or the OIDC form, UNVERIFIED), `SANDBOX_IMAGE`, `SANDBOX_REGION`, `SUPABASE_ACCESS_TOKEN` + `SUPABASE_ORG_SLUG`, `APP_SECRETS_ENCRYPTION_KEY`, `PREVIEW_DOMAIN`, `CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID`, `EXPO_TOKEN`, `APPETIZE_API_TOKEN`, `RESEND_TENANT_DOMAIN` (`inspect-infra-ops.md` section 11.4).
- `apps/server/src/modules/app-builder/` in the light-DDD layout. Import it in `apps/server/src/app.module.ts` after `WorkspacesModule` (`app.module.ts:64-67`) as `...(env.V2_BUILDER_ENABLED ? [AppBuilderModule] : [])`. Global guards (`CrossSiteWriteGuard`, `AuthGuard`, `WorkspaceContextGuard`) then apply unchanged.
- Controllers use `@Controller("v2/...")` so routes land under `/api/v2/*`.
- Sub-services: `BuilderSessionService` (admission, harness session, resume state), `SandboxService` (provider interface with a Vercel implementation), `AppVersionsService` (git, commits, restore), `PreviewService` (tokens, KV), `AppPublishService` (build task handoff, manifest, flip), `BackendProvisioningService` (Supabase queue), `AppSecretsService`, `V2MeteringService` (agent_session, checkpoints, caps).
- Trigger tasks in `apps/server/src/trigger/`: `builder-turn` (Phase 2), `publish-app`, `provision-backend`, `mobile-build`, `sandbox-idle-sweep`, `backend-pause-sweep`. Same Trigger project, new queues. The unreferenced `wandit-v2-experiment` project is not needed (`inspect-infra-ops.md` section 11.1 item 6).
- A `CLAUDE.md` and skills directory for the sandbox live in `apps/server/src/modules/app-builder/prompts/` and the template repos in `packages/app-templates/{web,expo}`.

### 13.2 Contracts and database

- `packages/contracts/src/v2/*.ts`: builder chat (data parts, harness tool map), turns, versions, preview, publish, backend, secrets, mobile builds. Same Zod idiom and route constants as v1 (`packages/contracts/README.md` per `inspect-web-builder-ui.md` section 6).
- Schema (all additive with defaults, `inspect-data-model.md` section 6): `projects.engine` (`v1_page` | `v2_app`, default `v1_page`), `projects.platform` (`web` | `mobile`), `projects.currentCommitId`; `chats.title`, `chats.scope`; `messages.turnId`; `deployments.kind`, `commitId`, `buildPrefix`, `fileCount`, `bytes`, `buildLogKey`, nullable `versionId`; new tables `builder_sessions`, `builder_turns`, `sandbox_sessions`, `app_commits`, `app_bundles`, `app_branches`, `app_backends`, `project_secrets`, `app_builds`, `mobile_builds`, `preview_tokens` (or KV only), `project_cost_caps`, `audit_events`; enum additions `ai_usage_operation` (`agent_session`, `sandbox`, `backend_provision`, `backend_hosting`), `ai_cost_transport` (`anthropic`, `vercel_sandbox`, `supabase`, `appetize`); `product_settings.v2BuilderEnabled`.
- Do not touch `artifacts`, `versions`, `page_generation_attempts`. A `v2_app` project never inserts an `artifacts` row, so the one-landing-page partial unique index is never hit.
- Migrations ship through the Railway pre-deploy `pnpm db:migrate` step, staging first (`inspect-infra-ops.md` section 3.6).

### 13.3 Web

- Keep `/p/$projectId` and `WorkspacePage`. The route reads `project.engine` and mounts either the V1 workspace body or a new `AppWorkspace` body that reuses the shell, the resizable split, the header, the tabs bar, the `PromptBox`, the `MessageParts` registry, the `ask_user` tray and the publish popover (`inspect-web-builder-ui.md` section 11).
- New feature folder `apps/web/src/features/app-builder/` with: harness tool cards (grouped like `PageEditActivityCard`), a files-changed receipt, a URL preview frame with loading and error overlays, a "Try to fix" button, a Versions list with Restore and Compare (unified diff viewer; add Shiki or CodeMirror), a Cloud tab shell, a Mobile tab (phone frame plus QR plus "Open on iPhone in the browser").
- Gate in `beforeLoad` with `usePublicSettingsQuery()` and the PostHog flag; hide the "New app" entry point on the dashboard when off (`inspect-infra-ops.md` section 11.2).
- Composer modes `app` and `mobile` in `composerModes` and `PromptBox` (2,722 lines; edit, not config).
- Message history: paginate `GET /chats/:id/messages` for V2 chats; harness transcripts grow fast (`inspect-web-builder-ui.md` section 13).

### 13.4 Native

V2 web-only at first. `apps/native` keeps V1. The native chat hook already speaks the AI SDK stream, so a later V2 mobile client changes the URL and adds a URL-based WebView (`inspect-native-and-simulator.md` section 5.4). Delete `lib/dev-auth-bypass.ts` before any V2 native release.

### 13.5 Rollout

1. `feat/v2-builder` PRs into `dev`. Vercel preview builds the web; the module is not mounted anywhere.
2. Fix staging same-site first: attach `staging.wandit.dev` and set `CORS_ORIGIN` (`docs/deployments/web-environments.md:20-28` per `inspect-infra-ops.md` section 3.3). Without it feature previews cannot log in against the staging API.
3. Set `V2_BUILDER_ENABLED=true` and the V2 secrets on Railway `staging` and Trigger `staging`. Deploy the preview Worker to the preview zone. Deploy the edge Worker change (it is backward compatible).
4. PR `dev` to `staging`. Internal users test at `staging.wandit.dev`.
5. PR `staging` to `main` with `V2_BUILDER_ENABLED=false` in production. Code ships, nothing mounts.
6. Flip the env switch in production, keep `product_settings.v2BuilderEnabled` off, enable the PostHog flag per user, then per cohort.
7. Add a CI job for `check-types` and `vitest` before step 4. Today no automated test runs (`inspect-infra-ops.md` section 2.6).

---

## 14. Component 13: migration of V1 projects and the leads feature

### 14.1 Projects

- No forced migration. `projects.engine` defaults to `v1_page`. V1 users see no change.
- "Upgrade to app" (one-way, user-initiated): read the latest `versions.r2Key` HTML, create a V2 project (or flip `engine` on the same row so domains, leads and media stay attached), scaffold the web template, place the page as the home route (static HTML inside a React shell or a converted component; the harness does the conversion as its first turn), commit as `source: import`, and keep the V1 `versions` rows for history. The custom domains and the slug stay valid because publishing writes the same `deployments` rows and the same KV pointer.
- The V1 inline editor and the 15 cheerio op kinds remain V1-only (`inspect-ai-pipeline.md` section 14).

### 14.2 Leads

- Keep `POST /api/public/leads/{publicFormId}` unchanged. It is already cross-origin (`origin: "*"`, `credentials: false`), keyed by an unguessable uuid (`packages/db/src/schema/projects.ts:43`), and drives push, Sheets, exports and the ads brain (`inspect-connectors-media-leads.md` section 7.1).
- Replace the publish-time `</body>` injection with the `@wandit/leads` SDK in the template (or a helper file the harness writes; a monorepo package is one source of truth). The SDK posts `leadCaptureBodySchema` JSON, retries on 429 and 5xx with `Retry-After`, sends `_hp` when a hidden field exists, adds web attribution, fires `fbq` and `ttq` after a 2xx, and emits `wandit:lead:result` (`inspect-connectors-media-leads.md` section 7.2). Currency comes from config; V1 hard-codes DZD.
- Pixels come from public env values so `getAdsTrackingFacts` keeps reading the same project columns.
- `deploymentId` stays optional in the SDK payload. V2 publishes write `deployments` rows, so the composite FK `leads_project_deployment_fk` holds; a missing id falls back to the active deployment (`leads-capture.service.ts:88-103`).
- COD orders remain leads rows. App-native databases hold the app's own business data; the SDK dual-writes when both exist.
- Reading or writing leads from inside a generated app needs a new project-scoped token type. Keep it out of V2.0.
- Move the capture throttle to Redis before more than one API instance runs.

### 14.3 Media and connectors

- `generate_image` becomes a server-side host tool that reuses `image-generator.ts`, `optimizeImage`, `storeImageVariants` and the R2 key layout, and returns a public URL with width and height (`inspect-connectors-media-leads.md` section 7.4). Add an `apps/{projectId}/assets/` prefix to `r2.ts` and to `ProjectAssetsService`.
- MCP connectors (Meta, TikTok, Higgsfield) attach to the V2 chat as host tools through `McpChatToolsService` unchanged.

---

## 15. Component 14: phased delivery plan

Each phase is a shippable slice. Effort is in engineer-weeks (ew), ESTIMATE, for engineers who know this repo. Calendar weeks assume two engineers in parallel where the work splits.

### Phase 0: spikes and vendor answers (1.5 ew, week 1)

Deliverable: a go or no-go on the harness path with evidence.

1. Upgrade `ai` to 7.0.91 in server and web; run the V1 test suites. (0.3 ew)
2. From a Railway-like Node process: create a Vercel Sandbox with a custom image, run `HarnessAgent` with the Claude Code adapter, stream one turn into `createUIMessageStream`, detach, resume. Prove the token form off-Vercel. Measure boot and resume times. (0.5 ew)
3. Expose a second port with a Vite dev server and load it in an iframe through a throwaway Worker. Confirm HMR over WebSocket. (0.3 ew)
4. Read the bridge source to confirm what reaches the host: usage per step, hooks, `maxBudgetUsd`, `total_cost_usd`. (0.2 ew)
5. Send the Supabase partnerships form. Ask Anthropic sales the legal question in writing. Buy the preview domain and create the zone. Request the Vercel Sandbox Pro quota. (0.2 ew)

### Phase 1: chat plus live preview in staging (5 ew, weeks 2 to 5)

Deliverable: an internal user creates a web app project, chats, sees the app in the preview, restores a version, in `staging`.

1. Module skeleton, env, contracts, schema (`projects.engine`, `builder_sessions`, `app_commits`, `app_bundles`, `sandbox_sessions`). (0.8 ew)
2. `BuilderSessionService` with the API-hosted stream (section 10.1), admission and credit hold as `agent_session` with token pricing at settle (no checkpoints yet). (1.0 ew)
3. Sandbox image and `SandboxService` (create, resume, idle sweep, dev server as detached command, heartbeat). (0.7 ew)
4. Web template repo with `CLAUDE.md`, skills from the worlds library, `ask_user` and `generate_image` host tools. (0.7 ew)
5. Preview Worker and hostname tokens; iframe frame with loading state. (0.6 ew)
6. Git commit per turn, bundles to R2, Versions list, Restore, adjacent diff. (0.6 ew)
7. Web: engine switch on `/p/$projectId`, harness tool cards, files-changed receipt, Versions UI, composer mode `app`. (0.6 ew)

### Phase 2: publish, durability and money safety (4 ew, weeks 6 to 9)

Deliverable: a V2 web app publishes to `{slug}.wandit.app` and custom domains; turns survive reloads and deploys; spend is capped. "Lovable without Cloud", ready for a first external cohort.

1. Edge Worker multi-file serving, `current.json`, manifest, SPA fallback, content types, headers, CI and tests. (0.8 ew)
2. `publish-app` task, `deployments.kind`, build in the sandbox, injectors on `dist/index.html`, rollback and unpublish, publish UI states. (0.8 ew)
3. `builder-turn` Trigger task, Redis relay, `BuilderTransport` with resume, lock, cancel, queued messages, Redis region move. (1.0 ew)
4. Checkpoint debits, `projectId` on usage events, project caps, estimate and receipt copy, Anthropic workspace split. (0.6 ew)
5. Security baseline: egress policy, deny rules and hook, secret scanner, `audit_events`, Redis rate limits, publish gate items 3 to 6, `suspended` reason. (0.5 ew)
6. Leads SDK and template form; pixels from env. (0.3 ew)

### Phase 3: Cloud (5 ew, weeks 10 to 14)

Deliverable: apps with auth, database, storage, functions, secrets, jobs, email and Stripe checkout. Lovable Cloud parity for web.

1. `BackendProvisioningService`, `provision-backend` task, `app_backends`, `project_secrets`, Management API queue, pause and restore sweeps. (1.2 ew)
2. Host tools: `ensure_backend`, `supabase_apply_migration`, `supabase_deploy_function`, `supabase_set_secret`, `supabase_get_advisors`; RLS-required check. (0.8 ew)
3. Cloud tab: Database, Users, Secrets, Logs, Functions, Storage, Jobs. (1.5 ew)
4. Email (Resend tenant domain flow), Stripe restricted key connector, publish gate items 1 and 2 (advisors and RLS probe), auth allow-list registration at publish and domain activation. (0.9 ew)
5. Plan entitlements for backends in the catalog and the checkout guard. (0.3 ew)
6. Optional in this phase: click-to-target overlay for React (0.8 ew) if users ask for it.

### Phase 4a: mobile V2, zero-vendor preview (4 ew, weeks 15 to 18)

Deliverable: an Expo app project with a web preview in the iframe and a QR code for Expo Go; "install on your phone" through EAS.

1. Expo template pinned to the store Expo Go SDK, module allow-list, `CLAUDE.md` mobile rules. (0.8 ew)
2. Metro in the sandbox, `EXPO_PACKAGER_PROXY_URL`, proxy WebSocket checks, phone-frame preview, QR panel. (0.8 ew)
3. Project type at creation, composer mode `mobile`, Mobile tab. (0.6 ew)
4. `mobile_builds` table, `mobile-build` task with EAS internal distribution and TestFlight through the user's account, guided store-account flow. (1.2 ew)
5. Metering for EAS builds as evidence rows. (0.2 ew)
6. Supabase in Expo apps (supabase-js on React Native, UNVERIFIED details). (0.4 ew)

### Phase 4b: device look in the browser (3 ew)

1. wandit dev-client runtime, EAS simulator and APK builds, Appetize upload and embed with the Metro URL, session caps, preview-minute entitlements. (2.0 ew)
2. TestFlight and Play internal testing distribution of the preview app. (1.0 ew)

### Later (not scheduled)

Branch per chat and merge, GitHub export and sync, Workers for Platforms for SSR, DB backups per version, drafts for teams, wandit-owned simulator or emulator streaming, native V2 client, Neon lite tier.

### Totals

- Web to Lovable parity (Phases 0 to 3): about 15.5 ew, about 14 calendar weeks with two engineers.
- Plus mobile (4a and 4b): about 22.5 ew, about 20 calendar weeks.
- First internal preview in staging: end of week 5.

---

## 16. Component 15: cost per active project per month

Assumptions (ESTIMATE): Sonnet 5 at medium effort with 1-hour caching, sandbox 2 vCPU / 4 GB on Vercel at realistic CPU use, one full-time active project = 20 sandbox-hours and 60 messages per month, a light project = 5 hours and 10 messages. Prices from `unit-economics.md` sections 1, 3, 4 and 6, `sandboxes.md` section 6.5, `git-versioning.md` section 6.11, `hosting-publish.md` section 11.

| Line | Light project (10 messages) | Active project (60 messages) | Source |
|---|---|---|---|
| Harness tokens (about $0.44 per typical message all-in) | $4.40 | $26.40 | `unit-economics.md` 6.5 |
| Sandbox compute (about $0.13 per hour) | $0.65 | $2.60 | `sandboxes.md` 6.5 |
| Sandbox snapshot storage (3 GB at $0.08 per GB-month) | $0.24 | $0.24 | https://vercel.com/docs/sandbox/pricing |
| Sandbox egress and exposed-port traffic (about 0.5 to 2 GB at $0.15 per GB) | $0.08 | $0.30 | same |
| Git data in R2 | $0.002 | $0.002 | `git-versioning.md` 6.11 |
| Hosting (Worker requests, R2 reads; egress free) | about $0.01 | about $0.05 | `hosting-publish.md` 11 |
| Custom hostname (after the first 100) | $0.10 | $0.10 | Cloudflare for SaaS plans |
| Supabase backend, list price, when live and not paused | $9.81 | $9.81 | `backend-on-behalf.md` 3.5 |
| Supabase backend, paused | $0 | $0 | same |
| Resend email (shared domain, within plan) | about $0 | about $0.20 | `backend-on-behalf.md` 6.1 |
| Mobile preview minutes (Appetize, 30 minutes) | $0 | $1.80 | `expo-mobile.md` 3.3 |
| **Total, web app without backend** | **about $5.50** | **about $30** | |
| **Total, web app with a live backend** | **about $15.30** | **about $40** | |
| **Total, mobile app with backend and 30 preview minutes** | **about $15.30** | **about $42** | |

Fixed monthly costs across all projects: Vercel Pro $20 (includes $20 credit), Supabase Pro $25 per organization, Workers Paid $5 (or Workers for Platforms $25 later), Appetize Starter $59 when Phase 4b ships, Trigger.dev and Railway as today.

Readings:

- Tokens dominate. Sandbox time is 3 to 6 percent of a message (`unit-economics.md` section 6.4).
- A live Supabase backend costs more than the whole AI budget of the Pro base tier. Pausing idle projects and a platform deal are required, not optional.
- At the $0.04 anchor an active project consumes about 660 to 750 credits per month. The current Pro base tier holds 175. Pricing must change or the loop must get cheaper (section 11.3).
- Opus 5 multiplies the token line by 2.5. Fable 5.1 by about 3.5.

---

## 17. Where the research files disagree, and the decision

| Topic | Position A | Position B | Decision |
|---|---|---|---|
| Publish pointer | `hosting-publish.md` 10.1: put `deploymentId` in the KV pointer with content-addressed blobs. | `inspect-publish-serve.md` 12.3: keep KV version-free, add an R2 flip object `current.json`. | B. KV is eventually consistent and the domain pipeline writes pointers without deploy knowledge. Content-addressed blobs later. |
| Preview host | `hosting-publish.md` 10.1 and `inspect-publish-serve.md` 12.3: first-level hosts on `wandit.app` (`p-{token}`, `d-{id}--{slug}`). | `security.md` 9.3: a separate registrable domain, one origin per project. | B for sandbox previews (they carry auth sessions). Build previews of published deployments can use `d-{id}--{slug}.wandit.app` later. |
| Turn host | `agent-runtime-patterns.md` 16: Trigger.dev task from day one. | `inspect-infra-ops.md` 11.1: both the API request pattern and a Trigger task fit; `ai-sdk-harness.md` 2.6: the documented pattern is an HTTP route. | Phase 1 API request (weeks-to-preview), Phase 2 Trigger task (production). The turn runner is one function used by both. |
| Sandbox auth off-Vercel | `ai-sdk-harness.md` 2.9: `VERCEL_OIDC_TOKEN` required. | `sandboxes.md` 5.1: access tokens work outside Vercel deployments. | UNVERIFIED. Phase 0 spike item 2. |
| Metering source | `inspect-auth-billing-credits.md` 10.1: direct settlement from harness-reported USD. | `unit-economics.md` 7.4 and `ai-sdk-harness.md` 2.8: never bill from `total_cost_usd`; price token counts yourself. | B. Token counts times the server price table, reconciled with the Usage and Cost API. |
| Backend cost model | `backend-on-behalf.md`: pause idle projects, platform deal. | `unit-economics.md` 7.4: entitlements per plan or a multi-tenant shard design. | Both: entitlements per plan plus pause, and a platform deal. A shared-shard design is a later option if the deal fails. |
| Preview for mobile | `inspect-native-and-simulator.md` 5.3: Mac pool with `serve-sim` as stage 2. | `expo-mobile.md` 5: Appetize on demand as phase 1.5, own hosts as phase 2 after legal review. | Appetize first. Own hosts deferred. |
| Sandbox size | `sandboxes.md`: 2 vCPU / 4 GB floor, 4 / 8 comfortable. | `unit-economics.md`: prices at 2 vCPU / 4 GB. | Start at 2 vCPU / 4 GB; measure `pnpm install` and Metro; move to 4 / 8 if builds stall. |
| Job runner | `docs/PRD.md:91` (BullMQ). | `inspect-infra-ops.md` 6: no worker service exists; Trigger.dev is live. | Trigger.dev. Mark the PRD stale. |
| Agent SDK version | The bridge pins `@anthropic-ai/claude-agent-sdk@0.3.245`. | npm latest is 0.3.259. | Accept the lag. Pin the adapter versions and re-test on each bump. |

---

## 18. Biggest risks

1. `@ai-sdk/harness` is experimental and "breaking changes between releases" are expected (https://ai-sdk.dev/docs/ai-sdk-harnesses/overview). Mitigation: pin exact versions, wrap the adapter behind a wandit interface, keep the Agent SDK direct path as the fallback with the same prompts and tools.
2. The Anthropic terms question (Claude Code CLI inside a hosted sandbox paid by wandit's key) is UNVERIFIED and can block launch. Mitigation: written answer in Phase 0; fallback is the Agent SDK direct path or Managed Agents for the model loop.
3. Vercel is the only sandbox with a harness adapter, and the token form off-Vercel is UNVERIFIED. Mitigation: Phase 0 spike; a custom E2B provider budgeted at 2 ew.
4. Supabase list price per idle project (about $9.8 per month) exceeds the Pro base tier's AI budget. Mitigation: entitlements, 7-day pause, partnerships deal before Phase 3 GA.
5. Unit economics at the current credit anchor give about 17 messages for $25. Mitigation: measure in staging for two weeks; decide on model and effort defaults and on plan tiers before external users.
6. Non-technical users ship apps with open RLS (CVE-2025-48757 class). Mitigation: RLS-required migrations, advisors gate, anonymous RLS probe, all blocking.
7. Phishing on `wandit.app` leads Cloudflare to disable hosted content. Mitigation: publish gate, slug rules, abuse inbox, `suspended` pointer, rate limits.
8. Preview URLs on Vercel are public. Mitigation: the hostname-token Worker before any user data appears in a preview; a Worker-only header check in the template in Phase 2.
9. Phase 1 turns run inside the API request and die on disconnect or deploy. Mitigation: staging only; Phase 2 moves the host to Trigger with resume.
10. Expo Go SDK drift and Expo's policy direction can break the mobile preview on Expo's schedule. Mitigation: pin the template SDK; start the wandit dev client in Phase 4b early.
11. Redis in `sfo` with the API in `europe-west4` adds a transatlantic hop to every relay chunk and lock call. Mitigation: move Redis before Phase 2.
12. No CI runs tests today. Mitigation: add `check-types` and `vitest` jobs before the first staging promotion of V2.

---

## 19. Unverified items to close, by phase

Phase 0:
- Adapter token form off-Vercel; per-step usage, hooks and budget options reaching the host; abort behaviour without `detach()`; git and Chromium in the managed images (custom image removes the last two).
- Anthropic terms clause; Vercel `cdg1` rates; Supabase project creation and restore durations; Supabase per-org project caps.

Phase 1:
- Whether gateway generation ids surface for harness calls (decides reconciliation path).
- Real step counts and token sizes per message (all estimates in section 16).
- Sandbox workspace size and snapshot size (2 GB is an ESTIMATE).

Phase 2:
- Whether `staging.wandit.dev` was attached; scopes of the existing `CLOUDFLARE_API_TOKEN`; who deploys `wandit-edge` today.
- Public Suffix List timing for both `wandit.app` and the preview domain.

Phase 3:
- Supabase claim-flow details; Resend SMTP host and port for Supabase auth; Stripe availability in Morocco; whether secret values can be read back through the Management API.

Phase 4:
- The App Store Expo Go SDK today; whether Expo Go dev-server loading stays unrestricted; whether Appetize devices can reach an arbitrary public Metro host; supabase-js on Expo details; Appetize plan numbers (read through a render proxy).

---

## 20. What is deliberately not in V2.0

- Multi-user drafts and CRDT co-editing (one main branch, one active turn, queued messages).
- Two-way GitHub sync (one-way export later).
- SSR frameworks and Workers for Platforms.
- Database time travel per version.
- wandit-owned iOS or Android streaming.
- Lead read or write from inside generated apps.
- A native V2 client.
- Per-user Anthropic keys or claude.ai login (forbidden by Anthropic).

---

## 21. Sources

Research files in `docs/v2/research/` (all dated 2026-09-03):
`inspect-ai-pipeline.md`, `inspect-publish-serve.md`, `inspect-data-model.md`, `inspect-web-builder-ui.md`, `inspect-auth-billing-credits.md`, `inspect-infra-ops.md`, `inspect-native-and-simulator.md`, `inspect-connectors-media-leads.md`, `inspect-product-docs-and-references.md`, `ai-sdk-harness.md`, `sandboxes.md`, `competitor-architectures.md`, `backend-on-behalf.md`, `expo-mobile.md`, `hosting-publish.md`, `git-versioning.md`, `security.md`, `unit-economics.md`, `agent-runtime-patterns.md`.

Repository files read directly for this proposal (worktree `.claude/worktrees/v2-builder`):
- `apps/server/package.json:37,45,46`; `apps/web/package.json:15,31,33`
- `apps/edge/src/index.ts:180-207`
- `packages/env/src/server.ts:118,227,234,270-271`
- `apps/server/src/app.module.ts:55-70`
- `packages/db/src/schema/deployments.ts:50-72`
- `apps/server/src/modules/pages/application/page-build-handoff.ts:37-60`
- `apps/server/src/modules/settings/domain/product-settings.constants.ts:1-25`
- `packages/db/src/schema/projects.ts:40-58`
- `packages/db/src/schema/credits.ts:34-52`

Key web sources (fetched by the sibling reports on 2026-09-03):
- https://ai-sdk.dev/docs/ai-sdk-harnesses/overview ; /harness-agent ; /tools ; /ui
- https://ai-sdk.dev/providers/ai-sdk-harnesses ; /claude-code
- https://registry.npmjs.org/@ai-sdk/harness/latest ; https://registry.npmjs.org/@ai-sdk/harness-claude-code/latest ; https://registry.npmjs.org/ai/latest
- https://code.claude.com/docs/en/agent-sdk/permissions ; /hooks ; /cost-tracking ; /file-checkpointing ; /secure-deployment ; /sessions
- https://code.claude.com/docs/en/legal-and-compliance ; https://code.claude.com/docs/en/sandbox-environments ; https://code.claude.com/docs/en/env-vars
- https://vercel.com/docs/sandbox/pricing ; /concepts ; /concepts/persistent-sandboxes ; /concepts/firewall ; /concepts/regions ; /concepts/images ; /sdk-reference
- https://trigger.dev/docs/tasks/overview ; /queue-concurrency ; /tasks/streams ; /wait ; /management/runs/cancel
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
- https://supabase.com/docs/reference/api/introduction ; /v1-create-a-project ; /v1-run-a-query ; /v1-update-auth-service-config ; /v1-bulk-create-secrets ; /v1-deploy-a-function ; /v1-get-project-logs ; /v1-pause-a-project
- https://supabase.com/pricing ; https://supabase.com/solutions/ai-builders ; https://supabase.com/docs/guides/database/database-advisors ; https://supabase.com/docs/guides/api/api-keys ; https://supabase.com/ui/docs/platform/platform-kit
- https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/ ; https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/ ; https://developers.cloudflare.com/r2/pricing/
- https://www.cloudflare.com/trust-hub/reporting-abuse/
- https://docs.expo.dev/more/expo-cli/ ; https://expo.dev/changelog/expo-go-and-app-store-may-2026 ; https://expo.dev/pricing ; https://docs.appetize.io/rest-api/v1/create-new-app.md ; https://docs.appetize.io/platform/embedding-apps.md
- https://git-scm.com/docs/git-bundle ; https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- https://platform.claude.com/docs/en/about-claude/pricing ; https://platform.claude.com/docs/en/api/rate-limits
- https://cveawg.mitre.org/api/cve/CVE-2025-48757 ; https://cveawg.mitre.org/api/cve/CVE-2024-21626
- https://docs.lovable.dev/features/security ; https://docs.lovable.dev/features/projects/history ; https://docs.lovable.dev/integrations/stripe ; https://support.bolt.new/integrations/expo
- https://vercel.com/blog/introducing-the-new-v0-api ; https://vite.dev/config/server-options.html
- https://github.com/publicsuffix/list/wiki/Guidelines
