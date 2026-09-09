# V2 research — product docs and reference directories

Date: 2026-09-03. Author: Claude Fable agent (read-only probe).
Worktree read: `/Users/mac/Desktop/work/projects/ISR-AI/.claude/worktrees/v2-builder` (branch `feat/v2-builder`, identical to `dev`).
Main checkout read for gitignored directories: `/Users/mac/Desktop/work/projects/ISR-AI`.

All file paths below are repo-relative unless marked. Line numbers come from `cat -n` / `sed -n` reads made on 2026-09-03. Items marked UNVERIFIED were not confirmed in the repo.

---

## 1. Scope and method

Task: read the product docs, the prompt copies, the design reference, and the six root reference directories. Then state what the product is, who it serves, which markets it targets, what the Lovable prompt copy does, what V2 notes exist, and what helps the V2 builder.

Method:

- Read in full: `docs/PRD.md`, `docs/prompts/lovable.md`, `docs/prompts/example.md`, `CLAUDE.md`, `README.md`, `docs/localization.md`, `docs/native-structure.md`, `docs/frontend-structure.md`, `docs/deployments/web-environments.md`, `docs/features/ai-chat-brain.md`, `docs/features/chat-generation.md`, `docs/features/composer-modes.md`, `docs/features/edge-serving.md`, `docs/features/publishing-serving.md`, `docs/features/leads-crm.md`, `docs/features/v2-generation-improvements.md`, `docs/features/pricing-v5-usd-anchor.md`.
- Skimmed: `DESIGN.md` (544 lines), `docs/prompts/claude-design.md` (9,199 lines, 151 headings), `docs/prompts/claude-design-light.md` (647 lines), `docs/features/cod-worlds.md`, `docs/features/design-worlds.md`, `docs/features/pricing-v6-starter-plan.md`.
- Grepped `docs/` for `v2`, `lovable`, `sandbox`, `expo`, `bolt`, `base44`, `harness`, `claude code`, `agent sdk`, `opencode`, `codex`.
- Listed and read entry files of `_cc-harness`, `references/opencode`, `_admin-dashboard`, `_production-ex`, `_heroui-example`, `design/`.
- Grepped `apps/` and `packages/` for any import of `docs/prompts` or the reference directories.

No source code was edited. No commit was made. No install was run.

---

## 2. Short summary

- Wandit is a prompt-first builder for e-commerce sellers in Algeria. V1 generates one static HTML file per page, publishes it from Cloudflare, and captures COD orders as leads. `docs/PRD.md:8-16`.
- The market is Algeria first, then Tunisia and Morocco. Pages are Arabic (RTL) and French. Prices are in DZD. Ad budgets and SaaS plans are in USD. `docs/PRD.md:20`, `docs/features/manual-billing.md:9`, `docs/features/billing.md:25`.
- The Lovable system prompt in `docs/prompts/lovable.md` is a vendored reference copy. No code imports it. The V1 Brain prompt does not reuse its text. It is a template for how a Lovable-class agent frames its interface, stack, tools, and design rules.
- There are no V2-builder notes anywhere in `docs/`. The one file named "v2" (`docs/features/v2-generation-improvements.md`) is a retired spec for V1 page generation. The words Bolt, Base44, Expo-as-output, Claude Code, Agent SDK, and sandbox-as-agent-runtime do not appear in any doc.
- `_cc-harness` is a partial copy of the Claude Code CLI source tree (the `src/` directory). It has no `package.json`, no README, and misses generated SDK type files. It shows the tool interface, the permission model, the sandbox config schema, the hook events, and the SDK control protocol.
- `references/opencode` is a full git clone of `anomalyco/opencode` (v1.18.10, commit `14f0bf64a1`, 2026-07-31). It shows a headless agent server with an OpenAPI spec and a JS SDK, plus a simple allow/ask/deny permission model.
- `_admin-dashboard`, `_production-ex`, `_heroui-example` are third-party starter templates (shadcn UI kit dashboard, next-forge, HeroUI Native example). All five reference directories are gitignored. Only `design/` is tracked; it holds Claude Design workspace mockups, three hand-written example pages that became "design worlds", generated baselines, and COD reference screenshots.

---

## 3. Product docs

### 3.1 `docs/PRD.md` (145 lines, "Last updated 2026-07-04")

**Vision** (`docs/PRD.md:8-16`):

- "An AI-powered creative workspace for e-commerce sellers — think Lovable × Lovart, focused on e-com." Line 10.
- Primary case: COD landing pages. Later: product images, videos, ad creatives, marketing strategies. Line 10.
- One line: "prompt → landing page → publish → orders." Line 12.
- Scope note: COD is primary, "not the only one" — sites vitrines, service pages, promos. Line 14.
- Inspirations: Just Add (chat → campaign → page → publish), Lovable (prompt-first funnel, pricing), Lovart (canvas). Line 16.

**Market and personas** (`docs/PRD.md:18-24`):

- Primary market: Algeria. Arabic (RTL) + French pages, wilaya/commune addressing, COD order flow, phone confirmation, DZD pricing, CIB card rail later. Line 20.
- Persona 1: E-com beginner. Runs Meta/TikTok ads, sells COD, mobile-heavy, FR/AR. "Needs speed, not tooling." Line 22.
- Persona 2: Freelancer / media buyer. Builds pages for several products or clients. Line 23.
- Persona 3: Agency (post-MVP Business plan). Seats, client workspaces, white-label. Line 24.

**Core journey** (`docs/PRD.md:26-34`): landing prompt box → Google auth modal → project auto-created → generation streams → iterate in chat → publish to `{slug}.wandit.app` → leads in Leads tab → status pipeline `to-confirm → confirmed → shipped → delivered / returned` (+ `cancelled`). Generation costs credits; publish and leads are free.

**Information architecture** (`docs/PRD.md:36-56`): three routes `/`, `/dashboard`, `/p/$projectId`. Workspace = chat pane left, inset main pane right. Tabs: Page | Assets | Leads | Settings. Page tab renders the active version in a sandboxed cross-origin iframe. Line 51.

**Settled architecture** (`docs/PRD.md:86-93`), stated as "do not relitigate":

- Three-domain split: `wandit.dev` (app + API), `{slug}.wandit.app` (published), `{token}.<preview-domain>` (previews). Never serve user content from `wandit.dev`. A Cloudflare Worker (`apps/edge`) routes by hostname to R2. Line 88.
- Generated pages: raw HTML + hand-written CSS + vanilla JS, single file, no build step. No React, no bundler. Line 89.
- Storage: immutable versioned files in R2 (`sites/{project_id}/{version_id}/`). Publishing = pointer update. Rollback = older pointer. Line 90.
- Generation in a queue (BullMQ, `apps/worker`) with Redis pub/sub and SSE relay. Line 91. NOTE: later docs replace this with Trigger.dev (see §5.1). The PRD is stale on this point.
- Credits: ledger table, balance = sum. Provider-agnostic (Stripe now, CIB later). Line 92.
- AI: Vercel AI SDK v7 + Vercel AI Gateway for everything. Models swappable per task. Line 93.

**Stack** (`docs/PRD.md:95-116`): pnpm + Turborepo + Biome. `apps/web` (Vite + React + TanStack Router SPA + Tailwind v4), `apps/server` (NestJS on Fastify, Better Auth), `apps/worker` (BullMQ), `apps/edge` (Cloudflare Worker), `apps/native` (Expo, "Out of MVP"), `packages/db` (Drizzle + Neon), `packages/auth`, `packages/env`, `packages/jobs`, `packages/contracts`, `packages/ui`, `packages/config`. Actual workspace today also has `apps/admin`, `packages/analytics`, `packages/internationalization`, `packages/observability`, `packages/preview-editor` (verified with `ls apps packages`).

**Data model** (`docs/PRD.md:118-129`): `user/session/account/verification`, `projects`, `chats`/`messages` (AI SDK parts as jsonb), `artifacts`/`versions` (immutable, R2 keys), `deployments` (slug → version), `leads` (E.164 phone, wilaya, commune, attribution jsonb), `credit_ledger`, `domains`.

**Non-functional requirements** (`docs/PRD.md:131-136`): Arabic RTL + French from day one, mobile-first. User HTML never on app domains. Preview iframes sandboxed. Public endpoints rate-limited + honeypot.

**Open questions** (`docs/PRD.md:138-143`): preview domain purchase, app chrome language, credit grant sizes, API/worker deploy target.

### 3.2 `docs/localization.md` (94 lines)

- Locales: `en` (source of truth), `fr` (informal "tu", Algeria market), `ar` (Modern Standard Arabic, RTL). Config in `packages/internationalization/src/config.ts`. Line 5.
- All user-facing copy goes through `@wandit/internationalization`. Line 3.
- Dictionaries per locale and namespace; the three trees must stay structurally identical. Line 11. Namespaces include `native` for the Expo app. Line 24.
- Arabic plurals need `zero/one/two/few/many/other`. Line 40.
- Number/date/currency helpers: `formatNumber`, `formatDate`, `formatCurrencyDZD`, `formatRelativeTime`. Line 42.
- Never localize brand terms (Wandit, COD, Meta, TikTok, Google, CIB) or DZD/DA amounts. Line 46.
- RTL rules: Tailwind logical utilities only; `rtl:rotate-180` on directional icons; `dir="auto"` on user content; Noto Sans Arabic. Lines 58-63.
- Native: `I18nManager` controls mirroring; in-app `ar` does not mirror layout yet. Line 64.
- Server never sends localized text; errors carry a `code`. Line 68.
- Reference data convention: `name`, `name_fr`, `name_ar` columns (for future `wilayas`, `communes`). Lines 72-77.

### 3.3 `CLAUDE.md` (45 lines)

- Line 1: report only in ASD-STE100 Simplified Technical English.
- Lines 5-16: worktrees live under `.claude/worktrees/<name>`; never commit at the end of a task; bootstrap steps (env files, `pnpm@11.7.0 install`, free ports, tmux session, Google OAuth URLs).
- Lines 18-45: GPT models only through the Codex CLI; routing table (`gpt-5.6-sol` ultra for implementation, `gpt-5.6-sol` high for batch probes, `gpt-5.6-luna` high for research). Claude models via Agent/Workflow `model`.

### 3.4 `README.md` (108 lines)

- Scaffold from Better-T-Stack. Line 3. `bts.jsonc` confirms the create command: `tanstack-router native-uniwind --backend fastify --database postgres --orm drizzle --auth better-auth` (main checkout `bts.jsonc:15`).
- Lists React Native + Expo in the stack. Lines 9-10.
- Otherwise a generic scaffold README (db scripts, shadcn in `packages/ui`).

### 3.5 `DESIGN.md` (544 lines, skimmed)

- Title "Wandit — Style Reference". Tagline "Warm parchment tooling with one ember running through it". Lines 1-3.
- Line 7: "borrowed straight from the Lovable school of quiet interface design". One accent (ember, terracotta-orange). Tool chrome is light; the generated page previewed inside may be dark.
- Colors authored in oklch. Tokens `--wd-parchment`, `--wd-sand`, `--wd-linen`, `--wd-ember`, etc. Lines 9-58.
- Typography: DM Sans, tracking `-0.025em`, ligatures off; Geist Mono for output. Lines 61-93.
- Components list (workspace shell, header, publish button, chat bubbles, composer, preview toolbar, version card, slide-in panel, etc.). Lines 157-292.
- "Agent Prompt Guide" with color quick reference and five example component prompts. Lines 344-368.
- "Similar Brands": Lovable ("the direct ancestor"), Vercel, Linear, Cursor/v0, Raycast. Lines 377-383.
- Added in commit `d631266d` (2026-07-07) "Warm-parchment design system + workspace rebuilt to the dc reference". "dc" = Design Component (see §4.2).

### 3.6 `docs/frontend-structure.md`, `docs/native-structure.md`

- Web: feature folders under `apps/web/src/features/*`; routes stay thin; `features/projects/` is the exemplar. `docs/frontend-structure.md:11-62`.
- Native: same shape under `apps/native/features/*`; Expo Router routes are thin. `docs/native-structure.md:11-46`.
- Line 7 of the native doc: "The native IA is Lovable-style, prompt-first: sign in → home ('What do you want to build?') with a projects drawer → project workspace with top tabs and a persistent chat bar at the bottom."
- Workspace tabs on native: chat / preview / leads / settings. `docs/native-structure.md:24-29`.

### 3.7 `docs/deployments/web-environments.md` (84 lines)

- Production: `wandit.dev` + `api.wandit.dev`. Staging: Vercel branch host + `api-staging.wandit.dev` (cross-site; cookie problems). Recommended fix: `staging.wandit.dev`. Lines 7-28.
- Web uses `VITE_SERVER_URL` baked at build time. Lines 32-38.
- `apps/web/vercel.json` `/api` rewrite points at the production Railway server, also on preview deployments. Lines 42-54. This matters for the V2 rollout plan ("tested in the preview environment"): a preview deploy that calls a relative `/api` reaches production.

---

## 4. The prompt copies in `docs/prompts/`

Four files. Git history: the files were added across commits `ae506452` (2026-07-07), `acc0788c` (2026-07-12), and `028458d7` (2026-07-24) (`git log --diff-filter=A -- docs/prompts/`). No code in `apps/` or `packages/` imports or reads any of them (grep for `docs/prompts`, `lovable`, `claude-design` over `*.ts`/`*.tsx`/`*.json` found only three comments that say "Lovable-style": `apps/web/src/features/workspace/lib/use-animated-text.ts:48`, `apps/web/src/features/billing/components/upgrade-button.tsx:57`, `apps/server/src/modules/sites/domain/badge-injector.ts:12`).

### 4.1 `docs/prompts/lovable.md` (316 lines) — the Lovable system prompt

What it is: a copy of Lovable's agent system prompt. The text names itself "You are Lovable, an AI editor that creates and modifies web applications" (line 1) and carries "Current date: 2025-09-16" (line 11). Source and license: UNVERIFIED (no attribution in the file).

Structure and content:

- Lines 1-9: identity. Left chat, right live preview iframe (line 3). Stack: React, Vite, Tailwind CSS, TypeScript; no Angular/Vue/Svelte/Next.js/native mobile (line 5). "Lovable also cannot run backend code directly ... but has a native integration with Supabase" (line 7). Not every interaction requires code changes (line 9).
- Line 13: reply in the user's language.
- Lines 15-49: general guidelines. "PERFECT ARCHITECTURE" (line 17), batch independent tool calls (line 19), never re-read files already in "useful-context" (line 21), "BE CONCISE ... fewer than 2 lines of text" (line 25), SEO requirements (lines 29-41), default to discussion and plan (line 44), verify feature exists before coding (line 45), use debugging tools first (line 46).
- Lines 51-84: required workflow: check useful-context → tool review → discussion mode by default (only act on words like "implement", "add") → think and plan → clarifying questions → gather context → implement (prefer search-replace) → verify and conclude.
- Lines 86-107: tools named: `search-replace`, `write-file`, `rename-file`, `delete-file`.
- Lines 113-120: debugging tools `read-console-logs`, `read-network-requests`.
- Lines 122-131: pitfalls. Line 131: "Do not use any env variables like `VITE_*` as they are not supported."
- Lines 133-171: response format. Custom XML tags prefixed `lov-` render UI components in chat (line 135). Mermaid diagrams allowed (lines 140-171).
- Lines 173-208: examples (efficient tool usage; discussion-first for "add authentication").
- Lines 210-281: design guidelines. Design system is everything; semantic tokens only; never `text-white`/`bg-white`; HSL in `index.css` and `tailwind.config.ts`; shadcn variants via `cva` (lines 212-281).
- Lines 283-316: first-message mode. "This is the first interaction ... wow them" (line 283). First message likely means "just write code" (line 284). Plan features, colors, fonts; never implement light/dark toggle (line 294). Tools `imagegen` and `web_search` for images (line 307). Write files fast with search-replace (line 315).

Role in this repo: reference copy only. The V1 Brain prompt (`apps/server/src/modules/ai-chat/agent/system-prompt.ts`, 216 lines) shares no phrases with it (grep for `useful-context`, `DEFAULT TO DISCUSSION`, `Spaghetti code`, `search-replace`, `lov-` in `apps/server/src` returned nothing). The V1 prompt is a creative-director prompt for Algerian merchants (`system-prompt.ts:22-25`), not a code-editor prompt.

Why it matters for V2: it is the closest public description of the target product class. It encodes (a) the interface contract (chat + iframe), (b) a fixed stack, (c) backend via a hidden Supabase integration, (d) discussion-first turn policy, (e) tool batching, (f) design-system-first generation, (g) special chat render tags. See §8.

### 4.2 `docs/prompts/claude-design.md` (9,199 lines) and `docs/prompts/claude-design-light.md` (647 lines)

What they are: copies of the Claude Design system prompt (long form) and a rewritten short form. Source: UNVERIFIED (no attribution in file). Evidence they are Claude Design: "You are an expert designer working with the user as a manager. You produce design artifacts on behalf of the user using HTML." (`claude-design.md:1`); Design Components `.dc.html` (`claude-design.md:59-77`); skills list including "Handoff to Claude Code" (`claude-design.md:271-289`); `window.claude.complete` helper using `claude-haiku-4-5` (`claude-design.md:556-573`); the trailing runtime blocks `<user_preferences>`, `<auto_thinking>`, `<user-email-domain>` `gmail.com` (`claude-design.md:300-323`) show the copy was captured from a live session of this user.

Key sections of the long form:

- Workflow (lines 12-22). Output creation guidelines (lines 31-43). Design Components authoring model: template + logic class + props JSON (lines 59-77). Templates with `{{ path }}` holes (line 81). "One DC by default" (line 75).
- Skills (lines 271-289): Animated video, Interactive prototype, Make a deck, Make a doc, Make tweakable, Claude API in prototypes, Frontend design, Wireframe, Export PPTX (two modes), Create design system, Save as PDF, Save as standalone HTML, Send to Canva, Handoff to Claude Code.
- "Frontend design" (lines 574-597): pick a bold aesthetic direction; distinctive fonts; CSS variables; "NEVER converge on the same choices across generations" (line 594).
- "Create design system" (lines 723-820): compiler-friendly folder layout (`styles.css` root, `tokens/`, `components/`, `ui_kits/`, `guidelines/`, `assets/`, `readme.md`).
- "Save as standalone HTML" (lines 887-985): bundler that produces a self-contained file. The tracked mockups in `design/*.html` have `<title>Bundled Page</title>` and sizes of 0.4-1.2 MB; they are outputs of this path (see §7.6).
- "Handoff to Claude Code" (lines 1006-1060+): README structure for developer handoff (overview, fidelity, screens, interactions, state).

Short form (`claude-design-light.md`): 17 numbered chapters (identity, workflow, questions, context, content, aesthetics, hierarchy, typography, color, accessibility, interaction, simplicity, system thinking, medium, users, quality, output). Lines 9-561. It reads as a condensed rewrite of the same source, not a verbatim copy.

Role in this repo: reference for the design-agent prompting style. The V1 builder has `apps/server/src/modules/ai-chat/agent/site-builder/frontend-design-skill.ts` (58 lines) whose name matches the "Frontend design" skill. Direct textual reuse: UNVERIFIED (not compared line by line).

### 4.3 `docs/prompts/example.md` (397 lines)

What it is: an example prompt package. Lines 1-35 are a `<role>` block for "an expert frontend engineer, UI/UX designer ... integrate a design system into an existing codebase". Lines 37-397 are a `<design-system>` block that specifies one style, "Neo-brutalism": philosophy, tokens (colors, typography, radius, shadows), component rules, layout, anti-patterns, motion, responsive strategy, accessibility.

Role: an example of the "role + design-system document" prompt shape. It shows how one authored visual system can steer a coding agent. The V1 "design worlds" (`docs/features/design-worlds.md:18-50`) follow the same idea at larger scale (57 landing worlds + 10 dossier worlds + 46 COD worlds).

---

## 5. V1 generation architecture as documented (ground for V2)

### 5.1 `docs/features/ai-chat-brain.md` (67 lines, "rebuild in progress", started 2026-07-11)

- Goal: one agentic chat that produces pages, assets, and marketing docs. Line 8-12.
- Architecture: "Brain → Builder. Two agents, one handoff." The Art Director stage was tried and retired in 2026-07. Line 18.
- Both agents use AI SDK 7 `ToolLoopAgent`. Line 19. Vercel AI Gateway. Line 20. **Trigger.dev runs the Builder** in a background task. Line 21. This supersedes the PRD's BullMQ statement.
- Builder must complete three screenshot review passes before `finish`. Lines 23, 33.
- "Algeria layer": AR-RTL + FR bilingual, COD forms phone-first with wilaya/commune, WhatsApp/phone trust, single-file HTML + Tailwind, form posts to lead endpoint, pixel injection. Line 37.
- Flow: Brain composes brief → `generate_page` tool → `page_generation_attempts` row → Trigger task → Builder writes one `index.html`, screenshots, fixes → upload to R2 → immutable version → web polls `GET /api/v1/projects/:id/page`. Lines 43-48.
- File map: Brain prompt `apps/server/src/modules/ai-chat/agent/system-prompt.ts`; builder `site-builder/builder-prompt.ts` and `site-builder-agent.ts`; R2 `apps/server/src/infrastructure/storage/r2.ts`; task `apps/server/src/trigger/generate-page.task.ts`. Lines 51-56.

Verified sizes: `site-builder-agent.ts` is 2,440 lines; `site-builder-agent.spec.ts` is 3,206 lines; `builder-prompt.ts` 201 lines; `cod-builder-prompt.ts` 135 lines; `simple-cod-builder-prompt.ts` 139 lines (from `wc -l`). This is the hand-built editing agent that V2 wants to replace with a harness.

### 5.2 `docs/features/chat-generation.md` (101 lines)

- Page contract: single HTML file with Tailwind + vanilla JS; CDN allowlist Swiper, Alpine.js, AOS; lead form posts with `form_id` + honeypot + attribution; viewport; `dir="rtl"` for Arabic; mobile-first. Lines 46-55.
- Preview iframe: `sandbox="allow-scripts allow-forms"`, no `allow-same-origin`. Line 59.

### 5.3 `docs/features/composer-modes.md` (110 lines)

- Prompt box = "a routing form stapled to a chat message". Mode (`page` / `marketing` / `image` / `video` / `auto`), output, options. Lines 5-13.
- Selections are "cargo, never law"; rendered into a "## This request" block by `request-context.ts`. Lines 15-20.

### 5.4 `docs/features/cod-worlds.md` and `docs/features/design-worlds.md`

- 46 COD worlds under `apps/server/src/modules/ai-chat/agent/worlds/cod/`; 30-id block vocabulary in `blocks.ts`. `cod-worlds.md:15-33`.
- Locale facts are variables: Algeria default with phone regex `/^0[567]\d{8}$/`, DZD (`دج` or `DZD`), 58 wilayas, commune field, home vs stopdesk fees. "Another market replaces those values without changing the funnel contract." `cod-worlds.md:49-54`.
- World kinds: `website`, `product` (dossier), `cod` (funnel). `design-worlds.md:20-34`.

### 5.5 Publishing and serving

- `docs/features/edge-serving.md:10-16`: visitor → Cloudflare edge (`wandit.app`, route `*/*`) → Worker → KV `domain:{host}` → R2 `published/{projectId}/current.html`.
- `docs/features/publishing-serving.md:19`: publish = read version HTML → inject pixels → write archive + `current.html` → KV pointer → promote deployment row. Rollback re-runs deterministic transforms.
- `apps/edge/README.md:1-7` confirms the Worker and its local Miniflare dev story.

### 5.6 Leads

- `docs/features/leads-crm.md:9-11`: `leads` table, status pipeline, public capture endpoint `POST /api/public/leads/{publicFormId}`.
- Page contract `wandit:lead` custom event; the injected runtime posts the capture body. Lines 16-22.
- Purchase events use `currency: "DZD"`. Line 24.

### 5.7 Money and markets in the feature docs

- 1 credit = $0.04 of AI-provider cost; ledger in centi-credits. `docs/features/pricing-v5-usd-anchor.md:14-20`.
- Plans (2026-09-02): starter $8/mo (50 credits), pro from $25/mo (175 credits), business 2× pro; signup grant 7 credits. `docs/features/pricing-v6-starter-plan.md:10-45`.
- "Wandit sells in Algeria first (Tunisia / Morocco next)". `docs/features/manual-billing.md:9`. Manual payment methods: Cash on delivery / Bank transfer / CCP / BaridiMob / Other; countries Algeria / Tunisia / Morocco / Other. Lines 348-349. TND stores millimes. Line 416.
- SaaS prices are USD on Stripe; "LASATIM (CIB, DZD)" later. `docs/features/billing.md:1,13,25`.
- Ad budgets are USD, never DA. `apps/server/src/modules/ai-chat/agent/system-prompt.ts` (Connector conduct section, "HARD RULE — ad budgets are USD").

### 5.8 Visual editing already exists in part

- `packages/preview-editor/src/` holds `editor-script.ts`, `inject.ts`, `messages.ts`, `parse-tokens.ts`, `pending.ts`, `target-comments.ts`, `contrast.ts` (listed). This is the iframe editor from the retired spec §7-8 (`docs/features/v2-generation-improvements.md:136-160`). It is the V1 postMessage precedent for "click an element in the preview".

---

## 6. Existing V2 notes in `docs/`

Grep: `grep -ril "v2\|lovable\|sandbox\|expo" docs` matched 32 files. Classified:

| Term | What the hits are | Any V2-builder content? |
|---|---|---|
| `v2` (word) | `pricing-v2-implementation.md`, `billing-v2-subscriptions-credits-affiliates.md`, `billing.md` (billing v2 rollout), `pricing-v3…v6` (refer back to v2), `credits.md` (superseded by billing v2), `ai-error-normalization…md` (design v2 of that doc), `teams-workspaces.md`, `v2-generation-improvements.md` | No. All are version numbers of V1 features. |
| `lovable` | `PRD.md:10,16,81`; `native-structure.md:7`; pricing/billing docs ("Lovable-style" tiers, "Lovable parity" plan picker) | No. Style references only. |
| `sandbox` | iframe sandbox (`PRD.md:51,134`, `chat-generation.md:59`, `ai-chat-brain.md:48`, `composer-modes.md:46`); Name.com API sandbox (`custom-domains*.md`) | No. Not an agent sandbox. |
| `expo` | `PRD.md:72,105` (Expo app out of MVP); `native-structure.md`; `localization.md`; `csrf-and-security-headers.md:26-30` (Expo authorization proxy) | No. Expo is the Wandit mobile client, not an output target. |
| `bolt`, `base44`, `harness`, `claude code`, `agent sdk`, `opencode` | zero hits | No. |
| `codex` | working-rule mentions (`ai-chat-brain.md:64`, billing/teams review notes) | No. |

`docs/features/v2-generation-improvements.md` (223 lines): header says "RETIRED, historical record" (line 1) and "Do not implement from it" (line 7). It described an Art Director stage, `data-wid` stamping, surgical edit tools (`get_page_outline`, `read_section`, `apply_element_ops`, `insert_section`, `replace_section`; lines 110-128), click-to-target (line 130), an inline editor (line 136), a theme panel (line 149), and a versioning invariant (line 220). Several of these shipped: the current Brain prompt lists `get_page_outline`, `apply_element_ops`, `insert_section`, `read_section`, `replace_section` (`system-prompt.ts`, "What you can do right now" section). This file is "V2" of page generation, not the V2 app builder.

`docs/v2/` did not exist in `dev`. It was created today for this research (`docs/v2/research/inspect-data-model.md` also exists, written by a sibling probe).

Conclusion: the V2 app-builder plan exists only in the founder's brief for this research. No doc in the repo describes it.

---

## 7. Root reference directories

Gitignore lines (main checkout `.gitignore`, verified identical in the worktree): `_admin-dashboard`, `_production-ex`, `_heroui-example`, `_cc-harness`, `references/`. These five exist only in the main checkout, not in the worktree. `design/` is tracked (40 files in `git ls-files design`).

No file in `apps/`, `packages/`, `turbo.json`, `pnpm-workspace.yaml`, or `.claude/` references `_cc-harness`, `references/opencode`, `_production-ex`, `_admin-dashboard`, or `_heroui-example` (grep over `*.ts`, `*.tsx`, `*.json`, `*.jsonc`, `*.yaml`, `*.md`, excluding `node_modules` and `docs/v2/research`). They are not workspace packages (`pnpm-workspace.yaml` lists `apps/*` and `packages/*` only).

### 7.1 `_cc-harness` — Claude Code CLI source tree (partial copy)

Location: `/Users/mac/Desktop/work/projects/ISR-AI/_cc-harness`. Size 33 MB. 1,903 files, of which 1,884 are `.ts`/`.tsx`. Directory mtime 2026-07-31. Not its own git repo (`git log` inside it resolves to the wandit repo).

Identity evidence:

- `constants/product.ts:1` `PRODUCT_URL = 'https://claude.com/claude-code'`.
- `main.tsx:3808` `.version(\`${MACRO.VERSION} (Claude Code)\`, '-v, --version', ...)`. `MACRO.VERSION` is a build-time macro; no version literal exists in the copy.
- `entrypoints/sandboxTypes.ts:1-2` "Sandbox types for the Claude Code Agent SDK".
- `tools.ts:1-120` imports `feature` from `bun:bundle` and toggles tools by build flags and `process.env.USER_TYPE === 'ant'`.
- Newest beta header string: `'token-efficient-tools-2026-03-28'` (`constants/betas.ts:21-22`). Model helpers map ids up to `claude-opus-4-6` and `claude-sonnet-4-6` (`utils/model/model.ts:221-239`). Migration `migrations/migrateSonnet45ToSonnet46.ts` exists. So the snapshot is from roughly 2026-Q2/Q3. Exact release: UNVERIFIED.

It is the `src/` directory only. No `package.json`, no README, no lockfile, no `node_modules` (verified: `cat _cc-harness/package.json` and `README.md` returned nothing; `find -name '*.json' -maxdepth 2` found none of these).

It is incomplete. `entrypoints/agentSdkTypes.ts:23-31` re-exports `./sdk/controlTypes.js`, `./sdk/coreTypes.js`, `./sdk/runtimeTypes.js`, `./sdk/settingsTypes.generated.js`, `./sdk/toolTypes.js`. Only `controlSchemas.ts`, `coreSchemas.ts`, `coreTypes.ts` exist in `entrypoints/sdk/`. Missing: `runtimeTypes.ts`, `coreTypes.generated.ts`, `toolTypes.ts`, `settingsTypes.generated.ts`, `controlTypes.ts` (checked with `[ -f ]`). `find . -name '*.generated.*'` returns nothing. The tree cannot compile as-is.

Top-level layout (from `ls -la`): `QueryEngine.ts` (46 KB), `Task.ts`, `Tool.ts` (29 KB), `commands.ts`, `context.ts`, `cost-tracker.ts`, `history.ts`, `main.tsx` (804 KB), `query.ts` (69 KB), `setup.ts`, `tools.ts`; directories `assistant/`, `bootstrap/`, `bridge/`, `buddy/`, `cli/`, `commands/` (101 entries), `components/` (146), `constants/`, `context/`, `coordinator/`, `entrypoints/`, `hooks/` (87), `ink/`, `keybindings/`, `memdir/`, `migrations/`, `moreright/`, `native-ts/`, `outputStyles/`, `plugins/`, `query/`, `remote/`, `schemas/`, `screens/`, `server/`, `services/`, `skills/`, `state/`, `tasks/`, `tools/`, `types/`, `upstreamproxy/`, `utils/` (331 entries), `vim/`, `voice/`.

What it shows that V2 can learn from:

1. **Tool interface** — `Tool.ts:362-530`. A tool has `name`, `inputSchema` (zod), optional `inputJSONSchema` (MCP), `call(args, context, canUseTool, parentMessage, onProgress)`, `description()`, `prompt()`, `isConcurrencySafe()`, `isReadOnly()`, `isDestructive?()`, `interruptBehavior?()`, `validateInput?()`, `checkPermissions()`, `getPath?()`, `preparePermissionMatcher?()`, `maxResultSizeChars`, `shouldDefer`/`alwaysLoad` (tool search), `backfillObservableInput?()`.
2. **Tool registry** — `tools.ts:1-120` lists the built-ins: Agent, Skill, Bash, FileEdit, FileRead, FileWrite, Glob, Grep, NotebookEdit, WebFetch, WebSearch, TaskStop/Output/Create/Get/Update/List, TodoWrite, ExitPlanModeV2, EnterPlanMode, AskUserQuestion, LSP, ListMcpResources, ReadMcpResource, ToolSearch, EnterWorktree, ExitWorktree, Config, Brief, SendMessage, TeamCreate/Delete, plus flag-gated ones (REPL, Sleep, Cron, RemoteTrigger, Monitor, SendUserFile, PushNotification, SubscribePR, WebBrowser, TerminalCapture, CtxInspect). Directory `tools/` has 41 tool folders.
3. **Permission model** — `types/permissions.ts:16-37`: external modes `acceptEdits`, `bypassPermissions`, `default`, `dontAsk`, `plan`; internal `auto`, `bubble`. Behaviors `allow | deny | ask` (line 44). Rule sources `userSettings | projectSettings | localSettings | flagSettings | policySettings | cliArg | command | session` (lines 52-61). Rule value `{ toolName, ruleContent? }` (lines 66-69). `Tool.ts:118-135` `ToolPermissionContext` with `alwaysAllowRules`, `alwaysDenyRules`, `alwaysAskRules`, `shouldAvoidPermissionPrompts`. Entry point `utils/permissions/permissions.ts:473` `hasPermissionsToUseTool`; `dontAsk` converts `ask` to `deny` (lines 505-518); `auto` mode uses a classifier (lines 519+). Rule engine `checkRuleBasedPermissions` at line 1071. Bash-specific: `tools/BashTool/bashPermissions.ts`, `bashSecurity.ts`, `readOnlyValidation.ts`, `destructiveCommandWarning.ts`, `shouldUseSandbox.ts`.
4. **Sandbox** — `entrypoints/sandboxTypes.ts:14-80`: network config (`allowedDomains`, `allowUnixSockets`, `allowLocalBinding`, `httpProxyPort`, `socksProxyPort`) and filesystem config (`allowWrite`, `denyWrite`, `denyRead`, `allowRead`). `utils/sandbox/sandbox-adapter.ts:1-22` wraps the external package `@anthropic-ai/sandbox-runtime` (`SandboxManager`, `SandboxViolationStore`). `tools/BashTool/shouldUseSandbox.ts:18-21` notes that `excludedCommands` is a convenience, "not a security boundary".
5. **Hooks** — `entrypoints/sdk/coreTypes.ts:25-55` `HOOK_EVENTS`: PreToolUse, PostToolUse, PostToolUseFailure, Notification, UserPromptSubmit, SessionStart, SessionEnd, Stop, StopFailure, SubagentStart, SubagentStop, PreCompact, PostCompact, PermissionRequest, PermissionDenied, Setup, TeammateIdle, TaskCreated, TaskCompleted, Elicitation, ElicitationResult, ConfigChange, WorktreeCreate, WorktreeRemove, InstructionsLoaded, CwdChanged, FileChanged. Hook runners: `utils/hooks/execAgentHook.ts`, `execHttpHook.ts`, `execPromptHook.ts`, `fileChangedWatcher.ts`.
6. **SDK control protocol** — `entrypoints/sdk/controlSchemas.ts:1-8`: "control protocol between SDK implementations and the CLI ... used by SDK builders (e.g., Python SDK)". `remote/RemoteSessionManager.ts:1-50` shows `control_request` / `control_response` / `control_cancel_request` message types and a `RemotePermissionResponse` (`allow` with `updatedInput` or `deny` with `message`). `bridge/` (32 files) implements a remote-control bridge to claude.ai sessions (`bridge/bridgeMain.ts`, `bridgePermissionCallbacks.ts`, `createSession.ts`).
7. **Query loop** — `QueryEngine.ts:184` `class QueryEngine`; `:209` `async *submitMessage(...)` (an async generator of SDK messages); `:1158` `interrupt()`; `:1174` `setModel()`. `Task.ts:6-13` task types `local_bash | local_agent | remote_agent | in_process_teammate | local_workflow | monitor_mcp | dream`.
8. **Tool allow-lists per agent kind** — `constants/tools.ts:35-80`: `ALL_AGENT_DISALLOWED_TOOLS`, `ASYNC_AGENT_ALLOWED_TOOLS`, `IN_PROCESS_TEAMMATE_ALLOWED_TOOLS`.
9. **Skills and agents on disk** — `skills/loadSkillsDir.ts`, `skills/bundled/`, `tools/AgentTool/loadAgentsDir.ts`, `tools/AgentTool/built-in/`.

Caveats: the copy is proprietary Anthropic source (UNVERIFIED how it was obtained; no license file). It is gitignored, so nothing ships with it. Treat it as read-only documentation of the harness behaviour. The published packages to build against are `@anthropic-ai/claude-agent-sdk` and `@anthropic-ai/sandbox-runtime` (named in `utils/sandbox/sandbox-adapter.ts:2,8`); their current versions are UNVERIFIED (no network check made).

### 7.2 `references/opencode` — full clone of `anomalyco/opencode`

Location: `/Users/mac/Desktop/work/projects/ISR-AI/references/opencode`. Size 568 MB. Own `.git`, remote `https://github.com/anomalyco/opencode`, HEAD `14f0bf64a1` ("chore: generate", 2026-07-31), `git describe` `github-v1.2.25-1534-g14f0bf64a1`. Package version `1.18.10` (`packages/opencode/package.json:3`). Cloned 2026-07-31 (directory mtime).

Stack: Bun `1.3.14` monorepo (`package.json:7`). Catalog pins `ai: 6.0.168` (Vercel AI SDK 6), `effect: 4.0.0-beta.83`, `hono 4.10.7`, `drizzle-orm 1.0.0-rc.2`, `zod 4.1.8` (`package.json:36-80`). Packages: `app`, `cli`, `client`, `codemode`, `console`, `containers`, `core`, `desktop`, `docs`, `enterprise`, `function`, `identity`, `llm`, `opencode`, `plugin`, `protocol`, `schema`, `sdk`, `sdk-next`, `server`, `session-ui`, `slack`, `stats`, `storybook`, `tui`, `ui`, `web`.

What it shows:

- **Headless server + OpenAPI + SDK**. `opencode serve` runs an HTTP server with an OpenAPI 3.1 spec at `/doc`; the TUI is one client of it (`packages/web/src/content/docs/server.mdx:9-15, 47-60`). `@opencode-ai/sdk` `createOpencode()` starts server + client (`sdk.mdx:19-31`; `packages/sdk/js/package.json:2-16` exports `./client`, `./server`, `./v2`). `packages/server/` and `packages/sdk-next/` are the newer Effect-based split (`packages/sdk-next/package.json`).
- **Permission model**. `packages/opencode/src/permission/index.ts:27-37` `evaluate(permission, pattern, ...rulesets)` picks the last matching wildcard rule, default `ask`. `ask()` (lines 66-100) returns early on `allow`, throws `DeniedError` on `deny`, and otherwise stores a `Deferred` and publishes an `Asked` event for a client to `reply`. Docs: `permissions.mdx:14-19` (`allow` / `ask` / `deny`), `--auto` mode (lines 22-36), object syntax per tool input pattern (lines 66-80).
- **Tool model**. `packages/opencode/src/tool/tool.ts:35-62`: `Context` has `sessionID`, `messageID`, `agent`, `abort`, `messages`, `metadata()`, `ask()`; `ExecuteResult` has `title`, `metadata`, `output`, `attachments`; `Def` has `id`, `description`, `parameters` (Effect Schema), `execute`. Registry `tool/registry.ts:1-60`: plan, question, shell, edit, glob, grep, read, task, todo, webfetch, write, invalid, skill, websearch, lsp, apply_patch; plus plugin and MCP tools.
- **Per-provider system prompts** as text files: `packages/opencode/src/session/prompt/{anthropic,beast,codex,copilot-gpt-5,default,gemini,gpt,kimi,meta,plan,trinity}.txt`.
- **Agents and subagent permissions**: `packages/opencode/src/agent/agent.ts`, `subagent-permissions.ts`.
- **No agent sandbox**. `packages/containers/README.md:1-10` are CI build images only. grep for sandbox/docker/container in `packages/opencode/src` hits only `worktree/index.ts`, `project/`, `lsp/`, `cli/cmd/web.ts` (no container isolation of tool execution).
- Contribution rules in `AGENTS.md:1-50` (Effect style, no destructuring, etc.).

Value for V2: a design reference for a **server-side session API** (sessions, SSE events, permission ask/reply over HTTP) that a web UI can drive. It also proves that a harness can run on the Vercel AI SDK (v6) under the hood. It is MIT licensed (`LICENSE` present; content UNVERIFIED beyond file name).

### 7.3 `_admin-dashboard` — bundui "Shadcn UI Kit" dashboard template

Location: `/Users/mac/Desktop/work/projects/ISR-AI/_admin-dashboard`. 7.4 MB. No own `.git`. `package.json:2-3` `"name": "shadcn-ui-kit-dashboard", "version": "1.3.0"`. `README.md:1-5`: "Shadcn UI Kit ... Next.js 15 ... React 19", clone URL `github.com/bundui/shadcn-ui-kit-dashboard`. Files date 2026-04-09 to 2026-04-27. Layout: `app/dashboard/(auth)`, `app/dashboard/(guest)`, `components/`, `hooks/`, `lib/`, `public/`. Dependencies include `@base-ui/react`, many Radix packages, `@tanstack/react-table`, `@tiptap/*`, `@fullcalendar/*`, dnd-kit.

Nature: vendored third-party template. Not live code. `PRD.md:48` says the workspace "mirrors the admin dashboard's sidebar-inset look", so it was a visual reference for the app shell and probably for `apps/admin` (UNVERIFIED which parts were copied).

### 7.4 `_production-ex` — Vercel `next-forge` 6.0.2 template

Location: `/Users/mac/Desktop/work/projects/ISR-AI/_production-ex`. 1.9 GB (includes `node_modules`). No own `.git`. `package.json:1-6` `"name": "next-forge", "version": "6.0.2", repository vercel/next-forge`. `README.md:1-3` "Production-grade Turborepo template for Next.js apps." Apps: `api`, `app`, `docs`, `email`, `storybook`, `studio`, `web`. Packages: `ai`, `analytics`, `auth`, `cms`, `collaboration`, `database`, `design-system`, `email`, `feature-flags`, `internationalization`, `next-config`, `notifications`, `observability`, `payments`, `rate-limit`, `security`, `seo`, `storage`, `typescript-config`, `webhooks`. Files date 2026-05-28 to 2026-07-01.

Nature: vendored third-party SaaS starter. Not live code. Wandit did not adopt Next.js (it is a Vite SPA + NestJS). Some package names match Wandit's (`analytics`, `internationalization`, `observability`), which suggests it was a layout reference (UNVERIFIED).

### 7.5 `_heroui-example` — HeroUI Native example app (Expo)

Location: `/Users/mac/Desktop/work/projects/ISR-AI/_heroui-example`. 1.4 GB (includes `node_modules`, `.expo`). Own `.git`, remote `https://github.com/heroui-inc/heroui-native-example.git`, HEAD `eec5ec5` "chore: upgrade heroui-native to v1.0.4". `package.json:1-4` name `heroui-native-example`; deps `expo ^56.0.5`, `expo-router ~56.2.7`, `react-native 0.85.3`, `heroui-native ^1.0.4`, `uniwind ^1.6.3`, `tailwindcss ^4.1.17`, `react-native-reanimated 4.3.1`. `README.md:3` still says "Expo 54" (stale text). `src/app/(home)`, `src/components`, `themes/`.

Relation to live code: `apps/native/package.json:35` `expo ~56.0.3`, `:49` `expo-router ~56.2.5`, `:55` `heroui-native ^1.0.4`, `:60` `react-native 0.85.3`, `:74` `uniwind ^1.9.0`. Commit `8ad06a36` (2026-07-04) "Add native shared UI kit, mobile design mockups, ignore _heroui-example". So the example was the source for the native UI kit and was then gitignored.

Nature: vendored third-party example. Not live code. Useful as a pinned, working Expo 56 + HeroUI Native + Uniwind dependency set.

### 7.6 `design/` — tracked design references (40 files)

Location (worktree): `design/`. All 40 files are tracked (`git ls-files design | wc -l` = 40). No README.

Contents:

- **Workspace mockups (Claude Design exports)**: `design/Workspace.html` (384 KB), `design/Wandit-Workspace-v2.html` (852 KB), `design/Wandit-Workspace-v3.html` (1.19 MB), `design/Wandit Mobile Workspace.html` (796 KB), `design/Wandit Mobile - Leads, Marketing, Assets.html`, `design/Wandit Projects Drawer.html`, `design/Wandit-mobile-dark.html`, `design/Wandit-mobile-light.html`. Each has `<title>Bundled Page</title>`, which matches the "Save as standalone HTML" bundler in `docs/prompts/claude-design.md:887-985`. Code references: `apps/web/src/features/workspace/components/chat/request-tray/types.ts:2` and `request-tray.tsx:2` cite `design/Wandit-Workspace-v3.html, turn 10`. Commits: `fa853d21` (2026-07-04) "workspace design mockup", `8ad06a36` (2026-07-04) mobile mockups, `d631266d` (2026-07-07) "workspace rebuilt to the dc reference".
- **Example pages**: `design/examples/agency.html` ("OBLIQUE® — We Build Brands That Bend Reality", 54 KB), `design/examples/ecommerce.html` ("LUME — Orbe N°1", 66 KB), `design/examples/real-estate.html` ("MERIDIAN — Architectural Estates", 55 KB). `design/index.html` is a copy of the LUME page (same title). These are the quality-bar examples. `apps/server/src/modules/ai-chat/agent/worlds/cinetique.ts:5` says it was "Distilled (values and all) from design/examples/agency.html"; `worlds/monographe.ts:5` from `real-estate.html`. `docs/features/v2-generation-improvements.md:37` used them as a technique lexicon.
- **Baselines (generated test builds)**: `design/baselines/bakery-fournil/index.html`, `dental-monographe/index.html` ("Cabinet Dentaire Benali — Hydra, Alger"), `earbuds-laboratoire/index.html` ("PulseBuds Pro — Banc d'essai"), briefs in `design/baselines/briefs/*.txt`, and `media-tests/` outputs. Written by `apps/server/scripts/test-build-world.ts:5,91` and `apps/server/scripts/test-media-generators.ts:10,20`. The briefs show the Brain's brief format: `WORLD`, `BUSINESS`, `AUDIENCE`, `PAGE TYPE`, `PAGE GOAL`, `OFFER` (prices in DZD), `LANGUAGE`, `ART DIRECTION`, `PAGE STORY`, `SIGNATURE INTERACTION`, `MOTION`, `SHOT LIST` (`design/baselines/briefs/bakery-fournil.txt:1-30`).
- **COD references**: `design/cod/*.png` (7 screenshots) and `design/cod/shots/` (desktop `d-*.png`, mobile `m-*.png`, tablet `t-0.png`, and `index.html` titled "GLACIÈRE CAPTAIN 25L — 48 h de froid, même en août | Livraison en Tunisie"). `docs/features/v2-generation-improvements.md:78` names `design/cod/` as the COD genre reference. Note the Tunisia example.
- **Competitor analysis**: `design/justpage-refs/structure-analysis.json` — block-by-block analyses of Arabic COD pages (e.g. ref "13i": Algerian Arabic RTL, drill-free shower-head holder, six blocks with `genreId` such as `hero`, `benefits-icons`). This is the source of the COD block vocabulary. Whether "JustPage" is the "Just Add" named in `PRD.md:16`: UNVERIFIED.

Nature: live reference assets used by scripts, prompts, and code comments. Not runtime code. The mockups are V1 UI; V2 needs new mockups for app-builder surfaces (preview device frame, logs, database, secrets, deploy status).

---

## 8. What helps V2, and how

### 8.1 Product facts V2 must keep

- Audience and tone: non-technical Algerian merchants and freelancers; FR/AR/EN chat; informal French; Arabic RTL; mobile-first. `PRD.md:20-24`, `localization.md:5`, `system-prompt.ts:22-25`.
- Money: prices in DZD for products; USD for plans and ad spend; credits at $0.04 of provider cost, metered from gateway cost. `pricing-v5-usd-anchor.md:14`. A harness run must report token cost so the same ledger works. V2 needs a per-run cost source (Claude Agent SDK usage messages; see `_cc-harness/QueryEngine.ts:17-18` `accumulateUsage` and `cost-tracker.ts`).
- Personas expand: `scrape_leads` exists "so users can prospect businesses to sell websites and services to" (`system-prompt.ts`, "What you can do right now"). V2 must serve freelancers who build apps for clients.
- Hide infrastructure: PRD never names Supabase or git to users; the Lovable prompt says "cannot run backend code ... native integration with Supabase" (`lovable.md:7`). V2's stated goal matches.
- Serving rules: user content never on `wandit.dev`; sandboxed iframes; publish = pointer; rollback always possible. `PRD.md:88-90,134`.

### 8.2 What the Lovable prompt teaches for the V2 agent prompt

Use it as a checklist, not as text to copy:

1. State the interface contract in the prompt (chat left, live preview right, edits appear immediately). `lovable.md:3`.
2. Pin the stack and refuse others. `lovable.md:5`. For V2: web = Vite + React + TS + Tailwind (+ shadcn); mobile = Expo. UNVERIFIED which template Zack wants.
3. Backend through one hidden integration. `lovable.md:7`.
4. Turn policy: discussion by default; act on action verbs; first message = build. `lovable.md:57, 283-284`.
5. Tool hygiene: batch calls; never re-read context; prefer search-replace. `lovable.md:19-21, 77, 101-107`.
6. Debug tools first: console logs and network requests from the preview. `lovable.md:113-120`. V2 needs a bridge from the preview iframe to the agent (console/network capture).
7. Design-system-first with semantic tokens and shadcn variants. `lovable.md:210-281`. This aligns with V1's "worlds" and `DESIGN.md`.
8. Custom chat render tags (`lov-*`) for rich UI parts. `lovable.md:135`. V2 on the AI SDK can use typed data parts instead.
9. Constraints that come from the runtime: "no `VITE_*` env" (`lovable.md:131`) shows that the sandbox/preview runtime shapes the prompt. V2 must write the same kind of runtime facts.

With a Claude Code harness, most of items 4-6 are already built in. The product layer should go into a `CLAUDE.md` in the sandbox repo plus an appended system prompt, not into a full replacement prompt. The harness loads `CLAUDE.md` and skills from disk (`_cc-harness/memdir/`, `skills/loadSkillsDir.ts`, `tools/AgentTool/loadAgentsDir.ts`).

### 8.3 What `_cc-harness` tells V2 to plan for

- **Headless run modes**: `dontAsk` (ask → deny) and `bypassPermissions` exist (`types/permissions.ts:16-22`). For a non-technical user, V2 should run with `bypassPermissions` or `acceptEdits` inside a sandbox, and use `allowedTools`/deny rules to fence `Bash`. `constants/tools.ts:57-73` shows a minimal allowed set (Read, Grep, Glob, Bash, Edit, Write, WebFetch, WebSearch, Skill, ToolSearch).
- **Sandbox config** at the harness level covers network domains and filesystem paths (`entrypoints/sandboxTypes.ts`). This is a second fence inside whatever VM/container V2 uses.
- **Hooks** give the events V2 needs to drive the UI: `PreToolUse`/`PostToolUse` for tool cards, `FileChanged` for preview refresh, `Stop` for turn end, `PermissionRequest` if any ask leaks. `coreTypes.ts:25-55`.
- **SDK message stream**: `QueryEngine.submitMessage` is an async generator of SDK messages (`QueryEngine.ts:209`); V2 must map these to AI SDK UI message parts. The published SDK types are in the missing generated files, so read them from the npm package, not from this copy.
- **Control protocol**: permission requests travel as `control_request` messages and answers as `control_response` with `allow + updatedInput` or `deny + message` (`remote/RemoteSessionManager.ts:37-48`). V2 can implement a "money/destructive action" confirmation the same way V1 does for ad spend.
- **Subagents, tasks, worktrees**: `Task.ts`, `tools/AgentTool/`, `tools/EnterWorktreeTool/`. Not needed for V2 MVP.

### 8.4 What `references/opencode` tells V2

- A harness can be a long-lived HTTP server with sessions and an event stream (`server.mdx`), and the UI a thin client. V2's NestJS API could play the client role. This is an alternative to spawning a CLI per turn.
- Permission rules as `{ "*": "ask", "bash": { "git *": "allow", "rm *": "deny" } }` (`permissions.mdx:66-80`) are a compact model V2 could expose in admin settings.
- Provider-agnostic via AI SDK 6 (`package.json` catalog `ai: 6.0.168`), which fits the "Vercel AI SDK + Gateway" rule in `PRD.md:93` if Claude is not the only model.
- Cost: Effect 4 beta and Bun runtime. Heavy to embed; better as a design reference than a dependency. UNVERIFIED whether opencode has an AI-SDK "harness" adapter.

### 8.5 What the templates and `design/` give V2

- `_heroui-example` + `apps/native`: a pinned Expo 56 / HeroUI Native / Uniwind set. Reuse as the base for the V2 **mobile app template** and for previewing generated Expo apps (UNVERIFIED that Zack wants HeroUI Native in generated apps).
- `_production-ex`: a catalogue of SaaS concerns (auth, payments, storage, email, feature flags, webhooks). Useful only as a checklist for what "Lovable Cloud"-style features V2 must expose. Not code to reuse.
- `_admin-dashboard`: shadcn dashboard patterns. Low value for V2.
- `design/examples/*.html` and `design/baselines/`: the quality bar and the brief format that V2's planner should keep for the "design" part of an app.
- `design/justpage-refs/structure-analysis.json`: block vocabulary for COD pages; still valid for V2 landing pages inside apps.
- `design/*.html` workspace mockups: V1 shell; V2 needs new mockups for app-builder surfaces.

### 8.6 Rollout notes from the docs

- Preview deployments inherit a `/api` rewrite to production (`web-environments.md:42-54`). A V2 module tested on Vercel previews must call an absolute staging API origin (`VITE_SERVER_URL`), or the rewrite must be changed.
- Auth on previews is cross-site (`web-environments.md:16-18`). Staging on `staging.wandit.dev` is the documented fix.

---

## 9. Reusable pieces (as-is)

- `docs/PRD.md` §2 personas, §7 three-domain and serving rules, §9 data model (projects, chats/messages parts, versions, deployments, leads, credit_ledger).
- `packages/internationalization` and `docs/localization.md` rules (en/fr/ar, RTL, `formatCurrencyDZD`).
- `apps/edge` Worker + KV pointer + R2 layout (`edge-serving.md:10-16`) for publishing static builds of V2 web apps.
- Leads contract `wandit:lead` + runtime injection (`leads-crm.md:16-22`) for any generated page or app.
- Credits/metering at $0.04 per credit with `pricing_snapshot` (`pricing-v5-usd-anchor.md`).
- Composer-mode "request context" pattern (`composer-modes.md:15-31`) to pass UI selections as cargo.
- `packages/preview-editor` postMessage patterns for click-to-target.
- `DESIGN.md` tokens and the "Agent Prompt Guide" for V2 chrome.
- Trigger.dev background-task pattern with attempt rows (`ai-chat-brain.md:43-48`).
- `design/examples`, `design/baselines/briefs` as design quality references.
- `_heroui-example` dependency pins for Expo 56.

---

## 10. Open questions

1. Which Claude Code release does `_cc-harness` match, and can the missing generated SDK type files be obtained? The betas file dates the snapshot to after 2026-03-28; the directory mtime is 2026-07-31. UNVERIFIED.
2. What is the current API of the AI SDK "harness" feature and of `@anthropic-ai/claude-agent-sdk`? Nothing in the repo documents either. Needs a web check.
3. Is `_cc-harness` allowed as a reference (source provenance and license)? UNVERIFIED.
4. Is "Just Add" (`PRD.md:16`) the same product as "JustPage" (`design/justpage-refs/`)? UNVERIFIED.
5. Which doc is the source of truth for V2 planning: `PRD.md` (2026-07-04, BullMQ) or `ai-chat-brain.md` (2026-07-11+, Trigger.dev)? The PRD is stale on the job runner.
6. Must generated V2 apps be AR/FR from day one, as pages must (`PRD.md:133`)? The PRD only states this for pages.
7. Which app templates does V2 pin (web: Vite+React+shadcn like Lovable; mobile: Expo + HeroUI Native)? The Lovable prompt fixes React/Vite/Tailwind/TS (`lovable.md:5`); Wandit's own choice is not written anywhere.
8. Does V2 keep the $0.04 credit unit and meter harness token usage through the same `ai_usage_events` path? Not written anywhere.
9. Should `docs/v2/` become the home for V2 specs? It was created today by this research and does not exist on `dev`.

---

## 11. Evidence index (paths)

Product docs: `docs/PRD.md`, `docs/localization.md`, `docs/frontend-structure.md`, `docs/native-structure.md`, `docs/deployments/web-environments.md`, `CLAUDE.md`, `README.md`, `bts.jsonc`, `DESIGN.md`.
Prompts: `docs/prompts/lovable.md`, `docs/prompts/claude-design.md`, `docs/prompts/claude-design-light.md`, `docs/prompts/example.md`.
V1 architecture: `docs/features/ai-chat-brain.md`, `docs/features/chat-generation.md`, `docs/features/composer-modes.md`, `docs/features/cod-worlds.md`, `docs/features/design-worlds.md`, `docs/features/edge-serving.md`, `docs/features/publishing-serving.md`, `docs/features/leads-crm.md`, `docs/features/v2-generation-improvements.md`, `docs/features/pricing-v5-usd-anchor.md`, `docs/features/pricing-v6-starter-plan.md`, `docs/features/manual-billing.md`, `docs/features/billing.md`, `apps/server/src/modules/ai-chat/agent/system-prompt.ts`, `apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`, `packages/preview-editor/src/`, `apps/edge/README.md`, `apps/native/package.json`, `apps/native/app.json`.
Reference dirs (main checkout): `_cc-harness/{Tool.ts,tools.ts,Task.ts,QueryEngine.ts,constants/product.ts,constants/betas.ts,constants/tools.ts,types/permissions.ts,utils/permissions/permissions.ts,utils/sandbox/sandbox-adapter.ts,entrypoints/sandboxTypes.ts,entrypoints/agentSdkTypes.ts,entrypoints/sdk/coreTypes.ts,entrypoints/sdk/controlSchemas.ts,remote/RemoteSessionManager.ts,bridge/bridgeMain.ts,tools/BashTool/shouldUseSandbox.ts,utils/model/model.ts}`; `references/opencode/{package.json,AGENTS.md,packages/opencode/package.json,packages/opencode/src/permission/index.ts,packages/opencode/src/tool/tool.ts,packages/opencode/src/tool/registry.ts,packages/web/src/content/docs/{server,sdk,permissions}.mdx,packages/containers/README.md}`; `_admin-dashboard/{package.json,README.md}`; `_production-ex/{package.json,README.md}`; `_heroui-example/{package.json,README.md}`.
Design: `design/` (40 tracked files), `apps/server/scripts/test-build-world.ts`, `apps/server/scripts/test-media-generators.ts`, `apps/server/src/modules/ai-chat/agent/worlds/{cinetique,monographe}.ts`, `apps/web/src/features/workspace/components/chat/request-tray/types.ts`.
