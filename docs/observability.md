# Observability — how it works and how to use it

> Written ADHD-style: action first, numbered steps, short lists.

## Do this first (≈15 minutes, one-time)

Nothing reports anywhere until you do this. The code is already wired — it just needs keys.

1. Create a Sentry account/org at sentry.io (name it `wandit`). Pick the **EU or US** region — doesn't matter much, just remember which.
2. Create **4 projects**: `wandit-server` (platform: Node.js), `wandit-web` (React), `wandit-admin` (React), `wandit-edge` (Cloudflare Workers). Each gives you a **DSN** (a URL — it's the "address" the app sends errors to; it is not a secret in the browser, but treat server tokens as secrets).
3. Create one **Organization Auth Token** (Settings → Auth Tokens) → this is `SENTRY_AUTH_TOKEN`, used only at build time to upload source maps.
4. Set the env vars in Railway + the Trigger.dev dashboard + Cloudflare (table below).
5. Deploy. Then break something on purpose (bad model name in preview) and watch it show up in Sentry.

### Env vars per place

| Where | Set |
|---|---|
| Railway **server** service | `SENTRY_DSN` (wandit-server DSN), `SENTRY_ENVIRONMENT=production`, `SENTRY_RELEASE=server@${{RAILWAY_GIT_COMMIT_SHA}}`, `SENTRY_ORG=wandit`, `SENTRY_AUTH_TOKEN` |
| Railway **worker** service | Same as server but `SENTRY_RELEASE=worker@${{RAILWAY_GIT_COMMIT_SHA}}` |
| Railway **web** service | `VITE_SENTRY_DSN` (wandit-web DSN), `SENTRY_ORG`, `SENTRY_AUTH_TOKEN` |
| Railway **admin** service | `VITE_SENTRY_DSN` (wandit-admin DSN), `SENTRY_ORG`, `SENTRY_AUTH_TOKEN` |
| Railway **preview env** (all services) | Same vars, but `SENTRY_ENVIRONMENT=preview` and `VITE_SENTRY_ENVIRONMENT=preview` |
| **Trigger.dev dashboard** (env vars) | `SENTRY_DSN` (wandit-server DSN) + `SENTRY_ENVIRONMENT` (runtime). For source-map upload the token must exist at BUILD time: if you deploy via GitHub integration, also add `TRIGGER_BUILD_SENTRY_AUTH_TOKEN` + `TRIGGER_BUILD_SENTRY_ORG`; if you deploy from a terminal/CI, have `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` in that shell's env. Trigger does NOT read Railway's env |
| **Cloudflare** (edge) | `wrangler secret put SENTRY_DSN` with the wandit-edge DSN (`SENTRY_ENVIRONMENT` is already in wrangler.jsonc) |

Local dev: leave everything unset. **No DSN = Sentry completely off** — that's by design, your console keeps working like today.

---

## The mental model (read once)

Console.log is a flashlight you hold while you're there. Sentry is a security camera that records even when you're not.

1. **An error happens** anywhere (API route, AI stream, background job, browser render, edge worker).
2. The Sentry SDK in that process **captures it**: stack trace, request URL, user's browser, our custom tags (`chatId`, `projectId`, `connectorId`…), and the last ~100 breadcrumbs (logs/clicks/requests that led up to it).
3. It's sent to sentry.io, which **groups identical errors into one "Issue"** with a counter — 500 users hitting the same bug = 1 issue, not 500 emails.
4. You get **one email on the first occurrence**. The issue page shows: which release introduced it, which environment (production/preview), how many users are affected, and the exact TS source line (source maps are uploaded at build).
5. You fix it, mark the issue "Resolved". If it comes back in a newer release, Sentry flags it as a **regression** and re-alerts.

That's errors. Three more things ride along:

- **Tracing**: every SPA page-load/navigation and API request becomes a "trace" — a waterfall of spans (HTTP → NestJS handler → DB queries → AI calls). Browser and API traces are linked, so you see "this click → this API call → this slow query".
- **Session Replay**: owned by **PostHog**, not Sentry (bigger quota — 5k/mo vs 50 — and it records *every* web session, not just crashes). Every browser error Sentry captures carries a **direct link to the PostHog replay** of that session. Typed input is always masked. Admin has no replay at all (no analytics there, by design).
- **Logs**: every NestJS `logger.warn/error` on server + worker is shipped to Sentry Logs (searchable, attached to traces) via the `SentryNestLogger` both apps install — Nest's default logger writes straight to stdout, so this custom logger is what makes it work. `log`/`info` stay local on purpose — quota.

## Where our code reports from (the package you now own)

`packages/observability` — one module, seven entry points, same idea as the NextForge template but adapted to our runtimes:

| Import | Used by | What it does |
|---|---|---|
| `@wandit/observability/nestjs` | `apps/server` | Init + AI monitoring + logs + tracing; capture in exception filter & AI streams |
| `@wandit/observability/node` | `apps/worker`, shared runner code | Same minus Nest specifics |
| `@wandit/observability/browser` | `apps/web`, `apps/admin` | Init + router tracing + replay + React error hooks |
| `@wandit/observability/cloudflare` | `apps/edge` | `withSentry` wrapper for the Worker |
| `@wandit/observability/trigger` | `src/trigger/init.ts` | Errors-only capture when a Trigger task fails |

(Plus `/vite` for source-map upload and `/error` for the `getErrorMessage` helper.)

The rule going forward: **never `import * as Sentry from "@sentry/..."` in app code** — always import from `@wandit/observability/<runtime>`. That's the "change the main file, everything follows" property you wanted.

---

## Runbook: "a generation failed in preview — what happened?"

1. Open Sentry → **Issues** → set environment filter to `preview`. Sort by "Last Seen".
2. Find the issue. AI-generation failures are tagged — search `chatId:<id>` or `runtime:trigger` or `connectorSlug:tiktok-ads` if you know what you're looking for.
3. Open it. Read top-down: error message → stack line (real TS source) → **tags** (chatId, projectId, userId) → **breadcrumbs** (the warn/error logs right before it).
4. If it's a browser-side issue: the event's context block has a **PostHog "Session replay URL"** — click it and literally watch what the user did.
5. If it's a page build (Trigger task): the Sentry event carries `runId` — paste it in the **Trigger.dev dashboard** to see the full task run log with every step. Sentry tells you *that and why* it broke; Trigger shows the *whole run timeline*.

For AI-specific behavior (not crashes): Sentry → **Insights → AI Agents** — every chat agent run shows the LLM calls, tool calls, token counts and latency, including inputs/outputs (we enabled recording pre-launch; flip `recordInputs/recordOutputs` to `false` in `packages/observability/src/nestjs.ts` when real customer data starts flowing, ~1 minute).

## Blind spots we closed (so you know why the code changed)

Before this branch, these errors **vanished silently** in production:

1. AI chat stream failures — user saw "An error occurred.", nothing was recorded anywhere.
2. MCP connector failures — chat quietly continued without the connector ("unreachable").
3. Image/video/marketing-asset provider errors — replaced by a generic "generation_failed" status; the real reason was thrown away.
4. Background job failures (BullMQ) and Trigger task failures — visible only if you happened to be reading Railway logs at that moment.
5. Every browser-side crash — no error boundary existed at all; users got a white screen and you got nothing.

## What we deliberately did NOT add (and when to revisit)

1. **Langfuse / LLM tracing platform** — Sentry's AI Agents view covers "what did the agent do" for now. Adopt Langfuse when you're debugging *quality* ("why is the output bad?") rather than *failures*, or when you want prompt A/B history. Free tier exists; ~an afternoon to wire.
2. **Evals** — automated tests for AI output quality (run N briefs through the builder, score results, catch regressions when you change a prompt/model). You don't need them pre-launch. Get them the first time you're scared to change a prompt. Start with Langfuse datasets or AI SDK evals then.
3. **Ad-blocker tunnel** — 10–30% of browser events get eaten by ad-blockers. Fix is a small `/api/tunnel` proxy endpoint (planned increment; everything works without it — just know browser numbers under-count).
4. **Sentry uptime/cron monitors** — free tier includes 1 uptime + 1 cron monitor; point the uptime one at `api.wandit.app/api/health` when you're in the dashboard anyway (~2 minutes).
5. **Betterstack/Logtail** — NextForge pairs it with Sentry; redundant for us. Sentry Logs + Railway's log viewer cover app + infra logs on one bill ($0).

## Three honest limitations (known, accepted for now)

1. **Server/worker/edge stack traces aren't source-mapped in Sentry yet** — the SPAs and Trigger tasks are. Node runs with `--enable-source-maps` so server stacks still show real TS lines in the error text; a `sentry-cli` upload step is the future increment for perfect mapping.
2. **A boot crash from a missing env var (e.g. `DATABASE_URL`) is not captured** — env validation runs before Sentry initializes. Railway's deploy log is where you'd see it, same as today.
3. **Browser events under-count 10–30%** until the ad-blocker tunnel increment lands (see the deferred list).

## Product analytics (PostHog) — the other half

One PostHog project (`wandit`, EU Cloud) for the whole product — environments and platforms are separated by event properties, not separate projects. `packages/analytics` mirrors the observability package: import from `@wandit/analytics/browser` (web SPA), `/node` (server + Trigger), `/react` (feature-flag hooks). **No `POSTHOG_KEY` = completely off** — same contract as Sentry.

What it does today:

- **Web**: pageviews on every SPA navigation, autocapture of clicks, and session replay (all sessions, inputs masked). Users are identified on login by internal id, with email and name as person properties for beta-support lookup. PostHog resets identity on logout. Query strings are stripped from every captured URL (prompts ride in preview URLs).
- **Server truth events** (ad-blocker-proof, captured where the state is persisted): `user_signed_up`, `generation_completed`, `generation_failed` (machine reason only), `site_published`, `subscription_started`.
- **Sentry link**: every browser error in Sentry carries the PostHog replay URL of that session.
- **Division of labor**: Sentry = alarms + diagnosis (errors, traces, alerts). PostHog = eyes + behavior (funnels, retention, replays, feedback surveys, feature flags).

Env vars: Railway web service → `VITE_POSTHOG_KEY` (+ `VITE_POSTHOG_HOST` only if not EU). Railway server service + Trigger.dev dashboard → `POSTHOG_KEY`. Same key everywhere — it's the project token (write-only, safe in browsers); `environment` comes from the existing `SENTRY_ENVIRONMENT`/`VITE_SENTRY_ENVIRONMENT` vars.

Deliberately not wired: admin (internal tool), edge/customer sites (their traffic is not our product data), mobile (add `/native` with posthog-react-native when the app ships — same project, cross-device journeys join by user id).

## Quota cheat-sheet (free "Developer" plan)

5k errors / 5M spans / 5GB logs per month, 30-day retention. Our sampling is already tuned for it: 100% of errors, 20% of API traces (health checks dropped), 100% of SPA traces, warn+error logs only. Replays don't count here — they live on PostHog's quota (5k recordings + 1M events/mo free). First knob to turn if you outgrow it: Team plan is $26/mo.

**Next action:** do step 1 of the setup block above — create the Sentry org.
