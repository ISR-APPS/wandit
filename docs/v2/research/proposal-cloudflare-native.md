# wandit V2 architecture proposal: Cloudflare-native

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev` at `1b2a9a1e`).
Author: Claude Fable principal-engineer agent. Read-only. No code changed.
Angle: keep the company on Cloudflare where Cloudflare is ready. Keep Supabase for user backends. Say where Cloudflare is not ready.

Evidence marks: `path:line` = read in this worktree on 2026-09-03. URL = fetched on 2026-09-03. `research: <file>` = a sibling report in `docs/v2/research/`. **UNVERIFIED** = not confirmed from a primary source. **ESTIMATE** = a planning number, not a vendor number.

Inputs: the nine `inspect-*.md` reports and the ten research topic reports in this folder, plus ten direct fetches of Cloudflare documentation made for this proposal (section 20).

---

## 0. Decision summary

| # | Component | Choice | One-line reason |
|---|---|---|---|
| 1 | Agent runtime | AI SDK v7 `HarnessAgent` + `@ai-sdk/harness-claude-code`, hosted in a Trigger.dev task, model traffic through a wandit LLM proxy Worker in front of Cloudflare AI Gateway | Reuses `useChat`, `createUIMessageStream`, and `toolApproval` exactly as V1 does; the proxy keeps the Anthropic key out of the VM |
| 2 | Sandbox | Day one: Vercel Sandbox (`cdg1`) behind a `SandboxProvider` port. Target: Cloudflare Sandbox SDK once a custom `HarnessV1SandboxProvider` passes four acceptance tests | Only Vercel has a shipped harness adapter; Cloudflare Sandbox erases disk on sleep and is a 1.0 preview |
| 3 | Web template | Vite + React + TypeScript + Tailwind + shadcn/ui + React Router (library mode) + `supabase-js` + `@wandit/leads` | Static output; the edge Worker can serve it; same shape as Lovable |
| 4 | Mobile | Expo pinned to the store Expo Go SDK; Expo web in the iframe; QR to Expo Go through the preview proxy; wandit dev-client app + Appetize next; own device pool last | No competitor streams a simulator as the main preview; Cloudflare has no Mac or KVM offer |
| 5 | Backend | One Supabase project per app in a wandit-owned org, created lazily, Supabase Auth, Resend per-tenant sending key, user's Stripe key, `pg_cron`, Management API behind a queue; Cloudflare Web Analytics injected at the edge | Lovable Cloud model; Cloudflare D1/DO has no bundled auth or dashboard |
| 6 | Versioning | git inside the sandbox, one commit per turn, incremental bundles to R2, `app_commits` tables, copy-forward restore | Cheapest durable store; Claude Code checkpoints miss Bash edits |
| 7 | Preview | New zone `wanditpreview.app` (name UNVERIFIED as available) served by a new preview-proxy Worker that checks a signed token and forwards to the sandbox port; one origin per project; PSL submission | Cross-origin isolation from the builder; hides the vendor host; WebSocket pass-through |
| 8 | Publish | Extend `wandit-edge`: immutable per-deployment R2 prefix, one flip object, path routing with SPA fallback, per-object content types; build in the sandbox from a Trigger task; Workers for Platforms in phase 2 for SSR | Zero egress cost; KV pointer contract and custom-domain pipeline stay unchanged |
| 9 | Streaming | Trigger.dev task produces; Redis Stream per turn for the browser leg (existing relay code); Trigger stream as durable copy; custom `ChatTransport` with `reconnectToStream`; Durable Objects later for fan-out | `useChat` untouched; no Trigger connection cap on browsers |
| 10 | Metering | New `agent_session` operation with checkpoint debits priced from token counts; AI Gateway logs with `cf-aig-metadata` as the reconciliation source; AI Gateway spend limits per user as the backstop; sandbox minutes measured; backends as entitlements; per-project caps | Keeps the $0.04 anchor and the ledger unchanged |
| 11 | Security | Firecracker or own-VM sandbox, deny-by-default egress, no secret in the VM, proxy-injected credentials, separate preview origin, publish gate (advisors, RLS probe, secret scan, phishing check), `suspended` pointer as takedown | Matches `research: security.md` checklist |
| 12 | Module | `apps/server/src/modules/app-builder` mounted behind `V2_BUILDER_ENABLED`; `/api/v2/*`; `packages/contracts/src/v2`; `projects.engine` column; web route reuses `/p/$projectId` shell and swaps the page by engine; PostHog flag per user | Matches the `QueuesModule` gating pattern already in `app.module.ts` |
| 13 | Migration | One-way import: V1 HTML becomes the first commit of a V2 project; leads keep the same capture endpoint through the SDK | V1 stays untouched for production users |
| 14 | Phases | P0 spike, P1 web alpha, P2 Cloud tab, P3 mobile phase 1, P4 Cloudflare sandbox + preview app, P5 SSR and git export, P6 device streaming | Each phase ships a usable slice |
| 15 | Cost | About $12-16 per active landing-page project-month, $22-26 with a Supabase backend, plus about $0.44 of tokens per typical message on Sonnet 5 | Tokens dominate; compute and hosting are cents |

---

## 1. The system in one picture

```
Browser (apps/web, useChat + BuilderTransport)
  │ POST /api/v2/projects/:id/turns                    NestJS API (Railway)
  │ GET  /api/v2/projects/:id/turns/:turnId/stream      - admission, lock, credit hold
  │ POST /api/v2/projects/:id/turns/:turnId/cancel      - Redis Stream relay (reused V1 code)
  │ <iframe src="https://<run>-<project>.wanditpreview.app">
  ▼
Redis (turn:{turnId} streams, builder:lock:{projectId})
  ▲
Trigger.dev task `builder-turn` (queue per project, limit 1)
  - HarnessAgent + Claude Code adapter session per chat
  - tees UI chunks to Redis and to a Trigger stream
  - git commit per turn; bundle + patch to R2
  │ WebSocket bridge          preview port           playwright service
  ▼
Sandbox (Vercel Sandbox day one; Cloudflare Sandbox SDK target)
  - /workspace git repo, dev server, harness bootstrap
  - egress: deny-all + allowlist; ANTHROPIC_BASE_URL=https://llm.wandit.app
  │
  ├─► llm.wandit.app  (Worker: run-token check → Cloudflare AI Gateway → Anthropic)
  ├─► R2 (git bundles, patches, screenshots, backups) via presigned URLs
  └─► <ref>.supabase.co (publishable key only; secrets injected at the proxy)

Publish: Trigger task `publish-app` → vite build in sandbox → R2 published/{projectId}/d/{deploymentId}/*
         → flip object current.json → deployments row → wandit-edge serves it (KV pointer unchanged)
Custom domains: Cloudflare for SaaS (unchanged, apps/server/src/modules/domains)
```

Cloudflare owns: model proxy and gateway, preview proxy and zone, publish serving, R2 storage for git and snapshots, custom domains, abuse scanning, web analytics, and (target) the sandbox. Railway owns the API. Trigger.dev owns the turn and publish jobs. Supabase owns each app's backend. Vercel owns the day-one sandbox and the web SPA hosting (unchanged).

---

## 2. Component 1: agent runtime and harness

### 2.1 Choice

Use the AI SDK v7 `HarnessAgent` from `@ai-sdk/harness@1.0.100` with `@ai-sdk/harness-claude-code@1.0.104` (`research: ai-sdk-harness.md:47-63`). Host the session object in a Trigger.dev task, not in the API request (`research: agent-runtime-patterns.md:73-79`). Route every model call from the sandbox through a wandit LLM proxy Worker (`llm.wandit.app`) that forwards to Cloudflare AI Gateway.

### 2.2 Why this and not the alternatives

- The harness gives the file tools, the edit loop, compaction, permission modes, session resume, and skills for free. V1 hand-built all of these: `write_file`, `edit_file`, the VFS, the finish gate, the stall watchdog, and 15 cheerio op kinds (`research: inspect-ai-pipeline.md:362-384`). That is the founder's stated pain.
- The stream is the same `createUIMessageStream` writer V1 uses at `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:1020`, so `data-ai-error`, `data-billing-error`, and `data-credits-settled` parts merge into the same stream (`research: ai-sdk-harness.md:158-182`).
- `toolApproval` uses the same map shape as `chat-agent.ts:476`, so the MCP connector approval flow carries over (`research: ai-sdk-harness.md:150`).
- Option B (Claude Agent SDK directly in wandit containers) is the fallback. It uses the same prompts, skills, and host tools, so nothing written for Option A is lost (`research: ai-sdk-harness.md:440-444`). Option C (Managed Agents) has no preview port and no ZDR, so it cannot host an in-iframe preview (`research: ai-sdk-harness.md:446-450`).

### 2.3 Session semantics

- One `HarnessAgentSession` per chat, `sessionId = chatId`. Persist only the opaque `resumeState` from `session.detach()` in a new `builder_sessions` table (`research: ai-sdk-harness.md:178`, `research: agent-runtime-patterns.md:405`).
- Do not resubmit the full transcript. The harness owns its history; Postgres keeps the display copy (`research: agent-runtime-patterns.md:108-110`). This also fixes the V1 problem that the transport resubmits the whole transcript per turn (`research: inspect-web-builder-ui.md:803-807`).
- Between turns while the user is active: `session.detach()`. After 20 minutes idle: `session.stop()`. On return: `createSession({ sessionId: chatId, resumeFrom })` (`research: agent-runtime-patterns.md:92-102`).
- `permissionMode: 'allow-all'` for built-in tools inside the sandbox. `toolApproval: 'user-approval'` only for host tools that spend money or publish (`research: agent-runtime-patterns.md:441`).
- Turn budget: `maxBudgetUsd` about $2 on Pro, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3`, default model Sonnet 5 at `effort: medium`, `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` (`research: unit-economics.md:292-296`).

### 2.4 Host tools (wandit product tools inside the harness)

Host tools run in the Trigger task and appear to Claude as `mcp__harness-tools__<name>` (`research: ai-sdk-harness.md:156`). First set:

| Tool | What it does | Approval |
|---|---|---|
| `read_preview_diagnostics` | Dev-server tail, console errors, page errors, failed requests, last screenshot | none |
| `take_screenshot` | Calls the Playwright service in the sandbox, uploads JPEG to R2, returns an image block | none |
| `generate_image` | Server-side call to `image-generator.ts` and `storeImageVariants`; returns an R2 URL plus size (`research: inspect-connectors-media-leads.md:288-292`) | none, metered child |
| `ensure_backend` | Provisions or wakes the Supabase project (section 6) | user approval on first call |
| `supabase_apply_migration`, `supabase_execute_sql`, `supabase_deploy_function`, `supabase_get_advisors` | Control-plane calls with the platform token; the sandbox never sees it (`research: security.md:253`) | `apply_migration` and `deploy_function` approved once per turn |
| `set_secret` | Writes a project secret (section 6.6) | user approval |
| `publish_preview` / `publish` | Section 9 | user approval |
| `ask_user` | Same request-tray flow as V1 | client tool |

The MCP connectors (Meta, TikTok, Higgsfield) attach to the chat through `McpChatToolsService.resolveToolsForUser` unchanged (`research: inspect-connectors-media-leads.md:296`).

### 2.5 The Brain stays

Keep the V1 Brain, the design worlds, `get_direction_candidates`, `ask_user`, `read_skill`, and the brief format (`research: inspect-ai-pipeline.md:387-400`). The V2 change is that `generate_page` becomes `run_builder_turn`: the Brain writes the brief, the handoff triggers `builder-turn`, and the harness builds or edits the project. Later, when the harness proves stable, the Brain can be folded into the harness system prompt as a skill. Do not do that in phase 1.

### 2.6 Model routing: the LLM proxy Worker and Cloudflare AI Gateway

Design (`research: security.md:184-191`):

1. The API mints a signed run token `{ sub: userId, project, run, exp: now+30 min, budget_usd, model_allow }` when it admits a turn.
2. The Trigger task starts the harness with `ANTHROPIC_BASE_URL=https://llm.wandit.app`, `ANTHROPIC_AUTH_TOKEN=<run token>`, `ANTHROPIC_API_KEY=""`, and `ANTHROPIC_CUSTOM_HEADERS="X-Wandit-Run: <runId>"`. The Agent SDK inherits these because it spawns Claude Code as a subprocess (https://vercel.com/docs/ai-gateway/coding-agents/claude-code, cited in `research: ai-sdk-harness.md:345`).
3. `llm.wandit.app` is a small Worker. It validates the token, checks the per-run budget in Workers KV or a Durable Object counter, forwards the body and every `anthropic-*` header unchanged, streams the reply with pings, and forwards to `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic` with `cf-aig-authorization: Bearer <CF_AIG_TOKEN>` and BYOK so the Anthropic key is stored in the gateway, not in the Worker env (https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/: "When using BYOK or Unified Billing, do not set `x-api-key` in `defaultHeaders`. AI Gateway supplies the Anthropic key for you.").
4. The Worker adds `cf-aig-metadata` with `userId`, `projectId`, `runId`, and `usageEventId`. AI Gateway spend limits then apply "per-user or per-team budgets using custom metadata" and return 429 when reached (https://developers.cloudflare.com/ai-gateway/features/spend-limits/: "When cumulative spend reaches the limit within a time window, AI Gateway blocks further requests with a `429` response until the window resets." and "Spend limits apply to both Unified Billing requests and BYOK requests for models with known pricing."). This is the backstop; the wandit ledger is the primary control (section 11).
5. Gateway logs are the reconciliation source (section 11).

Honest gaps:

- The Cloudflare AI Gateway Anthropic page does not document Claude Code or the Agent SDK. It shows cURL and the Anthropic SDK only (fetched 2026-09-03). Whether the gateway forwards `anthropic-beta` headers, `cache_control` markers, and SSE pings unchanged is **UNVERIFIED**. Claude Code needs all three or features degrade silently (`research: security.md:162-172`). The Vercel AI Gateway documents a Claude Code recipe (`research: ai-sdk-harness.md:345`). Decision rule: run the P0 spike against Cloudflare AI Gateway first; if prompt caching (`cacheReadInputTokens > 0`) or tool streaming fails, switch the proxy upstream to the Vercel AI Gateway. The proxy Worker makes this a one-line change.
- `research: security.md:181` says Cloudflare docs tell users to set `ANTHROPIC_BASE_URL` to the gateway for Claude Code. The provider page I fetched does not say that. Treat as **UNVERIFIED**.
- AI Gateway spend limits are budgets on the gateway, not per-run tokens. The per-run token and its budget must live in our Worker. LiteLLM virtual keys are the alternative if the Worker grows too large (`research: security.md:179`).
- Whether `harnessMetadata['claude-code']` exposes `total_cost_usd` is **UNVERIFIED** (`research: ai-sdk-harness.md:196`). The design does not depend on it; usage comes from the `finish` part token counts and gateway logs.

### 2.7 Licensing

The Agent SDK is governed by Anthropic Commercial Terms for products sold to end users. The Claude Code in-products clause forbids intermediating Claude usage for end users. The harness installs the Claude Code CLI package inside the sandbox as the Agent SDK runtime. Which clause applies is **UNVERIFIED** (`research: ai-sdk-harness.md:363-372`, `research: unit-economics.md:307`). Action before any external user: written confirmation from Anthropic sales. Product branding must not say "Claude Code" (`research: ai-sdk-harness.md:371`).

### 2.8 Version prerequisites

Move `apps/server` to `ai@7.0.91` or newer before adding `@ai-sdk/harness`; today it is `ai@^7.0.19` (`apps/server/package.json:45`; `research: ai-sdk-harness.md:33`). Whether `@ai-sdk/react@4.0.x` `useChat` accepts the harness stream unchanged is **UNVERIFIED** (`research: inspect-web-builder-ui.md:817-818`); the P0 spike answers it.

---

## 3. Component 2: sandbox provider and lifecycle

### 3.1 Choice

- Day one: Vercel Sandbox, region `cdg1`, 2 vCPU / 4 GB, custom image with Node 22, pnpm store, git, Expo CLI, Playwright Chromium, and the harness bridge pre-baked (`research: sandboxes.md:326-345`).
- Target: Cloudflare Sandbox SDK on Cloudflare Containers, after a custom `HarnessV1SandboxProvider` passes the acceptance tests in 3.5.
- Both sit behind one internal port `SandboxProvider` with: `create(projectId)`, `resume(projectId)`, `run(cmd, { detached })`, `readFile`, `writeFile`, `exposePort(port) → url`, `snapshot()`, `stop()`, `destroy()`, `setNetworkPolicy()`. The git-on-R2 design only needs `run`, `readFile`, and egress to R2, so it works on both (`research: git-versioning.md:435`).

### 3.2 Why Vercel first

1. It is the only sandbox with a shipped harness adapter, `@ai-sdk/sandbox-vercel`; every other provider needs a custom `HarnessV1SandboxProvider` against an interface that has no public third-party example (`research: ai-sdk-harness.md:206`, `research: sandboxes.md:274-279`).
2. Persistence is the default: stop snapshots the filesystem, any SDK call resumes, `Sandbox.getOrCreate({ name: projectId })`, `keepLastSnapshots: { count: 1 }`, `onResume` restarts dev servers (`research: sandboxes.md:75`).
3. Firecracker microVM with a dedicated kernel, firewall with credentials brokering, `cdg1` region, 64 GB disk, 15 ports, 24 h sessions on Pro (`research: sandboxes.md:72-89`).
4. Cost is similar to Cloudflare: about $0.13 per project-hour at 10% CPU versus about $0.10 on Cloudflare standard-3 (`research: sandboxes.md:308-322`).

### 3.3 Why Cloudflare Sandbox is not ready for day one (honest list)

Facts fetched on 2026-09-03:

- Status: "Sandbox SDK 1.0 preview" on `@cloudflare/sandbox@next`; the stable package is 0.12.x (https://developers.cloudflare.com/sandbox/; `research: sandboxes.md:156`).
- Sleep erases everything: "After a period of inactivity (10 minutes by default, configurable via sleepAfter), the container stops to free resources." "When the next request arrives, a fresh container starts. All previous state is lost and the environment resets to its initial state." "All files are deleted" (https://developers.cloudflare.com/sandbox/concepts/sandboxes/).
- Backups are a workaround, not persistence: "The overlay exists only while the container is running. When the sandbox sleeps or the container restarts, the mount is gone and the directory is empty." Vite's `node_modules/.vite/deps` hits `EXDEV` on the overlay (https://developers.cloudflare.com/sandbox/concepts/backup-restore/).
- No region pin: "The first request to a sandbox determines its geographic location." Containers "may launch in distant locations to prioritize startup speed over proximity" (https://developers.cloudflare.com/sandbox/concepts/sandboxes/, https://developers.cloudflare.com/containers/platform-details/architecture/).
- Size cap: custom instances go up to 4 vCPU, 12 GiB, 20 GB disk; account cap 1,500 concurrent vCPU (https://developers.cloudflare.com/containers/platform/limits/). Expo plus Vite plus a pnpm store fits in 20 GB but it is tight (`research: sandboxes.md:380`).
- Instance type, image, and env injection are set at the Container class level, not per sandbox call; the options page documents only `sleepAfter`, `keepAlive`, and logging (https://developers.cloudflare.com/sandbox/configuration/sandbox-options/).
- Harness: no adapter exists. The bridge needs one exposed WebSocket port; Cloudflare preview URLs do support WebSocket upgrades (https://developers.cloudflare.com/sandbox/concepts/preview-urls/: "Preview URLs support WebSocket connections."), so it is possible in principle. Effort **UNVERIFIED**.

What Cloudflare Sandbox does well, and why it stays the target:

- Isolation: "Each container instance runs inside its own VM, which provides strong isolation from other workloads running on Cloudflare's network." The hypervisor is not named (https://developers.cloudflare.com/containers/platform-details/architecture/).
- Egress: "Use `enableInternet = false` to block public internet access by default"; `allowedHosts` "becomes a deny-by-default allowlist"; outbound handlers "run in the Workers runtime — outside the sandbox — they can hold secrets that the sandbox itself never sees" (https://developers.cloudflare.com/sandbox/guides/outbound-traffic/). This is the exact credential-brokering pattern the security report asks for (`research: security.md:252`).
- Billing per 10 ms, nothing while asleep, Workers Paid includes 375 vCPU-minutes and 25 GiB-hours (`research: sandboxes.md:154`).
- Same account, same R2 bucket, same zone, one vendor fewer.

### 3.4 Lifecycle on both providers

| Event | Vercel day one | Cloudflare target |
|---|---|---|
| Create | `Sandbox.create` from custom image; `onCreate`: clone template, `pnpm install --frozen-lockfile`, start dev server and Playwright service as detached commands; expose ports 4000 (bridge) and 3000 (app) | Reference sandbox id = `projectId`; the DO creates the container from the Container class image; run the same bootstrap; `exposePort(3000)` and `exposePort(4000)` with custom tokens |
| Active turn | `extendTimeout` from a tab heartbeat; `session.detach()` between turns | `keepAlive: true` while `builder_sessions.state = warm`; destroy on idle policy |
| Pause (20 min idle) | `session.stop()` → automatic filesystem snapshot; `keepLastSnapshots: { count: 1 }` | `session.stop()`; `createBackup('/workspace')` to R2 (excluding `node_modules/.vite`); let `sleepAfter` fire |
| Resume | `Sandbox.get({ name })`, any call resumes; `onResume` restarts dev servers; expect 5-15 s | Fresh container from image (1-3 s) + `restoreBackup` + `git fetch` from R2 bundles + `pnpm install` from the baked store + dev server start; expect 20-60 s **ESTIMATE**; rebuild from git bundles if the backup is missing |
| Snapshot | Provider snapshot as cache only; git bundles on R2 are truth (section 7) | R2 backup as cache only; git bundles are truth |
| Destroy (30 days idle or project delete) | delete sandbox and snapshots | `destroy()`; delete R2 backup prefix |
| Egress policy | firewall `deny-all` + allowlist; `transform` rule injects Supabase and Stripe headers; brokered LLM traffic | `enableInternet=false`, `allowedHosts`, outbound handler injects headers |
| Preview | public `sandbox.domain(3000)` behind the wandit preview proxy | `https://3000-{id}-{token}.wanditpreview.app` behind the same proxy (or direct with the wildcard domain) |

Idle policy: a Trigger schedule every minute stops sandboxes with `last_active_at` older than 20 minutes and marks `builder_sessions.state = cold` (`research: agent-runtime-patterns.md:418`). A tab heartbeat `POST /api/v2/projects/:id/preview/heartbeat` keeps a sandbox warm while the user looks at the preview.

### 3.5 Acceptance tests for the Cloudflare migration (phase 4)

1. A custom `HarnessV1SandboxProvider` runs a full Claude Code turn with `permissionMode: 'allow-all'`, streams to the browser, and survives `detach()` + `createSession({ resumeFrom })` inside one container lifetime.
2. Cold resume after sleep restores a 200-commit project from R2 bundles plus backup, starts Vite and Metro, and shows the preview in under 60 seconds at p95 **ESTIMATE target**.
3. The outbound handler injects the Supabase secret header on `https://<ref>.supabase.co` and denies `169.254.0.0/16`, private ranges, and any host not on the allowlist; a test asserts no `sk-ant-` string exists in the container environment.
4. Preview through `wanditpreview.app` passes Vite HMR and Metro WebSocket traffic for 30 minutes without a reconnect loop.

If any test fails after two weeks of spike, stay on Vercel and re-evaluate at Sandbox SDK GA.

### 3.6 Trigger.dev host interaction

- The task runs on `small-2x`; the heavy work is in the sandbox (`research: agent-runtime-patterns.md:171`).
- Never call `wait.*` for more than a few seconds while the bridge WebSocket is open; a checkpoint kills the process (`research: agent-runtime-patterns.md:172`). Detach first.
- `retry.maxAttempts: 1` for the turn task, like `generate-page` (`apps/server/trigger.config.ts:57-63`). Phases inside the task (boot, bootstrap, commit) retry themselves.
- Raise `maxDuration` for the turn task to 3600 s; the global 1800 s in `trigger.config.ts:53` stays for other tasks.

---

## 4. Component 3: generated web app stack

### 4.1 Choice

Vite + React + TypeScript + Tailwind + shadcn/ui + React Router in library mode + `@supabase/supabase-js` + `@wandit/leads` (`research: hosting-publish.md:256-263`).

### 4.2 Why

1. The output is a directory of static files. The extended `wandit-edge` serves it with zero egress cost (section 9). No script size limit, no cold start.
2. It is the Lovable shape, which the market accepts (`research: competitor-architectures.md:62`).
3. Server logic lives in Supabase Edge Functions, so the host never runs user server code in phase 1. That removes most abuse and isolation work from publish.
4. React Router framework mode and TanStack Start work on Workers and can come in phase 5 for SSR (`research: hosting-publish.md:252-253`). Next.js stays out; OpenNext has the most caveats and the 10 MB compressed limit (`research: hosting-publish.md:254`).

### 4.3 Template contents (a git repo under `templates/web-app`, copied into the sandbox)

- `CLAUDE.md`: interface contract, pinned stack, discussion-first turn policy, tool hygiene, design-system-first rules, runtime facts (preview domain, env names, no `VITE_` secrets). Use `docs/prompts/lovable.md` as the checklist, not as text (`research: inspect-product-docs-and-references.md:360-374`).
- `.claude/settings.json`: deny `Bash(git push:*)`, `Bash(git reset --hard:*)`, `Bash(git checkout:*)`, `Bash(git switch:*)`, `Bash(git rebase:*)`, `Bash(sudo:*)`, `Bash(nc:*)`, `Bash(ssh:*)`, `Bash(docker:*)`, `Bash(curl:*)`, `Bash(wget:*)`; deny writes to `.claude/`, `.mcp.json`, `.git/hooks`, shell rc files (`research: git-versioning.md:273`, `research: security.md:503-505`). Exact rule syntax to confirm at implementation (**UNVERIFIED**).
- `vite.config.ts`: `server.host: true`, `server.allowedHosts: ['.wanditpreview.app', '.vercel.sh']`, `server.strictPort: true`, `server.hmr.clientPort: 443`, `protocol: 'wss'` (`research: agent-runtime-patterns.md:304`).
- `src/lib/wandit.ts`: the leads SDK and a preview error bridge that forwards `window.onerror`, `unhandledrejection`, and `console.error` to the parent with `postMessage` (`research: agent-runtime-patterns.md:318`).
- `.env` generated at session start with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WANDIT_API_ORIGIN`, `VITE_WANDIT_PUBLIC_FORM_ID`, `VITE_WANDIT_META_PIXEL_ID`, `VITE_WANDIT_TIKTOK_PIXEL_ID`, `VITE_WANDIT_CURRENCY`. Publishable values only (`research: security.md:259`).
- `.gitignore`: `.env*`, `node_modules`, `dist`, `.expo`, media directories; a pre-commit size guard at 10 MB (`research: git-versioning.md:414`).
- Design tokens and the shadcn theme wired to the V1 design worlds vocabulary so the Brain's brief still maps to a theme (`research: inspect-product-docs-and-references.md:370`).
- i18n scaffold with `en`, `fr`, `ar` and RTL utilities from `@wandit/internationalization` rules (`research: inspect-product-docs-and-references.md:354`). Whether generated apps must be AR/FR from day one is an open product question (`research: inspect-product-docs-and-references.md:431`).

### 4.4 Project kind is chosen at creation

Web and mobile projects do not convert into each other (`research: competitor-architectures.md:346`). The composer gets modes `app` and `mobile` (`research: inspect-web-builder-ui.md:782-783`). A landing page is a web project with the `landing` template preset, which still uses the same Vite stack; this replaces the V1 single-file HTML contract for new projects.

---

## 5. Component 4: mobile apps (Expo) and the mobile preview path

### 5.1 Choice

- Template: Expo pinned to the SDK the store Expo Go runs (SDK 57 is listed on https://expo.dev/go today; the store build is **UNVERIFIED**), `expo-router`, `react-native-web`, `@expo/metro-runtime`, a curated module allow-list that works in Expo Go and on web, HeroUI Native + Uniwind pins from `apps/native` (`research: expo-mobile.md:279`, `research: inspect-product-docs-and-references.md:394`; UNVERIFIED that Zack wants HeroUI Native in generated apps).
- Phase 1 preview: `npx expo start --web --port 8081` in the sandbox; the iframe shows the web target inside a phone-frame chrome; `EXPO_PACKAGER_PROXY_URL=https://8081-<run>-<project>.wanditpreview.app` so the QR code encodes the wandit proxy URL, and the user opens it in Expo Go (`research: expo-mobile.md:277-285`).
- Phase 1.5: a wandit preview app (`expo-dev-client`) per runtime, shipped through TestFlight and Play internal testing, plus on-demand Appetize.io embeds where the dev client loads JavaScript from the sandbox Metro (`research: expo-mobile.md:289-296`).
- Phase 2: wandit-owned Android emulators on KVM bare metal with WebRTC, then a Scaleway or MacStadium Mac mini pool with `serve-sim` behind an authenticated proxy, after legal review of the macOS SLA (`research: expo-mobile.md:298-311`).
- Ship: EAS internal distribution (APK link, TestFlight through the user's own Apple account) before store submission; the repo already has the EAS pipeline for its own app (`apps/native/eas.json`, `.github/workflows/mobile-testflight.yml:59`).

### 5.2 Why

- Every competitor previews Expo apps as React Native Web plus a QR to a phone; nobody streams a cloud simulator as the main preview (`research: competitor-architectures.md:30`, `research: expo-mobile.md:255-269`).
- Simulator or emulator streaming cannot run inside any Linux sandbox: iOS needs macOS, Android needs KVM that Firecracker guests and Cloudflare Containers do not expose (`research: sandboxes.md:301`, `research: expo-mobile.md:194-202`).
- The repo has zero infrastructure for previewing user-generated Expo apps; `apps/native` previews static HTML only. The `claude/ios-simulator-streaming-716ef9` branch holds no streaming code (`research: inspect-native-and-simulator.md:12-17`).

### 5.3 Where Cloudflare is not ready

Cloudflare has no macOS hosts, no KVM containers, and no device cloud. The mobile preview path is vendor-neutral by necessity. The only Cloudflare pieces are the preview proxy Worker (Metro traffic) and R2 for build artifacts.

### 5.4 Constraints to build in

- Expo Go SDK drift and the 2026-05-12 loading policy: re-pin the template when the store build moves; the dev-client app removes the dependency (`research: expo-mobile.md:56-66`).
- OAuth cannot round-trip in Expo Go; mark it "needs the wandit preview app" and fall back to email OTP or magic link (`research: expo-mobile.md:138`).
- Mobile preview minutes on Appetize cost $0.06 per minute, more than the AI cost per minute; cap them per plan (section 11).
- `apps/native` can become the V2 mobile client later. Its `use-ai-chat.ts` already speaks the AI SDK v7 stream, so a new `api` URL is enough for chat; the preview screen must change to a URL-based WebView with a signed token (`research: inspect-native-and-simulator.md:267-280`). Delete `lib/dev-auth-bypass.ts` before any V2 native release.

---

## 6. Component 5: backend on behalf of the user

### 6.1 Choice

One Supabase project per V2 app, inside wandit-owned Supabase organizations, created lazily on the first need. Supabase Auth in the app. Resend for email with one domain and one domain-scoped `sending_access` key per tenant. The user's own Stripe restricted key as a secret in phase 1. `pg_cron` for jobs. The Cloud tab built on the Management API through a server-side proxy modeled on the Supabase Platform Kit (`research: backend-on-behalf.md:15-25`).

### 6.2 Why not Cloudflare for the backend

Cloudflare D1 or Durable Object SQLite plus Workers for Platforms is the cheapest hosting and lite-database layer, and VibeSDK proves the pattern, but it has no bundled auth, no storage buckets with policies, no user dashboard, and D1 is SQLite with a 10 GB cap and a single writer (`research: backend-on-behalf.md:255-263`). Non-technical users need the Lovable Cloud surface: tables, users, storage, secrets, logs, functions, jobs. Supabase gives that through one API. Keep a `BackendProvider` interface so a Cloudflare lite tier (D1 or DO SQLite with Better Auth) can be added for landing pages with small data needs later (`research: backend-on-behalf.md:25`).

### 6.3 Provisioning flow

Trigger.dev task `provision-backend`, one per project, idempotent on `projectId` (`research: backend-on-behalf.md:414-425`):

1. `POST /v1/projects` with `name = wandit-<projectId>`, `organization_slug`, generated `db_pass`, `region` from the user's locale (default `eu-west-3` Paris or `eu-central-1`; no Africa or Middle East region exists), `desired_instance_size = micro` (or Nano under a partner deal).
2. Poll `GET /v1/projects/{ref}` every 5 s until `ACTIVE_HEALTHY`; time out at 10 minutes.
3. `GET /v1/projects/{ref}/api-keys?reveal=true`; store the publishable key in `app_backends`, the secret key in `project_secrets` (encrypted).
4. `PATCH /v1/projects/{ref}/config/auth`: `site_url` = preview origin, `uri_allow_list` = preview and published origins, Resend SMTP, CAPTCHA, OTP expiry at or below 3600 s.
5. `POST /v1/projects/{ref}/database/query`: enable `pg_cron`, RLS conventions.
6. `POST /v1/projects/{ref}/secrets`: `RESEND_API_KEY`, `APP_URL`.
7. `PUT /v1/projects/{ref}/api-keys/legacy` to disable legacy JWT keys once the client uses `sb_publishable_` keys; `PUT /v1/projects/{ref}/ssl-enforcement` (`research: security.md:417-418`).
8. Write `.env` into the sandbox; mark `ready`; show the Cloud tab.

All Management API calls go through one queue with per-project (120 per minute) and per-org buckets, and back off on `X-RateLimit-Remaining: 0` (`research: backend-on-behalf.md:70`).

### 6.4 Lifecycle and cost control

- Pause after 7 days without traffic and without cron jobs (`POST /v1/projects/{ref}/pause`); restore on demand with a "waking up" state; the edge Worker serves a friendly waking page for published apps (`research: backend-on-behalf.md:429-431`).
- Backends are plan entitlements, not credits: Starter 0, Pro 1, Business 3, more as a $10 per month add-on (`research: unit-economics.md:299`). List price is USD 0.01344 per hour per Micro, about $9.8 per month (`research: backend-on-behalf.md:134`).
- Contact Supabase partnerships before phase 2 for Nano scale-to-zero, project caps, and rate-limit lifts (`research: backend-on-behalf.md:120`).
- Hook publish and domain activation to `PATCH /config/auth` so `https://{slug}.wandit.app` and every active custom domain are allowed redirect URLs (`research: inspect-publish-serve.md:296`).

### 6.5 Sandbox access to the backend

The sandbox gets only `SUPABASE_URL` and the publishable key. Migrations, SQL, function deploys, and advisors run through host tools in the control plane (section 2.4), or through a project-scoped hosted Supabase MCP config with a short-lived proxy token (`research: backend-on-behalf.md:203-212`). The secret key and the platform PAT never enter the sandbox (`research: security.md:263-268`).

### 6.6 Secrets

`project_secrets` table: per project and environment, encrypted with `APP_SECRETS_ENCRYPTION_KEY`, write-only in the UI. Injection paths, ranked (`research: security.md:250-256`): egress-proxy header injection (Vercel `transform`, Cloudflare outbound handler), control-plane tools, deploy-time injection into Supabase Edge Function secrets. Never as a plain env var in the sandbox. `mcp_connections` stays per-user and agent-side; app integrations get their own `app_integrations` table (`research: inspect-connectors-media-leads.md:294-298`).

### 6.7 Email, payments, jobs, analytics, logs

- Email: shared `mail.wandit.app` sender by default; per-tenant Resend domain with DNS records shown in the wandit UI (the domains module already manages DNS); tenant-scoped `sending_access` key stored as a Supabase secret (`research: backend-on-behalf.md:357-364`).
- Payments: the user's Stripe restricted key (`rk_live_`) entered in a form, never in chat; Stripe Connect in phase 5 (`research: backend-on-behalf.md:375-378`, `research: security.md:520`). Stripe availability in Morocco is **UNVERIFIED**; COD-first users may not need it.
- Jobs: `pg_cron` with `cron.job_run_details` for history; jobs prevent auto-pause.
- Analytics: Cloudflare Web Analytics beacon injected by `wandit-edge` per site (Cloudflare is ready here); PostHog project per app as a paid add-on later (`research: backend-on-behalf.md:387-390`).
- Logs: `GET /v1/projects/{ref}/analytics/endpoints/logs` in 24-hour windows, 7-day retention on Pro; page in the UI; store longer history in R2 if users need it (`research: backend-on-behalf.md:90`).

---

## 7. Component 6: versioning and git

### 7.1 Choice

Git inside the sandbox is the file source of truth. The server makes one commit per assistant turn with tags `msg/<messageId>`. After each commit the sandbox uploads an incremental `git bundle`, a capped patch, and a numstat file to R2 through presigned URLs. Postgres tables `app_commits`, `app_bundles`, `app_branches` hold the version list and heads with the V1 compare-and-swap rule. Restore is a copy-forward commit. Provider snapshots and R2 directory backups are caches only (`research: git-versioning.md:252-262`).

### 7.2 Why

- Claude Code file checkpointing tracks only `Write`/`Edit`/`NotebookEdit`, not Bash or subagent edits, and dies with the session (`research: git-versioning.md:116-120`).
- Per-message sandbox snapshots would cost about $32 per project-month at 2 GB (**ESTIMATE**); git on R2 costs cents (`research: git-versioning.md:141`).
- R2 is already integrated (`apps/server/src/infrastructure/storage/r2.ts:42-61`), strongly consistent, and egress-free. At 10,000 projects the git data costs about $15 per month (`research: git-versioning.md:396-398`).
- V1 already has immutable versions with a CAS pointer and copy-forward restore (`apps/server/src/modules/pages/application/services/page-edits.service.ts:188-234`); V2 keeps the shape and changes the payload.

### 7.3 Details

- R2 keys: `git/{projectId}/bundles/{seq:08d}-{full|inc}-{sha}.bundle`, `git/{projectId}/patches/{sha}.diff`, `.numstat`; a full bundle every 50 commits; `git bundle verify` before recording the row; a nightly random-project rebuild check (`research: git-versioning.md:301-308`, `:429`).
- Commit on `finish` and on cancel (`wip: cancelled turn`), so no work is lost (`research: agent-runtime-patterns.md:187`).
- UI words: Versions, Restore, Compare, Try an idea, Bring into main, Copy project, Export code (`research: git-versioning.md:260`). Restore says "does not change your app's data".
- Branch per chat (`chat/<chatId>`) and `Sandbox.fork` for parallel previews in phase 5; merge with an agent turn for conflicts (Base44 pattern) (`research: git-versioning.md:368-373`).
- Export to GitHub one-way in phase 5 with a GitHub App user token; two-way sync later with a `wandit-sync` fallback branch (`research: git-versioning.md:380-384`).
- Media never enters git; uploads go to R2 through the existing uploads service (`research: git-versioning.md:261`).

### 7.4 Cloudflare note

On the Cloudflare Sandbox, a cold container has no git objects. Rebuild = download the latest full bundle plus the incremental bundles after it (downloads into the sandbox are free on both providers), `git clone` + `git fetch`, then `pnpm install` from the baked store (`research: git-versioning.md:342-352`). This is the same path as a lost Vercel snapshot, so the design is provider-neutral.

---

## 8. Component 7: preview (web iframe and mobile) and preview auth

### 8.1 Choice

- Buy a separate registrable domain, for example `wanditpreview.app` (availability **UNVERIFIED**), put it on the same Cloudflare account as its own zone, and deploy a new Worker `wandit-preview` on `*/*` of that zone. Do not reuse the `wandit.app` zone: its `*/*` route on `wandit-edge` would catch any new host (`apps/edge/wrangler.jsonc:24`; `research: inspect-infra-ops.md:518`), and the builder must not share a registrable domain with the preview (`research: security.md:337-341`).
- Host shape: `https://<port>-<runId>-<projectId>.wanditpreview.app` (one level, inside Universal SSL). One origin per project and run.
- The Worker checks a short-lived signed token, bound to `projectId` and `runId`, carried as a `__Host-` cookie set by a redirect from `app.wandit.dev`, or as a query token on the first hit. It looks up the sandbox host in KV (`preview:{runId}` → vendor host + vendor token), forwards the request with the vendor header (`e2b-traffic-access-token` style for E2B, nothing for Vercel public URLs, the hostname token for Cloudflare), and passes WebSocket upgrades through for Vite HMR and Metro (`research: sandboxes.md:287-294`).
- Response headers set by the proxy: `Content-Security-Policy: frame-ancestors https://wandit.dev https://*.wandit.dev`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex` (`research: security.md:344`).
- Builder iframe: `sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"`, no `allow-top-navigation`, minimal `allow` policy; drop `viewport` from the remount key so the desktop/mobile toggle does not reload the app (`research: security.md:343`, `research: inspect-web-builder-ui.md:796-797`).
- Submit `wanditpreview.app` (and `wandit.app`) to the Public Suffix List PRIVATE section early; there is no SLA (`research: security.md:331`).
- Mobile: the QR code encodes the same proxy host for Metro on port 8081; the phone gets a token in the URL with a short expiry; the proxy passes Metro WebSockets (`research: expo-mobile.md:280`).
- A loading route in the proxy shows "starting your app" while the sandbox boots, as v0 recommends (`research: agent-runtime-patterns.md:306`).

### 8.2 Why

- An iframe cannot send custom headers, so header-token providers need a proxy; a proxy also hides the vendor hostname and lets the sandbox vendor change (`research: sandboxes.md:287-294`).
- A V2 app needs `localStorage` and same-origin fetch, which needs `allow-same-origin`; with that flag the preview must live on a different registrable domain from the builder or it can read the builder's cookies (`research: security.md:333-337`).
- Cloudflare is ready here: a Worker on a wildcard zone with KV lookups is exactly what `wandit-edge` already does (`apps/edge/src/index.ts:171-174`).

### 8.3 Inline visual editor

The V1 inline editor (`packages/preview-editor`) works only on server-stamped single-file HTML and cannot inject into a cross-origin URL. Treat it as V1-only in phase 1. Phase 5 adds a Vite plugin that tags JSX elements with `data-wandit-src="file:line:col"` and a runtime overlay that posts the clicked source location to the builder, so click-to-target becomes a file path plus range for the harness (`research: inspect-web-builder-ui.md:743-749`, `research: inspect-ai-pipeline.md:377`).

---

## 9. Component 8: publish, hosting, and custom domains

### 9.1 Choice

Phase 1: extend `wandit-edge` to serve a directory of static files from R2. Phase 2 (this plan's P5): Workers for Platforms for apps that need SSR or edge bindings. Custom domains stay on Cloudflare for SaaS, unchanged. Offer "Export to your own Vercel" through Claim Deployments as an optional export, never as the default host (`research: hosting-publish.md:267-320`).

### 9.2 Why Cloudflare, with numbers

Cloudflare charges zero egress and free static-asset requests; at 10 TB per month the bill is about $62 on Workers plus R2 versus $1,750-3,780 on Vercel and about $1,500 on Netlify (`research: hosting-publish.md:324-337`). Vercel Pro caps deployments at 6,000 per day; Netlify at 100 per day and 500 sites; Railway Pro allows 20 custom domains (`research: hosting-publish.md:147, 158, 176`). Cloudflare Pages is capped at 100 projects per account and is a dead end (`research: hosting-publish.md:57-63`). Lovable, Bolt, and Base44 all sit behind Cloudflare; Lovable's IP prefixes are Cloudflare BYOIP (`research: hosting-publish.md:190-218`).

### 9.3 Storage layout and the flip

- Immutable prefix per deployment: `published/{projectId}/d/{deploymentId}/{path}`, written once, `Cache-Control: public, max-age=31536000, immutable` on hashed `assets/*`, `max-age=60` on `index.html`. Content type set per object at upload from an extended map (`.map`, `.wasm`, `.woff`, `.woff2`, `.ttf`, `.webmanifest`, `.mjs`, `.avif`) (`research: inspect-publish-serve.md:279, 284`).
- One small mutable flip object `published/{projectId}/current.json` → `{ deploymentId, kind, indexKey, spaFallback }`. A publish stays one strongly consistent R2 write, exactly like `current.html` today (`research: inspect-publish-serve.md:284`).
- Keep the KV pointer contract `domain:{host}` → `{ projectId, ... }` with `projectId` as the only required field (`apps/edge/src/index.ts:13-17`). Do not put `deploymentId` in KV: KV is eventually consistent with `cacheTtl: 60`, and the domains pipeline writes pointers without deploy knowledge, so every publish would need `refreshProjectDomains` on every active domain (`research: inspect-publish-serve.md:284`). This is a deliberate disagreement with `research: hosting-publish.md:280`, which puts `deploymentId` in the pointer; see section 17.
- Optional later: content-addressed blobs `published/blobs/{sha256}` for cross-build dedupe. Not needed for phase 1.

### 9.4 Worker request path (replaces `apps/edge/src/index.ts:184-207`)

1. Host → pointer (unchanged, `index.ts:171-182`).
2. If the pointer is suspended → 403 (unchanged, `index.ts:180-182`).
3. Read `current.json` (cache it in `caches.default` keyed on host + `/__wandit/current`, 60 s). If missing, fall back to the V1 `current.html` path so V1 sites keep working during migration.
4. `SITES.get(prefix + path)`. If missing and the request accepts HTML or the path has no extension → serve `index.html` with 200 (SPA fallback). Otherwise 404 `no-store`.
5. Set `content-type` from `object.httpMetadata.contentType`, honor `Range`, return the object's cache-control, keep `ETag` and 304 handling.
6. Keep `caches.default` keyed on the full URL; never enable the host-blind `ctx.cache` (`apps/edge/wrangler.jsonc:35-40`).
7. Add per-site security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a baseline `Permissions-Policy`, and a report-only CSP that can grow (`research: security.md:544, 550`).
8. Inject the Cloudflare Web Analytics beacon into `index.html` responses when the project has analytics enabled.

Rollback is a rewrite of `current.json` to an older prefix. Unpublish deletes `current.json` and the slug pointer. Suspend sets the pointer status, as today.

### 9.5 Publish task (`publish-app`, Trigger.dev)

1. Insert a `pending` deployments row under `FOR UPDATE` on the project (reuse `DeploymentsRepository`).
2. Run the security gate (section 12.6). Block on any ERROR.
3. In the sandbox: `pnpm build` (or `npx expo export --platform web` for a mobile project's web target); run `injectPixels`, `injectLeadsRuntime` (or rely on the SDK), and `injectWanditBadge` on `dist/index.html` only; these transforms only need `<head>` and `</body>` (`research: inspect-publish-serve.md:266`).
4. Hash every file; upload in parallel (S3 SDK, parallelism 8) to the immutable prefix with per-object content type and cache-control; verify the upload manifest instead of probing URLs (`research: inspect-publish-serve.md:286`).
5. Write `current.json`; write the slug KV pointer (heals old sites); promote the row (demote-then-promote transaction, unchanged).
6. Register the slug URL and active custom domains as allowed auth redirect URLs in the app's Supabase project (section 6.4).
7. On failure after the flip, restore the previous `current.json` (same compensation pattern as `restorePreviousLiveState`, `sites.service.ts:574-609` per `research: inspect-publish-serve.md:106`).

Drop the HTML-centric passes (`inlineKnownCdnScripts`, `optimizeFontLoading`, `optimizeImageMarkup`, `emitResponsiveImages`) and the relative-URL rejection for `kind = web_app` deployments; Vite emits root-relative `/assets/` URLs on purpose (`research: inspect-publish-serve.md:273-274`).

### 9.6 Schema changes for publish

`deployments`: add `kind` (`static_page | web_app | mobile_ota | mobile_store`), `commitId` (paired FK with `projectId` to `app_commits`), `buildPrefix`, `fileCount`, `bytes`, `buildLogKey`; make the `versions` pairing optional for V2 kinds while keeping `deployments_active_slug_uq` and `deployments_active_project_uq` so V1 and V2 share one slug namespace (`packages/db/src/schema/deployments.ts:55-61`; `research: inspect-data-model.md:356`).

### 9.7 Phase 2: Workers for Platforms

- One dispatch namespace `production`; the dispatch Worker replaces `wandit-edge` and keeps the same KV pointer and `*/*` route; the pointer or `current.json` carries `scriptName` (`research: hosting-publish.md:300-307`).
- One user Worker per deployment, `p-{projectId}-d-{deploymentId}`, tags for cleanup, `dispatcher.get(name, {}, { limits: { cpuMs, subRequests } })`, and an outbound Worker that blocks private ranges and logs egress (`research: hosting-publish.md:303-305`, `research: security.md:546`).
- Static assets through the three-step assets upload on the namespaced script (`research: hosting-publish.md:93-99`).
- Costs: $25 per month, 1,000 scripts included, then $0.02 per script per month; keep at most three builds as scripts and archive older builds to R2 (`research: hosting-publish.md:67-78, 306`).
- Gaps: no preview URLs for user Workers and versions/rollback for namespaced scripts are **UNVERIFIED**; the one-script-per-deployment design works around both (`research: hosting-publish.md:101-106`). Whether static-asset requests through the dispatch Worker are free is **UNVERIFIED**.

### 9.8 Custom domains

No mechanism change. Budget $0.10 per hostname per month after the first 100, 50,000 hard cap on non-Enterprise plans; keep the customer-zone apex workaround (`research: hosting-publish.md:112-118`, `docs/features/edge-serving.md` "Limits worth knowing"). Add a domain ownership check before Cloudflare for SaaS hostname creation (already in the domains module).

### 9.9 Operations

- Add a GitHub workflow that runs `wrangler deploy` for `apps/edge` and the new preview Worker on push to `staging` and `main`; today the edge deploys by hand with no CI (`research: inspect-infra-ops.md:137`).
- Deploy a staging edge Worker bound to the `wandit-staging` bucket on a staging zone or a first-level `staging-*.wandit.app` host set; today staging publishes never reach a real Worker (`research: inspect-infra-ops.md:539`).
- Vitest matrix in `apps/edge/test` for path routing, SPA fallback, content types, ranges, cache headers, and the V1 fallback.

---

## 10. Component 9: streaming, events, background jobs, and reconnect

### 10.1 Choice

Producer in a Trigger.dev task `builder-turn`. Two sinks: a Redis Stream `turn:{turnId}` for the low-latency browser leg through a NestJS SSE route with `Last-Event-ID` replay (the V1 relay code), and a Trigger.dev v2 stream `ui` as the durable copy visible in the dashboard. The browser uses a custom `ChatTransport` whose `sendMessages` POSTs the turn then opens the SSE stream, and whose `reconnectToStream` replays from Redis, so `useChat({ resume: true })` works unchanged (`research: agent-runtime-patterns.md:156-158, 380-425`).

### 10.2 Why

- Trigger.dev gives `signal`, `onCancel` with a 30 s budget, `runs.cancel`, `concurrencyKey` queues, `idempotencyKey`, and machine presets; it already deploys from `apps/server/src/trigger` (`research: agent-runtime-patterns.md:164-174`). Inngest cannot interrupt a running step; BullMQ needs a worker service Railway no longer runs (`research: agent-runtime-patterns.md:177-181`, `research: inspect-infra-ops.md:14`).
- The API has one Railway replica and a browser disconnect would abort an in-request run (`research: inspect-infra-ops.md:471`).
- Trigger.dev Realtime connection caps (Pro 500+) forbid one direct browser subscription per open tab at scale; the API fan-out avoids that (`research: agent-runtime-patterns.md:147`).
- `ChatTransport` has exactly two methods, so no React component changes (`research: agent-runtime-patterns.md:116-127`).

### 10.3 Where Durable Objects fit (Cloudflare)

A Durable Object per project with WebSocket hibernation is a clean fan-out point for presence, queued messages, and multi-tab sync, and it bills nothing while hibernated (`research: agent-runtime-patterns.md:150-154`). Two facts keep it out of phase 1: the harness host needs a Node WebSocket client (`ws` peer dependency) and Node APIs that are only partial in Workers, so the `HarnessAgent` session cannot live in a DO (**UNVERIFIED**, `research: agent-runtime-patterns.md:154, 480`); and a Trigger.dev checkpoint kills any open socket, which means the task must stay the host. Plan: phase 5 moves the browser leg from Redis SSE to a DO WebSocket fed by the task over an HTTP push, and removes the cross-Atlantic Redis hop. Until then, move the Railway Redis from `sfo` to the API's region; today every relay hop crosses the Atlantic (`research: inspect-infra-ops.md:113`).

### 10.4 Turn sequence, lock, cancel, stall

- Submit: auth and workspace scope (V1 guards), credit hold (`reserveWithReplay` with the new `agent_session` operation), Redis lock `SET builder:lock:{projectId} {turnId} NX PX 600000` else 409 `AI_CHAT_TURN_ACTIVE` plus a `queued_messages` row, insert `builder_turns` (partial unique index on active turns), `tasks.trigger('builder-turn', payload, { queue: 'builder-turn', concurrencyKey: projectId, idempotencyKey: turnId, idempotencyKeyTTL: '1h' })`, respond 202 (`research: agent-runtime-patterns.md:412`).
- Boot, attach, stream, watchdog (abort after 4 minutes without a chunk, the V1 pattern), finish (git commit, file list, screenshot, `app_commits` row, `detach()`, settle) (`research: agent-runtime-patterns.md:413-417`).
- Cancel: `runs.cancel(runId)` → `signal` → `onCancel`: `wip` commit, `detach()`, terminal chunk, release lock, refund the unused hold (`research: agent-runtime-patterns.md:427-429`). Bridge behaviour on host abort without `detach()` is **UNVERIFIED**; always kill the bridge and set `maxBudgetUsd` (`research: agent-runtime-patterns.md:461`).
- Fencing: every `XADD`, every `app_commits` row, and every commit message carries `turnId`; a late task from an expired lock cannot overwrite a newer head (`research: agent-runtime-patterns.md:203`).
- Progress for the chat card: `metadata.set` with phase and files, read by the existing `useLiveRun` hook plus the 5 s poll (`apps/web/src/features/workspace/lib/use-live-run.ts:73-93`).

### 10.5 Logs, diagnostics, screenshots

- Dev-server tail from the detached command, browser console and `pageerror` from a Playwright service inside the sandbox, and iframe-posted errors feed `read_preview_diagnostics` and an opt-in "Try to fix" turn capped at two automatic fixes per user turn (`research: agent-runtime-patterns.md:312-329`).
- Move Chromium from the Trigger.dev image into the sandbox image; the turn task then no longer needs `medium-1x` (`research: agent-runtime-patterns.md:335`; `apps/server/trigger.config.ts:16-39`).
- Terminal and log surfaces in the web app are new; the log channel is the same UI-message stream with transient `data-logs` parts, so there is one transport (`research: inspect-web-builder-ui.md:754-757`).

---

## 11. Component 10: metering and credits

### 11.1 Choice

Keep 1 credit = $0.04 of provider cost and route every V2 cost shape through `usdMicrosToCentiCredits` (`packages/env/src/server.ts:118`; `apps/server/src/modules/metering/domain/model-pricing.ts:209-221` per `research: inspect-auth-billing-credits.md:268-277`). Add:

1. Operation `agent_session` (root; children `image`, `video`, `sandbox`, `backend_provision`) with a reserve floor of 500-1,000 cc and a checkpoint path `MeteringService.checkpoint(eventId, { usageDelta, modelId })` that debits deltas with `allowOverdraft: true` under `checkpoint:<eventId>:<n>`, renews the execution lease, and re-checks balance and project cap (`research: inspect-auth-billing-credits.md:529-538`).
2. Settlement from token counts, never from `total_cost_usd`: read `finish.totalUsage` per turn, price with the server-side `model_prices` table (Anthropic list prices, 1-hour cache write rates, 1.1x when `inference_geo` is `us`), store per-model usage in `rawUsage` (`research: unit-economics.md:292`).
3. Reconciliation source: Cloudflare AI Gateway logs, keyed by the `usageEventId` we send in `cf-aig-metadata`; a Trigger cron reads gateway cost per event and writes `ai_provider_call_evidence` rows with a new transport value `cloudflare_ai_gateway` and `costStatus: measured`. This replaces the Vercel AI Gateway generation-id path for harness traffic. Whether the AI Gateway logs API exposes per-request cost for BYOK Anthropic requests is **UNVERIFIED**; the spend-limits page states costs are known "for models with known pricing", which implies a price table exists.
4. Operation `sandbox` (measured, `unit: "minute"`): reserve N minutes at start, heartbeat every minute, settle from `activeSeconds / 60` with the vendor rate as `rateUsdMicrosPerUnit`; either included in the plan (`customerBillable: false`) or shown as 0.1 credit per minute (`research: inspect-auth-billing-credits.md:546-549`, `research: unit-economics.md:297`).
5. Backends as plan entitlements plus `backend_provision` (fixed) and `backend_hosting` (measured, monthly cron with key `hosting:<projectId>:<yyyy-mm>`) evidence rows (`research: inspect-auth-billing-credits.md:555-561`).
6. Mobile preview minutes: per-plan allowance then 2 credits per minute (`research: unit-economics.md:298`).
7. `projectId` on `ai_usage_events` plus a `project_cost_caps` table; enforce hard at reserve and at each checkpoint, soft at settle; new error `PROJECT_CREDIT_CAP_REACHED` (403) and a `data-billing-error` variant (`research: inspect-auth-billing-credits.md:567-574`).
8. Tighten admission for long runs: replace "any positive balance admits the full reserve" with a real floor for `agent_session`, and a DB-backed concurrency cap per actor and per project (`research: inspect-auth-billing-credits.md:526, 538`).
9. Backstops outside our code: an AI Gateway spend limit per user through `cf-aig-metadata`, a separate Anthropic workspace for V2 with its own spend cap, and the per-run `maxBudgetUsd` (`research: security.md:376`).

### 11.2 What the current plans buy

At the anchor, a typical Sonnet 5 feature message costs about 10 credits, a simple edit 4, a large build 35; the Pro base tier (175 credits, $25) buys about 17 typical messages at a 72 percent AI margin, versus about 100 messages on Lovable's $25 plan (`research: unit-economics.md:259-288`). This is a founder pricing decision: cheaper loop (Haiku or low effort, fewer steps) or a lower margin per tier. Measure real step counts in the preview environment for two weeks before setting prices. Show an estimate before and a receipt after each run.

---

## 12. Component 11: security controls

### 12.1 Trust boundaries and the rules

`research: security.md` sections 1-16 are the checklist. The Cloudflare-native decisions below map to it.

1. Sandbox: dedicated kernel per run (Vercel Firecracker day one; Cloudflare "its own VM" target), non-root user inside, one sandbox per project, never shared across users, egress deny-by-default with an explicit allowlist (LLM proxy, npm registry, the project's `<ref>.supabase.co`, R2 presigned host, preview host), denied CIDRs `169.254.0.0/16`, `10/8`, `172.16/12`, `192.168/16`, `100.64/10`, `127/8`, `fd00:ec2::/32`, `fd20:ce::/32`; no `subnets.allow` (`research: security.md:280-290`).
2. No secret in the VM: `ANTHROPIC_API_KEY=""`, the run token only, Supabase secret key and Stripe key injected by the egress proxy or control-plane tools, `.env` limited to publishable values (`research: security.md:488-489`).
3. Agent controls: `disallowedTools` for `WebFetch` and `WebSearch` unless needed, `PreToolUse` hook that denies writes to `.claude/`, `.mcp.json`, `.git/hooks`, shell rc files and any path outside the workspace, `settingSources: []` so imported repos cannot load settings, secret-shape scanner on every file write and chat message, `PostToolUse` audit hook and OTel export with `userId` and `projectId` (`research: security.md:499-512`).
4. Prompt injection: fetched pages, uploads, imported repos, and database rows are data; the egress allowlist removes the exfiltration leg of the lethal trifecta (`research: security.md:307-320`).
5. Preview isolation: separate registrable domain, one origin per project and run, signed short-lived token, `frame-ancestors` header, no `allow-top-navigation`, PSL entry (section 8).
6. Publish gate (10-15 s, Lovable pattern): `GET /v1/projects/{ref}/advisors/security` and block on ERROR; anonymous RLS probe per table with the publishable key; secret-shape scan of `dist/`; static phishing rules (login forms posting off-project, bank and wallet brand names plus a password field, obfuscated JS, hidden iframes); slug brand look-alike check; Cloudflare URL Scanner or Google Web Risk on the live preview for new accounts; hold suspicious publishes for review (`research: security.md:404-420`, `research: hosting-publish.md:358-365`).
7. Takedown: keep `status: "suspended"` on the pointer (`apps/edge/src/index.ts:180-182`), add `suspended_reason`, an audit row, a user notice, a one-call project suspend, `abuse@wandit.app`, and a public form; Cloudflare disables hosted content on valid notices, so we must catch abuse first (`research: security.md:360-364`).
8. Rate limits and caps: Redis-backed per-route limits (the in-memory guard at `apps/server/src/modules/domains/presentation/http/guards/rate-limit.guard.ts:30` and the lead throttle must move before a second API instance), publish rate limit per account, verified email before first publish, payment method before a custom domain, a mining detector (sustained CPU with no file writes), per-project Supabase pause on overuse (`research: security.md:366-378, 424-430`).
9. Audit: an `audit_events` table for every privileged action; V1 has none (`research: security.md:434-441`).
10. Data residency: Anthropic `inference_geo` supports only `global` and `us`, default 30-day retention, ZDR excludes Fable and Mythos models; Supabase specific EU regions; Cloudflare Data Localization Suite is Enterprise-only. Publish a subprocessor list and a per-project data map; document 30-day retention in the privacy policy (`research: security.md:447-453`).

### 12.2 Cloudflare-specific security wins

- Outbound handlers hold secrets outside the sandbox (fetched, section 3.3).
- Workers for Platforms outbound Workers and per-Worker CPU and subrequest limits for published dynamic apps (`research: hosting-publish.md:87-88`).
- AI Gateway spend limits and authenticated gateway tokens as cost backstops (fetched, section 2.6).
- URL Scanner API for pre-publish phishing checks; rate limits and price **UNVERIFIED** (`research: hosting-publish.md:352`).
- One-zone blast radius is the cost: an abuse action against `wandit.app` hits every customer; the pre-publish gate is the mitigation (`research: hosting-publish.md:348, 375`).

---

## 13. Component 12: how V2 lives in the monorepo and the rollout

### 13.1 Server

- New module `apps/server/src/modules/app-builder/` (light-DDD layout). Mount it in `apps/server/src/app.module.ts` after `WorkspacesModule` (line 67) with `...(env.V2_BUILDER_ENABLED ? [AppBuilderModule] : [])`, copying the `QueuesModule` gate (`apps/server/src/infrastructure/queues/queues.module.ts:16-41`). Global guards then apply unchanged (`research: inspect-infra-ops.md:466-468`).
- Controllers under `@Controller("v2/...")` so routes land at `/api/v2/*`. Contracts in `packages/contracts/src/v2/*` exported from the package index.
- New env group in `packages/env/src/server.ts`, all optional at boot and checked at call time: `V2_BUILDER_ENABLED`, `VERCEL_SANDBOX_TOKEN` + team and project ids (day one), `CF_SANDBOX_*` bindings later, `LLM_PROXY_SIGNING_KEY`, `CF_AIG_TOKEN` + gateway id, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_ORG_SLUG`, `APP_SECRETS_ENCRYPTION_KEY`, `PREVIEW_DOMAIN`, `PREVIEW_TOKEN_SIGNING_KEY`, `EXPO_TOKEN`, `APPETIZE_API_TOKEN` (`research: inspect-infra-ops.md:499-512`).
- Trigger.dev tasks in `apps/server/src/trigger/`: `builder-turn`, `publish-app`, `provision-backend`, `sandbox-idle-sweep` (schedule), `git-integrity-check` (schedule), `backend-pause-sweep` (schedule), `hosting-charge` (schedule). Use the main Trigger project with new queues; the unreferenced `wandit-v2-experiment` project only if V2 needs different secrets (`research: inspect-infra-ops.md:474`).
- Streaming route: copy the `ai-stream` pattern (`@SkipResponseEnvelope()`, `reply.hijack()`, manual CORS) and add `Last-Event-ID` handling from the legacy relay (`research: inspect-infra-ops.md:470-473`). Add new request headers to the CORS allowlist in `main.ts` first.

### 13.2 Database

Additive migrations only, following the attempt-row and composite-FK conventions (`research: inspect-data-model.md:323-332`):

- `projects`: `engine` (`v1_page | v2_app`, default `v1_page`), `platform` (`web | mobile`), `template`, `currentBranch` default `main`, `backendId`.
- New: `app_commits`, `app_bundles`, `app_branches`, `builder_sessions`, `builder_turns` (the V2 attempt row with `failure_*` and `sentry_event_id`), `queued_messages`, `preview_diagnostics`, `app_backends`, `project_secrets`, `app_integrations`, `app_builds`, `mobile_builds`, `preview_sessions`, `project_cost_caps`, `audit_events`.
- Extended: `deployments` (section 9.6), `chats` (`title`, `branch`), `messages` (`turnId`), `ai_usage_events` (`projectId`), enums `ai_usage_operation` and `ai_cost_transport`, `product_settings.v2BuilderEnabled`, `lifecycle_events.event` values.
- Untouched: `artifacts`, `versions`, `page_generation_attempts` stay V1-only (`research: inspect-data-model.md:401-403`).

### 13.3 Web

- Reuse the `/p/$projectId` route and `WorkspacePage` shell. `WorkspacePage` reads `project.engine`; `v2_app` mounts `AppWorkspace` from `apps/web/src/features/app-builder/` with the same header, resizable split, and providers (`research: inspect-web-builder-ui.md:702-705, 808-811`).
- New surfaces: URL preview frame with loading state, file tree and code/diff viewer (Shiki), log stream panel, harness tool cards in the `MessageParts` registry, versions list on `app_commits`, Cloud tab (database, users, storage, secrets, logs, functions, jobs, emails), mobile device panel with QR (`research: inspect-web-builder-ui.md:741-783`).
- Gate: `beforeLoad` reads public settings (`v2BuilderEnabled`) and the PostHog flag `app-builder`; the server guard `AppBuilderEnabledGuard` checks both, so a client-only flag cannot be spoofed (`research: inspect-infra-ops.md:487-497`).
- Message history pagination is required; harness transcripts grow fast (`research: inspect-web-builder-ui.md:803-804`).

### 13.4 Edge

Two Workers in the account: `wandit-edge` (extended, section 9) and `wandit-preview` (new zone, section 8), plus `wandit-llm-proxy` on `llm.wandit.app` (a route exclusion on the `wandit.app` zone is needed for that host, like `api.wandit.app`, `docs/features/edge-serving.md` setup item 3). All three get a `wrangler deploy` workflow.

### 13.5 Rollout

1. `feat/v2-builder` → `dev`: Vercel preview builds the web; the module is not mounted anywhere.
2. Fix staging first: attach `staging.wandit.dev` to the staging branch and set `CORS_ORIGIN` so feature previews can log in; today the staging web is cross-site with the staging API (`research: inspect-infra-ops.md:173-178, 537`). Set `V2_BUILDER_ENABLED=true` and V2 secrets on Railway staging and Trigger staging. Deploy the staging edge Worker.
3. `dev` → `staging`: Railway migrates and redeploys, Trigger staging deploys, edge staging deploys. Internal testing with the Supabase preview org (10 projects, list prices).
4. `staging` → `main` with `V2_BUILDER_ENABLED=false` in production. Code ships, module does not mount.
5. Flip production on with `product_settings.v2BuilderEnabled=false`; enable per user through the PostHog flag; migrate users in cohorts.
6. Add CI for `check-types` and `vitest` before step 3; today no automated test runs before staging (`research: inspect-infra-ops.md:150`).

---

## 14. Component 13: migration of V1 projects and the leads feature

### 14.1 Projects

- V1 keeps working untouched. `projects.engine` defaults to `v1_page`; V1 code paths never read the new columns (`research: inspect-data-model.md:405-408`).
- "Upgrade to app" is a one-way import: read the latest `versions.r2Key` HTML, create a V2 project from the web template, place the HTML as `public/legacy/index.html` plus a first `app_commits` row with `source: 'import'`, then run one harness turn with the prompt "convert this static page into the app template, keep the design and the lead form contract". The V1 project stays as a fallback until the user publishes from V2; the slug moves at that publish because both engines share `deployments_active_slug_uq` (`packages/db/src/schema/deployments.ts:55-57`).
- Existing custom domains follow the project id; the KV pointer does not change (`research: inspect-publish-serve.md:261-262`).
- The V1 Page tab, inline editor, versions, and cheerio edit tools stay mounted for `v1_page` projects. No user is forced to migrate.

### 14.2 Leads

- Keep `POST /api/public/leads/{publicFormId}` unchanged: cross-origin `origin: "*"`, keyed by an unguessable uuid, honeypot, E.164 normalization, duplicate window, push, Sheets, exports (`research: inspect-connectors-media-leads.md:313-317`).
- Replace publish-time `</body>` injection with `@wandit/leads`, a small SDK in `packages/leads-sdk` copied into the template: posts `leadCaptureBodySchema` JSON with `credentials: "omit"`, `keepalive`, retries on 429/5xx with `Retry-After`, adds attribution on web, sends `_hp` when a hidden field exists, fires `fbq`/`ttq` Lead and Purchase after a 2xx, emits `wandit:lead:result`, and listens for the `wandit:lead` DOM event so the COD worlds' prompt contract stays valid (`research: inspect-connectors-media-leads.md:273-279`). Currency comes from config; V1 hard-codes DZD.
- Pixels come from public env values written at session start and at build time from `projects.metaPixelId` and `tiktokPixelId`, so `getAdsTrackingFacts` keeps its meaning (`research: inspect-connectors-media-leads.md:286`).
- `deploymentId` stays optional; the capture service falls back to the active deployment (`research: inspect-connectors-media-leads.md:280`).
- Expo apps send `platform: "app"` in extras and accept `source = direct` until an app-install attribution field exists.
- Move the in-process capture throttle to Redis before a second API instance (`research: inspect-connectors-media-leads.md:333`).
- Reading or writing leads from inside a generated app (merchant admin screens) needs a new project-scoped token type; keep it out of V2.0 (`research: inspect-connectors-media-leads.md:285`).
- COD orders stay `leads` rows with order extras; app-native Supabase tables are the app's own data; the SDK can dual-write (`research: inspect-connectors-media-leads.md:300-303`).

### 14.3 Retire

`apps/worker` BullMQ chat path, `use-project-chat.tsx`, `ChatMessageView`, `docs/features/chat-generation.md`, and PRD section 7 on BullMQ are superseded; mark them before writing V2 docs (`research: inspect-ai-pipeline.md:412`, `research: inspect-web-builder-ui.md:830-831`).

---

## 15. Component 14: phased delivery plan

Effort is in engineer-weeks (ew) for one senior engineer who knows this repo, plus review. Numbers are **ESTIMATE**. Phases are shippable slices; each ends in the staging environment with the flag on.

| Phase | Slice | Contents | Effort |
|---|---|---|---|
| P0 | Spike: harness turn end to end | Upgrade `ai` to 7.0.91; `builder-turn` Trigger task with `HarnessAgent` + Vercel Sandbox; LLM proxy Worker in front of Cloudflare AI Gateway (fallback Vercel AI Gateway); Redis stream sink; `BuilderTransport` with reconnect; git commit per turn; preview through a temporary `wandit-preview` Worker on the new zone. Exit criteria: caching works through the gateway, `useChat` renders harness parts, cost per message measured on 20 real prompts. | 3 ew |
| P1 | Web app alpha (landing pages and static web apps) | `app-builder` module, contracts v2, schema (commits, bundles, branches, sessions, turns, secrets, caps), web template with CLAUDE.md and leads SDK, harness tool cards, file tree and diff view, versions and restore, `agent_session` metering with checkpoints, sandbox idle policy, preview domain and token, publish task and `wandit-edge` path routing with V1 fallback, edge CI, security basics (egress policy, deny rules, secret scan, audit table), staging same-site fix. | 10 ew |
| P2 | Cloud tab (Supabase on behalf) | `provision-backend` task, Management API queue, `app_backends`, `project_secrets`, host tools for migrations and SQL and functions and advisors, Cloud tab panels (database, users, secrets, logs, functions, jobs), Resend per-tenant sender, user Stripe key, publish gate with advisors and RLS probe, pause and restore sweeps, auth redirect registration at publish and domain activation, Supabase partnership request. | 8 ew |
| P3 | Mobile phase 1 | Expo template pinned to store Expo Go, `mobile` composer mode, Expo web preview in the phone frame, QR through the preview proxy with Metro WebSockets, EAS internal distribution flow, module allow-list enforcement. | 4 ew |
| P4 | Cloudflare sandbox and preview app | Custom `HarnessV1SandboxProvider` for Cloudflare Sandbox SDK; R2 backup and git rebuild on wake; outbound handlers with credential injection; acceptance tests in 3.5; migrate projects provider by provider. In parallel: wandit dev-client preview app on TestFlight and Play internal testing; Appetize on-demand embed with minute caps. | 6 ew (3 sandbox, 3 preview app) |
| P5 | Power features | Workers for Platforms for SSR apps with outbound Worker and limits; branch per chat with `Sandbox.fork` previews and AI merge; export to GitHub; visual click-to-target through a Vite source plugin; Durable Object WebSocket fan-out replacing the Redis SSE leg; Stripe Connect. | 8 ew |
| P6 | Device streaming | Self-hosted Android emulators on KVM with WebRTC; Mac mini pool with `serve-sim` behind an authenticated proxy after legal review. | 6 ew plus legal |

Total to a general-availability web plus mobile phase 1 (P0-P3): about 25 engineer-weeks. P4-P6 add about 20 more.

Dependencies outside engineering: Anthropic licensing confirmation (before external users), Supabase partnership terms (before P2 pricing), preview domain purchase and PSL submission (P0), Cloudflare Workers Paid confirmation and API token scopes (P1), Apple and Google developer accounts for the preview app (P4).

---

## 16. Component 15: cost per active project per month

Assumptions (**ESTIMATE**, measure in P0): Sonnet 5 at medium effort with 1-hour caching; a typical message costs $0.44 all-in (`research: unit-economics.md:238-247`); a warm sandbox hour costs $0.13 on Vercel at 10-25 percent CPU or about $0.10 on Cloudflare standard-3 (`research: sandboxes.md:308-322`); one 3 GB snapshot at $0.08 per GB-month; preview traffic 1-2 GB per month at $0.15 per GB on Vercel exposed ports (zero on Cloudflare within the 1 TB included); git data about 10 MB per project at $0.015 per GB-month plus Class A ops; hosting on the extended edge Worker about $0.05 per project-month at $0.30 per million requests; Supabase Micro $9.81 per month while running (`research: backend-on-behalf.md:147`); Appetize $0.06 per minute (`research: unit-economics.md:143`); EAS $1-2 per build after the free 15 per platform (`research: expo-mobile.md:81`).

| Profile | Messages | Warm hours | Tokens | Sandbox | Snapshot + git | Preview egress | Hosting | Backend | Mobile | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| A. Landing page, no backend | 30 | 10 | $13.20 | $1.30 | $0.25 | $0.15 | $0.05 | $0 | $0 | about $15 |
| B. Web app with backend | 60 | 20 | $26.40 | $2.60 | $0.25 | $0.30 | $0.05 | $9.81 | $0 | about $39 |
| C. Mobile app with backend | 60 | 20 | $26.40 | $2.60 | $0.25 | $0.30 | $0.05 | $9.81 | $3.80 (30 Appetize minutes + 1 EAS build) | about $43 |
| D. Idle project (no messages) | 0 | 0 | $0 | $0 | $0.25 | $0 | $0.05 | $0 (paused) | $0 | about $0.30 |

Readings:

- Tokens are 85-90 percent of an active project's cost. The sandbox choice moves the total by less than $1; choose the sandbox on isolation, adapter support, and persistence, not price (`research: unit-economics.md:118`).
- On the Cloudflare Sandbox target, profile B drops by about $0.90 (sandbox $2.00 and egress $0), so the migration is not a cost play.
- A running Supabase backend costs more than the whole Pro base tier's AI budget ($7 of provider cost at 175 credits); backends must be entitlements or partner-priced (`research: unit-economics.md:135, 315`).
- Fixed platform costs, not per project: Vercel Pro $20 (sandbox), Workers Paid $5, Workers for Platforms $25 (P5), Supabase Pro $25 per org, Appetize Starter $59 (P4), Trigger.dev plan (**UNVERIFIED**, not researched), Anthropic organization TPM limits to raise before migration (`research: unit-economics.md:316`).
- Custom domains add $0.10 per hostname per month after the first 100 (`research: hosting-publish.md:112`).

---

## 17. Where the research files disagree, and the call made here

| Topic | Report A | Report B | Call |
|---|---|---|---|
| Where the per-publish flip lives | `research: inspect-publish-serve.md:284` recommends an R2 flip object; KV is eventually consistent and the domains pipeline writes pointers without deploy knowledge | `research: hosting-publish.md:280` puts `deploymentId` in the KV pointer | R2 flip object `current.json`; KV keeps `projectId` only |
| Cloudflare Sandbox isolation | `research: security.md:112, 130` calls it a container tier without a dedicated kernel | `research: sandboxes.md:145` and the Containers page fetched here say "Each container instance runs inside its own VM" | Cloudflare states own VM per instance; the hypervisor is unnamed; treat it as VM isolation for planning and confirm with Cloudflare before P4 |
| Claude Code through Cloudflare AI Gateway | `research: security.md:181` says the docs tell users to set `ANTHROPIC_BASE_URL` to the gateway for Claude Code | The Anthropic provider page fetched here does not mention Claude Code or the Agent SDK | **UNVERIFIED**; the P0 spike tests it; the proxy Worker can switch upstream to the Vercel AI Gateway |
| Sandbox for day one | `research: sandboxes.md:326` and `research: security.md:130` rank Vercel Sandbox first and E2B second | This proposal's Cloudflare-native angle | Vercel first, Cloudflare target with acceptance tests; E2B stays the fallback if a custom provider is needed anyway |
| Preview host | `research: hosting-publish.md:292` and `research: inspect-publish-serve.md:278` use a first-level host on `wandit.app` | `research: security.md:341` requires a separate registrable domain | Separate domain; the builder-cookie risk outweighs the convenience |
| Streaming producer to browser | `research: inspect-infra-ops.md:472` offers Trigger Realtime direct to the browser | `research: agent-runtime-patterns.md:147` warns about connection caps | Redis SSE leg through the API, Trigger stream as durable copy, DO fan-out later |
| Trigger project | `research: inspect-infra-ops.md:474` suggests `wandit-v2-experiment` only if secrets differ | same report earlier lists it as an option | One project, new queues |
| Sandbox minutes billing | `research: inspect-auth-billing-credits.md:549` leaves it open | `research: unit-economics.md:297` suggests included or 0.1 credit per minute | Included in plan with evidence rows, 10-minute idle stop; revisit with data |

---

## 18. Biggest risks

1. Anthropic terms. The Claude Code in-products clause versus the Agent SDK clause for a hosted-sandbox harness paid with wandit's key is **UNVERIFIED**. A wrong answer removes the runtime. Mitigation: written confirmation before external users; Option B (Agent SDK direct) reuses everything; Managed Agents is the last fallback.
2. `@ai-sdk/harness` is experimental with breaking changes between releases, and the bridge pins the Agent SDK 14 patches behind npm (`research: ai-sdk-harness.md:44, 204`). Mitigation: pin versions, wrap behind a wandit `AgentRuntime` port, keep Option B ready.
3. Only Vercel ships a harness sandbox provider. The Cloudflare provider is custom work against an interface with no public third-party example (`research: sandboxes.md:279`). Mitigation: acceptance tests and a time box; Vercel stays if the spike fails.
4. Cloudflare AI Gateway may not pass `anthropic-beta`, `cache_control`, or SSE pings unchanged; prompt caching would silently stop and cost would double (`research: security.md:162-172`, `research: unit-economics.md:310`). Mitigation: measure `cacheReadInputTokens` in P0; switch upstream if needed.
5. Cloudflare Sandbox sleep erases the workspace; a slow wake (install plus dev server) hurts the "user returns" moment. Mitigation: baked image with the pnpm store, R2 backup, git rebuild, and the 60-second p95 target before migration.
6. Vercel preview ports are public; a leaked URL exposes source bundles. Mitigation: the preview proxy is mandatory in P0, not later.
7. Generated apps ship without RLS (CVE-2025-48757 class) or as phishing pages on our zone; Cloudflare disables hosted content on valid notices and one zone serves every customer (`research: security.md:396-397`, `research: hosting-publish.md:348`). Mitigation: the publish gate and the suspend switch in P1 and P2.
8. Unit economics: about 17 typical messages for $25 at the current anchor versus about 100 on Lovable (`research: unit-economics.md:288`). Mitigation: measure in P0; decide effort, model, and margin before GA.
9. Supabase idle cost of about $9.8 per running project per month; 1,000 always-on projects cost about $9.8k (`research: backend-on-behalf.md:141-147`). Mitigation: entitlements, 7-day pause, partnership for Nano.
10. Trigger.dev checkpoints kill the bridge WebSocket on any long wait; a Redis cross-Atlantic hop slows every chunk (`research: agent-runtime-patterns.md:460-462`). Mitigation: detach before waits; move Redis to the API region before P1.
11. Expo Go SDK drift and loading policy can break the mobile phase 1 preview on Expo's schedule (`research: expo-mobile.md:326`). Mitigation: start the dev-client app in P4.
12. No CI for tests or types today; a V2 regression can reach staging unchecked (`research: inspect-infra-ops.md:150`). Mitigation: CI in P1.

---

## 19. Open questions and UNVERIFIED items

For Zack:

1. Preview domain name and purchase (`wanditpreview.app` or another). Is the earlier planned preview domain already bought (`research: inspect-publish-serve.md:243`)?
2. EU region requirement for the sandbox at launch (`cdg1` on Vercel; no pin on Cloudflare).
3. Accept about 17 typical messages for $25 at 72 percent AI margin, or lower the margin toward the 35-65 percent competitor range?
4. Backends as entitlements (Pro 1, Business 3) and pause after 7 days: acceptable?
5. HeroUI Native + Uniwind in generated mobile apps, or plain Expo components?
6. Must generated apps be AR/FR from day one?
7. Which Cloudflare plan is the account on (Workers Paid needed for Containers and Sandbox), and what scopes does `CLOUDFLARE_API_TOKEN` have?
8. Mobile preview first target: browser device (needs Appetize) or the user's phone (free)?

UNVERIFIED (carried from the research and this proposal):

- Whether `@ai-sdk/harness-claude-code` forwards Agent SDK hooks (`PostToolUse`, `Stop`) and accepts `sessionStore`; whether `harnessMetadata['claude-code']` exposes `total_cost_usd`; bridge behaviour on host abort without `detach()`.
- The `HarnessV1SandboxProvider` effort for Cloudflare Sandbox; whether the Vercel universal image includes git and Chromium.
- Cloudflare AI Gateway pass-through of Claude Code beta headers, caching markers, and pings; per-request cost in gateway logs for BYOK Anthropic; whether the gateway can be the sole reconciliation source.
- Cloudflare Sandbox: hypervisor technology, DO placement relative to the Railway API region, egress behaviour for UDP/QUIC, backup size limits, instance-type selection per sandbox.
- Vercel Sandbox `cdg1` rates; E2B paused-state storage price.
- Workers for Platforms: preview URLs, versions and rollback for namespaced scripts, static-asset request billing through the dispatcher, script size limit.
- Supabase: project claim flow details, per-org project caps, creation and restore durations, whether secrets are readable back, Resend SMTP host and port for auth email, hosted MCP tool names.
- Anthropic: the licensing clause that applies; ZDR availability for the chosen model; EU inference regions on Bedrock or Vertex.
- Expo: whether the App Store Expo Go binary is SDK 57 today; whether dev-server loading stays unrestricted; whether Appetize devices can reach an arbitrary public Metro host.
- Apple macOS SLA position on streaming simulators to customers (Sequoia SLA read; Tahoe presumed the same).
- Trigger.dev plan pricing and Realtime connection caps for the chosen plan.
- Repo: production values of `AI_CHAT_MODEL` and `AI_PAGE_BUILDER_MODEL`; whether staging and production use separate databases; whether `mcp_connections` tokens are encrypted (the connectors report says yes, with `BETTER_AUTH_SECRET`, at `token-crypto.ts:13-29`; the data-model report says UNVERIFIED); who deploys `wandit-edge`; the two extra Railway projects.
- All step counts, token sizes, resume times, and per-project cost numbers in sections 15 and 16 are estimates until measured in P0.

---

## 20. Sources

Sibling reports in `docs/v2/research/` (all dated 2026-09-03): `inspect-ai-pipeline.md`, `inspect-publish-serve.md`, `inspect-data-model.md`, `inspect-web-builder-ui.md`, `inspect-auth-billing-credits.md`, `inspect-infra-ops.md`, `inspect-native-and-simulator.md`, `inspect-connectors-media-leads.md`, `inspect-product-docs-and-references.md`, `ai-sdk-harness.md`, `sandboxes.md`, `competitor-architectures.md`, `backend-on-behalf.md`, `expo-mobile.md`, `hosting-publish.md`, `git-versioning.md`, `security.md`, `unit-economics.md`, `agent-runtime-patterns.md`. Each report lists its own primary sources.

Repo files read directly for this proposal (worktree `.claude/worktrees/v2-builder`):
- `apps/edge/src/index.ts` (lines 13-17, 45-59, 120-207)
- `apps/edge/wrangler.jsonc` (lines 17-41)
- `apps/server/src/app.module.ts` (lines 57-93)
- `apps/server/src/infrastructure/queues/queues.module.ts` (lines 16-48)
- `apps/server/src/infrastructure/storage/r2.ts` (lines 28-94)
- `apps/server/trigger.config.ts` (lines 16-39, 43-63)
- `apps/server/package.json` (lines 23-45)
- `packages/env/src/server.ts` (lines 113-118, 226-234)
- `packages/db/src/schema/deployments.ts` (lines 15-76)
- `docs/features/edge-serving.md` ("One-time Cloudflare dashboard setup" items 3-6, "Limits worth knowing")

Cloudflare documentation fetched on 2026-09-03 for this proposal:
- https://developers.cloudflare.com/sandbox/
- https://developers.cloudflare.com/sandbox/concepts/sandboxes/
- https://developers.cloudflare.com/sandbox/concepts/backup-restore/
- https://developers.cloudflare.com/sandbox/concepts/preview-urls/
- https://developers.cloudflare.com/sandbox/guides/outbound-traffic/
- https://developers.cloudflare.com/sandbox/configuration/sandbox-options/
- https://developers.cloudflare.com/sandbox/platform/limits/
- https://developers.cloudflare.com/sandbox/platform/pricing/ (defers to Containers pricing)
- https://developers.cloudflare.com/containers/platform-details/architecture/
- https://developers.cloudflare.com/containers/platform/limits/
- https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/
- https://developers.cloudflare.com/ai-gateway/features/
- https://developers.cloudflare.com/ai-gateway/features/spend-limits/
- https://developers.cloudflare.com/ai-gateway/integrations/claude-code/ (404)
- https://developers.cloudflare.com/ai-gateway/features/byok/ and /configuration/byok/ (404; BYOK behaviour taken from the Anthropic provider page)
