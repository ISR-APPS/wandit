# wandit V2 architecture proposal: vendor-managed, lowest ops

Date: 2026-09-03. Branch: `feat/v2-builder` (same as `dev` at `1b2a9a1e`).
Author: Claude Fable (principal-engineer proposal, read-only; no code changed).
Angle: lean on managed services. Optimize for the smallest team and the least on-call load. Quantify lock-in and cost.

Evidence marks:
- `path:line` = a file in this worktree, read on 2026-09-03.
- URL = a vendor page. The URLs come from the sibling research reports in `docs/v2/research/`, which fetched them on 2026-09-03. I did not re-fetch them. Each URL cites the report that fetched it.
- `UNVERIFIED` = not confirmed from a primary source.
- `DISAGREEMENT` = two research reports give different answers. I state which one this proposal follows and why.

Inputs: all 19 files in `docs/v2/research/` (nine `inspect-*.md` reports on V1 and ten topic reports).

---

## 0. Summary

1. Run Claude Code inside a Vercel Sandbox through the AI SDK v7 `HarnessAgent` and the `@ai-sdk/harness-claude-code` adapter. The host of the session is a Trigger.dev task, not the API request. This replaces the 2,440-line hand-built site builder (`docs/v2/research/inspect-product-docs-and-references.md`, summary) with a vendor-maintained loop and tool set.
2. Use one persistent Vercel Sandbox per project. Snapshot on stop, resume on demand. Rebuild from git bundles in R2 when a snapshot is gone.
3. Generate Vite + React + TypeScript + Tailwind + shadcn + React Router (library mode) + `supabase-js` web apps. Generate Expo apps for mobile with a pinned SDK and a module allow-list.
4. Rent Supabase under wandit-owned organizations (Lovable Cloud model) through the Management API and the Supabase for Platforms program. Provision lazily. Pause idle backends. Build an exit door (claim flow) from day one.
5. Keep git as the file source of truth inside the sandbox. One commit per assistant turn. Bundles to R2. Postgres holds the version list.
6. Serve web previews from the sandbox dev server through a small Cloudflare Worker proxy on a separate registrable preview domain with a signed token. Serve mobile previews as Expo web in the same iframe and as an Expo Go QR code. Add Appetize on demand later. Do not build a Mac pool.
7. Publish static bundles through the existing `wandit-edge` Worker, R2, KV pointer, and Cloudflare for SaaS. Build inside the sandbox. Move to Workers for Platforms only for SSR apps in a later phase.
8. Stream turns with Trigger.dev Realtime streams v2 relayed by the API as SSE. Reconnect with `useChat({ resume: true })` and a custom `ChatTransport`. Skip a Redis stream on day one.
9. Meter tokens through the existing centi-credit ledger with a new `agent_session` operation and checkpoint debits. Price from token counts and a server-side price table. Make backends plan entitlements, not credits.
10. Mount V2 as one NestJS module behind `V2_BUILDER_ENABLED`, one `contracts/v2` folder, one web feature folder, and new tables that copy the V1 attempt-row pattern. Roll out dev, then staging, then production behind a per-user flag.

Team: two to three engineers. Estimated delivery to a public beta: about 44 engineer-weeks over six phases (section 14).

Cost per active web project: about USD 12 to 13 per month without a backend, about USD 16 to 22 with a Supabase backend at list price (section 15). Idle project: about USD 0.25 per month.

The three largest risks: the Anthropic terms for the Claude Code CLI inside a hosted sandbox are `UNVERIFIED`; `@ai-sdk/harness` is experimental and only Vercel Sandbox has an adapter; Supabase per-project idle cost needs a partner deal.

---

## 1. What "lowest ops" means in this proposal

Rules used to make every choice:

1. Prefer a service with an SLA and a support channel over a process wandit runs.
2. Prefer a service that wandit already pays for (Cloudflare, Trigger.dev, Vercel, Supabase account, Resend, Stripe) over a new vendor.
3. Accept a higher unit price when it removes a deployable, a queue, a host, or an on-call rotation.
4. Every vendor choice gets an exit path with a stated cost in engineer-weeks (section 16).
5. No self-hosted sandboxes, no self-hosted git server, no Mac pool, no emulator fleet, no LLM proxy that wandit runs.

What wandit operates today (from `docs/v2/research/inspect-infra-ops.md`, summary): Vercel (web and admin SPAs), Railway (one NestJS API and one Redis), Trigger.dev cloud (20 tasks), Cloudflare (R2, KV, one Worker), Expo EAS, Postgres. This proposal adds zero self-run services. It adds three vendor relationships: Vercel Sandbox (same Vercel account), Supabase for Platforms, and later Appetize.

---

## 2. Component 1: agent runtime and harness

### Choice

`HarnessAgent` from `@ai-sdk/harness` with `@ai-sdk/harness-claude-code`, sandbox provider `@ai-sdk/sandbox-vercel`. Model calls go through the Vercel AI Gateway Claude Code endpoint. The Claude Agent SDK direct path is the fallback.

### Why

- The adapter gives the loop, the file tools (`read`, `write`, `edit`, `bash`, `glob`, `grep`), permission modes, compaction, session park and resume, skills, and structured output. Wandit writes only host tools. Evidence: `docs/v2/research/ai-sdk-harness.md:84-157`.
- The stream is the same `createUIMessageStream` writer that V1 uses today (`apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts:1020`, cited at `ai-sdk-harness.md:182`). Custom `data-*` parts (credits, errors, phase, files) share the stream. `useChat` on web and native needs no change beyond the API URL (`docs/v2/research/inspect-native-and-simulator.md`, summary).
- Host tools use the same `toolApproval` map that V1 passes (`apps/server/src/modules/ai-chat/agent/chat-agent.ts:476`, cited at `ai-sdk-harness.md:150`).
- Anthropic Managed Agents is the only more-managed option. It is rejected as the interactive engine because its cloud sandbox has no documented preview port, it has no AI SDK adapter, it is beta, and it is Claude-only (`ai-sdk-harness.md:376-423`). It stays a candidate for background jobs.
- The Agent SDK direct path (Option B in `ai-sdk-harness.md:440-444`) needs wandit to own the process supervision, the SDK-message-to-UI mapping, and the multi-tenant isolation. That is more ops, so it is the fallback only.

### Configuration

- `permissionMode: 'allow-all'` for built-in tools inside the VM. The sandbox is the blast radius. Shell approvals would make the product unusable for non-technical users (`docs/v2/research/agent-runtime-patterns.md:441`).
- `toolApproval: 'user-approval'` only for host tools that spend money or publish (`publish`, `ensure_backend`, connector actions).
- Default model Sonnet 5 at medium effort, 1-hour prompt cache TTL, `maxBudgetUsd` per turn from the user's balance, subagent depth 1, concurrency 3 (`docs/v2/research/unit-economics.md:292-296`).
- `instructions` carries the wandit product prompt. A sandbox `CLAUDE.md` plus skills carry the stack contract, using `docs/prompts/lovable.md` as the checklist (`inspect-product-docs-and-references.md`, implications).
- Host tools (run in the Trigger.dev task): `read_preview_diagnostics`, `take_screenshot`, `generate_image` (server-side, keeps provider keys out of the VM), `ensure_backend`, `run_migration`, `deploy_edge_function`, `set_secret`, `publish`, `read_leads_summary`, MCP connector tools from `McpChatToolsService` (`inspect-connectors-media-leads.md`, implications).

### Model routing (vendor-managed key handling)

- Vercel AI Gateway documents a Claude Code recipe: `ANTHROPIC_BASE_URL=https://ai-gateway.vercel.sh/claude-code`, `ANTHROPIC_AUTH_TOKEN=<gateway key>`, `ANTHROPIC_API_KEY=''` (https://vercel.com/docs/ai-gateway/coding-agents/claude-code, cited at `ai-sdk-harness.md:345`).
- The adapter has an `auth: 'ai-gateway'` mode and `credentialForwarding` for placeholder rewriting (`ai-sdk-harness.md:208`).
- With Vercel Sandbox, use a firewall `transform` rule so the gateway key never enters the VM (https://vercel.com/docs/sandbox/concepts/firewall, cited at `docs/v2/research/security.md:184-194`).
- V1 already bills through the Vercel AI Gateway with generation-id reconciliation (`inspect-ai-pipeline.md`, summary). Routing V2 through the same gateway keeps one provider bill.
- `UNVERIFIED`: whether the gateway Claude Code endpoint emits generation ids that `ai_usage_generation_refs` can reconcile. If not, reconcile with the Anthropic Usage and Cost API (`unit-economics.md:99`).
- `UNVERIFIED`: whether the gateway can mint per-run short-lived keys with budgets (`security.md:174-182`). Without it, the per-run budget is `maxBudgetUsd` in the SDK plus the metering checkpoint (component 10). This is the accepted trade for not running an LLM proxy.

### Lock-in and cost

- Lock-in: `@ai-sdk/harness` event shapes and the Vercel-only sandbox provider. Exit to the Agent SDK direct path: prompts, skills, host tools, and the UI transport transfer; the bridge equivalent is about 27 KB of TypeScript (`ai-sdk-harness.md:444`). Estimate: 4 to 6 engineer-weeks.
- Cost: tokens only (section 15). No fixed fee.

### Open items

- Anthropic terms: the Agent SDK clause allows products that pay with their own key; the Claude Code in-products clause forbids intermediating usage. The AI SDK bridge installs the `@anthropic-ai/claude-code` CLI package inside the sandbox. Which clause applies is `UNVERIFIED` (`ai-sdk-harness.md:363-372`, `unit-economics.md:307`). Get written confirmation from Anthropic sales before external users.
- Upgrade the server to `ai@7.0.91` or newer first; `@ai-sdk/harness` pins it (`ai-sdk-harness.md:33`; server today `apps/server/package.json:45` at `^7.0.19`).
- `UNVERIFIED`: whether the adapter forwards `PostToolUse` and `Stop` hooks to the host (`agent-runtime-patterns.md:473`). If not, the changed-file list comes from `git status` after the turn, which works.
- `UNVERIFIED`: whether `total_cost_usd` reaches the host. Not needed; wandit prices tokens itself.

---

## 3. Component 2: sandbox provider and lifecycle

### Choice

Vercel Sandbox on the Pro plan, region `cdg1` (Paris), one persistent sandbox per project named by `projectId`, a custom image from Vercel Container Registry.

### Why

- It is the only sandbox with a first-party harness adapter, so the plan works on day one (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code, cited at `docs/v2/research/sandboxes.md:330`).
- Firecracker microVM with a dedicated kernel per sandbox (https://vercel.com/docs/sandbox/concepts, `sandboxes.md:72`). This meets the security report's isolation floor (`security.md:128-135`).
- Persistence is the default: stop snapshots the filesystem, any SDK call resumes, `Sandbox.getOrCreate({ name })`, `onCreate` and `onResume` hooks, `keepLastSnapshots: { count: 1 }` (https://vercel.com/docs/sandbox/concepts/persistent-sandboxes, `sandboxes.md:75`).
- Firewall with deny-by-default egress and credential brokering (https://vercel.com/docs/sandbox/concepts/firewall, `sandboxes.md:78`).
- Active-CPU billing fits an idle-heavy builder (`sandboxes.md:83`).
- Limits fit: 64 GB disk, up to 15 ports, 24 h sessions on Pro, 10,000 concurrent (`sandboxes.md:216` in `ai-sdk-harness.md`).

### Lifecycle

| Event | Call | State after | Notes |
|---|---|---|---|
| Create (first turn of a project) | `Sandbox.getOrCreate({ name: projectId, ports: [4000, 3000, 8081], timeout: 30 min, keepLastSnapshots: { count: 1 }, onCreate })` | running | `onCreate`: copy template, `pnpm install`, `git init`, start dev server and Playwright service. Emit `data-phase`. |
| Turn ends, user active | `session.detach()` | running, warm | Store the opaque `resumeState` per chat in `builder_sessions.harness_resume_state` (encrypted). |
| Tab open, no turn | client heartbeat every 60 s to `POST /v2/projects/:id/preview/heartbeat` | running | API calls `sandbox.extendTimeout()`. Max 24 h per session. |
| Idle 20 min | cron `builder-idle-stop` (Trigger.dev schedule, 1 min) calls `session.stop()` | stopped, snapshot | Snapshot storage USD 0.08 per GB-month. Dev servers die. |
| User returns | `createSession({ sessionId: chatId, resumeFrom })`; provider `resumeSession` | running | `onResume` restarts dev server and Playwright. Budget several seconds plus Metro warmup. |
| Snapshot expired (30 days) or sandbox removed (14 idle days) | rebuild from R2 git bundles (component 6) into a fresh sandbox from the base image | running | https://vercel.com/docs/sandbox/concepts/persistent-sandboxes, `sandboxes.md:75`. |
| Project deleted | delete sandbox and snapshots, delete R2 prefix, delete rows | gone | |
| Parallel preview of another branch (phase 4) | `Sandbox.fork()` | second sandbox | `sandboxes.md:75`. |

### Image

One custom image, rebuilt weekly by a GitHub Action: Node 22, pnpm 11.7.0 (matches `package.json:35`), git, Chromium for Playwright, the Expo CLI, a warm pnpm store for the two templates. Reason: `git` in the `vercel/sandbox/universal` image is `UNVERIFIED` (`docs/v2/research/git-versioning.md:430`), and Chromium is `UNVERIFIED` (`agent-runtime-patterns.md:475`).

### Firewall policy

Deny by default. Allow: `ai-gateway.vercel.sh`, `registry.npmjs.org`, `<ref>.supabase.co` for the project's backend, `api.stripe.com` only when connected, the R2 presigned-URL host, `exp.host` and `expo.dev` for Expo. Deny link-local and private CIDRs. Two-phase policy: wide during install, narrow before user code runs (`security.md:280-292`).

### Lock-in and cost

- Lock-in: the harness sandbox provider interface `HarnessV1SandboxProvider` (https://raw.githubusercontent.com/vercel/ai/main/packages/harness/src/v1/harness-v1-sandbox-provider.ts, `ai-sdk-harness.md:206`). No public third-party provider exists. Exit to E2B or Daytona: write a custom provider (effort `UNVERIFIED`; estimate 3 to 5 engineer-weeks) plus a firewall equivalent. The git-bundle design makes project files portable with no provider snapshot (`git-versioning.md:435`).
- Cost: about USD 0.11 to 0.15 per sandbox-hour at realistic CPU use, USD 0.15 per GB exposed-port egress, USD 0.08 per GB-month snapshots (https://vercel.com/docs/sandbox/pricing, `unit-economics.md:110`). Pro plan USD 20 per month, already paid for the web SPA.
- `UNVERIFIED`: `cdg1` regional rates (`sandboxes.md:83`). Pilot in `cdg1` and read the invoice.

### Rejected alternatives

- E2B: mature, memory-preserving pause, but no harness adapter and USD 150 per month Pro for sessions over one hour (`sandboxes.md:347-349`). Fallback.
- Cloudflare Sandbox SDK: disk erased on sleep, 0.x SDK, no region pin (`sandboxes.md:361`).
- Managed Agents cloud sandbox: no preview port (`ai-sdk-harness.md:408`).
- Self-hosted Firecracker: rejected by the angle.

---

## 4. Component 3: generated-app stack template for web

### Choice

Vite + React + TypeScript + Tailwind + shadcn/ui + React Router in library mode + `@supabase/supabase-js`. Output is a directory of static files. Server logic lives in Supabase Edge Functions.

### Why

- Static output serves from the existing edge stack with a small change; no server bundle, no script size limit, no cold start (`docs/v2/research/hosting-publish.md:256-261`).
- It is the Lovable shape, which the market accepts (`hosting-publish.md:218`).
- The host never runs user server code. Most abuse and isolation work leaves the publish path (`hosting-publish.md:260`).
- Next.js via OpenNext has the most caveats and a 10 MB limit (`hosting-publish.md:254`). SSR frameworks are a phase-2 option on Workers for Platforms.

### Template contents (repo package `packages/app-templates/web`)

- `vite.config.ts` with `server.host: true`, `server.allowedHosts: ['.<preview domain>']`, `server.strictPort: true`, `hmr.clientPort: 443`, `hmr.protocol: 'wss'` for the proxied preview (https://vite.dev/config/server-options.html, `agent-runtime-patterns.md:304`).
- `.env` generated at session start from `project_secrets` with only `VITE_` public values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WANDIT_PUBLIC_FORM_ID`, `VITE_WANDIT_API_ORIGIN`, `VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID`.
- `src/lib/wandit-leads.ts`: the leads SDK file (component 13).
- `src/lib/supabase.ts`: client with `sb_publishable_` key.
- `supabase/migrations/` and `supabase/functions/` folders with a migration template that enables RLS in the same file (`security.md:411-414`).
- `.gitignore` with `.env*`, `node_modules`, `dist`, media folders (`git-versioning.md:414`).
- `.claude/settings.json` with deny rules for `git push`, `git reset --hard`, `git checkout`, `git switch`, `git rebase`, `git tag`, `sudo`, `nc`, `ssh`, `docker`, and writes to `.claude/`, `.mcp.json`, `.git/hooks` (`git-versioning.md:273`, `security.md:499-512`).
- `CLAUDE.md`: stack contract, design-system-first rule, AR/FR/EN and RTL rules from `docs/localization.md`, DZD prices, mobile-first (`inspect-product-docs-and-references.md`, implications).
- Pinned versions. The template is rebuilt in CI weekly so the sandbox image pnpm store stays warm.

### Lock-in and cost

None beyond Supabase (component 5). The output runs on any static host.

---

## 5. Component 4: mobile stack (Expo) and preview path

### Choice

Expo project template pinned to the SDK that the store Expo Go runs, with `expo-router`, `react-native-web`, `@expo/metro-runtime`, and a curated module allow-list. Preview path in three steps: (1) Expo web in the same iframe plus an Expo Go QR code; (1.5) a wandit preview app (`expo-dev-client`) plus Appetize.io on demand; (2) no wandit-owned device streaming in this proposal.

### Why

- Every mobile builder starts with Expo, RN-Web browser preview, and Expo Go by QR (`docs/v2/research/competitor-architectures.md:316-321`).
- Expo web costs nothing extra: the sandbox runs `npx expo start --web --port 8081` and the iframe shows it (`docs/v2/research/expo-mobile.md:275-288`).
- Expo Go needs no tunnel when the sandbox exposes the port. Set `EXPO_PACKAGER_PROXY_URL` to the wandit preview proxy URL (`expo-mobile.md:280`; `sandboxes.md:298`).
- Appetize is what Expo Snack uses for in-browser devices. Upload one dev-client build once, pass the Metro URL through `launchUrl` or `params`, and edits need no rebuild (`expo-mobile.md:142-166`).
- A Mac mini pool with `serve-sim` needs macOS hosts, a legal review of the Apple SLA, and a helper with no auth and a shell-exec endpoint (`docs/v2/research/inspect-native-and-simulator.md`, summary). This is the opposite of lowest ops. Rejected.
- Self-hosted Android emulators need KVM bare metal (`expo-mobile.md:298-303`). Rejected for the same reason. Genymotion SaaS at USD 0.06 per minute is the managed Android option if Appetize's Android devices are not enough.

### Constraints to design in

- Pin the template SDK to the store Expo Go build. Expo Go lagged SDK releases for months in 2026 and only loads EAS Update projects the user owns since 2026-05-12 (`expo-mobile.md`, summary). `UNVERIFIED`: whether dev-server loading stays unrestricted. Mitigation: start the wandit preview app early.
- OAuth cannot round-trip in Expo Go. Generated apps fall back to email OTP or magic link in Expo Go (`expo-mobile.md:284`).
- Decide web versus mobile at project creation. Web projects do not convert to Expo (`competitor-architectures.md:348`).
- Ship: EAS internal distribution first, store submission later with guided onboarding (Apple USD 99 per year, Google USD 25 plus a 12-tester closed test) (`expo-mobile.md:285`). Reuse `apps/native/eas.json` and `.github/workflows/mobile-testflight.yml`.

### Lock-in and cost

- Expo and EAS: 15 free builds per platform per month, then USD 1 to 4 per build (`expo-mobile.md:287`).
- Appetize: USD 59 per month Starter (500 minutes, 3 concurrent), USD 319 Premium (16 concurrent), USD 0.06 per extra minute (https://appetize.io/pricing via render proxy, `unit-economics.md:139-146`; prices `UNVERIFIED` because the page is script-driven). Cap sessions at 10 to 15 minutes. Meter minutes as their own line (component 10).
- `UNVERIFIED`: whether Appetize devices can reach an arbitrary public Metro host (`expo-mobile.md:166`). Spike this before phase 5.

---

## 6. Component 5: backend-on-behalf and provisioning

### Choice

Supabase, one project per wandit app, in wandit-owned organizations (one per environment), through the Management API, under the Supabase for Platforms program. Lazy provisioning. Pause after 7 idle days. Supabase Auth in generated apps. Resend for email with one domain and one domain-scoped key per tenant. User's own Stripe restricted key in phase 1. `pg_cron` for jobs. Logs through the Management API. A Cloud tab built on a server-side proxy modeled on the Supabase Platform Kit.

### Why

- Lovable, Bolt, v0, and Tempo run this way; Lovable says the Management API handles about 90 percent of its Supabase interactions (https://supabase.com/customers/lovable, `docs/v2/research/backend-on-behalf.md:17`).
- The API covers every need: create project, keys, SQL, auth config with SMTP and OAuth providers, edge function deploy, secrets, storage, logs, branches, pause and restore, claim (`backend-on-behalf.md:76-97`).
- Supabase Auth is included, API-configurable, and RLS-native. Better Auth in generated code needs a server runtime in every app. Clerk adds a vendor and Third-Party MAU charges (`backend-on-behalf.md:321-342`).
- Supabase ships a Platform Kit with database, users, storage, secrets, logs, and SQL panels behind a server proxy (https://supabase.com/ui/docs/platform/platform-kit, `backend-on-behalf.md:193`). Port the hooks; `apps/web` is Vite, not Next.js (`inspect-web-builder-ui.md`, summary).
- Neon is the strongest database-only alternative with scale-to-zero (`backend-on-behalf.md:220-231`). Keep a `BackendProvider` interface so a Neon tier can be added if the idle-cost target is not met.

### Provisioning flow (Trigger.dev task `backend-provision`)

1. Agent calls host tool `ensure_backend` on the first need (auth, data, storage, functions, email, payments, jobs) or the user clicks "Enable backend" (`backend-on-behalf.md:403-410`). Landing pages and lead forms keep the V1 leads path and get no backend.
2. Insert `app_backends` row with status `provisioning`. Reserve the fixed `backend_provision` credit operation.
3. `POST /v1/projects` with `name = wandit-<projectId>`, `organization_slug`, generated `db_pass`, `region` from user locale (default `eu-west-3` Paris; no Africa or Middle East region exists), `desired_instance_size = micro` or Nano under the deal (`backend-on-behalf.md:416`).
4. Poll `GET /v1/projects/{ref}` every 5 s until `ACTIVE_HEALTHY`; time out at 10 minutes and mark `failed`.
5. `GET /v1/projects/{ref}/api-keys?reveal=true`; store the publishable key in `app_backends` and the secret key and `db_pass` in `project_secrets` (encrypted).
6. `PATCH /v1/projects/{ref}/config/auth`: `site_url` preview URL, `uri_allow_list` preview and published hosts, Resend SMTP on the shared wandit sender domain, CAPTCHA on, OTP expiry 3600 s or lower.
7. `POST /v1/projects/{ref}/database/query`: enable `pg_cron`; apply the RLS baseline.
8. `PUT /v1/projects/{ref}/api-keys/legacy` off, `PUT /v1/projects/{ref}/ssl-enforcement` on (`security.md:418-420`).
9. `POST /v1/projects/{ref}/secrets`: `RESEND_API_KEY` (tenant-scoped), `APP_URL`.
10. Write `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` into the sandbox `.env` and into the build.
11. Status `ready`. Emit `data-backend` on the stream. Show the Cloud tab.

While provisioning runs, the agent continues UI work. Backend-dependent steps wait for `ready`. `UNVERIFIED`: creation duration (`backend-on-behalf.md:412`).

### Every Management API call goes through one queue

Per-project bucket 120 per minute, logs 30 per minute, custom hostnames 10 per minute, retry on 429 with `X-RateLimit-Reset` (`backend-on-behalf.md:59-70`). One `SupabaseAdminClient` in the API and in Trigger tasks. The sandboxed harness never holds the platform token. It gets a project-scoped Supabase MCP config or short-lived proxy tokens for `database/query`, `functions/deploy`, and `secrets` (`backend-on-behalf.md:205-212`; exact hosted MCP tool names `UNVERIFIED`).

### Idle and cost policy

- Pause after 7 days without traffic and with no cron jobs: `POST /v1/projects/{ref}/pause`. Paused projects cost no compute (`backend-on-behalf.md:429`).
- Restore on demand with a "waking up" state; published apps get a friendly page from `wandit-edge` during restore (`backend-on-behalf.md:430`). Restore duration `UNVERIFIED`.
- Delete after a grace period when the wandit project is deleted.
- Send the Supabase partnerships form before building. Ask for Nano scale-to-zero, per-project price at 1k and 10k projects, project caps per org, rate-limit lifts (`backend-on-behalf.md:120`). Per-org project caps on paid plans are `UNVERIFIED`.

### Email, payments, jobs, analytics

- Email: Resend. Shared sender domain by default; custom domain per tenant with `POST /domains`; one `sending_access` key scoped by `domain_id` stored as a Supabase secret; auth SMTP set on the tenant project (`backend-on-behalf.md:357-364`). Resend SMTP host and port `UNVERIFIED`.
- Payments: phase 1, the user's own Stripe restricted key stored as a secret with a checkout edge function (Lovable's documented flow). Phase 2, Stripe Connect at USD 2 per monthly active connected account (`backend-on-behalf.md:369-378`). Stripe availability in Morocco `UNVERIFIED`. COD-first users may not need card payments in phase 1.
- Jobs: Supabase Cron; history from `cron.job_run_details` (`backend-on-behalf.md:382`).
- Analytics: Cloudflare Web Analytics beacon injected by `wandit-edge` per site; PostHog project per app as a later add-on (`backend-on-behalf.md:388-390`).

### Cloud tab panels and their calls

Database (tables with `pg_stat_user_tables` row estimates, rows through parameterized `database/query`, SQL editor with confirmation on DDL and DELETE, RLS policy view), Users (`auth.admin.listUsers` server-side), Storage (`GET /storage/buckets`), Secrets (write-only names), Logs (`GET /analytics/endpoints/logs`, 24-hour windows, 7-day retention on Pro), Functions (`GET /functions`), Jobs (SQL on `cron.job`) (`backend-on-behalf.md:176-193`). `POST /database/query` is Beta; keep a direct Postgres fallback with the stored `db_pass` (`backend-on-behalf.md:453`).

### Lock-in and cost

- Lock-in: generated apps use `supabase-js` and Supabase Auth. The exit door is the claim flow (`GET /v1/projects/{ref}/claim-token`, `GET /v1/oauth/authorize/project-claim`), verified in the OpenAPI spec but the guide is `UNVERIFIED` (`backend-on-behalf.md:93`). Bolt ships this; Lovable does not and gets complaints (`competitor-architectures.md:305`). Build it in phase 5.
- Cost at list: USD 0.01344 per hour per running Micro project, about USD 9.8 per month; Pro org USD 25 per month with USD 10 of compute credits (`backend-on-behalf.md:133-147`). 1,000 always-on projects is about USD 9.8k per month; with 70 percent paused about USD 2.96k.
- This cost exceeds the Pro base tier's whole AI budget (USD 7), so backends are plan entitlements: Starter 0, Pro 1, Business 3, more at USD 10 per month each (`unit-economics.md:299`).

---

## 7. Component 6: versioning and git

### Choice

Git inside the sandbox is the file source of truth. The server makes one commit per assistant turn with a tag `msg/<messageId>`. After each commit the sandbox uploads an incremental git bundle, a capped patch, and a numstat file to R2 through presigned URLs (full bundle every 50 commits). Postgres tables `app_commits`, `app_bundles`, `app_branches` hold the version list. Restore is a copy-forward commit. No GitHub org, no Gitea. GitHub export is a later one-way push.

### Why

- Claude Code file checkpointing covers only Write and Edit, not Bash or subagents, and Anthropic says to use git for permanent history (https://code.claude.com/docs/en/agent-sdk/file-checkpointing, `git-versioning.md:114-120`).
- Sandbox snapshots cost USD 0.08 per GB-month on a full filesystem; per-message snapshots at 2 GB would be about USD 32 per project-month (`git-versioning.md:133-141`, estimate). Git in R2 costs cents.
- R2 is already in the stack (`apps/server/src/infrastructure/storage/r2.ts:29-65`), strongly consistent, egress free, USD 0.015 per GB-month (`git-versioning.md:155-165`).
- GitHub as the internal store has a 100,000-repo cap, 500 content-creating requests per hour, and puts user code in a wandit org (`git-versioning.md:167-176`). Gitea is a stateful service to run; rejected by the angle (`git-versioning.md:210-216`).
- V1 already has the right shape: immutable versions, a mutable active pointer with compare-and-swap, copy-forward restore (`apps/server/src/modules/pages/application/services/page-edits.service.ts:188-234`, cited at `git-versioning.md:258`).

### Design details

- Layout, git identity, commit trailers, deny rules: `git-versioning.md:263-273`.
- Commit script and R2 keys `git/{projectId}/bundles/{seq}-{full|inc}-{sha}.bundle`, `git/{projectId}/patches/{sha}.diff`, `.numstat`: `git-versioning.md:275-308`.
- Tables `app_commits`, `app_bundles`, `app_branches`; `projects.current_branch`; `deployments.commit_id`: `git-versioning.md:310-340`.
- Rebuild a sandbox from R2: clone the last full bundle, fetch the incremental bundles, `pnpm install`, start dev servers (`git-versioning.md:342-352`).
- Restore: `git read-tree -u --reset <sha> && git commit`, UI says "Restore does not change your app's data" (`git-versioning.md:354-360`).
- Adjacent diff from R2 without a sandbox; any-two-versions diff on demand in the warm sandbox (`git-versioning.md:362-366`).
- Branch per chat with `Sandbox.fork` for parallel previews, merge with one agent turn on conflict (Base44 pattern): phase 4 (`git-versioning.md:368-373`).
- Export to GitHub one-way with a GitHub App user token, then two-way with a `wandit-sync` fallback branch: phase 5 (`git-versioning.md:380-384`).
- Nightly job rebuilds one random project from R2 and reports failures (`git-versioning.md:429`).

`DISAGREEMENT`: `inspect-data-model.md:369` proposes `app_snapshots` with a file manifest of path to R2 key. `git-versioning.md:310` proposes `app_commits` with git bundles. This proposal follows `app_commits`. Reason: a file manifest per message costs more R2 operations and cannot diff or merge; git bundles do both and stay provider-neutral. The attempt-row and composite-FK conventions from `inspect-data-model.md` still apply.

### Lock-in and cost

- Lock-in: none. Any sandbox that runs `git` and can reach R2 works (`git-versioning.md:435`).
- Cost: about USD 15 per month at 10,000 projects (`git-versioning.md:394-398`, estimate).
- `UNVERIFIED`: repo sizes and per-message deltas are estimates; exact Claude Code permission-rule syntax (`git-versioning.md:441-455`).

---

## 8. Component 7: preview (web iframe and mobile) and preview auth

### Choice

A second, small Cloudflare Worker `wandit-preview` on a separate registrable preview domain (working name `wanditpreview.app`; availability `UNVERIFIED`). One host per project and run: `https://<runId>-<projectId>.wanditpreview.app`. The Worker checks a signed short-lived token (cookie or query), looks up the sandbox host in KV, forwards HTTP and WebSocket traffic to `sandbox.domain(port)`, and sets `frame-ancestors`, `nosniff`, and `Referrer-Policy` headers. The builder embeds it in an iframe without `allow-top-navigation`. Mobile: Expo web in the same iframe; the Expo Go QR encodes the same proxy URL; Appetize embed in phase 5.

### Why

- Vercel Sandbox preview URLs are public with no token (`sandboxes.md:77`). An iframe cannot send headers, so a proxy is required (`sandboxes.md:287-294`).
- The generated app needs `allow-same-origin` for auth sessions, so it must live on a separate registrable domain, one origin per project, with a Public Suffix List entry (`security.md:339-350`).
- The proxy hides the vendor hostname, so the sandbox provider can change without a client change (`sandboxes.md:294`).
- Vite HMR and Metro need WebSocket pass-through; Workers support WebSocket proxying.
- V1's `srcDoc` iframe with an injected editor script only works on server-stamped single-file HTML (`inspect-web-builder-ui.md`, implications). It stays V1-only.

`DISAGREEMENT`: `hosting-publish.md:292` proposes flat single-level hosts on `wandit.app` (for example `d-{id}--{slug}.wandit.app`) for previews. `security.md:339-341` requires a separate registrable domain. This proposal uses both: the separate domain for live sandbox previews (they run with `allow-same-origin` and hold auth sessions), and flat single-level `wandit.app` hosts with `noindex` for previews of published builds (static, served by `wandit-edge`, inside Universal SSL). Two-level hosts on `wandit.app` fail TLS (`docs/features/edge-serving.md`, cited at `hosting-publish.md:27`).

### Token flow

1. Client asks `GET /v2/projects/:id/preview` after a turn or on tab open. API checks workspace membership, mints `{ projectId, runId, exp: now + 15 min }` signed with `PREVIEW_TOKEN_SECRET`, and returns the preview URL with the token in a query parameter.
2. The Worker validates the token, sets a `__Host-` cookie scoped to that preview origin, and redirects to the clean path. Subsequent requests carry the cookie.
3. The Worker reads KV `preview:{host}` for the sandbox target (written by the API when the sandbox starts or resumes).
4. Phone QR: same URL with a 15-minute token; Expo Go opens `exp://` on the proxy host. `UNVERIFIED`: Expo Go behavior with a query token in the URL; fallback is a token in the hostname.

### Diagnostics feed

A `postMessage` bridge in the template forwards `window.onerror`, `unhandledrejection`, and `console.error` to the builder with `event.origin` checks (`agent-runtime-patterns.md:318`, `security.md:346`). The API stores them as `preview_diagnostics` for the host tool `read_preview_diagnostics` and the "Try to fix" button.

### Lock-in and cost

- Cloudflare Worker requests at USD 0.30 per million after 10 million; no egress charge. Vercel exposed-port egress USD 0.15 per GB behind the proxy (`sandboxes.md:294`).
- PSL inclusion has no SLA; the pre-PSL state is a known gap (`security.md:341`).

---

## 9. Component 8: publish, hosting, and custom domains

### Choice

Phase 1: extend `wandit-edge` to serve static Vite bundles from R2. Immutable per-deployment prefix, one small mutable flip object per project, path routing with SPA fallback, per-object content types, immutable cache headers on hashed assets. Build inside the sandbox in a Trigger.dev task. Keep the KV pointer contract, Cloudflare for SaaS custom hostnames, the customer-zone apex workaround, and the `deployments` state machine. Phase 2: Workers for Platforms for apps that need SSR, with the dispatch Worker replacing `wandit-edge` on the same route. Optional export: Vercel Claim Deployments.

### Why

- Cloudflare charges zero egress and free static asset requests; Vercel charges USD 0.15 to 0.35 per GB after 1 TB. At 10 TB per month that is about USD 60 versus USD 1,750 to 3,780 (`hosting-publish.md:324-337`).
- Wandit already runs the right shape: one Worker on `*/*` of `wandit.app`, KV `domain:{host}`, R2 bytes, SaaS hostnames, archive-per-deployment rollback (`apps/edge/src/index.ts:10-11,58,63,143,164,180-181`; `hosting-publish.md:11-28`).
- Cloudflare Pages is capped at 100 projects; plain Workers at 500 per account (`hosting-publish.md:47-63`). Only the R2-backed single Worker or Workers for Platforms scale.
- Build in the sandbox, not on git CI: it is the Vercel and Cloudflare reference pattern; a 5-minute 2-vCPU run costs about USD 0.03; CI would need a git repo per project and hits Vercel's 6,000 deploys per day and Netlify's 100 (`hosting-publish.md:222-243`).
- Lovable, Bolt, and Base44 all sit behind Cloudflare (`hosting-publish.md:180-218`).

`DISAGREEMENT`: `hosting-publish.md:280` puts `deploymentId` in the KV pointer. `inspect-publish-serve.md` (implications) keeps the KV pointer version-free and puts the flip in an R2 object `published/{projectId}/current.json`, because KV is eventually consistent and the custom-domain pipeline writes pointers without deploy knowledge. This proposal follows the R2 flip object. `projectId` stays the only required pointer field so V1 sites keep working.

### Publish task `app-publish` (Trigger.dev)

1. API validates slug and entitlement, inserts a pending `deployments` row (existing `FOR UPDATE` insert, `inspect-publish-serve.md`, reusable list), reserves nothing (hosting is an entitlement), triggers the task with `idempotencyKey = deploymentId`.
2. Task resumes the sandbox if needed, runs `vite build` at the tagged commit, checks output size and file count.
3. Security gate (component 11): Supabase security advisors block on ERROR, anonymous RLS probe, secret-shape scan of `dist/`, phishing classifier plus static rules.
4. Runs `injectPixels`, the leads runtime (or relies on the SDK), and the badge on `dist/index.html` only (`inspect-publish-serve.md`, reusable list).
5. Hashes every file, uploads only missing blobs to `apps/blobs/{sha256}` in parallel, writes `apps/{projectId}/builds/{deploymentId}/manifest.json`.
6. Writes `published/{projectId}/current.json -> { deploymentId }`, writes the KV slug pointer if missing, promotes the row (demote-then-promote in one transaction, best-effort compensation).
7. Registers the slug URL and every active custom domain in the tenant Supabase `uri_allow_list` (`inspect-publish-serve.md`, implications).

Rollback flips `current.json` to an older manifest. Unpublish deletes the flip object and the slug pointer. Suspend sets pointer `status: 'suspended'` as today.

### Edge Worker changes

After the pointer lookup: read the flip object, read the manifest (cached by `deploymentId`), match the path, SPA fallback for navigation requests, 404 otherwise, content type from the manifest, `Range` support, `immutable` cache on hashed assets, `max-age=60` on `index.html`, keep `caches.default` host-keyed (`hosting-publish.md:282-296`). Add CI for `wrangler deploy` and tests for routing (`inspect-publish-serve.md`, implications). Today the edge deploys by hand.

### Custom domains

No mechanism change. Cloudflare for SaaS: 100 hostnames free, then USD 0.10 per hostname per month, 50,000 cap on non-Enterprise (`hosting-publish.md:110-118`). Price it into paid plans. Submit `wandit.app` to the Public Suffix List before apps set cookies (`hosting-publish.md:320`).

### Lock-in and cost

- Lock-in: Cloudflare zone and SaaS hostnames. Exit: any object store plus any CDN; the manifest layout is portable. Estimate 3 engineer-weeks.
- Cost: Workers Paid USD 5 per month, USD 0.30 per million requests over 10 million, R2 USD 0.015 per GB-month, egress USD 0 (`hosting-publish.md:294`). About USD 62 per month at 200 million requests and 10 TB.
- Workers for Platforms later: USD 25 per month plus USD 0.02 per script beyond 1,000 (`hosting-publish.md:67-78`). `UNVERIFIED`: static asset billing through a dispatch Worker, versions for namespaced scripts (`hosting-publish.md:101-106`).

---

## 10. Component 9: streaming, events, background jobs, and reconnect

### Choice

The API admits a turn and writes a `builder_turns` row. A Trigger.dev task `builder-turn` on a per-project queue (`concurrencyKey: projectId`, `concurrencyLimit: 1`, `idempotencyKey: turnId`, machine `small-2x`) owns the `HarnessAgent` session and pipes every `UIMessageChunk` into a Trigger.dev Realtime stream v2. The API serves `GET /v2/projects/:id/turns/:turnId/stream` as SSE by reading the Trigger stream (`streams.read(runId, 'ui', { startIndex })`) and relaying it, with `Last-Event-ID` mapped to the stream index. The web client uses a custom `ChatTransport` whose `sendMessages` POSTs and then opens the SSE stream, and whose `reconnectToStream` opens it from the saved index, so `useChat({ resume: true })` works unchanged. Locks: a partial unique index on active turns plus the Trigger queue. A Redis stream leg is added only if latency is not acceptable.

### Why

- A Trigger.dev task gives an `AbortSignal`, `onCancel` with a 30 s budget, `runs.cancel`, per-project queues, idempotency, machine presets, and a dashboard; it is already deployed from `apps/server/src/trigger` (`agent-runtime-patterns.md:164-173`; `apps/server/src/trigger/generate-page.task.ts:87-91`).
- Inngest cannot interrupt a running step. BullMQ needs a worker service that wandit no longer deploys (`agent-runtime-patterns.md:177-181`; `inspect-infra-ops.md`, summary).
- Trigger streams v2: unlimited length, 300 MiB, 28 days retention, resume from the last chunk, SDK 4.1.0 or newer (wandit is on 4.5.3) (https://trigger.dev/docs/tasks/streams, `agent-runtime-patterns.md:144-148`).
- The `ChatTransport` interface has two methods, so the React components stay untouched (`agent-runtime-patterns.md:118-127`).
- The API relays so the browser never counts against the Trigger.dev Realtime connection cap (Pro 500 or more) (`agent-runtime-patterns.md:147`).

`DISAGREEMENT` with `agent-runtime-patterns.md:158`, which recommends two sinks (Redis Stream plus Trigger stream). This proposal starts with the Trigger stream only. Reasons: fewer moving parts; the Railway Redis sits in `sfo` while the API runs in `europe-west4`, so every relay hop crosses the Atlantic (`inspect-infra-ops.md:113`); the legacy Redis relay code (`chat-stream-relay.service.ts:26-127`) stays available as the upgrade path. The Redis lock is replaced by the DB partial unique index and the Trigger queue. `UNVERIFIED`: `streams.read` latency from an API process for a live stream; measure in phase 1.

### Turn sequence

1. Submit: `POST /v2/projects/:id/turns { chatId, message, metadata }` → auth and workspace scope (global guards unchanged) → credit reserve (component 10) → insert `builder_turns` (409 `AI_CHAT_TURN_ACTIVE` on the unique index; optional `queued_messages` row) → `tasks.trigger('builder-turn', ...)` → `202 { turnId, runId, streamUrl }`.
2. Boot: `Sandbox.getOrCreate` with `onCreate` or `onResume`; `data-phase`.
3. Attach: `createSession({ sessionId: chatId, resumeFrom })`.
4. Stream: `agent.stream({ session, prompt, abortSignal: signal })`; `toUIMessageStream`; pipe to the Trigger stream; host tools; lease heartbeat; metering checkpoints every N steps.
5. Watchdog: no chunk for 4 minutes → abort as `stalled` (V1 pattern, `generate-page.task.ts:1472-1544` cited at `agent-runtime-patterns.md:36`).
6. Finish: `git add -A && git commit`, `git status --porcelain=v2 -z`, screenshot, `app_commits` row, `builder_turns` update, terminal chunk, `session.detach()`, store resume state, settle credits.
7. Never call `wait.*` for more than a few seconds while the bridge socket is open; a checkpoint kills the machine (https://trigger.dev/docs/wait, `agent-runtime-patterns.md:172`). Detach first for approvals.

### Cancel

Client `stop()` → `POST .../cancel` → `runs.cancel(runId)` → task `signal` → `onCancel`: `wip` commit, files list, `detach()`, terminal chunk `cancelled`, refund the unused hold (`agent-runtime-patterns.md:183-190`). `UNVERIFIED`: bridge behavior on abort without `detach()`; always kill the bridge and set `maxBudgetUsd`.

### Other jobs

`backend-provision`, `app-publish`, `builder-idle-stop` (schedule), `git-rebuild-check` (nightly), `backend-idle-pause` (daily), `metering` sweeps reused from V1. All in the existing Trigger.dev project `wandit` with a new queue; the unreferenced project `wandit-v2-experiment` exists if separate secrets are needed (`inspect-infra-ops.md:125,474`).

### Native client

`apps/native/features/workspace/lib/use-ai-chat.ts` already uses AI SDK v7 `useChat` with typed data parts; it needs the new API URL and the custom transport (`inspect-native-and-simulator.md`, implications). Mobile is web-first in this proposal; native parity lands in phase 5.

### Lock-in and cost

- Lock-in: Trigger.dev cloud. Exit: any job runner with cancel and streams; estimate 3 engineer-weeks. Trigger.dev pricing for the new task volume is `UNVERIFIED` in the research set; the current plan already runs 20 tasks.

---

## 11. Component 10: metering and credits

### Choice

Keep 1 credit = USD 0.04 of provider cost (`packages/env/src/server.ts:118`; `apps/server/src/modules/metering/domain/model-pricing.ts:5,209-221` cited at `unit-economics.md:257`). Add operations `agent_session` (incremental token mode with checkpoints), `sandbox` (measured, unit minute), `backend_provision` (fixed), `backend_hosting` (measured, unit month), `mobile_preview` (measured, unit minute). Price harness usage from token counts on the `finish` part with a server-owned price table. Reconcile with gateway generation ids if available, else with the Anthropic Usage and Cost API. Add `projectId` to `ai_usage_events` and a `project_cost_caps` table. Backends and hosting are plan entitlements.

### Why

- The ledger, `CreditsService`, plan holds, settled balance, Stripe billing, and Trigger sweeps reuse unchanged (`docs/v2/research/inspect-auth-billing-credits.md`, reusable list).
- V1 settle is terminal; a harness turn runs for minutes with many model calls, so a checkpoint debit path (`checkpoint:<eventId>:<n>`, `allowOverdraft`, lease renewal, balance and cap re-check) is required (`inspect-auth-billing-credits.md:531-538`).
- The adapter reports token counts, not USD; `total_cost_usd` is a client-side estimate that must not bill users (https://code.claude.com/docs/en/agent-sdk/cost-tracking, `unit-economics.md:84-99`).
- Sandbox minutes and mobile preview minutes cost money without tokens; `settleMeasuredFromEvidence` exists for measured units (`inspect-auth-billing-credits.md:547`).
- A Supabase project at about USD 10 per month is 250 credits, more than the Pro base tier; it cannot be a per-credit charge (`unit-economics.md:271,299`).

### Rules

1. Reserve a floor per turn (10 credits build, 3 credits plan mode). Set `maxBudgetUsd` per turn to `min(remaining balance, plan ceiling)` (USD 2 on Pro) (`unit-economics.md:293`).
2. Checkpoint every 5 steps or 60 seconds from `step-finish` usage; stop the harness when the balance or the project cap fails.
3. Settle from `finish.totalUsage` per model with the price table; write `ai_provider_call_evidence` rows with a new transport `harness` (`inspect-auth-billing-credits.md`, implications).
4. Sandbox: reserve at start, heartbeat each minute, settle on stop with `ceil(activeSeconds / 60)`; record `customerBillable: false` when included in the plan (`unit-economics.md:297`).
5. Backends: `backend_provision` fixed at start; `backend_hosting` monthly cron consume with key `hosting:<projectId>:<yyyy-mm>`; entitlements Starter 0, Pro 1, Business 3, add-on USD 10 per month each (`inspect-auth-billing-credits.md`, implications; `unit-economics.md:299`).
6. Mobile preview: per-plan minute allowance (Starter 0, Pro 30, Business 120), then 2 credits per minute (`unit-economics.md:298`).
7. Project caps: hard at reserve and at each checkpoint, soft at settle; error `PROJECT_CREDIT_CAP_REACHED` (403) with a `data-billing-error` variant (`inspect-auth-billing-credits.md:570-573`).
8. Admission: the V1 rule that any positive balance admits the full reserve is unsafe for dollar-scale turns; use a real floor and a DB-backed concurrency cap per actor and per project (`inspect-auth-billing-credits.md:538`).
9. Estimate before the run and receipt after (`unit-economics.md:300`).
10. Negative balance policy: pause AI and the sandbox; pause backends after 7 days; never take a published static site offline (`competitor-architectures.md:342`).

### Pricing decision for Zack

At 72 percent AI margin the Pro USD 25 tier buys about 17 typical Sonnet 5 messages; Lovable sells about 100 for USD 25 at a thinner margin (`unit-economics.md:279-288`). Measure real step counts for two weeks in staging, then choose between a cheaper loop and a lower margin.

### Lock-in and cost

None beyond the model provider. The price table is wandit's.

---

## 12. Component 11: security controls

All controls map to the checklist in `security.md:478-560`. The vendor-managed choices below remove three self-run pieces the security report lists as options: no own LLM proxy, no LiteLLM, no self-run sandbox.

| Boundary | Control | Vendor piece that provides it | Evidence |
|---|---|---|---|
| Sandbox isolation | Firecracker microVM, dedicated kernel, non-root Claude Code, one sandbox per project, never shared across users | Vercel Sandbox | `security.md:128-135` |
| Model key | Never in the VM: firewall `transform` rule injects the gateway key on `ai-gateway.vercel.sh`; `ANTHROPIC_API_KEY=''`; `ANTHROPIC_BASE_URL` set to the gateway | Vercel Sandbox firewall + Vercel AI Gateway | `security.md:184-194`; https://vercel.com/docs/sandbox/concepts/firewall |
| Per-run budget | `maxBudgetUsd` in the SDK plus metering checkpoints; separate Anthropic workspace for V2 with its own spend cap | Anthropic workspace limits | `security.md:374-378` |
| Egress | Deny by default; domain allow-list; deny link-local and private CIDRs; no `subnets.allow`; two-phase policy | Vercel Sandbox firewall | `security.md:280-292` |
| User secrets | Supabase secret key, `db_pass`, Stripe key, Supabase PAT only in the control plane (`project_secrets`, encrypted); injected as Supabase Edge Function secrets; `.env` in the workspace holds only `VITE_` public values | Supabase secrets | `security.md:514-525` |
| Agent controls | `disallowedTools` for `WebFetch`/`WebSearch` unless needed; `PreToolUse` hook denies writes to `.claude/`, `.mcp.json`, `.git/hooks`, shell rc files, and paths outside the workspace; `settingSources` ignores imported settings; subagents limited | Claude Agent SDK through the adapter | `security.md:499-512` |
| Prompt injection | Fetched pages, uploads, imported repos, and DB rows are data; the egress allow-list removes the exfiltration leg | Same | `security.md:298-322` |
| Preview | Separate registrable domain, one origin per project and run, signed token, `frame-ancestors`, no `allow-top-navigation`, PSL entry | Cloudflare Worker proxy | `security.md:339-350` |
| Publish gate | Supabase security advisors block on ERROR (`GET /v1/projects/{ref}/advisors/security`), anonymous RLS probe, secret-shape scan, phishing classifier plus static rules, slug brand check | Supabase advisors + cheap model call | `security.md:380-421` |
| Takedown | `status: 'suspended'` pointer with reason and audit row; abuse form and mailbox | Existing edge Worker | `apps/edge/src/index.ts:180-181`; `security.md:388-390` |
| Abuse and cost | Sandbox timeouts, idle stop, CPU caps; mining detector (sustained CPU with no file writes); per-account publish rate limit in Redis; Supabase pause on overuse | Vercel Sandbox, Supabase pause | `security.md:366-378` |
| Audit | `audit_events` table; `PostToolUse` audit hook and OTel export with redaction; proxy logs from the gateway dashboard | Vercel AI Gateway logs | `security.md:434-444` |
| Data residency | Anthropic `inference_geo` is `global` or `us`, 30-day retention, ZDR per org and not for Fable models; Supabase EU regions; document in the privacy policy and subprocessor list | | `security.md:445-456` |

Known gaps in the vendor-managed path:

- `UNVERIFIED`: how `@ai-sdk/harness-claude-code` passes `ANTHROPIC_*` variables and whether the firewall transform rule works with the bridge's `credentialForwarding` (`security.md:562-576`). Add an integration test that asserts no `sk-ant-` or gateway key string exists in the VM environment or filesystem.
- `UNVERIFIED`: whether Vercel AI Gateway can mint per-run keys with budgets. Without it the gateway key is shared across runs and revocation is per key, not per run. Mitigation: the firewall rule keeps the key out of the VM; the checkpoint stops runaway turns.
- In-process rate limiters (leads capture, per-route guards) must move to Redis before more than one API instance (`inspect-connectors-media-leads.md`, implications; `security.md:386`).

---

## 13. Component 12: separate module in the monorepo and rollout

### Server

- New module `apps/server/src/modules/app-builder/` (name chosen to avoid "v2" in code paths). Mount with `...(env.V2_BUILDER_ENABLED ? [AppBuilderModule] : [])` after `WorkspacesModule` in `apps/server/src/app.module.ts` (lines 59-67 show the `QueuesModule` and guard-order pattern), so the global guards apply unchanged (`inspect-infra-ops.md:466-468`).
- `V2_BUILDER_ENABLED` in `packages/env/src/server.ts` with the `QUEUE_ENABLED` transform. New optional-at-boot env groups: `VERCEL_SANDBOX_TOKEN` (or OIDC), `VERCEL_SANDBOX_TEAM_ID`, `AI_GATEWAY_API_KEY` (exists for V1 gateway use; confirm), `SUPABASE_PLATFORM_TOKEN`, `SUPABASE_PLATFORM_ORG_SLUG`, `APP_SECRETS_ENCRYPTION_KEY`, `PREVIEW_TOKEN_SECRET`, `PREVIEW_DOMAIN`, `RESEND_PLATFORM_KEY`, `APPETIZE_API_KEY`, `EXPO_TOKEN` (`inspect-infra-ops.md`, implications).
- Routes under `/api/v2/*`. Contracts in `packages/contracts/src/v2/`.
- Sub-folders: `turns` (admission, transport, cancel), `sandboxes` (lifecycle, heartbeat, preview tokens), `versions` (commits, restore, diff), `backends` (Supabase admin client, provisioning, Cloud tab proxy), `publish` (app-publish pipeline, gate), `secrets`, `leads-sdk`, `metering` (checkpoint path, new operations).
- Trigger tasks in `apps/server/src/trigger/app-builder/`.
- Reuse as-is: `llm-provider.ts` seam, `ai-errors` module, metering service and sweeps, `page-build-handoff.ts` Realtime token pattern, R2 helpers, `sites.service.ts` publish structure, domains module, leads capture, `McpChatToolsService`, image tools (`inspect-ai-pipeline.md`, `inspect-publish-serve.md`, `inspect-connectors-media-leads.md`, reusable lists).
- Retire: the legacy BullMQ chat path and `docs/features/chat-generation.md` (`inspect-ai-pipeline.md`, implications).

### Database (Drizzle, additive migrations only)

- `projects`: add `engine` enum (`v1_page`, `v2_app`) default `v1_page`, `target_platform` (`web`, `mobile`), `framework`, `current_branch` (`inspect-data-model.md`, implications).
- New: `builder_sessions`, `builder_turns` (copies the attempt-row shape: status enum, `request_key` unique with `chat_id`, `trigger_run_id`, `failure_*`, `sentry_event_id`, timestamps, partial unique on active turns), `app_commits`, `app_bundles`, `app_branches`, `app_backends`, `project_secrets`, `app_builds`, `preview_diagnostics`, `queued_messages`, `project_cost_caps`, `audit_events`, `mobile_builds` (phase 5).
- `deployments`: add `kind`, `commit_id`, `build_prefix`, `file_count`, `bytes`; relax the `versions` pairing to optional (`inspect-data-model.md`, implications).
- `ai_usage_events`: add `project_id`; enum ADD VALUE for the new operations and transports (pattern from migration 0065).
- `product_settings`: add `v2BuilderEnabled`; add a per-user early-access flag (PostHog flag or a `user_feature_flags` table).
- V1 tables `artifacts`, `versions`, `page_generation_attempts` stay V1-only; a `v2_app` project never inserts an `artifacts` row, so partial uniques keep both engines safe in one database.

### Web

- Keep the `/p/$projectId` shell (`apps/web/src/routes/_auth/p.$projectId.tsx`, `WorkspacePage`, resizable split, header, tabs, project switcher). Swap the tab list and bodies by `project.engine` (`inspect-web-builder-ui.md`, implications).
- New feature folder `apps/web/src/features/app-builder/`: `BuilderTransport`, harness tool cards (read, write, edit, bash grouped like `PageEditActivityCard`), preview pane with the proxied URL and phone frame, file tree and diff viewer (new dependency, none exists today), versions list, Cloud tab panels, publish flow extended with building and gate steps, composer modes `app` and `mobile`.
- Gate the route in `beforeLoad` with the public settings query plus the per-user flag.
- Message history: paginate or trim server-side; harness transcripts grow fast (`inspect-web-builder-ui.md`, implications).

### Edge

- `apps/edge`: manifest serving and flip object (component 8). New Worker `apps/preview-edge` for the preview proxy (component 7). Add a GitHub Actions job for `wrangler deploy` of both.

### Rollout

1. Feature branch to `dev` with `V2_BUILDER_ENABLED=false` everywhere; CI runs `check-types` and `vitest` (new job; today no CI runs tests, `inspect-infra-ops.md`, summary).
2. `staging`: `V2_BUILDER_ENABLED=true` on Railway staging and Trigger staging; one Supabase Pro org for staging; Vercel Sandbox in `cdg1` from the same Vercel team; a staging preview domain. Fix staging same-site first (`staging.wandit.dev` with `CORS_ORIGIN`), because feature-branch Vercel previews cannot log in against the staging API today (`inspect-infra-ops.md`, implications).
3. `main`: module mounted with the switch off. Then on with `v2BuilderEnabled=false` in `product_settings`. Then per-user early access. Then a "New app" entry on the dashboard for all users.
4. Sentry: new tags `engine=v2_app`, `turnId`, `sandboxName`. PostHog events for turn start, finish, publish, backend enable.

---

## 14. Component 13: migration path for V1 projects and the leads feature

### Projects

- V1 projects stay on the V1 engine. Nothing breaks. No forced migration.
- New projects choose an engine at creation: "Landing page" (V1) or "Web app" or "Mobile app" (V2). This matches the "decide web versus mobile at creation" lesson (`competitor-architectures.md:348`).
- "Upgrade to app" (phase 5): creates a new V2 project with the same owner, org, domains policy, and `publicFormId`; seeds the sandbox with the latest V1 HTML from `versions.r2Key` as `public/legacy/index.html` and runs one agent turn with the prompt "Convert this landing page into React components with the same design and the same lead form". The V1 project stays until the user deletes it. One-way, as `inspect-data-model.md:403` proposes.
- Custom domains move by re-pointing the KV pointer to the new `projectId` through the existing `DomainRoutingService` writer.

### Leads

- Keep `POST /api/public/leads/{publicFormId}` unchanged. It is cross-origin, keyed by an unguessable uuid, and drives push, Sheets, and exports (`inspect-connectors-media-leads.md:138-142,274-278`).
- Replace publish-time injection for V2 apps with a template file `src/lib/wandit-leads.ts` (web) and `lib/wandit-leads.ts` (Expo). It posts `leadCaptureBodySchema` JSON, retries on 429 and 5xx with `Retry-After`, sends `_hp` when a hidden field exists, adds web attribution, fires `fbq` and `ttq` Lead plus Purchase after a 2xx, and emits `wandit:lead:result`. It also listens for the V1 `wandit:lead` event so the COD worlds and prompts stay valid (`inspect-connectors-media-leads.md`, implications). Currency configurable; DZD default.
- Pixels: `VITE_META_PIXEL_ID` and `VITE_TIKTOK_PIXEL_ID` from the project columns so `getAdsTrackingFacts` keeps working.
- `deploymentId`: V2 publishes keep writing `deployments` rows, so the composite FK `leads_project_deployment_fk` holds; the SDK reads `VITE_WANDIT_DEPLOYMENT_ID` injected at build time.
- Expo apps: `source=direct` attribution in phase 3; app-install attribution later.
- COD orders remain leads with extras; no dual write into the tenant Supabase in phase 1 (`inspect-connectors-media-leads.md`, implications). Optional later: an edge function in the tenant backend that mirrors orders into the wandit leads endpoint.
- Move the in-process capture throttle to Redis before staging runs more than one API instance.

### Docs

Mark `docs/features/chat-generation.md` and PRD section 7 as superseded; write a V2 PRD addendum in `docs/v2/` (`inspect-product-docs-and-references.md`, implications).

---

## 15. Component 14: phased delivery plan

Effort is in engineer-weeks (ew) for engineers who know the repo. Each phase is a shippable slice. Estimates carry about 30 percent uncertainty. Phases 1 to 4 assume two engineers in parallel where the work is independent.

### Phase 0: spikes and contracts (2 ew, calendar 2 weeks)

- Upgrade the server to `ai@7.0.91` or newer; run the V1 test suite.
- Spike: `HarnessAgent` + Claude Code adapter + Vercel Sandbox in a script; a second exposed port serving Vite to a browser; measure boot, resume, and egress.
- Spike: Vercel AI Gateway Claude Code endpoint through the firewall transform rule; assert no key in the VM; check whether generation ids appear.
- Send the Supabase partnerships form. Write to Anthropic sales about the Claude Code CLI-in-sandbox terms. Buy the preview domain. Submit the PSL request.
- Exit criteria: a turn streams to a browser, a preview renders in an iframe, and the two legal or commercial questions have a named contact.

### Phase 1: internal alpha, web app builder without backend (12 ew, calendar 6 weeks)

- Module skeleton, env switch, contracts v2, tables `builder_sessions`, `builder_turns`, `app_commits`, `app_bundles`, `app_branches`, `queued_messages`, `preview_diagnostics`.
- `builder-turn` task, Trigger stream sink, API SSE relay, `BuilderTransport`, cancel, lock, watchdog, idle stop cron.
- Sandbox image, web template, `onCreate` and `onResume`, heartbeat, preview proxy Worker with signed tokens.
- Git commit per turn, bundles to R2, versions list, restore, adjacent diff.
- Metering: `agent_session` with checkpoints, sandbox minutes, `projectId` on usage events, project caps.
- Web: builder route by engine, tool cards, preview pane, versions panel, composer mode `app`.
- Playwright service, `read_preview_diagnostics`, "Try to fix".
- Exit criteria: staff build and iterate on a web app in staging; cost per message measured.

### Phase 2: publish and backend (10 ew, calendar 5 weeks)

- `app-publish` task, manifest layout, flip object, edge Worker path routing, CI for `wrangler deploy`, rollback and unpublish.
- Supabase admin client with the rate-limited queue, `backend-provision` task, `app_backends`, `project_secrets`, `ensure_backend`, `run_migration`, `deploy_edge_function`, `set_secret` host tools, project-scoped Supabase MCP config.
- Cloud tab: Database, Users, Secrets, Logs (Functions and Jobs in phase 4).
- Publish security gate: advisors, RLS probe, secret scan, phishing classifier, slug rules; `suspended` reason and audit row.
- Leads SDK in the template; pixels from env; V2 `deployments` rows.
- Idle pause and restore for backends; entitlements in the catalog.
- Exit criteria: a staff-built app with auth and a table publishes to `{slug}.wandit.app` and a custom domain; a lead posts to the Leads tab.

### Phase 3: mobile phase 1 (4 ew, calendar 3 weeks)

- Expo template with pinned SDK and module allow-list; `expo start --web` in the iframe; QR panel with `EXPO_PACKAGER_PROXY_URL` through the proxy; composer mode `mobile`; project creation choice.
- EAS internal distribution flow reusing `apps/native/eas.json`.
- Exit criteria: a staff-built Expo app runs in the iframe and in Expo Go on a phone.

### Phase 4: beta hardening (8 ew, calendar 4 weeks)

- Branch per chat, `Sandbox.fork` parallel previews, merge with AI conflict resolution, copy project, compare any two versions.
- Cloud tab: Functions, Jobs, Storage; email (Resend domain per tenant), payments (user Stripe key), `pg_cron` jobs.
- Abuse pipeline, publish rate limits in Redis, capture throttle in Redis, `audit_events`, OTel export, mining detector.
- Message history pagination; native `useChat` transport parity.
- Per-user early-access flag; production mount with the switch off, then on.
- Exit criteria: external early-access users on production; on-call runbook written (revoke tokens, suspend project, pause backend, rotate PAT and gateway key).

### Phase 5: GA features and mobile 1.5 (8 ew, calendar 4 weeks)

- Wandit preview app (`expo-dev-client`) on TestFlight and Play internal testing; Appetize upload and embed; `mobile_preview` metering.
- "Upgrade to app" for V1 projects; export to GitHub one-way; Supabase claim flow ("Export to your own Supabase"); Vercel Claim Deployments export.
- Workers for Platforms path only if SSR demand appears (not in this estimate).
- Exit criteria: public launch of the V2 builder for all users.

Total: about 44 engineer-weeks. With two engineers and some parallel work, about 24 calendar weeks from the start of phase 0.

---

## 16. Component 15: cost per active project per month

Definition of an active web project in one month: 30 assistant turns (20 simple edits, 8 typical features, 2 large builds) on Sonnet 5 with caching, 20 sandbox-hours of wall time at about 15 percent CPU, 3 GB snapshot, 2 GB of preview traffic through the sandbox port, one backend, one publish per week, 200,000 visitor requests. All figures are list prices from the research reports; step counts are estimates to be measured in staging (`unit-economics.md:187-249`).

| Line | Basis | USD per month | Source |
|---|---|---|---|
| Model tokens | 20 x 0.14 + 8 x 0.44 + 2 x 1.40 | 9.12 | `unit-economics.md:261-265` |
| Sandbox compute | 20 h x about 0.13 | 2.60 | `unit-economics.md:110`; `sandboxes.md:310` |
| Sandbox snapshot | 3 GB x 0.08 | 0.24 | `sandboxes.md:83` |
| Sandbox egress (preview) | 2 GB x 0.15 | 0.30 | `sandboxes.md:83` |
| Sandbox creations | negligible | 0.00 | |
| Git bundles in R2 | 10 MB storage + 90 Class A ops | 0.00 | `git-versioning.md:394-398` |
| Hosting (Workers requests + R2 reads, egress 0) | 200k requests | 0.06 | `hosting-publish.md:294` |
| Custom domain (if beyond the first 100) | 1 hostname | 0.10 | `hosting-publish.md:112` |
| Trigger.dev run time | 30 turns on `small-2x` | `UNVERIFIED` (not priced in the research set; expected under 0.50) | |
| Subtotal, web project without backend | | about 12.4 to 13 | |
| Supabase Micro at list, always on | 730 h x 0.01344 | 9.81 | `backend-on-behalf.md:134` |
| Supabase Micro with the 7-day pause policy (about 30 percent running) | | about 2.9 | `backend-on-behalf.md:141-147` |
| Supabase Nano scale-to-zero under a platform deal | | `UNVERIFIED` | `backend-on-behalf.md:115-120` |
| Resend email (shared domain, under plan) | | 0.00 to 0.20 | `backend-on-behalf.md:354` |
| Total, web project with backend at list | | about 22 | |
| Total, web project with backend paused when idle | | about 15.5 to 16 | |
| Mobile add-on: Expo web only | | 0.00 extra | `expo-mobile.md:287` |
| Mobile add-on: Appetize 30 minutes | 30 x 0.06 at overage, plus USD 59 fixed amortized | 1.80 + share of 59 | `unit-economics.md:139-146` |
| Opus 5 instead of Sonnet 5 | token line x 2.5 | +13.7 | `unit-economics.md:218-223` |

Idle project (no turns, sandbox stopped, backend paused, site published): snapshot 0.24 + hosting about 0.01 + optional hostname 0.10 = about USD 0.25 to 0.35 per month.

Fixed monthly vendor fees for the platform: Vercel Pro USD 20 (already paid), Cloudflare Workers Paid USD 5 (already paid), Supabase Pro org USD 25 per environment, Appetize USD 59 to 319 (phase 5), Resend Pro USD 20 to 35, Trigger.dev plan (existing), Anthropic none.

Reading against the plan catalog: the Pro USD 25 tier holds USD 7 of AI cost (`unit-economics.md:279-284`). The active-project definition above spends USD 9 in tokens alone. Either the definition is a heavy user, or the plan needs the pricing decision in component 10. Both hosting and backend must be plan entitlements, not credits, for the math to close.

Scale view at 1,000 active projects: tokens about USD 9k, sandboxes about USD 3.1k, backends about USD 2.9k paused or USD 9.8k always on, hosting under USD 100, git under USD 20. Total about USD 15k to 22k per month before the Supabase deal.

---

## 17. Vendor lock-in and exit matrix

| Vendor | What is locked | Monthly spend at 1,000 active projects | Exit path | Exit cost (ew) |
|---|---|---|---|---|
| Vercel Sandbox + `@ai-sdk/sandbox-vercel` | Harness provider interface, snapshots, firewall rules, `VERCEL_OIDC_TOKEN` or access token | about USD 3.1k | Custom `HarnessV1SandboxProvider` for E2B or Daytona; rebuild sandboxes from R2 git bundles; re-create firewall rules on the new vendor | 3 to 5 (`UNVERIFIED`; no public third-party provider exists) |
| `@ai-sdk/harness` + Claude Code adapter | Event shapes, session resume state, experimental API | 0 | Agent SDK direct path in wandit containers; prompts, skills, host tools, and transport transfer | 4 to 6 |
| Anthropic (Claude Code CLI as runtime) | Model, terms | about USD 9k | Codex, OpenCode, or Pi adapters exist in the same harness family (`ai-sdk-harness.md:65-78`); prompts need rework | 2 to 4 plus quality regression |
| Vercel AI Gateway | Key brokering, usage reporting | pass-through | Direct Anthropic key behind the firewall transform rule; or Cloudflare AI Gateway | 1 |
| Supabase for Platforms | Generated apps use `supabase-js` and Supabase Auth; wandit-owned orgs | about USD 2.9k to 9.8k | Claim flow hands a project to the user's org; `BackendProvider` interface for a Neon tier | 6 to 8 for a second provider; per-app claim is a product feature (2) |
| Cloudflare (edge, R2, KV, SaaS) | Zone, hostnames, Worker code | under USD 200 | Any object store plus CDN; manifest layout is portable; SaaS hostnames must be re-issued | 3 |
| Trigger.dev | Task code, streams, queues | existing plan | Any job runner with cancel and streams | 3 |
| Resend | Tenant domains and keys | under USD 100 | Any SMTP provider; per-tenant DNS records must be re-issued | 2 |
| Appetize | Build uploads, embed | USD 59 to 319 | Genymotion SaaS for Android; no managed iOS alternative found | 1 to 2 |
| Expo EAS | Builds and updates | per build | Standard React Native tooling; keep Expo | not planned |

The concentration risk is Vercel: sandbox, harness package, and gateway in one account. The design keeps that risk bounded by the git-bundle persistence, the preview proxy that hides the vendor host, and the Agent SDK fallback.

---

## 18. Where the research disagrees and what this proposal follows

| Topic | Report A | Report B | This proposal |
|---|---|---|---|
| Version storage | `inspect-data-model.md:369` `app_snapshots` file manifests | `git-versioning.md:310` git bundles + `app_commits` | git bundles + `app_commits` (component 6) |
| Flip pointer | `hosting-publish.md:280` `deploymentId` in KV | `inspect-publish-serve.md` R2 flip object, version-free KV | R2 flip object (component 8) |
| Preview host | `hosting-publish.md:292` flat hosts on `wandit.app` | `security.md:339` separate registrable domain | Both: separate domain for live sandbox previews, flat `wandit.app` hosts for published-build previews (component 7) |
| Stream sinks | `agent-runtime-patterns.md:158` Redis + Trigger | none | Trigger stream only at first; Redis leg as an upgrade (component 9) |
| Lock | `agent-runtime-patterns.md:200-203` Redis lock + DB index + queue | none | DB index + Trigger queue; Redis lock optional (component 9) |
| Mobile preview | `expo-mobile.md:298` Mac pool in phase 2 | `inspect-native-and-simulator.md` Mac pool needed for streamed iOS | No Mac pool; Appetize on demand (component 4) |
| LLM proxy | `security.md:184-194` own proxy or LiteLLM with per-run tokens | `ai-sdk-harness.md:345` Vercel AI Gateway recipe | Vercel AI Gateway + firewall transform; accept no per-run key (component 2, 11) |
| Backend cost model | `unit-economics.md:299` entitlements or multi-tenant shards | `backend-on-behalf.md:19` per-project with pause and a partner deal | Per-project with pause, entitlements, partner deal; shards only if the deal fails (component 5, 10) |

---

## 19. UNVERIFIED register (must close before the phase gate named)

| Item | Gate | Source |
|---|---|---|
| Anthropic terms for the Claude Code CLI inside a hosted sandbox paid by wandit's key | Phase 1 exit | `ai-sdk-harness.md:370`, `unit-economics.md:307` |
| Second exposed sandbox port serves the iframe at acceptable egress cost | Phase 0 exit | `ai-sdk-harness.md:454` |
| Vercel AI Gateway Claude Code endpoint emits generation ids; per-run keys with budgets | Phase 0 exit | `security.md:180`, `inspect-auth-billing-credits.md` open questions |
| How the adapter passes `ANTHROPIC_*` into the sandbox; firewall transform compatibility | Phase 0 exit | `security.md:562-576` |
| Adapter forwards hook events (`PostToolUse`, `Stop`) to the host | Phase 1 | `agent-runtime-patterns.md:473` |
| Bridge behavior on host abort without `detach()` | Phase 1 | `agent-runtime-patterns.md:474` |
| Vercel `cdg1` regional rates | Phase 1 | `sandboxes.md:83` |
| `git` and Chromium in the Vercel images (custom image removes the question) | Phase 1 | `git-versioning.md:430`, `agent-runtime-patterns.md:475` |
| Custom `HarnessV1SandboxProvider` effort (fallback) | Phase 2 | `ai-sdk-harness.md:206` |
| Supabase project creation and restore durations, per-org project caps, claim flow guide, Nano deal terms | Phase 2 | `backend-on-behalf.md:466-484` |
| Supabase secret values readable through the API; hosted MCP tool names | Phase 2 | same |
| Resend SMTP host and port; Stripe availability in Morocco | Phase 4 | same |
| Appetize prices and whether its devices reach an arbitrary public Metro host | Phase 5 | `expo-mobile.md:337-357` |
| Store Expo Go SDK today; Expo Go dev-server loading policy | Phase 3 | same |
| Trigger.dev cost for the new task volume; `streams.read` relay latency | Phase 1 | this proposal |
| Preview domain availability and PSL timeline | Phase 0 | this proposal |
| Workers for Platforms static-asset billing and versions on namespaced scripts | Phase 5 or later | `hosting-publish.md:101-106` |
| All token and step counts in the cost model | Phase 1 exit (measure) | `unit-economics.md:335` |

---

## 20. Decisions for Zack

1. Accept Vercel as a second cloud for compute and the model gateway, next to Cloudflare and Trigger.dev. Yes or no. This proposal says yes.
2. Region: `cdg1` from day one, or `iad1` for staging first.
3. Pricing: keep 17 typical messages per USD 25 at 72 percent margin, or lower the margin toward Lovable's range.
4. Backend entitlements per plan (proposed Starter 0, Pro 1, Business 3, add-on USD 10 per month).
5. Mobile: confirm no Mac pool in the first year.
6. Preview domain name and purchase.
7. Which Supabase org and region set for preview and production.
8. Whether to keep the V1 inline editor for V1 projects only (proposed yes) and drop it for V2 apps.

---

## 21. Sources

Research reports in this worktree (all read in full or in the cited sections):
- `docs/v2/research/ai-sdk-harness.md`
- `docs/v2/research/sandboxes.md`
- `docs/v2/research/unit-economics.md`
- `docs/v2/research/backend-on-behalf.md`
- `docs/v2/research/hosting-publish.md`
- `docs/v2/research/agent-runtime-patterns.md`
- `docs/v2/research/git-versioning.md`
- `docs/v2/research/security.md`
- `docs/v2/research/expo-mobile.md`
- `docs/v2/research/competitor-architectures.md`
- `docs/v2/research/inspect-ai-pipeline.md`
- `docs/v2/research/inspect-publish-serve.md`
- `docs/v2/research/inspect-data-model.md`
- `docs/v2/research/inspect-web-builder-ui.md`
- `docs/v2/research/inspect-auth-billing-credits.md`
- `docs/v2/research/inspect-infra-ops.md`
- `docs/v2/research/inspect-native-and-simulator.md`
- `docs/v2/research/inspect-connectors-media-leads.md`
- `docs/v2/research/inspect-product-docs-and-references.md`

Repo files read directly for this proposal:
- `apps/server/src/app.module.ts:50-70`
- `apps/server/src/infrastructure/queues/queues.module.ts:16-46`
- `apps/server/src/trigger/generate-page.task.ts:87-91`
- `apps/server/package.json:23-69`
- `packages/env/src/server.ts:118,151,245`
- `apps/server/src/infrastructure/storage/r2.ts:29-384`
- `apps/edge/src/index.ts:10-11,58,63,143,164,180-181`

Vendor pages (fetched by the research reports on 2026-09-03; cited above by report and line):
- https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent
- https://ai-sdk.dev/docs/ai-sdk-harnesses/tools
- https://ai-sdk.dev/docs/ai-sdk-harnesses/ui
- https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- https://raw.githubusercontent.com/vercel/ai/main/packages/harness/src/v1/harness-v1-sandbox-provider.ts
- https://vercel.com/docs/sandbox/pricing
- https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
- https://vercel.com/docs/sandbox/concepts/firewall
- https://vercel.com/docs/sandbox/concepts/regions
- https://vercel.com/docs/sandbox/concepts/images
- https://vercel.com/docs/ai-gateway/coding-agents/claude-code
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/agent-sdk/cost-tracking
- https://code.claude.com/docs/en/agent-sdk/file-checkpointing
- https://code.claude.com/docs/en/agent-sdk/secure-deployment
- https://code.claude.com/docs/en/legal-and-compliance
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/managed-agents/overview
- https://supabase.com/docs/reference/api/introduction
- https://api.supabase.com/api/v1-json
- https://supabase.com/solutions/ai-builders
- https://supabase.com/pricing
- https://supabase.com/ui/docs/platform/platform-kit
- https://supabase.com/docs/guides/database/database-advisors
- https://supabase.com/customers/lovable
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/
- https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-vibe-coding-platform/
- https://developers.cloudflare.com/r2/pricing/
- https://trigger.dev/docs/tasks/streams
- https://trigger.dev/docs/tasks/overview
- https://trigger.dev/docs/queue-concurrency
- https://trigger.dev/docs/wait
- https://trigger.dev/docs/limits
- https://vite.dev/config/server-options.html
- https://docs.expo.dev/more/expo-cli/
- https://appetize.io/pricing
- https://docs.appetize.io/rest-api/v1/create-new-app.md
- https://resend.com/docs/api-reference/api-keys/create-api-key
- https://publicsuffix.org/submit/
- https://docs.lovable.dev/features/cloud
- https://docs.lovable.dev/integrations/supabase.md
- https://v0.app/docs/sandbox
