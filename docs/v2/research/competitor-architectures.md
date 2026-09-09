# Competitor architectures — AI app builders as of 2026-09-03

Date: 2026-09-03. Branch: `feat/v2-builder` (identical to `dev`). Author: Claude Fable research agent (read-only, web research; no code changed).

Evidence marks:
- `CONFIRMED` = read on the cited page on 2026-09-03 (primary source: vendor docs, vendor blog, pricing page, GitHub repo).
- `REPORTED` = secondary source (review site, news, forum). Treat as likely but not proven.
- `INFERENCE` = my reading of the facts. Not stated by the vendor.
- `UNVERIFIED` = I could not find a primary or credible source.
- `OLD` = source older than 12 months (before 2025-09-03). Flagged in place.

Repo context (for the V2 plan): the V1 pipeline is mapped in `docs/v2/research/inspect-ai-pipeline.md`. V1 uses two hand-built AI SDK `ToolLoopAgent`s (Brain + Builder), an in-memory virtual file system, and a `srcDoc` iframe preview (`docs/v2/research/inspect-ai-pipeline.md:9-11`). The V2 plan is to replace the hand-built Builder with a coding harness (Claude Code) run through the AI SDK `HarnessAgent` in a sandbox. Section 4 covers that path.

---

## 0. One-page summary

The market has converged on one shape. A chat agent writes code into an isolated Linux workspace. A dev server in that workspace serves a live preview into an iframe. A managed backend (database, auth, storage, functions, secrets) is provisioned per project behind the product. Every change becomes a version the user can restore. Git is hidden by default and offered as a two-way sync for developers. Publishing is one click to the vendor's own hosting. Billing is credits or tokens that cover both building and running.

Three backend strategies exist:
1. **Rent Supabase under your own org, hide it, let users "claim" it later.** Lovable Cloud and Bolt Cloud both do this. `CONFIRMED` (Supabase docs for both).
2. **Own the backend.** Base44 (MongoDB-compatible NoSQL + Deno functions), Replit (Postgres + Replit Auth on Google Cloud Identity Platform), Emergent (MongoDB Atlas per app), Convex Chef (Convex), Google AI Studio (Firestore + Firebase Auth).
3. **Connect the user's own service.** v0 (Vercel Marketplace: Neon, Supabase, Upstash), Bolt classic Supabase integration, a0.dev (Convex or Supabase).

Three sandbox strategies exist:
1. **Firecracker microVMs.** Lovable (Fly.io earlier, then bought Molnett), v0 (Vercel Sandbox), Vercel's harness path.
2. **Kubernetes pods with warm pool.** Emergent (30K+ concurrent).
3. **In-browser WebContainers.** Bolt.new, Convex Chef. No server cost, but Node-only and no native binaries.

Mobile has one dominant answer: generate an Expo/React Native project, preview with Expo Go by QR code, build and submit with EAS. Rork, Replit, Bolt, Vibecode, Anything, a0.dev, Emergent all do this. a0.dev is the only one I can confirm that ships a custom iOS preview app and a React-Native-Web browser preview. Nobody in this list streams a cloud iOS simulator to the browser as their main preview. `INFERENCE`: simulator streaming is a differentiator, but it is expensive and Apple licensing limits macOS virtualization.

---

## 1. Comparison table

| Builder | Agent / model | Sandbox | Preview | Backend | Git / versions | Hosting | Mobile | Pricing unit |
|---|---|---|---|---|---|---|---|---|
| Lovable | Claude family; Build + Plan modes; sub-agents | Firecracker microVMs (Fly.io, then own infra via Molnett) | iframe of dev server (INFERENCE) | Lovable Cloud = Supabase owned by Lovable | Auto version per change; GitHub 2-way sync on one branch | lovable.app + custom domains | Web only; PWA or Capacitor | Credits (build + run) |
| Bolt.new | "Bolt Agent" Standard/Max, model hidden (Claude historically) | WebContainers in browser | Iframe in browser | Bolt Cloud = Supabase owned by Bolt; or user Supabase | Version history; GitHub sync | Netlify-backed bolt.host | Expo + Expo Go QR + EAS | Tokens |
| v0 | v0 agent, multi-model, autofixers | Vercel Sandbox (Firecracker) | Preview URL from sandbox dev server | Vercel Marketplace (Neon, Supabase, Upstash, Blob) | Branch per chat, auto-commit, PR to main | Vercel | None | Credits ($) |
| Base44 | Model selectable (Sonnet 5, GPT-5.6) | Not disclosed | Iframe (INFERENCE) | Own: NoSQL entities + Deno functions + auth | GitHub 2-way sync, AI conflict resolve | Built-in CDN hosting | Web wrapper + store files | Message credits + integration credits |
| Replit Agent 4 | Free/Power/Max/Auto model tiers; parallel agents | Nix container per app (GCP) | Webview in workspace | Own Postgres, Replit Auth, secrets, object storage | Checkpoints + DB time travel; Git in workspace | Autoscale / Static / Reserved VM / Scheduled | Expo, Expo Go, App Store via EAS | Effort-based $ per checkpoint |
| Rork | Not disclosed | Not disclosed | Web preview + Expo Go QR; Rork Max via companion app | Rork Backend serverless functions | Not disclosed | No web hosting; export | Expo (Pro) or SwiftUI (Max) | Messages |
| a0.dev | Not disclosed | Not disclosed | React Native Web in browser + own iOS preview app + Expo Go on Android | Convex or Supabase | Not disclosed | Handles App Store Connect | Expo | Free + $20 Pro (REPORTED) |
| Vibecode | Claude (site says Claude) | Not disclosed | Expo Go / share link / App Clips (REPORTED) | Vibecode Cloud + Better Auth | GitHub push (REPORTED) | yourapp.vibecode.run | Expo + Expo Launch to App Store | $1 credit = $1 AI cost |
| Emergent | E1 builder, E3 orchestrator | Kubernetes pods, warm pool, 30K+ concurrent | Pod URL (INFERENCE) | MongoDB Atlas per app, FastAPI | GitHub integration | Own hosting; VPC on Enterprise | Expo + FastAPI in monorepo | Credits |
| Anything (Create.xyz) | GPT-5 named; "best models" on Max | Not disclosed | iOS preview app (REPORTED) | Auto backend functions + auth (REPORTED) | Code export | Custom domains | Expo | Credits (20K/mo Pro) |
| Convex Chef | AI SDK v4, Anthropic/OpenAI/Google/xAI | WebContainers (fork of bolt.diy) | Iframe in browser | Convex via OAuth provisioning | Export only; being replaced | None built-in | None | Free tier; OSS |
| Google AI Studio Build | Gemini | Not disclosed | Live preview pane; browser Android emulator | Firestore + Firebase Auth auto-provisioned | GitHub 2-way sync | Cloud Run, *.ai.studio | Kotlin/Compose Android | Gemini API usage |
| Firebase Studio | Gemini 2.5 | Cloud VM + Nix (Code OSS) | Web preview; Android emulator (Flutter) | Firestore + Firebase Auth | Git in IDE | Firebase App Hosting | Flutter | Sunset 2027-03-22 |

---

## 2. Per-builder detail

### 2.1 Lovable

**Agent / model**
- `CONFIRMED` Two modes. "Build mode" (was "Agent mode") implements changes end to end. "Plan mode" discusses before code. Build mode can run "up to 10 hours". Tools: browser testing, build error inspection, console/network inspection, image/video generation, web search, doc fetch, backend function verification, file diffs. https://docs.lovable.dev/features/modes
- `CONFIRMED` Users cannot pick a model. "The agent runs on current frontier models, and Lovable rolls out model upgrades automatically". https://docs.lovable.dev/introduction/faq
- `CONFIRMED` Claude customer story: Claude Sonnet 3.5 was "the first model that made agents work"; Claude Opus 4.5 was the next step for long-horizon tasks. Architecture: a primary agent delegates to specialised sub-agents, each matched to a Claude model. Numbers: $400M ARR, 50M+ projects, 200K+ projects/day. https://claude.com/customers/lovable
- `CONFIRMED` Generated stack: React + Vite + Tailwind + shadcn/ui SPA. Backend is Supabase (Postgres, Auth, Storage, Deno edge functions, Realtime). https://vibe-eval.com/guides/lovable-tech-stack/ (`REPORTED`, matches Supabase blog).

**Sandbox / infra**
- `REPORTED` "Lovable.dev uses Fly.io containers with Firecracker MicroVMs" (Pixeljets, 2025-07-14, `OLD`). https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/
- `REPORTED` "Companies like Lovable and Quora run millions of executions through it [Modal]" (Northflank, 2026-07-06). https://northflank.com/blog/best-platforms-for-high-concurrency-sandbox-environments
- `CONFIRMED` Lovable acquired Molnett on 2025-11-25 to bring "infra engineers" and "secure, sovereign cloud infrastructure" in house. The post does not name Firecracker. https://lovable.dev/blog/lovable-welcomes-molnett
- `REPORTED` Molnett ran every container in a Firecracker microVM in EU data centres. https://www.inmotionhosting.com/blog/lovable-acquires-molnett-ai-code-generation-deployment/
- `UNVERIFIED` The "20,000 concurrent sandboxes during a 48-hour event" claim. The search summary attributed it to Lovable, but the Northflank page attributes 20,000 concurrent containers to Modal, not to Lovable. Do not quote it as a Lovable number.
- `INFERENCE` Lovable started on rented microVMs (Fly.io, Modal) and is moving to owned Firecracker infra. The acquisition shows that sandbox cost and control become the main infra problem at scale.

**Preview**
- `INFERENCE` Editor preview is an iframe on the sandbox's dev server. Docs only say "Preview: shows unpublished work in the editor only". https://docs.lovable.dev/features/deploy

**Backend-as-a-service (Lovable Cloud)**
- `CONFIRMED` Cloud is enabled for the workspace by default. It turns on when a feature needs a backend, or asks first depending on permission settings. Includes: Database (tables, records, RLS policies, backups, SQL editor), Authentication (Google OAuth etc.), Storage buckets, Edge Functions with monitoring, Secrets, Jobs (scheduled tasks with run history), Emails (branded, own domain), Logs, Usage dashboard. Regions: Americas, Europe, Asia Pacific; region cannot change after enable. Nine permission toggles (enable Cloud, read/modify DB, add data, configure auth, run security checks, read logs...) each "Always allow / Ask each time / Never allow". https://docs.lovable.dev/integrations/cloud and https://docs.lovable.dev/features/cloud
- `CONFIRMED` "Every project created in Lovable Cloud is powered by Supabase behind the scenes" (Supabase blog, 2025-09-29). https://supabase.com/blog/lovable-cloud-launch
- `CONFIRMED` Lovable Cloud projects are "owned and managed by Lovable". They do not show in the user's Supabase dashboard. No service role key or DB URL is exposed. There is no automated migration to a user-owned Supabase project. https://supabase.com/docs/guides/troubleshooting/identify-lovable-cloud-or-supabase-backend
- `REPORTED` Edge functions run on Deno Deploy infrastructure (search summary of Lovable docs; I did not fetch the exact page). `UNVERIFIED` as to the exact host.
- `CONFIRMED` Connectors: app connectors (runtime OAuth to Google etc.) and chat connectors (MCP, build time). Lovable's gateway handles OAuth, token refresh and revocation. https://lovable.dev/connect (via search; page fetch not done, treat as `REPORTED`).
- `INFERENCE` Lovable uses the Supabase Management API under a Lovable-owned organisation to create one Supabase project per user project. Supabase documents this exact path for partners (OAuth app + `/v1/projects`). https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration

**Versioning / Git**
- `CONFIRMED` Every change creates a version automatically. Revert restores code only, not database data. "Back to latest" leaves a preview snapshot. Bookmarks. Chat continues after revert; later edits stay in the chat and can be reapplied. https://docs.lovable.dev/features/projects/history
- `CONFIRMED` GitHub: a workspace connection (GitHub App on an account/org) plus a per-project repository link. Two-way sync on one active branch at a time (default `main`). If the push is rejected (protected branch), Lovable pushes to `lovable-sync` and the user merges by hand. If the synced branch is deleted, Lovable switches to `lovable-fallback`. Not supported: importing an existing repo, reconnecting the same repo (a new repo is created). Lovable cannot edit files over 10 MB. Repos are private by default. https://docs.lovable.dev/integrations/github

**Hosting**
- `CONFIRMED` Published apps live on `[subdomain].lovable.app` with HTTPS. Business/Enterprise get `app.workspace.lovable.app`. Custom domains on paid plans. Published snapshot stays live; changes need a republish. No staging environment in docs. A basic security scan runs when the publish dialog opens. https://docs.lovable.dev/features/deploy

**Security scanner**
- `CONFIRMED` Basic scan (10-15 s): RLS policy linting, schema review, npm dependency audit. Runs at publish and on demand. Deep scan (about 3 minutes): "thorough agentic review" adding access-control review, endpoint protection, code-level issues (secrets, SQLi, XSS, storage), plus "security memory" of past decisions. Auto-fix for critical Basic findings, opt-in, workspace or project scope. Admins can "Block publishing with critical findings". Scheduled deep scans: Enterprise. Security center: Business and Enterprise. https://docs.lovable.dev/features/security and https://lovable.dev/blog/how-lovable-protects-your-apps-automatically (2026-06-01)

**Mobile**
- `CONFIRMED` "Lovable does not generate React Native projects." Paths: PWA, or wrap the published web app with Capacitor. https://docs.lovable.dev/introduction/faq
- `CONFIRMED` The Lovable mobile app (iOS 15+, Android 9+) is a builder client, not an output. https://docs.lovable.dev/integrations/lovable-mobile-app

**Pricing**
- `CONFIRMED` One credit balance covers building, Cloud hosting and in-app AI. Free: 5 build credits per day, capped at 30/month, plus 20 Cloud credits and 4 AI credits per month. Pro and Business: monthly credits plus the same daily and monthly grants. Plan mode = 1 credit per message. Build mode is usage based; typical tasks $0.50-$2.00 equivalent; examples 0.50 credit for a styling update to 1.70 for a complex landing page. Top-ups: Pro $0.30/credit, Business $0.60/credit, valid 12 months. Cloud/AI usage converts at $0.25/credit (Pro) and $0.50/credit (Business). At zero balance: building stops, in-app AI stops, Cloud-backed apps "can pause", published static sites stay live. Monthly credits expire 2 months after issue. https://docs.lovable.dev/introduction/credits-and-usage and https://lovable.dev/pricing
- `REPORTED` Pro $25/month for 100 credits, Business $50/month (review sites, 2026). https://www.nocode.mba/articles/lovable-pricing

### 2.2 Bolt.new (StackBlitz)

**Agent / model**
- `CONFIRMED` "Bolt Agent" replaced the v1 agent. Standard agent (free plan, fast, token-efficient) and Max agent (paid, "maximum reasoning"). "Bolt handles model selection behind the scenes." v1 agent removed for new projects on 2026-04-13; all v1 projects auto-switched on 2026-08-03. https://support.bolt.new/building/switch-v1-projects
- `REPORTED` Supabase's troubleshooting page calls it "Bolt's Claude Agent". https://supabase.com/docs/guides/troubleshooting/supabase-project-provisioned-via-bolt-not-visible-in-dashboard-7188fc

**Sandbox**
- `CONFIRMED` Bolt runs projects in WebContainers, StackBlitz's in-browser Node.js runtime. Runs npm/pnpm/yarn, all major JS frameworks, WebAssembly. Chromium, Firefox, Safari TP. https://webcontainers.io/
- `INFERENCE` No server-side compute per user. Cost is near zero per session. Limits: Node only, no Python/native binaries, browser tab must stay open, memory limited by the tab.

**Preview**
- `INFERENCE` Iframe served by the in-browser dev server. No public preview URL without publishing.

**Backend (Bolt Cloud)**
- `CONFIRMED` Bolt Cloud (2025-09-30 launch): "every project in Bolt Cloud that needs a backend is powered by Supabase". 600,000+ Supabase backends connected through Bolt at launch. https://supabase.com/blog/bolt-cloud-launch
- `CONFIRMED` Bolt Cloud includes: hosting via Netlify, unlimited databases, auth, file storage, edge functions, analytics, Stripe payments, domain purchase/connect. https://support.bolt.new/cloud/bolt-cloud.md
- `CONFIRMED` The Supabase project behind a Bolt database is owned by "Bolt's organizational account". Users run a "claim" to move it to their own Supabase org. No path back from Supabase to Bolt Database. https://supabase.com/docs/guides/troubleshooting/supabase-project-provisioned-via-bolt-not-visible-in-dashboard-7188fc and https://support.bolt.new/integrations/supabase
- `CONFIRMED` Version history restore does not restore the Supabase database. https://support.bolt.new/integrations/supabase

**Versioning / Git**
- `CONFIRMED` Built-in Version History with preview-before-restore. GitHub is the "advanced" path for branching and collaboration; user can move between Bolt and the repo. https://support.bolt.new/concepts/version-history-github.md

**Hosting**
- `CONFIRMED` Free hosting: 10 GB bandwidth + 333,333 requests/month, "Made in Bolt" badge, site goes offline over limit. Pro hosting (with any paid plan): 30 GB + 1M requests/month, pay-as-you-go with spend cap. All sites share one allowance. https://support.bolt.new/cloud/hosting/plans.md
- `REPORTED` Sites publish to bolt.host or Netlify. https://www.aipedia.wiki/tools/bolt/

**Mobile**
- `CONFIRMED` Expo integration. Test on a phone by scanning a QR code from the Device Preview icon into Expo Go ("the first time... will take some time to build"). Web via `npx expo export --platform web`. Build and submit via EAS (`eas build --platform ios --auto-submit`). "Projects created for web do not easily switch over to mobile." RevenueCat for IAP. https://support.bolt.new/integrations/expo

**Pricing**
- `CONFIRMED` Free: 300K tokens/day, 1M/month, no rollover. Pro: $25/month, from 10M tokens, no daily cap, rollover for two months. Teams: $30/member/month. Tokens are spent mostly when Bolt "reads, understands, and syncs your project files"; bigger projects cost more per message; code-view edits cost nothing. Reload tokens on top Pro tiers never expire. https://bolt.new/pricing and https://support.bolt.new/account-and-subscription/tokens
- `REPORTED` $50 tier = 26M tokens/month. https://www.nocode.mba/articles/bolt-pricing-2026

### 2.3 v0 (Vercel)

**Agent / model**
- `CONFIRMED` (2026-01-07) v0 is a multi-step pipeline: dynamic system prompt (embeddings + keyword matching inject framework docs and curated samples from a read-only filesystem), "LLM Suspense" (stream-time find-and-replace: URL fix, icon name fix via vector DB), and autofixers (deterministic fixes plus a fine-tuned model for multi-file AST fixes) that complete within 250 ms. Main metric: "percentage of successful generations". https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent
- `CONFIRMED` Credits are token based; "tokens per credit depends on the model"; model picker shows cost. https://v0.app/docs/pricing

**Sandbox**
- `CONFIRMED` "VM-backed chats" run in Vercel Sandbox: Node.js with pnpm/npm/yarn/bun, a framework-aware dev server (Next.js, Vite, Node), env vars pulled from the linked Vercel project. Three surfaces: Preview tab, Console (logs + terminal), Code editor synced to the sandbox FS. Isolation per chat and per team. Filesystem persists across sessions for the same chat. Lifetime: 30 min initial, +10 min while active, 24 h absolute max. https://v0.app/docs/sandbox
- `CONFIRMED` Vercel Sandbox: Firecracker microVM per sandbox, dedicated kernel, root access, Docker inside allowed, egress firewall, persistent-by-default with automatic snapshot on stop, snapshots for warm start, Ubuntu 26.04 default image or custom OCI image from Vercel Container Registry, regions iad1/sfo1/cle1/cdg1. https://vercel.com/docs/sandbox/concepts
- `CONFIRMED` Sandbox pricing (Pro): $0.128 per active-CPU hour, $0.0212 per GB-hour, $0.60 per 1M creations, $0.15/GB egress (downloads free), $0.08/GB-month snapshots. Limits: 10,000 concurrent, 24 h per session, 8 vCPU/16 GB on Pro, 15 open ports, 64 GB NVMe. Example: 30 min at 4 vCPU/8 GB is about $0.34 at full CPU. https://vercel.com/docs/sandbox/pricing

**Preview**
- `CONFIRMED` The dev server runs in the sandbox; v0 "gives you a preview URL you can embed in your own UI" via short-lived preview tokens; the vendor recommends proxying server-side and showing a loading route while the sandbox boots. https://vercel.com/blog/introducing-the-new-v0-api (2026-08-05)

**Backend**
- `CONFIRMED` One-click integrations via the Vercel Marketplace: Upstash, Neon, Supabase, Vercel Blob, Snowflake. Adding one "provisions a new user account on that service and adds the necessary environment variables to your project". https://v0.app/docs/databases
- `INFERENCE` v0 does not own a backend. It delegates to Marketplace vendors who bill through Vercel.

**Versioning / Git**
- `CONFIRMED` (2026-02-03 "new v0") Sandbox runtime can import any GitHub repo. Each chat gets its own working branch (for example `v0/username-abc123`). Every code-changing message auto-commits. Publish creates or reuses a PR to the base branch. After merge, v0 re-syncs the chat to base. Branch menu offers "Fix Conflicts", "Fix CI", "Fix CI + Conflicts". https://vercel.com/blog/introducing-the-new-v0 and https://v0.app/docs/github

**Hosting**
- `CONFIRMED` Deploy to Vercel; PR previews map to real Vercel deployments. https://vercel.com/blog/introducing-the-new-v0

**Mobile**
- `UNVERIFIED` No Expo or native mobile output found in v0 docs.

**Pricing**
- `CONFIRMED` Free $0 with $5 credits/month; Premium $20 (being phased out); Plus $30/user; Business $100/user; Enterprise custom. Unused credits roll over and expire after 65 days. https://v0.app/docs/pricing

### 2.4 Base44 (Wix)

**Agent / model**
- `CONFIRMED` Model selection is a plan feature (Builder and up). Changelog: Sonnet 5 added 2026-06-30; GPT-5.6 Terra and Sol added 2026-07-08. https://docs.base44.com/changelog/product and https://base44.com/pricing
- `REPORTED` Wix bought Base44 for $80M in June 2025. https://www.certifiedcode.us/resources/article/what-is-base44-app-builder-and-how-does-it-work-with-wix

**Sandbox / preview**
- `UNVERIFIED` Base44 does not document its execution environment.

**Backend (own)**
- `CONFIRMED` Backend functions run on Deno (TypeScript/JavaScript). Three call paths: `base44.functions.invoke()` from the SDK, HTTP at `https://<app-domain>/functions/<name>`, and automations (scheduled or DB-triggered). Direct HTTP calls have no user context and must use `asServiceRole`. Secrets via `secrets.get()` inside the handler. 5-minute max execution. 50 functions per deploy. https://docs.base44.com/developers/backend/resources/backend-functions/overview
- `CONFIRMED` Developer surface: `@base44/sdk` (typed data, auth, AI, integrations), `npx base44` CLI, entities defined in code with managed storage/validation/migrations/queries, Google OAuth built in, row-level security, one-command deploy with CDN + custom domain + HTTPS, "eject to a local project any time, sync two ways with GitHub". https://base44.com/developers
- `REPORTED` The database is a managed NoSQL, MongoDB-compatible store. https://www.buildmvpfast.com/alternatives/base44 (`UNVERIFIED` from primary docs)
- `REPORTED` Code export via GitHub includes only the frontend; database, auth and functions stay on Base44. https://www.jetadmin.io/blog/untitled-41/

**Versioning / Git**
- `CONFIRMED` (changelog) 2026-08-11: on a sync conflict, AI chat shows "Resolve", merges each conflicted file so both sides survive, pushes the merge. 2026-08-26: commits carry the developer's GitHub identity as co-author. https://docs.base44.com/changelog/product

**Mobile**
- `REPORTED` Base44 does not output native apps. Its "mobile app" is a wrapper around the published URL. A store-readiness scan is free; downloading generated store files needs Builder or higher (feature dated 2026-02-03). https://newly.app/base44-for-mobile-apps and https://docs.base44.com/changelog/product
- `CONFIRMED` (changelog 2026-07-26 and 2026-08-05) iOS builds include localized permission purpose strings in 25 languages to reduce App Store rejections. So Base44 does produce iOS builds of the wrapper. https://docs.base44.com/changelog/product

**Pricing**
- `CONFIRMED` Two credit types: message credits (building) and integration credits (running). Free: 25 messages, 100 integration credits, 5 apps. Starter $16/mo: 100 / 2,000. Builder $40/mo: 250 / 10,000, model selection, domain. Pro $80/mo: 500 / 20,000, GitHub integration. Elite $160/mo: 1,200 / 50,000. Annual is 20% off. https://base44.com/pricing

### 2.5 Replit Agent

**Agent / model**
- `CONFIRMED` Agent 4. Modes: Free (included models), Power, Max ("best frontier models"), Auto (routes between Power and Max). Agent tests its own work; creates checkpoints for rollback; users are asked before paid actions. Outputs: web apps, mobile apps, slides, designs, data viz, documents, spreadsheets, 3D games. https://docs.replit.com/replitai/agent
- `REPORTED` Agent 4 adds an infinite design canvas, parallel agents and team collaboration. https://www.developersdigest.tech/blog/replit-agent-4-design-to-app

**Sandbox**
- `REPORTED` Every project lives in a container with a Nix-based environment; a very large shared Nix store disk is attached to dev containers. https://www.lowcode.agency/blog/what-is-replit (`OLD` details from Replit infra blog, not re-fetched)
- `CONFIRMED` Published apps run on Google Cloud, hosted in the US (EU on request for Enterprise), single-tenant isolation of compute, secrets and storage. https://docs.replit.com/cloud-services/deployments/about-deployments

**Backend (own)**
- `CONFIRMED` Every Replit App gets a default PostgreSQL database with 20 GB free storage, an ORM layer, and "Time travel: restore your database to any Agent checkpoint". Dev databases were on Neon before 2025-12-04. https://docs.replit.com/cloud-services/storage-and-databases/sql-database
- `CONFIRMED` Replit Auth: Agent-only setup. Users sign in with Google, GitHub, X, Apple or Email on a Replit-branded page. Backed by Firebase and Google Cloud Identity Platform, reCAPTCHA, Clearout (email verification), Stytch (MFA). Auto-creates user rows in the app database. https://docs.replit.com/replit-workspace/replit-auth
- `REPORTED` Replit is also an OpenID Connect provider (scopes openid, email, profile). https://blog.replit.com/auth

**Versioning**
- `CONFIRMED` Checkpoint = completed state of one Agent task; used to inspect or roll back. Pricing is effort based (below). https://replit.com/blog/effort-based-pricing
- `INFERENCE` Checkpoint + DB time travel is the most complete restore story in the group (code and data together).

**Hosting**
- `CONFIRMED` Four deployment types: Autoscale, Static, Reserved VM, Scheduled. Custom domains. Analytics. https://docs.replit.com/cloud-services/deployments/about-deployments

**Mobile**
- `CONFIRMED` (forum, 2026-01-15) "Mobile Apps on Replit": describe the app, Agent builds React Native + Expo, preview in Expo Go, publish to TestFlight/App Store with an Expo account. Cannot remix a web app into a mobile project. https://replit.discourse.group/t/introducing-mobile-apps-on-replit/8593
- `CONFIRMED` (`OLD`, 2025-02-20) Expo blog: QR install, instant device updates, EAS builds for both stores. https://expo.dev/blog/from-idea-to-app-with-replit-and-expo

**Pricing**
- `CONFIRMED` Starter free with daily agent credits, 1 live project. Core $20/month ($17 annual) with "$20 towards most powerful models". Pro $100/month ($95 annual) with $100 of model use, 10 parallel agents, 28-day DB rollback. Enterprise custom. https://replit.com/pricing
- `CONFIRMED` Effort-based pricing since 2025-06-18: one checkpoint per request; simple ones under $0.25, complex ones more. Options: "High power model" and "Extended thinking". https://replit.com/blog/effort-based-pricing

### 2.6 Rork

**Stack / preview**
- `CONFIRMED` Rork Pro: React Native + Expo for iOS, Android and web. Preview: "scan the QR code and open it in the Expo Go app". Rork Max: SwiftUI compiled with Xcode; preview via browser installer (Chrome/Edge on Mac) or the "Rork Companion" app over USB. https://rork.com/faq
- `CONFIRMED` "Ship a web screen by Friday and open it in your browser. Then flip the same project to your phone via TestFlight". Rork Max covers iPhone, iPad, Watch, TV, Vision Pro (Feb 2026). https://rork.com/guides/best-no-code-mobile-app-builder
- `INFERENCE` The browser preview is the Expo web target (React Native Web), not a simulator.

**Backend**
- `CONFIRMED` "Rork Backend": auto-scaling serverless functions that call third-party APIs and databases, hosted for paid users. https://rork.com/faq

**Publishing**
- `CONFIRMED` App Store: built in; Max is "two clicks", Pro needs an Expo account. Google Play: manual .aab upload. No web hosting; export to Vercel/Netlify. https://rork.com/faq

**Pricing**
- `CONFIRMED` (FAQ) Paid plans $25-$200+/month; Max on $200+ plans; no separate credit purchases; "We do not charge credits for AI errors". https://rork.com/faq
- `REPORTED` (2026-05-19) Free: limited; Junior $25 / 100 messages; Middle $50 / 250; Senior $100 / 500; Scale/Max $200 / 1,000. "One message = one prompt", regardless of size. https://www.nocode.mba/articles/rork-pricing

**Agent / model / sandbox**
- `UNVERIFIED` Not disclosed.

### 2.7 a0.dev (YC W25)

- `CONFIRMED` (HN launch, 2025-02-11, `OLD`) Browser preview runs "React Native Web in the browser"; deps without web support fail in web preview but work on the phone. A proprietary iOS app previews on device. Android uses Expo Go. Founders declined to name the LLM. https://news.ycombinator.com/item?id=43015267
- `CONFIRMED` Backend: "powered by Convex or Supabase". Publishing: "We'll handle the build, create your App Store Connect listing, and upload it for you". Payments and subscriptions set-up; analytics. A companion mobile app to test/edit/deploy. https://a0.dev/
- `REPORTED` Free and $20 Pro tiers. https://www.buildfastwithai.com/ai-tools/a0-dev
- `UNVERIFIED` Sandbox and model.

### 2.8 Vibecode (Software Composer)

- `CONFIRMED` Site says the platform is powered by Claude; apps are Expo/React Native. https://www.vibecodeapp.com/ and https://www.vibecodeapp.com/docs/getting-started/web-to-mobile
- `CONFIRMED` Docs index lists Expo Go preview, "Vibecode Cloud" backend, Better Auth for Google Sign-In, and model integrations (GPT-5 family, Gemini 3 Pro, Grok 4 Fast, Claude Code Agent SDK, Sora 2). https://www.vibecodeapp.com/docs/llms.txt
- `CONFIRMED` Deployment paths: share link (no install), web deploy to `yourapp.vibecode.run` or custom domain, App Store via Expo Launch (cloud build about 20 minutes, lands in TestFlight; needs Apple Developer Program, Expo account, 2FA device). "Preflight" scan for common rejection causes; auto bundle ID; icon generation. Google Play not mentioned. https://www.vibecodeapp.com/docs/deploying/overview.md and https://www.vibecodeapp.com/docs/getting-started/deploy-app-store.md
- `CONFIRMED` Pricing model: "$1 in credits on Vibecode = $1 in AI usage on Anthropic, OpenAI, etc. We charge exactly what we pay." Credits roll over and never expire. https://www.vibecodeapp.com/pricing
- `CONFIRMED` App Store IAPs: Plus $19.99/month, Pro $49.99/month, Max $199.99/month, weekly Plus $9.99, annual Plus $199.99, annual Pro $479.99. https://apps.apple.com/us/app/vibecode-website-builder/id6742912146
- `REPORTED` App Clips for sharing. https://vibecoding.gallery/en/tools/vibecode/
- `UNVERIFIED` The claim "Claude Code inside an E2B sandbox" comes from an open-source clone (`sa4hnd/vibra-code`), not from Vibecode. Do not attribute it to Vibecode. The docs index does list a "Claude Code (Agent SDK)" integration page, which is an in-app integration, not proof of their builder runtime.

### 2.9 Emergent

**Agent**
- `CONFIRMED` (2026-06-08) E1 = core builder agent, 10-15 minute sessions. E3 = orchestrator over E1 sub-agents for multi-hour builds, with a testing agent that clicks through the app and routes bugs back. E3 uses about 30% more tokens. Beta on Pro ($200/month). Stack: web = React + Python + MongoDB; mobile = Expo + FastAPI + MongoDB, both in one monorepo. https://emergent.sh/blog/introducing-e-3-autonomous-app-building-on-emergent

**Sandbox**
- `CONFIRMED` (2026-03-03) Kubernetes ephemeral pods, not VMs and not "lightweight sandboxes". Three containers: init (restores state from content-addressed backup in object storage, 2-6 s), main (full Linux, root inside container, unprivileged at node level), sidecar (heartbeats, checkpoint on termination). Warm pool gives under 8 s start. GKE Dataplane V2 (eBPF) network policies; egress to public internet only; crypto-mining detection; cgroups and PID limits. Network-attached SSD per pod; incremental content-addressed backups replaced VolumeSnapshots at scale. Grew from hundreds to "over 30K+" concurrent environments. No gVisor/Kata named. https://emergent.sh/blog/real-environments-for-ai-agents-and-why-we-bet-on-kubernetes

**Backend**
- `CONFIRMED` Each deployed app gets its own MongoDB Atlas database on an isolated cluster, provisioned by the agent at deploy time. Nearly 2M apps built in 4 months, 50K+ deployed, median app 35K LOC. https://www.mongodb.com/solutions/customer-case-studies/emergent-labs-inc

**Pricing**
- `CONFIRMED` Free $0 / 10 credits; Standard $20 ($17 annual) / 100 credits, private hosting, GitHub; Pro $200 ($167 annual) / 750 credits, 1M context, custom agents; Business and Enterprise custom (VPC deploy, self-hosted DB). https://emergent.sh/pricing
- `REPORTED` Credits expire monthly; a landing page with a form costs 20-30 credits; a SaaS with auth + Stripe 60-100. https://www.nocode.mba/articles/emergent-ai-pricing

### 2.10 Anything (formerly Create.xyz)

- `CONFIRMED` Pricing: Free; Pro $19/month with 20K credits, private projects, custom domains; Max $199/month with 220K credits, parallel agents, computer-use automated testing, visual QA, 1M context; Teams custom. "All plans include unlimited messages, code export." https://www.createanything.com/pricing
- `CONFIRMED` Home page names GPT-5 and "40+ integrations". https://www.createanything.com/
- `REPORTED` Generates Expo/React Native; an Anything iOS app previews mobile apps on device; backend functions, auth and access control are created on request. https://hostadvice.com/ai-app-builders/anything-review/ and https://www.superappp.com/blog/anything-ai-app-builder-review-2026
- `REPORTED` $11M Series A at $100M valuation. https://www.crunchbase.com/organization/create-3800
- `UNVERIFIED` Sandbox, hosting details, git. `docs.createanything.com` did not resolve.

### 2.11 Convex Chef

- `CONFIRMED` Open source, Apache-2.0, fork of the `stable` branch of bolt.diy. Runs a Node environment in the browser with `@webcontainer/api` 1.5.1 and `@webcontainer/snapshot`. Uses AI SDK v4 (`ai@^4.3.2`) with Anthropic, OpenAI, Google, Vertex, Bedrock and xAI providers. Remix front end. Convex provisioning through the hosted Convex control plane with OAuth (`CONVEX_OAUTH_CLIENT_ID/SECRET`). https://github.com/get-convex/chef and https://raw.githubusercontent.com/get-convex/chef/main/package.json
- `CONFIRMED` (2025-09-17) Chef "was never meant to go against the AI app builders"; 250K users. https://news.convex.dev/open-kitchen-chef-is-now-oss/
- `CONFIRMED` Chef is being replaced. Migration guide: export, run locally, continue with Claude Code or OpenCode, deploy backend by CLI, host frontend elsewhere. Chef cannot re-import exported projects. https://docs.convex.dev/chef
- `INFERENCE` Chef is the best public reference implementation of a WebContainer builder with a real backend. It is worth reading for the tool set and prompt structure, but its stack (AI SDK v4, Remix) is behind.

### 2.12 Google AI Studio (Build mode)

- `CONFIRMED` Gemini models (docs name Gemini 3.8 Flash, Nano Banana image, Veo, Live API). Default output: React front end + Node backend; also native Android in Kotlin + Jetpack Compose. Live preview pane; Android projects run in a browser-based emulator. Firebase Firestore and Authentication are auto-provisioned. GitHub two-way sync with AI-written commit messages. Apps private by default; sharing possible. The user's Gemini API key is stored as a secret and usage bills to it. https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- `CONFIRMED` Deploy to Cloud Run with one click; each deploy is a Cloud Run service; URL under `*.ai.studio`. Starter tier: 2 apps, one region, no billing account needed. Standard needs a billed GCP project. https://ai.google.dev/gemini-api/docs/aistudio-deploying
- `INFERENCE` Google runs a browser Android emulator for Kotlin apps. This is the only in-browser device emulator in this list, and it is Android only.

### 2.13 Firebase Studio

- `CONFIRMED` Sunset on 2027-03-22; new workspaces and sign-ups disabled since 2026-06-22; migrate to Google AI Studio or Antigravity. Architecture: browser IDE built on Code OSS on a Google Cloud VM with Nix configuration (`.idx/dev.nix`). App Prototyping agent (Gemini 2.5) provisions Firestore and Firebase Auth. Deploy via Firebase App Hosting. https://firebase.google.com/docs/studio
- `CONFIRMED` Previews: Chrome web preview; Android emulator only in Flutter workspaces; no iOS simulator. Hooks into framework hot reload. Share preview links. https://firebase.google.com/docs/studio/preview-apps
- `INFERENCE` Google folded the full-IDE product into the simpler chat-first Build mode. A signal that the "IDE for everyone" framing lost to "chat and preview".

---

## 3. Cross-cutting patterns

### 3.1 The "hidden Supabase" pattern (Lovable Cloud, Bolt Cloud)
- Both vendors keep one Supabase organisation. Each user project gets one Supabase project inside that org. The user never sees keys or the Supabase dashboard. `CONFIRMED` for both (section 2.1, 2.2).
- Supabase documents the partner path: register an OAuth app, get Management API tokens, call `POST /v1/projects` with a generated DB password. https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration and https://supabase.com/docs/reference/api/create-a-project
- Exit paths differ. Bolt supports a "claim" that transfers the project to the user's Supabase org. Lovable has no automated migration. `CONFIRMED`.
- `INFERENCE` The vendor pays Supabase per project and re-bills as "run credits" (Lovable) or "integration credits" (Base44) or hosting bandwidth (Bolt). Unified credits let the vendor throttle apps at zero balance (Lovable: "apps that rely on Cloud can pause").
- `UNVERIFIED` Whether Lovable/Bolt use paused/free-tier Supabase projects for idle apps to control cost. Supabase pauses inactive free projects; a partner likely needs a paid org and its own idle strategy.

### 3.2 The AI SDK harness path (Zack's plan)
- `CONFIRMED` (2026-06-12) AI SDK 7 adds `HarnessAgent`. Packages: `@ai-sdk/harness`, `@ai-sdk/harness-claude-code`, `@ai-sdk/sandbox-vercel`. Supported harnesses: Claude Code, Codex, Pi, Cline, Cursor, fx, Grok Build, OpenCode, ACP (any ACP client). Sandbox: Vercel Sandbox (`createVercelSandbox`, Node 24, at least one exposed port). Sessions: `agent.createSession()`, `agent.stream()`, `session.destroy()`. Stream events like `text-delta`. Permission modes `allow-reads` / `allow-edits` with tool approval requests. Tools exposed: read, write, edit, bash, glob, grep, webSearch. Marked experimental. https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk , https://ai-sdk.dev/providers/ai-sdk-harnesses , https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- `CONFIRMED` Vercel guide for running the Claude Agent SDK inside Vercel Sandbox (published 2025-11-25, updated 2026-06-17): install `@anthropic-ai/claude-code` inside the VM, OIDC auth, default timeout 5 min, extend to hours. https://vercel.com/kb/guide/using-vercel-sandbox-claude-agent-sdk
- `INFERENCE` The harness adapter mirrors v0's own design: the agent process lives inside the microVM, the app orchestrates it over a stream, and the preview is the sandbox's exposed port. This is the same shape as v0 "VM-backed chats" (section 2.3).
- `INFERENCE` Risks for wandit: (1) only Vercel Sandbox is a documented sandbox adapter today; other sandboxes need a custom adapter or ACP; (2) "experimental" API; (3) per-session cost about $0.30-$0.70 per 30-60 minutes at 4 vCPU (Vercel pricing table); (4) 24 h session cap, so long-lived previews must use snapshots and resume.

### 3.3 Mobile preview options seen in the market
1. Expo Go + QR code: Bolt, Replit, Rork Pro, Vibecode, a0.dev (Android). Cheapest; no custom native modules. `CONFIRMED`.
2. Custom preview app (a dev-client with the vendor's native modules baked in): a0.dev iOS app, Rork Companion (Max), Anything iOS app (`REPORTED`), Vibecode ("a modified Expo Go" is `REPORTED` only).
3. React Native Web in the browser: a0.dev (`CONFIRMED`), Rork (`INFERENCE`).
4. Browser Android emulator: Google AI Studio (Kotlin) and Firebase Studio (Flutter). `CONFIRMED`.
5. Cloud iOS simulator streaming: not found at any builder in this list. `UNVERIFIED` for the market. Note: this repo has its own research on this in `docs/v2/research/inspect-native-and-simulator.md`.
6. Share link / App Clip: Vibecode share link `CONFIRMED`; App Clips `REPORTED`.

### 3.4 Versioning and restore
- Every builder saves a version per AI change. Lovable, Bolt and Replit expose preview-before-restore. Only Replit restores the database at a checkpoint ("time travel"). Lovable and Bolt both say restore does not touch the database. `CONFIRMED`.
- v0 is the only one that maps versions to git commits on a per-chat branch with PRs. Lovable and Base44 sync a single branch two-way. Base44 resolves merge conflicts with AI. `CONFIRMED`.

### 3.5 Pricing units
- Credits with variable cost per task: Lovable (build usage-based; plan 1 credit), Replit (effort-based per checkpoint), Emergent, Base44 (message credits + integration credits), Anything (20K credits/month numbers imply token-like units).
- Tokens: Bolt (10M/month Pro), v0 (dollar credits mapped to tokens by model).
- Messages: Rork (1 message = 1 prompt, any size).
- Pass-through dollars: Vibecode ($1 = $1 provider cost) plus a subscription for access.
- All vendors give a daily or monthly free grant and stop the paid features at zero. Lovable and Base44 bill runtime (backend usage, in-app AI) from the same pool as building.

---

## 4. Ten design lessons for a new entrant (wandit V2)

1. **Put the agent inside the sandbox, not next to it.** v0, the AI SDK harness and Emergent all run the coding agent as a process in the workspace VM/pod and drive it over a stream. This removes the hand-built virtual file system and tool set that V1 carries (`docs/v2/research/inspect-ai-pipeline.md:9-11`). Sources: v0 sandbox docs, AI SDK harness docs, Emergent K8s post.
2. **Make the preview the sandbox's own dev server on an exposed port, proxied through a short-lived token.** v0's API does exactly this and recommends a loading route while the VM boots. Keep the iframe; drop `srcDoc`.
3. **Use persistent sandboxes with snapshot-on-stop and resume-on-demand.** Vercel Sandbox does this by default; Emergent built content-addressed backups for the same reason. Never keep a VM running while the user is away. Budget about $0.35 per active 30 minutes at 4 vCPU on Vercel pricing.
4. **Hide the backend behind your product, but plan the exit door on day one.** Lovable Cloud and Bolt Cloud both rent Supabase under their own org. Bolt's "claim" flow is the better design; Lovable's "no migration" is a known complaint. If wandit uses Supabase, register an OAuth/Management API app and create one project per user project. Keep one place that can hand the project to the user later.
5. **Bill one credit pool for build and run, with grants that never hit zero for small apps.** Lovable: 20 Cloud credits + 4 AI credits monthly, "for most users hosting does not cost anything". Zero balance must pause AI and heavy backend, never take a published static site offline (Lovable rule).
6. **Version every change, preview before restore, and be honest that code restore does not restore data.** Copy Replit's DB "time travel" if the backend allows it (Postgres branching or backups per checkpoint). Otherwise state the limit like Lovable and Bolt.
7. **Git is optional and one-branch by default.** Lovable's single active branch with `lovable-sync` fallback is enough for non-technical users. v0's branch-per-chat + PR is the developer-grade design. Base44 shows AI conflict resolution is now table stakes. Start with Lovable's model.
8. **Ship a security gate at publish time.** Lovable runs a 10-15 s scan (RLS lint, schema, deps) on every publish and lets admins block on critical findings. Non-technical users generate open RLS by default; this is the most reported class of vibe-coding incident. Cheap to build, high trust value.
9. **For mobile, start with Expo + Expo Go QR + EAS submit; add a custom dev-client app second.** Every mobile builder in the list starts there. a0.dev shows the next step (own iOS preview app, RN-Web browser preview). Rork says "projects created for web do not easily switch to mobile" (Bolt docs): decide web vs mobile at project creation.
10. **Give the agent its own verification loop and meter effort, not messages.** Lovable Build mode inspects console/network and runs browser checks; v0 fixes stream errors in 250 ms; Emergent E3 has a testing agent; Replit tests its work and bills per effort. Message-count pricing (Rork) is simple but caps what the agent may do. Wandit already has a token-usage pipeline (`da026a04 feat(observability): per-message token usage`), so effort-based credits are within reach.

---

## 5. Things I could not verify

- Lovable's exact current sandbox provider mix (Fly.io vs Modal vs owned Molnett infra) and any concurrency numbers. The "20,000 concurrent sandboxes" figure is Modal's, not Lovable's, on the page I could read.
- Lovable edge functions on "Deno Deploy" (search summary only).
- Lovable's preview transport (iframe on a sandbox URL).
- Base44's database engine (MongoDB-compatible) and execution sandbox.
- Rork's model, sandbox and browser preview implementation.
- a0.dev's and Anything's current pricing pages (JS-rendered; used review sites).
- Vibecode's builder runtime (Claude Code in E2B is an open-source clone's claim, not Vibecode's).
- Replit's current Nix/container isolation details (2026 primary page not fetched).
- Any builder streaming a cloud iOS simulator as the main preview.
- Who pays Supabase for Lovable Cloud / Bolt Cloud projects and how idle projects are handled.

---

## 6. Source list (all fetched 2026-09-03 unless marked)

Lovable
- https://docs.lovable.dev/features/modes
- https://docs.lovable.dev/introduction/faq
- https://docs.lovable.dev/introduction/credits-and-usage
- https://docs.lovable.dev/integrations/cloud
- https://docs.lovable.dev/features/cloud
- https://docs.lovable.dev/features/projects/history
- https://docs.lovable.dev/integrations/github
- https://docs.lovable.dev/features/deploy
- https://docs.lovable.dev/features/security
- https://docs.lovable.dev/integrations/lovable-mobile-app
- https://lovable.dev/pricing
- https://lovable.dev/blog/how-lovable-protects-your-apps-automatically (2026-06-01)
- https://lovable.dev/blog/lovable-welcomes-molnett (2025-11-25)
- https://claude.com/customers/lovable
- https://supabase.com/blog/lovable-cloud-launch (2025-09-29)
- https://supabase.com/docs/guides/troubleshooting/identify-lovable-cloud-or-supabase-backend
- https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/ (2025-07-14, OLD, secondary)
- https://northflank.com/blog/best-platforms-for-high-concurrency-sandbox-environments (2026-07-06, secondary)
- https://www.inmotionhosting.com/blog/lovable-acquires-molnett-ai-code-generation-deployment/ (secondary)
- https://vibe-eval.com/guides/lovable-tech-stack/ (secondary)
- https://www.nocode.mba/articles/lovable-pricing (secondary)

Bolt.new
- https://support.bolt.new/building/switch-v1-projects
- https://support.bolt.new/cloud/bolt-cloud.md
- https://support.bolt.new/cloud/database.md
- https://support.bolt.new/cloud/hosting/plans.md
- https://support.bolt.new/concepts/version-history-github.md
- https://support.bolt.new/integrations/supabase
- https://support.bolt.new/integrations/expo
- https://support.bolt.new/account-and-subscription/tokens
- https://support.bolt.new/llms.txt
- https://bolt.new/pricing
- https://supabase.com/blog/bolt-cloud-launch (2025-09-30)
- https://supabase.com/docs/guides/troubleshooting/supabase-project-provisioned-via-bolt-not-visible-in-dashboard-7188fc
- https://webcontainers.io/
- https://www.nocode.mba/articles/bolt-pricing-2026 (secondary)
- https://www.aipedia.wiki/tools/bolt/ (secondary)

v0 / Vercel
- https://vercel.com/blog/introducing-the-new-v0 (2026-02-03)
- https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent (2026-01-07)
- https://vercel.com/blog/introducing-the-new-v0-api (2026-08-05)
- https://v0.app/docs/sandbox
- https://v0.app/docs/github
- https://v0.app/docs/databases
- https://v0.app/docs/pricing
- https://vercel.com/docs/sandbox
- https://vercel.com/docs/sandbox/concepts
- https://vercel.com/docs/sandbox/pricing
- https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk (2026-06-12)
- https://ai-sdk.dev/providers/ai-sdk-harnesses
- https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- https://vercel.com/kb/guide/using-vercel-sandbox-claude-agent-sdk

Base44
- https://base44.com/pricing
- https://base44.com/developers
- https://docs.base44.com/developers/backend/resources/backend-functions/overview
- https://docs.base44.com/changelog/product
- https://newly.app/base44-for-mobile-apps (secondary)
- https://www.jetadmin.io/blog/untitled-41/ (secondary)
- https://www.buildmvpfast.com/alternatives/base44 (secondary)

Replit
- https://docs.replit.com/replitai/agent
- https://docs.replit.com/replit-workspace/replit-auth
- https://docs.replit.com/cloud-services/storage-and-databases/sql-database
- https://docs.replit.com/cloud-services/deployments/about-deployments
- https://replit.com/pricing
- https://replit.com/blog/effort-based-pricing (2025-06-18)
- https://replit.discourse.group/t/introducing-mobile-apps-on-replit/8593 (2026-01-15)
- https://expo.dev/blog/from-idea-to-app-with-replit-and-expo (2025-02-20, OLD)
- https://www.developersdigest.tech/blog/replit-agent-4-design-to-app (secondary)

Rork
- https://rork.com/faq
- https://rork.com/guides/best-no-code-mobile-app-builder
- https://www.nocode.mba/articles/rork-pricing (2026-05-19, secondary)
- https://rorklab.net/en/articles/rork-dev/react-native-expo-architecture (secondary)

a0.dev
- https://a0.dev/
- https://news.ycombinator.com/item?id=43015267 (2025-02-11, OLD)
- https://www.buildfastwithai.com/ai-tools/a0-dev (secondary)

Vibecode
- https://www.vibecodeapp.com/
- https://www.vibecodeapp.com/pricing
- https://www.vibecodeapp.com/docs/llms.txt
- https://www.vibecodeapp.com/docs/getting-started/web-to-mobile
- https://www.vibecodeapp.com/docs/deploying/overview.md
- https://www.vibecodeapp.com/docs/getting-started/deploy-app-store.md
- https://apps.apple.com/us/app/vibecode-website-builder/id6742912146
- https://vibecoding.gallery/en/tools/vibecode/ (secondary)

Emergent
- https://emergent.sh/pricing
- https://emergent.sh/blog/real-environments-for-ai-agents-and-why-we-bet-on-kubernetes (2026-03-03)
- https://emergent.sh/blog/introducing-e-3-autonomous-app-building-on-emergent (2026-06-08)
- https://www.mongodb.com/solutions/customer-case-studies/emergent-labs-inc
- https://www.nocode.mba/articles/emergent-ai-pricing (secondary)

Anything (Create.xyz)
- https://www.createanything.com/pricing
- https://www.createanything.com/
- https://hostadvice.com/ai-app-builders/anything-review/ (secondary)
- https://www.superappp.com/blog/anything-ai-app-builder-review-2026 (secondary)

Convex Chef
- https://github.com/get-convex/chef
- https://raw.githubusercontent.com/get-convex/chef/main/package.json
- https://news.convex.dev/open-kitchen-chef-is-now-oss/ (2025-09-17)
- https://docs.convex.dev/chef

Google
- https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- https://ai.google.dev/gemini-api/docs/aistudio-deploying
- https://firebase.google.com/docs/studio
- https://firebase.google.com/docs/studio/preview-apps

Supabase platform API
- https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
- https://supabase.com/docs/reference/api/create-a-project
