# Wandit V2 builder: inspection and research report

Date: 2026-09-03. Branch: `feat/v2-builder`. Worktree: `.claude/worktrees/v2-builder`. The branch is the same as `dev` at commit `1b2a9a1e`.

Status: research and recommendation only. No product code changed. All agents were Claude Fable 5.1.

Language note: this report obeys the rules of ASD-STE100 Simplified Technical English. Full compliance needs the official dictionary from asd-ste100.org. Technical names, file paths, and product names stay as they are.

## 0. How to read this report

The report has 3 parts.

- Part A tells you how V1 works today. It tells you what V2 must replace and what V2 can keep.
- Part B explains each new word. Then it gives the research result for each building block of V2.
- Part C gives the recommended design, the phases, the decisions that only you can make, and the open tests.

Two labels appear in the text:

- UNVERIFIED: no primary source confirms this claim. Do not build on it before the test in section 13.
- ESTIMATE: nobody measured this number. The number comes from a calculation.

Each detailed file is in `docs/v2/research/`. Section 15 lists them. This report is the summary.

---

# Part A. What V1 does today

## 1. The V1 flow, step by step

V1 has 2 AI agents. Both agents are AI SDK `ToolLoopAgent` instances. Both agents are hand-built. The flow has 10 steps.

1. The user sends a chat message. The web app or the native app sends it to `POST /v1/chats/:chatId/ai-stream`.
2. The server reserves credits and takes a lock on the chat. Then the server starts the first agent, the Brain.
3. The Brain does not write code. The Brain writes a design brief. Then the Brain calls the `generate_page` tool 1 time.
4. The `generate_page` tool writes a row in the `page_generation_attempts` table. Then it starts the Trigger.dev task `generate-page`.
5. The task runs the second agent, the Builder. The Builder is the file `site-builder-agent.ts`. This file has about 2,440 lines.
6. The Builder writes files into a virtual file system in memory. It uses hand-built tools: `write_file`, `edit_file`, `read_file`, `list_files`, `generate_image`, `animate_image`, `screenshot_page`, and `finish`.
7. The Builder has a limit of 64 steps. A watchdog stops the Builder after 180 seconds without output.
8. After the loop, the task processes 1 HTML file. It puts GSAP inline, optimizes fonts and images, and adds a `data-wid` stamp to each element. Then it uploads `index.html` to R2 and writes a `versions` row.
9. The web app polls `GET /v1/projects/:id/page` each 1.5 seconds. Then it shows the HTML in an iframe with the `srcDoc` attribute.
10. A published page sends its leads to `POST /api/public/leads/{publicFormId}`. The Leads tab, the push notifications, and the Google Sheets sync read the `leads` table.

Edits do not go back to the Builder. Seven chat tools change the HTML directly. They use 15 cheerio operation types on the `data-wid` targets. A large change is a full rebuild. The rebuild never sees the old HTML.

Publish is a pointer. The publish pipeline in `SitesService.runPublishPipeline` transforms the HTML again. It adds the pixels, the leads script, and the badge. Then it writes `published/{projectId}/current.html` to R2. Then it writes a KV pointer `domain:{host} -> {projectId}`. The Cloudflare Worker in `apps/edge` reads the pointer and serves the 1 HTML file. The Worker ignores the URL path.

The detailed maps are in `inspect-ai-pipeline.md`, `inspect-publish-serve.md`, and `inspect-web-builder-ui.md`.

## 2. Why V1 cannot grow into Lovable

The limits are in the structure. They are not bugs.

- **V1 stores 1 HTML file per page.** A React app or an Expo app is a folder of many files. It also needs a build step.
- **The agent loop is hand-built.** V1 owns each tool, the file system, the step limit, the watchdog, and the validation. A coding harness includes all of these.
- **The edit tools only work on static HTML.** They use cheerio on `data-wid` stamps. They cannot edit a React component.
- **The edge Worker ignores the URL path.** It serves 1 file with a fixed `text/html` type. It cannot serve `/assets/index-abc123.js`.
- **The preview is `srcDoc`.** There is no preview URL, no dev server, and no hot reload.
- **Generated apps have no backend.** V1 apps have no database, no login, no file storage, and no server functions.
- **The web UI has no file tree, no code view, no terminal, no logs, and no backend dashboard.**
- **The credit system expects short runs.** The `settle` step is final. A harness session runs for minutes and makes many model calls. It needs charges during the run.

## 3. What V1 keeps for V2

These parts are good. V2 must use them again.

- **Login and workspaces.** Better Auth with Google, magic link, and OTP. The Expo plugin. Organizations. The `x-wandit-workspace` header. The role matrix. The admin login. Files: `packages/auth`, `apps/server/src/modules/auth`, `workspaces`.
- **Money.** The credit ledger in centi-credits. The reserve, settle, and reconcile steps. The rule `1 credit = $0.04`. Stripe billing and manual billing. The kill switches. The Trigger.dev sweeps. Files: `credits`, `metering`, `billing`.
- **AI plumbing.** The model gateway seam in `llm-provider.ts`. The 16 error types. Sentry capture. Token usage per message. The SSE stream pattern. The `ask_user` tray. The MCP connectors with approvals.
- **Background jobs.** The Trigger.dev configuration. The attempt-row pattern with `status`, `requestKey`, `triggerRunId`, and `failure_*` columns. The Realtime tokens. The `useLiveRun` hook.
- **Serving.** The edge Worker skeleton. The KV pointer contract. The R2 helpers. Custom domains with Cloudflare for SaaS. The full `domains` module. The `deployments` state machine.
- **Leads.** The public capture endpoint. The honeypot, the throttle, and the duplicate window. Push notifications. Google Sheets sync. The CRM tab.
- **UI.** The `/p/$projectId` shell. The split panels. The chat pane. The message part registry. The `PromptBox` composer. The version switcher. The publish popover. The Leads, Assets, and Settings tabs. The 3 languages with RTL.
- **Mobile client.** The Expo 56 app with login, chat over SSE, live runs, push, 3 languages, and the TestFlight pipeline.
- **Data model.** The `projects` table as the root. The owner pair. The composite foreign keys. The partial unique indexes. The additive migrations.

## 4. Facts from the inspection that change the plan

These facts were not in your brief.

- **The iOS simulator branch has no simulator code.** The branch `claude/ios-simulator-streaming-716ef9` has 0 commits after `dev`. The "simulator stream" was a Claude Code desktop tool during development. The `serve-sim` tool is a Claude Code plugin on this Mac. It runs on macOS only, has no login, and has a shell endpoint. It is a reference, not a product part.
- **Trigger.dev is the live job system.** The `apps/worker` app has no Railway service. The old BullMQ chat path has no importers. Do not build on them.
- **Redis runs in `sfo`. The API runs in `europe-west4`.** Each lock and each stream message crosses the Atlantic. Correct this before V2 adds stream traffic.
- **No CI runs tests or type checks.** The edge Worker deploys with a manual `wrangler deploy` command. Only the Trigger.dev tasks have a deploy workflow.
- **The staging web app is on `preview.wandit.dev` and the staging API on `api-staging.wandit.dev`.** They are one site under `wandit.dev`, and the auth cookies are already `SameSite=Lax` (checked live on 2026-09-07). The repo docs still describe the old cross-site setup on `vercel.app`. Feature-branch previews on `vercel.app` stay cross-site and cannot log in to the staging API. Do not confuse the staging host `preview.wandit.dev` with the V2 preview domain for user apps.
- **The V1 "connectors" are MCP tools for the agent.** They are Meta Ads, TikTok Ads, and Higgsfield. They are not app connectors like Lovable Cloud. App connectors are new work.
- **The file `docs/prompts/lovable.md` is a copy of the Lovable prompt.** No code imports it. It is a good checklist for the V2 agent rules.
- **The folder `_cc-harness` is a partial copy of the Claude Code source.** It has 33 MB and no `package.json`. Its license is UNVERIFIED. Read the real types from the npm packages instead.
- **The public capture endpoint already accepts requests from any origin.** It uses an unguessable `publicFormId`. V2 apps can send leads to it without change.
- **A second Trigger.dev project `wandit-v2-experiment` exists.** The repo does not use it.
- **The kill-switch pattern and the PostHog flag hooks exist.** They can control the V2 rollout per environment and per user.

---

# Part B. The new words and the research

## 5. The new words

Read this section 1 time. The rest of the report uses these words.

**Coding harness.** A complete coding agent product. It has the model loop, the file tools, the shell tool, the permissions, the session history, and the hooks. Claude Code, Codex CLI, and OpenCode are harnesses. V1 built a small harness by hand.

**Claude Agent SDK.** The npm package `@anthropic-ai/claude-agent-sdk`. It runs the Claude Code engine from TypeScript, without a terminal. It gives `query()`, permission modes, hooks, MCP tools, session resume, and a cost estimate.

**AI SDK HarnessAgent.** The package `@ai-sdk/harness` from AI SDK v7. It is experimental. It starts a harness inside a sandbox. It returns the same message stream that `useChat` already reads. Adapters exist for Claude Code, Codex, OpenCode, and more.

**Sandbox.** A Linux machine in the cloud. Wandit creates 1 sandbox per project. The harness, the dev server, and the build run inside it. Providers are Vercel Sandbox, E2B, Daytona, Modal, Cloudflare, and Fly.

**Firecracker microVM.** A very small virtual machine with its own kernel. It is the isolation level that Anthropic recommends for agents that run without a human. Vercel Sandbox and E2B use it. A plain Docker container shares the host kernel. It is not safe enough for user code.

**Snapshot, pause, resume.** A snapshot saves the sandbox disk. Sometimes it also saves the memory. A project can sleep between chats and wake fast. Vercel saves the disk only. E2B saves the memory too, so the dev servers survive.

**Preview URL.** The dev server inside the sandbox on a public host name. The web app shows it in an iframe. An iframe cannot send custom headers. Thus a token or a proxy must protect the URL.

**Preview proxy.** A small Cloudflare Worker on a separate domain. It makes sure that the user has a session. Then it sends the traffic to the sandbox port.

**Public Suffix List (PSL).** A list that tells browsers that each `*.wandit.app` site is a separate site. Without it, 1 published app can read the cookies of another app on a sister subdomain.

**Supabase Management API.** The REST API at `api.supabase.com/v1`. It creates projects, reads keys, runs SQL, sets the login configuration, deploys functions, and reads logs. Lovable Cloud runs on it.

**Supabase for Platforms.** The partner program for products that create Supabase projects for their users. It offers small instances that scale to 0. The price is by contract.

**Row Level Security (RLS).** Postgres rules that decide which rows a user can read or write. Apps written by an agent often have missing or open rules. This is the most common security incident in this product class.

**Workers for Platforms (W4P).** A Cloudflare product. It runs 1 Worker per customer app in a dispatch namespace. V2 needs it only when a generated app needs server code on Cloudflare.

**Cloudflare for SaaS.** The Cloudflare product that V1 already uses for customer domains and certificates.

**Git bundle.** One file that holds git history. After each turn, the sandbox uploads a small bundle to R2. Wandit can rebuild a sandbox from the bundles.

**Expo Go.** An app from the Apple and Google stores. It loads a JavaScript bundle from a Metro dev server with a QR code. It has 1 fixed Expo SDK version. Since May 2026, it loads only EAS Update projects that the user owns.

**Expo dev client.** A custom build of the Expo Go idea. It has the exact native modules of 1 app. Wandit can publish its own preview app this way.

**Metro.** The bundler and dev server for React Native. It runs inside the sandbox on port 8081.

**EAS.** Expo Application Services. Cloud builds, over-the-air updates, and store submission. The wandit app already uses it.

**Appetize.io.** A hosted iOS simulator and Android emulator. It streams the device into a browser iframe. Expo Snack uses it. The price is per minute.

**serve-sim.** An open-source tool for macOS. It captures an iOS Simulator screen and streams it as MJPEG or H.264 over WebSocket. It also sends touch input.

**KVM.** Kernel virtualization. An Android emulator needs it for usable speed. Firecracker sandboxes do not give it.

**Prompt injection.** Text in a fetched page, an uploaded file, a repo, or a database row. The text tries to give orders to the agent. The defense has 2 parts: block all network output by default, and keep secrets out of the sandbox.

**Credential brokering.** The sandbox firewall adds the real API key to each outgoing request. The key never exists inside the sandbox. Vercel Sandbox has this feature.

**Checkpoint debit.** A credit charge during 1 long agent run, each N steps. A user cannot run past the balance before the final charge.

## 6. The building blocks of V2

Each block has 5 parts: what it does, the options, our choice, the cost, and what is not sure. The detailed file has the tables and the URLs.

### 6.1 The coding agent, or harness

Detailed file: `research/ai-sdk-harness.md`.

**What it does.** The harness replaces the Builder agent and the edit tools of V1. It reads and writes real files in the sandbox. It runs commands. It keeps its own session history.

**The options.**

- Option A: AI SDK `HarnessAgent` with the Claude Code adapter and Vercel Sandbox. It works today.
- Option B: The Claude Agent SDK directly in containers that wandit controls. The same prompts, skills, and tools work in both options.
- Option C: Anthropic Managed Agents. Price $0.08 per session-hour plus tokens. It has no documented preview port. It is not for an interactive builder.

**Our choice.** Option A for the prototype. Option B is the fallback.

**Important facts.**

- AI SDK v7 (`ai@7.0.91`) ships `HarnessAgent` in `@ai-sdk/harness@1.0.100`. Ten adapters exist. Claude Code is the first one.
- The harness always runs inside a sandbox. It does not run on the app server.
- The Claude Code adapter installs the Claude Agent SDK and the Claude Code CLI inside the sandbox. It sends events back over 1 WebSocket port.
- The session owns its history. The server keeps a small resume state per chat. The server does not send the full transcript again.
- The stream uses the same `createUIMessageStream` path that V1 uses in `ai-chat.service.ts:1020`. Custom data parts can share it.
- Usage arrives as token counts. The adapter does not give a dollar cost.
- Only 1 sandbox provider has an adapter: `@ai-sdk/sandbox-vercel`. Another sandbox needs a custom provider. The interface is not documented. No public example exists.
- The server must move to `ai@7.0.91` or later first. Otherwise 2 copies of `ai` load.
- One Claude process needs about 1 GiB of memory, 5 GiB of disk, and 1 CPU. Claude Code prefers 4 GB of memory.

**License.** The Agent SDK is permitted in products that you sell to end users, with your own API key. End-user login with claude.ai is forbidden. The "Claude Code" brand name is not permitted. One point is UNVERIFIED: which license clause applies when the Claude Code CLI runs inside a hosted sandbox. Ask Anthropic sales in writing before external users.

**Risk.** The package `@ai-sdk/harness` is experimental. Vercel expects breaking changes. Pin the versions. Put a wandit interface in front of it.

### 6.2 The sandbox

Detailed file: `research/sandboxes.md`.

**What it does.** The sandbox runs 3 things per project at the same time: Claude Code, a Vite dev server, and a Metro dev server. It keeps the project files between chats. It needs 2 vCPU, 4 GB of memory, and 3 open ports.

**The options.** The research compared 13 providers.

| Rank | Provider | Isolation | What survives a pause | Preview login | Price for 2 vCPU and 4 GB |
|---|---|---|---|---|---|
| 1 | Vercel Sandbox | Firecracker | disk | public URL, needs a wandit proxy | about $0.13 per hour |
| 2 | E2B | Firecracker | disk and memory | header token, needs a proxy | $0.166 per hour, plus $150 per month |
| 3 | Daytona | containers | disk | signed URL, works in an iframe | $0.166 per hour, EU region |
| 4 | Modal | gVisor | none | header | $0.24 to $0.38 per hour |
| 5 | Cloudflare Sandboxes (GA since 2026-04) | own Linux VM | disk, by snapshot at sleep. Memory: not yet | host-name token, public by default | $0.08 to $0.22 per hour (2 vCPU, 8 GiB) |
| 6 | Fly Machines | Firecracker | volumes | you build it | cheapest, but you build the routing |
| - | StackBlitz WebContainers | in the browser | - | - | cannot run Claude Code |

**Our choice.** Vercel Sandbox first. It is the only provider with a harness adapter. Use the Paris region `cdg1`. Create 1 sandbox per project with `Sandbox.getOrCreate`. Take a snapshot at stop. Restart Vite and Metro in `onResume`. Block all network output by default. Use credential brokering. Cloudflare Sandboxes is the second choice. It is GA, it has disk snapshots and credential injection, and it is already in your stack. It needs a custom harness adapter, about 2 weeks. E2B is the third choice.

**The cost.** Vercel bills the CPU only when it is active. A warm project hour costs about $0.13.

**Not sure yet.** Vercel preview URLs are public. Thus a proxy with a session check is mandatory. Snapshots keep the disk only. Thus the dev servers restart at each resume. Traffic on an open port costs $0.15 per GB. Vite hot reload and Metro bundles add to this cost.

### 6.3 What the other builders do

Detailed file: `research/competitor-architectures.md`.

The market agrees on 1 shape:

- A chat agent writes code in an isolated Linux workspace.
- A dev server shows a live preview in an iframe.
- A managed backend is created per project behind the product.
- Each change becomes a version that the user can restore.
- Git is hidden by default. GitHub sync is an option.
- Publish is 1 click to the hosting of the vendor.
- One credit pool pays for the build and the run.

There are 3 backend strategies. Lovable Cloud and Bolt Cloud rent Supabase and hide it. Base44, Replit, and Emergent own their backend. v0 and old Bolt connect the service of the user. Bolt lets the user "claim" the Supabase project. Lovable has no exit path, and users complain.

There are 3 sandbox strategies. Lovable, v0, and the harness path use Firecracker. Emergent uses Kubernetes pods with a warm pool. Bolt uses WebContainers in the browser.

For mobile, all builders generate Expo. They show React Native Web in the browser. They send the user to Expo Go with a QR code. Only a0.dev has a custom iOS preview app. No builder streams a cloud iOS simulator as the main preview.

Lovable runs a security scan of 10 to 15 seconds at each publish. The scan checks RLS, the schema, and the dependencies. It blocks the publish on critical findings.

The 3 most important lessons for wandit:

1. Use the v0 shape. The agent runs in the microVM. The preview runs on an open port behind a short token. Take a snapshot at stop.
2. Build a "claim" exit path from day 1.
3. Choose web or mobile when the project is created. A web project does not become an Expo project.

### 6.4 The backend for user apps

Detailed file: `research/backend-on-behalf.md`.

**What it does.** A generated app needs a database, login, file storage, server functions, secrets, jobs, email, and logs. Your screenshot of Lovable Cloud shows this list. Wandit must create all of it for the user, without the user seeing Supabase.

**The options.** Supabase is the primary choice. Neon is the best database-only alternative. Cloudflare D1 is a possible small database level later. Convex, Turso, PlanetScale, Firebase, Nhost, InsForge, and PocketBase were examined and rejected.

**Why Supabase.** The Management API covers project creation, keys, SQL, login configuration, function deploy, secrets, storage, logs, pause, restore, and a claim flow. Supabase ships a Platform Kit with panels for the database, users, storage, secrets, logs, and SQL. This kit is the reference for the Cloud tab.

**The cost.** Each running project bills a Micro instance. The price is $0.01344 per hour, or about $9.8 per month. One thousand projects that never sleep cost about $9.8k per month. A paused project costs nothing. The partner program sells instances that scale to 0. No Supabase region exists in Africa or the Middle East. Paris and Frankfurt are the nearest regions.

**Our choice.**

- One Supabase project per wandit app, in organizations that wandit owns.
- Create the project only when the app needs it. The agent calls a tool `ensure_backend` on the first need for login, data, storage, functions, email, payments, or jobs.
- A pure landing page keeps the V1 leads path.
- Pause a project after 7 idle days. Restore it on demand with a "waking up" state.
- Keep the service keys and the platform token on the server. Give the harness a project-scoped MCP or a proxy token.
- Build the Cloud tab on a server proxy, like the Platform Kit.
- Contact Supabase partnerships now.
- Keep a `BackendProvider` interface. A Neon level can come later.

**Login, email, payments, jobs.** Use Supabase Auth in the generated apps. Use 1 wandit Resend account with 1 domain per tenant. Store the sending key as a Supabase secret. For payments, phase 1 uses the Stripe restricted key of the user, stored as a secret. Stripe availability in Morocco is UNVERIFIED. Users who sell with cash on delivery do not need cards at first. Use `pg_cron` for jobs.

### 6.5 Mobile apps with Expo

Detailed files: `research/expo-mobile.md` and `inspect-native-and-simulator.md`.

**What it does.** The user asks for a mobile app. Wandit generates an Expo project in the same sandbox. Then the user must see the app.

**The options.**

| Option | Cost | Limit |
|---|---|---|
| Expo web in the same iframe as web previews | sandbox time only | Native modules, camera, biometrics, and purchases do not show. |
| Expo Go on the phone of the user, with a QR code from the sandbox | free | Expo Go has 1 fixed SDK. The store version was months late in 2026. Since 2026-05-12, it loads only projects that the user owns. Login with OAuth does not work. |
| A wandit preview app, built with expo-dev-client, on TestFlight and Play internal testing | EAS builds, $1 to $4 each after 15 free builds per month | This is what a0.dev and Vibecode do. It removes the Expo Go problem. |
| Appetize.io, a hosted device in the browser | Starter $59 per month for 500 minutes and 3 devices. Premium $319 per month for 16 devices. $0.06 per extra minute. | Expo Snack uses it. It is the only product with an embed API. |
| Own Android emulators with WebRTC | bare metal $100 to $300 per month (UNVERIFIED), or Genymotion $0.06 per minute | It needs KVM. Thus it needs a separate host fleet. |
| Own iOS simulators on rented Macs with serve-sim | Scaleway from EUR 0.22 per hour. MacStadium $149 per month. AWS about $1.23 per hour. All have a 24-hour minimum. | The Apple license permits 2 VMs per host, for development and test only. It needs a legal review. |

**Our choice.** Phase 1: Expo web in the iframe, plus a QR code for Expo Go. Pin the template to the SDK of the store Expo Go. Permit only modules that work on web and in Expo Go. Phase 1.5: publish a wandit preview app. Add Appetize on demand. The dev client loads the JavaScript from the sandbox. Phase 2: own Android emulators, then a Mac mini pool with serve-sim after a legal review. Keep EAS for builds and store submission.

**Store accounts.** A user needs an Apple account ($99 per year) and a Google account ($25, plus a closed test with 12 testers). Wandit must guide the user through this.

### 6.6 Hosting and publish

Detailed files: `research/hosting-publish.md` and `inspect-publish-serve.md`.

**The key fact.** Cloudflare charges $0 for data transfer out. Vercel charges $0.15 to $0.35 per GB after 1 TB. At 10 TB per month, Cloudflare costs about $60. The others cost $1,500 to $3,800. Wandit already runs the right shape on Cloudflare.

**Our choice, phase 1.** Extend the `wandit-edge` Worker so that it serves a Vite build from R2.

- Store each file by its hash at `apps/blobs/{sha256}`.
- Store 1 manifest per build. The manifest lists the files.
- Store 1 small flip object `current.json` per project. A publish changes only this object.
- Keep the KV pointer without a version.
- Serve `index.html` for unknown paths (SPA fallback). Serve hashed files with long cache headers. Set the content type per file.
- Rollback, unpublish, and suspend change only the pointer.
- Build inside the sandbox with `vite build`. Upload only the new files. Do not use a git-based CI.
- Show each build at a preview host with 1 level, for example `d-{id}--{slug}.wandit.app`. Universal SSL does not cover 2 levels.

**Our choice, phase 2.** Workers for Platforms, for apps that need server code. The price is $25 per month for 1,000 scripts, then $0.02 per script. Use 1 Worker per deployment.

**The generated web stack.** Vite, React, TypeScript, Tailwind, shadcn, React Router in library mode, and `supabase-js`. The output is static files. Server logic lives in Supabase Edge Functions. This is the same shape as Lovable.

**Rejected hosts.** Cloudflare Pages has a limit of 100 projects per account. Vercel is expensive for data transfer and has a limit of 6,000 deployments per day. Netlify has a limit of 100 deploys per day. Railway permits 20 custom domains.

**Before launch.** Scan each publish with the Cloudflare URL Scanner API or Google Web Risk. Limit the publish rate. Ask for a verified account before a custom domain. Keep the `suspended` pointer as the kill switch. Submit `wandit.app` to the Public Suffix List.

### 6.7 Version history

Detailed file: `research/git-versioning.md`.

**The market shape.** One version per chat change. Git is hidden. GitHub is an optional export. A restore changes the code only. It never changes the database. Only Replit restores data.

**Why git in the sandbox.** Claude Code has a file checkpoint feature. It tracks only the Write and Edit tools. It misses Bash edits. It is tied to 1 session. Thus a real git repository inside the sandbox must be the source of truth.

**Why not sandbox snapshots.** A snapshot per message at 2 GB costs about $32 per project per month (ESTIMATE). Git costs cents. R2 costs $0.015 per GB per month with free transfer out. A source-only repo is 1 to 10 MB after 200 messages (ESTIMATE). Ten thousand projects cost about $15 per month in R2.

**Why not GitHub as the store.** GitHub has a limit of 100,000 repos per account and 500 creation requests per hour. User code inside a wandit organization is a privacy problem. Gitea or Forgejo is a good internal remote in a later phase.

**Our choice.**

- Git inside the sandbox.
- The server, not the model, makes 1 commit per assistant turn. The tag is `msg/<messageId>`.
- After each commit, the sandbox uploads a small bundle, a patch, and a numstat file to R2 under `git/{projectId}/`. Each 50 commits, it uploads a full bundle.
- The tables `app_commits`, `app_bundles`, and `app_branches` hold the version list. They use the same compare-and-swap rule as V1.
- A restore is a copy-forward commit. This is the same rule as `page-edits.service.ts:188-234`.
- Each chat becomes a git branch later.
- Export to GitHub later, with a GitHub App user token.
- Media and secrets never enter git.
- Permission rules deny `git push`, `git reset`, and `git checkout` to the agent.

**Alternative found on 2026-09-05: code.storage.** A hosted git storage by Pierre, made for products like wandit. Repos are created by API. Push, fetch, and clone use normal git. SDKs exist in TypeScript, Python, and Go, with webhooks and a sync engine to GitHub. Lovable uses it for each project: 8 million new repos per week, 250 per second at peak, 99.99 percent uptime (https://code.storage/changelog/lovable-case-study). Price: $20 per month minimum, hot storage $0.005 per GB per hour for the last 7 days, cold storage $0.0002 per GB per hour, $0.15 per GB out (https://code.storage/pricing). It replaces the bundle upload and the later Gitea remote with 1 managed service. Add it to the P0 tests next to the bundle design. If it passes, use it from day 1. The bundle design stays as the fallback.

### 6.8 Streaming and background jobs

Detailed file: `research/agent-runtime-patterns.md`.

**The shape.** Each reference product runs the harness inside the sandbox. A thin host relays the events.

**The host.** The host must be a Trigger.dev task, not an HTTP request. The task gets an abort signal and a cancel hook. The API can cancel it. The queue has 1 slot per project. Each turn has an idempotency key. Inngest cannot interrupt a step. BullMQ needs a worker service that wandit no longer runs.

**The session state.** The state has 2 parts: the Claude Code transcript and the files. Both live in the sandbox folder. A persistent sandbox restores both. Between turns, the task calls `session.detach()`. After idle time, it calls `session.stop()`. Processes do not survive a snapshot. Thus `onResume` restarts the dev server and Playwright.

**The browser stream.** The AI SDK v7 `ChatTransport` interface has 2 functions: `sendMessages` and `reconnectToStream`. The hook `useChat({ resume: true })` calls the second one at mount. The design sends each message chunk to 2 places. A Redis Stream feeds the browser through SSE with `Last-Event-ID`. V1 already has this relay code. A Trigger.dev stream keeps the durable copy.

**The lock.** Redis `SET NX PX` with a heartbeat. A partial unique index on active turns. The Trigger.dev queue per project. A fencing turn id in each write.

**Auto-fix.** The task reads the dev-server log. A Playwright page inside the sandbox reads the browser console errors. V1 already does this. An iframe `postMessage` bridge sends user errors. The loop is limited and optional, like the Lovable "Try to fix" button.

**Risk.** Any Trigger.dev wait longer than a few seconds saves the machine state and kills the bridge WebSocket. The task must detach first. The bridge behavior at a host abort without detach is UNVERIFIED.

### 6.9 Security

Detailed file: `research/security.md`.

**The 3 new risks.** V2 adds an agent that runs shell commands. V2 holds backend secrets for users. V2 publishes apps with server logic.

**The core rule.** Run Claude Code inside a microVM with its own kernel, as a non-root user. Keep each credential outside the VM. Block all network output by default. Anthropic ranks isolation from weak to strong: sandbox-runtime, containers, gVisor, Firecracker.

**The model key.** Claude Code reads `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_CUSTOM_HEADERS`. The design gives each run a short token. A wandit proxy checks the token, adds the real key, and limits the dollars per run and per user. The proxy must pass the `anthropic-beta` and `anthropic-version` headers without change. It must keep `cache_control`. Otherwise features stop silently.

**User secrets.** The Supabase secret key ignores all RLS rules. In 2025, a prompt injection through the Supabase MCP leaked OAuth tokens. Add secrets at the network proxy or through server tools. Ask users for Stripe restricted keys.

**The preview.** The preview needs `allow-same-origin` for login sessions. Thus it must live on a separate domain with 1 origin per project. It needs a PSL entry, `frame-ancestors` headers, no `allow-top-navigation`, and a signed token.

**The publish gate.** Run the Supabase security advisors and block on ERROR. Run an anonymous RLS probe. This probe finds the CVE-2025-48757 class, where Lovable apps were open to unauthenticated users. Scan for secrets. Run a phishing classifier. Cloudflare disables hosted content on a valid abuse notice. Thus wandit must find abuse first.

**Cost caps.** Three layers: a dollar limit per run at the proxy, sandbox CPU and session time limits, and a Supabase usage limit per project with pause.

**Data residency.** Anthropic offers only `global` and `us` for inference. API data stays for 30 days by default. Supabase has 6 EU regions. Write this in the privacy policy.

### 6.10 Money

Detailed file: `research/unit-economics.md`.

**Model prices on 2026-09-03.** Sonnet 5: $2 in and $10 out per million tokens. Opus 5: $5 and $25. Fable 5.1: $10 and $50. Haiku 4.5: $1 and $5. Models from version 4.7 make about 30 percent more tokens.

**The cost estimate.** The Agent SDK gives `total_cost_usd`. Anthropic says that this number is an estimate. Do not bill users from it. Count the tokens with your own price table.

**Cost per message.** With Sonnet 5 and caching, a small edit costs about $0.14. A typical feature message costs about $0.44. A large build costs about $1.40. The sandbox is 3 to 6 percent of the total. Opus 5 costs 2.5 times more.

**The problem.** With `1 credit = $0.04`, a typical message is about 10 credits. The Pro plan gives 175 credits for $25. This buys about 17 typical messages at a 72 percent margin. The Lovable plan for $25 buys about 100 messages. Lovable had a margin of about 35 percent in May 2025 (secondary source).

**Items that credits cannot buy.** A Supabase backend costs about $10 per month. This is more than the AI budget of the Pro plan. Mobile preview minutes cost $0.06 per minute. Make these items plan entitlements or add-ons.

**Our choice.** Measure real step counts and token sizes in staging for 2 weeks. Then fix the credit mapping. Use Sonnet 5 at medium effort by default. Use a 1-hour cache. Limit each turn with `maxBudgetUsd`, about $2 on Pro. Limit subagents to depth 1 and 3 in parallel. Offer Opus 5 as a visible mode that costs 2.5 times more. Show an estimate before each run and a receipt after it.

---

# Part C. The recommended design

## 7. How we made the recommendation

Three agents wrote 3 independent proposals. The angles were: fastest path to Lovable, Cloudflare-native, and vendor-managed with the least operations. The proposals agree on 11 of 15 blocks. Section 8.3 lists the differences and the decision for each.

A judge panel and a critic were part of the workflow. They failed 3 times with API 529 overload errors, during a Claude service incident. The main agent made the synthesis below from the full material. Section 15 says how to run the judges later.

## 8. The design

### 8.1 One picture

```
Browser  apps/web  (the /p/$projectId shell, useChat + BuilderTransport)
  |  POST /api/v2/projects/:id/turns             NestJS API on Railway
  |  GET  /api/v2/projects/:id/turns/:id/stream   admission, lock, credit hold,
  |  POST /api/v2/projects/:id/turns/:id/cancel   Redis Stream relay (V1 code)
  |  <iframe src="https://<run>-<project>.<preview-domain>">
  v
Redis  (turn:{turnId} streams, builder:lock:{projectId})   <- move to the API region
  ^
Trigger.dev task  builder-turn   (1 slot per project, idempotent per turn)
  - HarnessAgent + Claude Code adapter, 1 session per chat
  - sends each chunk to Redis (browser) and to a Trigger stream (durable copy)
  - after the turn: git commit msg/<id>, bundle + patch to R2, versions row
  | WebSocket bridge        preview port        Playwright service
  v
Sandbox  (Vercel Sandbox, cdg1, Firecracker, 1 per project)
  - /workspace git repo, Vite or Metro dev server, harness bootstrap
  - network output blocked by default, no platform secret inside
  +--> LLM proxy  (short token in, real key added, dollar limit per run)
  +--> R2 by presigned URL  (git bundles, patches, screenshots)
  +--> <ref>.supabase.co   (public key only)

Publish  Trigger task publish-app -> vite build in the sandbox -> R2 published/{projectId}/d/{deploymentId}/*
         -> flip object current.json -> deployments row -> wandit-edge serves it (KV pointer unchanged)
Backend  Supabase project per app in a wandit org, created on first need, paused when idle
Domains  Cloudflare for SaaS (unchanged)
Mobile   Expo project in the same sandbox. Expo web in the iframe. QR to Expo Go. Later: dev client + Appetize
```

### 8.2 The choice per block

**1. Agent runtime.** Choice: AI SDK v7 `HarnessAgent` with the Claude Code adapter. One harness session per project. Every message goes to it, including questions. There is no Brain agent in V2. The design worlds, the brief rules, and `ask_user` move into the template as `CLAUDE.md`, skills, and host tools. Sonnet 5 at medium effort. Built-in tools run without approval. Wandit tools that spend money or publish need approval. Fallback: the Claude Agent SDK directly. Why: it deletes the 2,440-line Builder and the Brain handoff. It streams the parts that V1 already shows.

**2. Sandbox.** Choice: Vercel Sandbox Pro in `cdg1`. One persistent sandbox per project. A custom image with Node 22, pnpm, git, Chromium, and the Expo CLI. Snapshot at stop. Idle stop after 20 minutes. Rebuild from R2 bundles when the snapshot expires. Fallback: Cloudflare Sandboxes behind a `SandboxProvider` interface, after a custom harness adapter. E2B is the third option. Why: Vercel is the only provider with a harness adapter today.

**3. Web template.** Choice: Vite, React, TypeScript, Tailwind, shadcn/ui, React Router, supabase-js, and a small `@wandit/leads` package. Arabic, French, and RTL included. A `CLAUDE.md` and skills in the template. Deny rules for git and configuration paths. Why: static output that the edge Worker can serve.

**4. Mobile template and preview.** Choice: Expo pinned to the SDK of the store Expo Go. The project type is chosen at creation. Phase 1: Expo web in a phone frame plus a QR code. Phase 1.5: a wandit preview app plus Appetize with minute limits. Last: own device fleet. Why: no competitor streams a simulator as the main preview. Zero fixed cost first.

**5. Backend.** Choice: Supabase, 1 project per app in wandit organizations. Created on first need. Supabase Auth. Resend with 1 key per tenant. The Stripe restricted key of the user. `pg_cron`. Secrets on the server. Pause after 7 idle days. Cloud tab on a server proxy. A claim export from day 1. Fallback: a Neon level for database-only apps. Why: the Lovable Cloud model with full API coverage.

**6. Versions.** Choice: git inside the sandbox. One commit per turn. Bundles to R2. Tables `app_commits`, `app_bundles`, and `app_branches`. Copy-forward restore. Fallback: Gitea as an internal remote later. Why: the cheapest durable store. Claude Code checkpoints miss Bash edits.

**7. Preview.** Choice: a separate preview domain with wildcard DNS. A small Cloudflare Worker checks a 15-minute signed token, sets a cookie, and forwards HTTP and WebSocket traffic to the sandbox port. One origin per project and run. A PSL entry. Why: Vercel preview URLs are public. A bad project on the builder domain can read builder cookies.

**8. Publish and hosting.** Choice: extend `wandit-edge` with an immutable prefix per deployment, 1 flip object, path routing with SPA fallback, and content types per file. Build in the sandbox from a Trigger task with a security gate. Cloudflare for SaaS unchanged. CI for the Worker. Later: Workers for Platforms for server apps. Why: $0 transfer cost. The domains module stays unchanged.

**9. Streaming and jobs.** Choice: the Trigger.dev task `builder-turn` with 1 slot per project. Each chunk goes to a Redis Stream and to a Trigger stream. A custom `ChatTransport` with `reconnectToStream`. A Redis lock, a unique index, and a fencing turn id. Cancel with `runs.cancel` and a work-in-progress commit. A queue for messages that arrive during a turn. Why: the API has 1 replica. A closed tab must not kill a run.

**10. Money.** Choice: keep `1 credit = $0.04`. New operations `agent_session` with checkpoint debits, `sandbox`, `backend_provision`, `backend_hosting`, and `mobile_preview`. Price from token counts with the server price table. Add `projectId` to usage events and a `project_cost_caps` table. Show an estimate before and a receipt after each turn. Backends and preview minutes are plan entitlements. Why: the ledger, reserve, settle, and reconcile stay as they are.

**11. Security.** Choice: a Firecracker VM as non-root. No credential in the VM. Network output blocked by default, with private ranges denied. A `PreToolUse` hook that denies writes to `.claude`, `.mcp.json`, `.git/hooks`, and shell files. A separate preview domain. The publish gate from section 6.9. The `suspended` pointer with a reason. An `audit_events` table. Redis rate limits. A separate Anthropic workspace with a spend limit. Why: this is the checklist in `research/security.md`.

**12. Module and rollout.** Choice: the module `apps/server/src/modules/app-builder`. It loads only when `V2_BUILDER_ENABLED=true`, like the `QueuesModule` pattern. Routes under `/api/v2`. Contracts in `packages/contracts/src/v2`. A new column `projects.engine` with values `v1_page` and `v2_app`. The `/p/$projectId` shell shows a different body per engine. A `product_settings` flag, a PostHog flag per user, and a server guard. Rollout: `dev`, then `staging` with the switch on, then `main` with the switch off, then per user. Why: V1 stays untouched for production users.

**13. Migration and leads.** Choice: V1 projects keep `engine = v1_page`. Later, a 1-way "Upgrade to app" creates a V2 project from the V1 HTML. V2 publishes keep the `deployments` rows and the KV contract, so `leads.deploymentId` stays valid. Leads go to the unchanged `POST /api/public/leads/{publicFormId}` from the SDK. The currency is configurable. Pixels come from public environment values. `generate_image` becomes a server tool on the existing R2 layout. MCP connectors attach to the V2 chat without change. Why: nothing in V1 breaks.

### 8.3 Where the proposals disagreed, and the decision

| Topic | Options | Decision |
|---|---|---|
| The model proxy before Anthropic | Cloudflare AI Gateway, Vercel AI Gateway, or an own proxy with LiteLLM | Test Vercel AI Gateway first. V1 already reconciles costs with its generation ids. It documents a Claude Code recipe. Put a thin wandit proxy in front for short tokens and dollar limits. Cloudflare AI Gateway is UNVERIFIED for the beta headers and `cache_control`. |
| Where the turn runs in phase 1 | Inside the API request (saves about 2 weeks), or a Trigger.dev task from day 1 | A Trigger.dev task from day 1. The API has 1 replica. A deploy or a closed tab kills a request. The relay code exists. |
| The sandbox target | Stay on Vercel, move to Cloudflare Sandboxes later, or E2B | Stay on Vercel behind a `SandboxProvider` interface. Cloudflare Sandboxes is the second choice: GA since April 2026, disk snapshots, credential injection, same stack. It needs a custom harness adapter. Move only when the adapter passes the tests and the vendor count matters. The move saves less than $1 per project per month. |
| The preview host | A 1-level host on `wandit.app`, or a separate domain | A separate domain. The cookie risk is larger than the convenience. |
| The publish flip | An R2 flip object, or `deploymentId` in the KV pointer | The R2 flip object `current.json`. KV is eventually consistent. The domains pipeline writes pointers without deploy knowledge. |
| The browser transport | Trigger Realtime directly, or a Redis SSE leg through the API | The Redis SSE leg. The Trigger stream is the durable copy. Durable Object fan-out later, if needed. |
| Sandbox minutes | Per credit, or included | Included in the plan, with evidence rows and a 10-minute idle stop. Examine again with data. |
| Effort | 15.5 to 22.5 engineer-weeks, 25, or 44 | Plan about 24 engineer-weeks to web Lovable Cloud parity plus mobile phase 1. This is for 1 senior engineer who knows the repo. |

## 9. One chat turn from start to end

1. The user sends a message. The web app sends `POST /api/v2/projects/:id/turns` with the workspace header.
2. The API checks the plan, the project limit, and the balance. It reserves a hold and takes the Redis lock. It writes a `builder_turns` row. It starts the `builder-turn` task with `idempotencyKey = turnId`. It returns the turn id at once.
3. The web app opens `GET .../turns/:id/stream`. The custom `ChatTransport` reads SSE with `Last-Event-ID`. A page refresh resumes the stream.
4. The task gets or creates the project sandbox. At resume, it restarts the dev server and the Playwright service. It creates or resumes the harness session from the stored state.
5. The harness runs Claude Code inside the sandbox. Model calls go to the LLM proxy with a short token. Wandit tools run on the server side. Tools that spend money need approval.
6. The task writes each chunk to the Redis Stream and the Trigger stream. Each N steps, it takes a checkpoint debit. It makes sure that the balance and the project limit are not exceeded.
7. The preview iframe shows the dev server through the preview proxy. Hot reload works over the WebSocket.
8. At the end of the turn, the task commits the files as `msg/<messageId>`. It uploads the bundle, the patch, and the numstat to R2. It inserts the `app_commits` row. It settles the hold from the token counts.
9. The message row stores the harness parts, the usage, and the commit sha. The Versions list shows the new entry. A restore is a copy-forward commit.

## 10. Changes to the database and the environment

**New tables.** All are additive. They copy the attempt-row pattern.

- `builder_sessions`: the harness resume state per chat.
- `builder_turns`: status, `requestKey`, `triggerRunId`, input and output commit, `failure_*`, `sentry_event_id`.
- `sandbox_sessions`: provider id, image, status, preview host, `expiresAt`.
- `app_commits`, `app_bundles`, `app_branches`: the version list.
- `app_backends`: 1 hidden Supabase project per V2 project, with reference, region, and status.
- `project_secrets`: encrypted values or an external reference. Never plain text.
- `app_builds`, `mobile_builds`: web builds and Expo builds.
- `project_cost_caps`, `audit_events`.

**Changed tables.** `projects` gets `engine`, `targetPlatform`, and `framework`. `deployments` gets `kind`, a build prefix, a file count, and bytes. `ai_usage_events` gets `projectId` and new `operation` values. `product_settings` gets `v2BuilderEnabled`. `messages` gets a turn id link.

**Untouched.** Everything that V1 reads. A `v2_app` project never inserts an `artifacts` row. Thus both engines are safe in 1 database.

**New environment values.** All are optional at boot. The code checks them at call time. `V2_BUILDER_ENABLED`, `VERCEL_SANDBOX_TOKEN`, `ANTHROPIC_API_KEY` for the proxy in a separate workspace, `LLM_PROXY_SIGNING_KEY`, `SUPABASE_PLATFORM_TOKEN`, `SUPABASE_PLATFORM_ORG_ID`, `APP_SECRETS_ENCRYPTION_KEY`, `PREVIEW_DOMAIN`, `PREVIEW_TOKEN_SIGNING_KEY`, `CLOUDFLARE_V2_DEPLOY_TOKEN`, `EXPO_TOKEN`, `APPETIZE_API_TOKEN`, `RESEND_PLATFORM_API_KEY`.

## 11. The phases

Each phase is a slice that you can use. Each phase ends in the staging environment with the switch on. The effort is an ESTIMATE for 1 senior engineer who knows this repo.

**P0. Tests and vendor answers. 3 weeks.**

- Upgrade `ai` to 7.0.91.
- Run `HarnessAgent` with the Claude Code adapter on Vercel Sandbox from a Railway-like process. Measure the token form, the boot time, the resume time, a second open port, the usage events, the hook events, and the abort behavior.
- Run the LLM proxy path. Measure `cacheReadInputTokens`.
- Measure the cost on 20 real prompts.
- Send the Supabase partnerships form.
- Ask Anthropic sales the license question in writing.
- Buy the preview domain. Submit the PSL entry.
- Ask Vercel for sandbox quota.
- Correct the 4 V1 gaps: the Redis region, CI for types and tests, CI for the edge Worker, and the staging same-site problem.

**P1. Web builder alpha for internal users. 9 weeks.**

- The `app-builder` module, the environment values, the v2 contracts, and the new tables.
- The `builder-turn` task, the Redis relay, the `BuilderTransport` with resume, the lock, cancel, and the message queue.
- The sandbox image and its lifecycle.
- The web template with `CLAUDE.md`, the design worlds as skills, and the `ask_user` and `generate_image` tools.
- The preview proxy Worker with signed tokens.
- A git commit per turn with bundles to R2. Versions and Restore with a diff view.
- Harness tool cards, a file tree, the engine switch in the shell, and the composer mode `app`.
- The `agent_session` operation with checkpoint debits. `projectId` on usage events. Project limits. Estimate and receipt.
- Result: internal users build a web app in staging.

**P2. Publish, money safety, and security basics. First external users. 4 weeks.**

- The edge Worker serves many files with `current.json`, a manifest, SPA fallback, content types, headers, and tests.
- The `publish-app` task builds in the sandbox. `deployments.kind`. Pixel and badge injectors on `dist/index.html`. Rollback and unpublish.
- The leads SDK.
- Security basics. These are the network policy, the deny rules and hook, the secret scanner, and `audit_events`. They also include Redis rate limits, the phishing and slug rules, and the suspend switch.
- Result: Lovable without Cloud.

**P3. The Cloud tab with Supabase. 7 weeks.**

- The `provision-backend` task, the Management API queue, `app_backends`, and `project_secrets`.
- The tools `ensure_backend`, `apply_migration`, `run_sql`, `deploy_function`, `set_secret`, and `get_advisors` with an RLS check.
- The Cloud tab panels. These are Database with row counts and rows, SQL editor, Users and signups, and Storage. They also include Secrets (write only), Logs in 24-hour pages, Functions, and Jobs.
- The Resend tenant domain flow. The Stripe restricted key connector.
- The advisors and the RLS probe in the publish gate. Login redirect registration at publish and at domain activation.
- The pause and restore sweeps. Plan entitlements for backends.
- Result: Lovable Cloud parity for web.

**P4. Mobile phase 1. 4 weeks.**

- The Expo template pinned to the SDK of the store Expo Go, with a module allow-list.
- The `mobile` composer mode and the project type at creation.
- Metro in the sandbox with `EXPO_PACKAGER_PROXY_URL` through the preview proxy.
- A phone-frame Expo web preview and a QR panel.
- The `mobile_builds` table and a `mobile-build` task with EAS internal distribution and TestFlight.
- Result: mobile V2 with no new vendor.

**P5. Mobile phase 1.5. 3 weeks.**

- The wandit preview app with expo-dev-client, on TestFlight and Play internal testing.
- EAS simulator and APK builds.
- Appetize upload and embed with the Metro URL. Session limits and preview-minute entitlements.
- Result: a device in the browser on demand.

**P6. Power features. 8 weeks.**

- A branch per chat with `Sandbox.fork` previews and AI merge.
- GitHub export, then 2-way sync.
- Supabase claim export and Vercel claim export.
- Workers for Platforms for server apps.
- Stripe Connect.
- "Upgrade to app" for V1 projects.
- Click-to-target through a Vite source plugin.
- History pagination. Native client parity.
- Early access rollout in production.

**P7. Device streaming. 6 weeks plus legal review.**

- Own Android emulators on KVM with WebRTC.
- A Mac mini pool with serve-sim behind a login proxy.

**Totals.** P0 to P3 is about 23 engineer-weeks. P4 and P5 add 7 weeks. P6 and P7 add 14 weeks plus legal review.

**Dependencies outside engineering.** The Anthropic license letter before external users. The Supabase partnership terms before P3 pricing. The preview domain and the PSL entry in P0. The Cloudflare Workers Paid plan and the API token scopes in P1. Apple and Google developer accounts for the preview app in P5.

## 12. Decisions that only you can make

Each decision changes the tickets. Each item gives the trade-off.

1. **Vercel as the sandbox vendor.** It is the only provider with a harness adapter. It adds Vercel as a runtime vendor next to Cloudflare, Railway, and Trigger.dev. The alternative costs 2 or more weeks for a custom E2B provider.
2. **The price stance.** With the current rule, $25 buys about 17 typical messages at a 72 percent margin. Lovable sells about 100 messages for $25 at a thin margin. Option 1: keep the margin and sell effort. Option 2: lower the margin to 35 to 65 percent. Measure 2 weeks in staging first.
3. **Backends as entitlements.** Suggestion: 1 live backend on Pro, 3 on Business, and a $10 per month add-on. Pause after 7 idle days with a "waking up" state.
4. **The first mobile preview target.** The phone of the user is free but fragile. A browser device costs $59 to $319 per month plus $0.06 per minute. The plan does the phone first.
5. **The preview domain.** A separate domain is required. Tell me if the earlier preview domain exists.
6. **The UI kits for generated apps.** Web: shadcn/ui is the safe default. Mobile: HeroUI Native with Uniwind, as in `apps/native`, or plain Expo components.
7. **Arabic and French in generated apps from day 1.** V1 pages require it. It adds template and prompt work in P1.
8. **The data residency stance.** Anthropic inference is US or global only, with 30-day retention. Supabase and the sandbox can be in Paris. Decide the privacy policy text before external users.
9. **The exit path.** Build the Supabase claim export and the GitHub export in P6, or earlier. The missing exit path of Lovable is a known complaint.
10. **The default model.** Sonnet 5 at medium effort, with Opus 5 as a visible mode at 2.5 times the cost. Fable 5.1 off by default at 3.5 times the cost.
11. **V1 projects.** Keep them on V1 for ever, or build "Upgrade to app" in P6. Nothing forces a migration.
12. **The native app as a V2 client.** Keep it as a V1 client until V2 is stable on web, or mirror the transport in P6.

## 13. Claims that are not sure, and the test for each

| Claim | Why it matters | Test |
|---|---|---|
| The Claude Code adapter sends hook events and usage per step to the host | The changed-files list, the checkpoint debits, and the stall detection need them | P0: run 1 turn and log each event type |
| The token form for Vercel Sandbox outside Vercel | The Trigger task runs on Trigger.dev machines, not on Vercel | P0: log in from a Railway-like process |
| A second open port serves the iframe at an acceptable transfer cost | The live preview | P0: measure the bytes of 1 Vite hot-reload session |
| The bridge and the CLI behavior when the host aborts without `detach()` | Token cost without limit | P0: abort in the middle of a turn and read the proxy log |
| The Vercel image includes git and Chromium | The commit per turn and the screenshots | P0: examine the image, or build a custom image |
| code.storage as the internal git remote works at wandit scale and cost | It removes the bundle system and gives branches, forks, and GitHub sync | P0: create 100 repos, push each turn, fetch on wake, measure latency and cost |
| Prompt caching survives the proxy (`cacheReadInputTokens` > 0) | The cost doubles if caching stops | P0: measure on 20 prompts |
| The Anthropic license clause for a hosted-sandbox harness with the wandit key | It can block the launch | P0: a written answer from Anthropic sales |
| Supabase project limits per organization, the Nano price, and the creation time | The Cloud tab cost and the waiting UX | P0: partnerships call. P3: measure |
| The SDK of the store Expo Go today, and its loading policy | Mobile phase 1 | P4: test on a real phone |
| Appetize devices can reach a public Metro host | Mobile phase 1.5 | P5: trial account |
| Trigger.dev plan prices and Realtime connection limits | The cost of the durable stream copy | P1: read the plan page |
| Cloudflare Sandbox hypervisor and disk behavior | Only if the Cloudflare target is pursued | later |
| The Apple license position on simulators streamed to customers | Only for P7 | later, with a lawyer |

## 14. Costs

Cost per active project per month. All numbers are an ESTIMATE. Measure them in P0. Tokens are 85 to 90 percent of the cost. The sandbox choice moves the total by less than $1.

| Profile | Messages | Tokens | Sandbox | Backend | Mobile | Total |
|---|---|---|---|---|---|---|
| Landing page, no backend | 30 | $13 | $1.30 | $0 | $0 | about $15 |
| Web app with backend | 60 | $26 | $2.60 | $9.81 | $0 | about $39 |
| Mobile app with backend | 60 | $26 | $2.60 | $9.81 | $3.80 | about $43 |
| Idle project | 0 | $0 | $0 | $0 (paused) | $0 | about $0.30 |

Fixed platform costs per month: Vercel Pro $20, Workers Paid $5, Supabase Pro $25 per organization, Appetize Starter $59 (P5), Workers for Platforms $25 (P6). The Trigger.dev plan is UNVERIFIED. A custom domain costs $0.10 per month after the first 100.

## 15. The detailed files

All files are in `docs/v2/research/` in the worktree.

Inspection of V1, 9 files: `inspect-ai-pipeline.md`, `inspect-publish-serve.md`, `inspect-data-model.md`, `inspect-web-builder-ui.md`, `inspect-auth-billing-credits.md`, `inspect-infra-ops.md`, `inspect-native-and-simulator.md`, `inspect-connectors-media-leads.md`, `inspect-product-docs-and-references.md`.

Web research, 10 files: `ai-sdk-harness.md`, `sandboxes.md`, `competitor-architectures.md`, `backend-on-behalf.md`, `expo-mobile.md`, `hosting-publish.md`, `git-versioning.md`, `security.md`, `unit-economics.md`, `agent-runtime-patterns.md`.

Proposals, 3 files: `proposal-fastest-parity.md`, `proposal-cloudflare-native.md`, `proposal-vendor-managed.md`.

Judge panel, synthesis, critic, and gap-fill files: not produced. The API returned 529 overload errors during a Claude service incident. The workflow script in the job log can run them later. They add `judge-*.md`, `synthesis.md`, `critic.md`, and `gapfill-*.md`.

## 16. Next steps

1. Read this report and the 3 proposals. Ask questions.
2. Make the 12 decisions in section 12.
3. Make 1 ticket per test in section 13. Each ticket gets an exit condition.
4. After P0 answers the runtime questions, make the P1 tickets.
