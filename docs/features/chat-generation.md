# Chat & Page Generation

## Purpose

The core of the product: the chat is the interface, and the generation engine turns intents into versioned landing pages rendered live in the canvas. Queue-backed so generations survive navigation.

## Owns

- `chats` + `messages` tables (one chat per project in MVP; messages store AI SDK v7 **parts** as jsonb — future-proof for @-mentions).
- `artifacts` + `versions` tables (immutable versions pointing to R2 keys `sites/{project_id}/{version_id}/`).
- Message endpoint + SSE stream endpoint; Redis pub/sub relay between worker and API.
- The generation BullMQ job: Vercel AI SDK v7 `streamText` via Vercel AI Gateway, system prompt enforcing the **page contract**, version write to R2, artifact pointer update, credits consumption hook.
- Workspace UI: shell layout (collapsible chat pane, canvas, header, tabs skeleton Canvas | Assets | Leads | Settings), chat message list + input, canvas with sandboxed iframe preview, version switcher, desktop/mobile toggle, open in new tab. Assets tab = simple list of artifacts/versions in MVP.

## Working model

Client `POST`s a message → server persists it, enqueues a generation job, returns immediately. Client subscribes to `GET /api/chats/:chatId/stream` (SSE). The worker runs `streamText` against the Gateway, publishes deltas to a Redis channel, persists the final assistant message, writes the new version to R2, updates the artifact pointer, consumes credits, then emits an `artifact-updated` event. The API relays the Redis channel to SSE subscribers — so the API stays stateless and a user who navigates away and back just re-subscribes (on mount: fetch messages, subscribe; if a job is active the stream continues).

**Page contract (system prompt):** single-file HTML + Tailwind + vanilla JS; whitelisted CDN libs only (Swiper, Alpine.js, AOS); lead form posting to our capture endpoint with the project's `form_id`, a honeypot field, and a small form script forwarding ad params (`utm_*`, `fbclid`, `ttclid`, referrer) from the page URL; viewport meta; pixel placeholders; `dir="rtl"` + Arabic support when the page language is Arabic; mobile-first.

**Preview (MVP interim):** the canvas iframe is `sandbox="allow-scripts allow-forms"` (opaque origin, no `allow-same-origin`) fed with the version HTML fetched through the authed API — safe without infra. It switches to `{token}.<preview-domain>` URLs once the edge worker lands (→ publishing-serving). Tailwind Play CDN in previews.

## Does not own

- Publish pipeline, Tailwind compile, pixel injection at publish, edge serving (→ publishing-serving).
- Lead capture endpoint the generated form posts to (→ leads-crm; the page contract must match its spec).
- Credit amounts and the ledger (→ credits; this feature calls a `consume` interface).
- Image/video generation, visual editing — post-MVP.

## Issue breakdown

### 1. Chat domain + streaming backbone (DB → API → worker relay)

`chats`/`messages` tables + contracts (parts jsonb). `POST /api/chats/:chatId/messages` persists + enqueues. Generation queue in `packages/jobs`. Worker job skeleton wired to AI SDK v7 + AI Gateway (model per task via env-configured gateway strings). Redis pub/sub channel per chat; SSE endpoint relaying it (heartbeats, reconnect with last-event-id, close on job end). Assistant message persisted on completion. **Dependencies to add (ask first): `ai` v7, Redis client.**

**Acceptance criteria**
- Sending a message returns fast; deltas arrive over SSE; the final assistant message is in Postgres.
- Killing the browser mid-generation and reopening the workspace shows the completed result; re-subscribing mid-run resumes the live stream.
- Model/gateway configurable via env without code changes.

### 2. Landing-page generation pipeline (versions → R2)

`artifacts`/`versions` tables + contracts. R2 client + bucket layout `sites/{project_id}/{version_id}/index.html`. Generation system prompt implementing the page contract (see Working model) with the project's `form_id` injected. On completion: write R2 version, insert immutable `versions` row, update artifact pointer, call the credits `consume` interface (no-op stub until Credits lands), emit `artifact-updated` over the stream. First generation triggered by project creation must work end-to-end.

**Acceptance criteria**
- Each generation creates a NEW version (never overwrites); pointer moves; all versions listable.
- Generated HTML passes contract checks: single file, whitelisted CDNs only, form → capture endpoint with correct `form_id` + honeypot, viewport meta, RTL when Arabic.
- R2 keys match the layout and are reachable by the API for preview fetch.

### 3. Workspace UI: shell, chat pane, canvas preview

Workspace shell on `/p/$projectId`: header (logo → dashboard, project dropdown, tabs), collapsible chat pane, canvas area. Chat UI: message list rendering parts, streaming indicator, input with disabled state while running. Canvas: sandboxed iframe (`allow-scripts allow-forms`, no same-origin) rendering the active version; toolbar with version switcher, desktop/mobile viewport toggle (mobile default), open in new tab. Assets tab: simple artifact/version list. Leads/Settings tabs: placeholders wired for their features.

**Acceptance criteria**
- Full loop: prompt → streaming text in chat → page appears in canvas when the version is saved.
- Version switcher flips the iframe between versions; mobile/desktop toggle resizes correctly.
- The iframe has no same-origin access (verified: no cookies/storage reachable from page JS).

**Files:** `packages/db/src/schema/{chats,artifacts}.ts`, `packages/jobs/src/**`, `packages/contracts/src/{chat,artifacts}.ts`, `apps/server/src/modules/generation/**` (chats, artifacts, SSE relay), `apps/worker/src/processors/ai-generation.processor.ts`, `apps/web/src/routes/_auth/p.$projectId.tsx`, `apps/web/src/features/workspace/**`.

Source docs: docs/PRD.md, docs/features/chat-generation.md
