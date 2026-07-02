# PRD — Wandit

**Status:** MVP planning · **Owner:** Zack · **Last updated:** 2026-07-02
This document is the source of truth for product scope, build order, and settled architecture decisions. Feature-level detail lives in `docs/features/*.md`.

---

## 1. Vision

An AI-powered creative workspace for e-commerce sellers — think **Lovable × Lovart, focused on e-com**. The user chats with an AI to generate marketing artifacts: **COD landing pages (primary case)**, and later product images, videos, ad creatives, and marketing strategies. They preview the page live, iterate via chat (later: click-to-edit), and publish to a subdomain in one click. Published pages contain order forms; submissions flow back into the platform as leads/orders managed in a mini order-CRM.

One line: **prompt → landing page → publish → orders.**

Scope note: COD e-com is the primary case, **not the only one** — the generator serves landing pages for any business goal (sites vitrines, service pages, promos).

Inspiration: Just Add (chat → campaign → page → publish) executed with a sane architecture and UX; Lovable's prompt-first funnel and pricing mechanics; Lovart's canvas.

## 2. Market & personas

Primary market: **Algeria** → Arabic (RTL) + French pages, wilaya/commune addressing, COD order flow, phone-based confirmation, DZD pricing and a CIB card payment rail later.

- **E-com beginner** — runs Meta/TikTok ads, sells COD, mobile-heavy, FR/AR. Needs speed, not tooling.
- **Freelancer / media buyer** — builds pages for several products/clients, iterates fast.
- **Agency** (post-MVP Business plan) — seats, client workspaces, white-label.

## 3. Core journey (prompt-first funnel)

1. Visitor lands on `/` → hero prompt box + examples + pricing.
2. Types a prompt → **auth modal** (Google OAuth popup, magic link fallback). The typed prompt lives in React state through auth, with a **one-shot sessionStorage stash** as a safety net for redirect flows; cleared after replay.
3. After first prompt + auth: **project auto-created**, user lands in the workspace with generation **already streaming**.
4. Iterates via chat; the Page tab previews the landing page (mobile/desktop toggle — audience is mobile-first).
5. Publishes to `{slug}.wandit.app` in one click; runs ads to it.
6. Form submissions appear in the **Leads** tab → user confirms orders by phone → status pipeline `to-confirm → confirmed → shipped → delivered / returned` (+ `cancelled` when phone confirmation fails).
7. Generation costs credits (visible price tags). When empty: upgrade plan or top-up wallet (post-MVP; **fake credits** in MVP). Publishing and lead collection are always free.

## 4. Information architecture

3-page SPA, prompt-first:

| Route | Content |
|---|---|
| `/` | Public landing: hero prompt box + examples + pricing (light chunk) |
| `/dashboard` | Projects grid (thumbnail, status, lead count) + prompt box |
| `/p/$projectId` | Workspace (heavy, lazy-loaded) |

Auth is a **modal + Google popup overlaying any route** — never a dedicated page.

**Workspace:** chat pane on the left (drag-resizable + collapsible), main pane on the right floating as an inset card (rounded, bordered, shadowed — chat stays flush to the edge, mirrors the admin dashboard's sidebar-inset look). Desktop uses a real resizable split (`react-resizable-panels`, size persisted); mobile keeps the chat pane as a full-screen overlay.

**Workspace tabs:** Page | Assets | Leads | Settings.
- Page: renders the active landing-page version in a sandboxed cross-origin iframe. Toolbar: version switcher, desktop/mobile preview toggle, open in new tab. The toolbar's trailing action group is reserved for the future edit-mode toggle (see §6 roadmap item 4 — visual editing).
- Assets: every generated artifact (+ user uploads post-MVP), viewable as a **Library** (strict grid) or a **Canvas** (freeform mood board, pannable/zoomable) — one tab, a view toggle switches between them.
- Leads: submissions table, inline status pipeline, tap-to-call / tap-to-WhatsApp, CSV export, counters.
- Settings: publish slug, Meta/TikTok pixel IDs, rename/delete, unpublish.

Logo → dashboard. Project-name dropdown switches projects. Everything autosaves. Generations keep running server-side (queue) if the user navigates away.

## 5. MVP scope & build order

Build **vertical slices** (DB → API → UI per feature), in this order:

| # | Feature | Doc | Linear project |
|---|---|---|---|
| 1 | Foundation & App Shell | `docs/features/foundation-app-shell.md` | Foundation & App Shell |
| 2 | Auth & Accounts | `docs/features/auth-accounts.md` | Auth & Accounts |
| 3 | Projects & Dashboard | `docs/features/projects-dashboard.md` | Projects & Dashboard |
| 4 | Chat & Page Generation | `docs/features/chat-generation.md` | Chat & Page Generation |
| 5 | Publishing & Site Serving | `docs/features/publishing-serving.md` | Publishing & Site Serving |
| 6 | Leads & Order CRM | `docs/features/leads-crm.md` | Leads & Order CRM |
| 7 | Credits (fake) | `docs/features/credits.md` | Credits & Usage |

**Out of MVP:** image/video generation, visual click-to-edit, Stripe/CIB billing, custom domains, Business plan / organizations, Google Sheets sync, analytics dashboards, campaign integrations + @-entity tagging, the Expo native app, lead email notifications, user asset uploads.

**Launch gate:** "MVP" is the internal build milestone, not the public launch. The public launch ships with **subscription plans live** — Stripe billing (roadmap #1) is slice 8, built on top of the fake-credits ledger before opening to the public.

## 6. Post-MVP roadmap (rough order)

1. **Stripe billing** *(launch-blocking — ships before public launch)* — Free + Pro (credit-amount slider = multiple recurring Prices on one Product) + Business (seats, client workspaces, white-label). Monthly plan credits expire each billing cycle (expire + re-grant inside the `invoice.paid` webhook); one-time top-up packs (Stripe Checkout) never expire and burn only after plan credits. Adds the `subscription` table (Better Auth Stripe plugin or hand-rolled) — purely additive, no changes to existing tables.
2. **CIB card rail** — pay in DZD → grant credits. The ledger is payment-provider-agnostic by design; CIB is just another writer.
3. **Image / video generation** — AI SDK `generateImage` / `experimental_generateVideo` inside BullMQ workers (extended timeouts ~15 min), results uploaded to R2 and registered as artifacts.
4. **Visual editing** — elements stamped with `data-eid` at save time; editor script injected into preview HTML only; cross-origin iframe ↔ app via postMessage; edits applied server-side by element ID, saved as a new version. Two tiers: direct text/style edits (no AI) and element-scoped AI edits. No drag-and-drop, ever. **UI direction (settled 2026-07-02):** a right-side element-inspector rail (Framer/Webflow-style) slides in from the edge of the Page tab when an element is clicked, rather than Lovable's floating bottom toolbar or a plain edit/preview tab-switch — chrome stays anchored and never occludes the page, and it scales naturally to the two-tier edit model above. The Page toolbar's trailing action group is the reserved slot for the edit-mode toggle that opens it.
5. **Campaign integrations + entity tagging** — link TikTok/Meta campaigns to a project; @-tag entities in chat (`@campaign x`); AI answers questions and takes actions on them via tools. Platform OAuth tokens live in a dedicated connections table — not Better Auth's `account`.
6. Custom domains (Cloudflare for SaaS), Google Sheets sync, analytics dashboards, Business/orgs (Better Auth organizations plugin).

## 7. Architecture decisions (settled — do not relitigate)

- **Three-domain split:** `wandit.dev` serves the SaaS (marketing + app; API on `api.wandit.dev`); published sites on `{slug}.wandit.app`; previews on `{token}.<preview-domain>` (noindex) — a dedicated cheap domain (candidates: `wandit-preview.xyz`, `wnditpreview.site`; purchase pending). Wildcard DNS + certs on `*.wandit.app` and the preview domain. **Never serve user-generated content from `wandit.dev` (app/API domain).** A Cloudflare Worker (`apps/edge`) routes by hostname to files in R2. Post-launch: submit `wandit.app` to the Public Suffix List (like `pages.dev`) so user sites' cookies are isolated from each other.
- **Generated pages:** raw HTML + Tailwind + vanilla JS, single file, no build step. Whitelisted CDN libraries only (Swiper, Alpine.js, AOS). No React, no bundler. The generation system prompt enforces the page contract: form posts to our lead-capture endpoint with the project's form ID, viewport meta, Meta/TikTok pixel injection, RTL support for Arabic, mobile-first.
- **Storage & versioning:** generated HTML saved as **immutable versioned files** in R2 (`sites/{project_id}/{version_id}/`) — every generation is a NEW version, never overwritten. Postgres holds pointers. **Publishing = updating a pointer** (slug → version_id). Rollback = pointing to an older version. Tailwind Play CDN in previews; Tailwind CLI compiles a small CSS file on publish only.
- **Generation runs in a queue** (BullMQ, `apps/worker`), streams deltas via Redis pub/sub, and the API relays to the client over SSE — so generations survive navigation and the API stays stateless.
- **Credits:** ledger table (`grant / consume / topup / expire / revoke` rows), balance = `sum(ledger)`. Provider-agnostic: Stripe now, CIB later — both just write ledger rows. Generation costs credits with visible price tags; publishing and lead collection are always free.
- **AI:** Vercel AI SDK v7 + Vercel AI Gateway for everything (text, structured outputs with Zod, tools, images, video). Models swappable per task via Gateway strings. fal.ai direct client is a fallback only.

## 8. Tech stack & repo layout (actual)

pnpm workspaces + Turborepo. Biome for lint/format. TypeScript everywhere.

| Workspace | Role |
|---|---|
| `apps/web` | Vite + React + **TanStack Router SPA** (no SSR) + Tailwind v4. TanStack Query for server state (to be added). Feature-based structure (`src/features/*`, thin routes) — see `docs/frontend-structure.md`. Lazy route chunks — `/` stays light. → Cloudflare Pages with SPA fallback. |
| `apps/server` | **NestJS on Fastify** — the API. ALL business logic. Better Auth mounted. SSE for chat/generation streaming. Light-DDD module per domain in `src/modules/*` (see `src/modules/README.md`). |
| `apps/worker` | **NestJS BullMQ worker process** — background jobs: generation, publishing, media later. One processor per queue in `src/processors/*`. Long timeouts live here. |
| `apps/edge` *(to be created)* | **Cloudflare Worker** — hostname router for published sites + previews (KV pointer → R2 file). |
| `apps/native` | Expo app from the scaffold. **Out of MVP** — untouched for now. |
| `packages/db` | Drizzle ORM + Neon Postgres. Schema + drizzle-kit migrations. |
| `packages/auth` | Better Auth config (Google OAuth + magic links, Drizzle adapter). |
| `packages/env` | t3-env schemas per surface (`server` / `web` / `native`). |
| `packages/jobs` | BullMQ queue names + job payload types, shared server ↔ worker. |
| `packages/contracts` *(to be created)* | Shared Zod API contracts + types, web ↔ server. |
| `packages/ui` | Shared UI kit (shadcn-style, base-ui). |
| `packages/config` | Shared tsconfig / tooling. |

Naming: the product is **Wandit** — workspace scope `@wandit/*` → `@wandit/*` in Foundation.

Other services: Neon (Postgres), Redis (BullMQ + pub/sub + rate limiting), Cloudflare R2 + KV + Pages + Workers, Vercel AI Gateway, Sentry.

## 9. Data model (overview)

| Table | Owner feature | Notes |
|---|---|---|
| `user`, `session`, `account`, `verification` | Auth | Better Auth Drizzle adapter tables. |
| `projects` | Projects | The hub: everything hangs off a project (chats, artifacts, leads; campaigns later). Public `form_id`, preview token, pixel IDs. |
| `chats`, `messages` | Chat & Generation | One chat per project in MVP. Messages store AI SDK v7 **parts** (jsonb) — flexible enough for future @-mentions. |
| `artifacts`, `versions` | Chat & Generation | Artifact = a generated thing (landing page; later image/video/strategy). Versions are **immutable**, point to R2 keys. |
| `deployments` | Publishing | slug → version pointer, publish state, history. |
| `leads` | Leads | name, phone (E.164), wilaya, commune, extra fields jsonb, ad attribution jsonb, status pipeline. |
| `credit_ledger` | Credits | grant / consume / topup / expire / revoke rows; balance = sum; idempotency key dedupes retried jobs/webhooks. |

## 10. Non-functional requirements

- **Generated pages must support Arabic (RTL) and French from day one**, mobile-first.
- **Security:** user HTML never on app/API domains; preview iframes sandboxed (opaque origin); public endpoints (lead capture) rate-limited + honeypot; secrets validated via env schemas; Better Auth cookies httpOnly.
- **Performance:** `/` is a light chunk; workspace code lazy-loads on `/p/*`.
- **Reliability:** generations survive navigation (queue); versions immutable (rollback always possible); Sentry on web, server, and worker.

## 11. Open questions

- Preview domain purchase (`wandit-preview.xyz` vs `wnditpreview.site` vs other) — placeholder `<preview-domain>` in docs/config until bought.
- App chrome language for MVP: FR, EN, or both (generated pages are AR/FR regardless).
- Email provider for magic links (suggestion: Resend).
- Free credit grant size + per-action credit costs (placeholders defined in `docs/features/credits.md`).
- API + worker deploy target (Railway / Fly / VPS).

Source docs: docs/PRD.md, docs/features/*.md
