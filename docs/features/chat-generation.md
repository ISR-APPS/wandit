# Chat & Page Generation

## What is this feature?

This is the heart of the product. The user talks to the AI in a chat. The AI turns what the user asks for into a landing page. The page appears live in the **Page** tab of the workspace.

The AI work runs as a **background job** (see the word list below). Because of this, if the user closes the browser or moves to another page, the generation does not die. It keeps running and finishes on its own.

## Words used in this doc

Read this list first. Everything below uses these words.

- **Job / queue (BullMQ)** — a job is a task saved in a waiting line (the queue). A separate program called the **worker** takes jobs from the line and runs them, one by one. BullMQ is the library we use for this.
- **Worker** — our second server (`apps/worker`). It does the slow AI work, so the main API stays fast.
- **Redis** — a very fast, small database that lives in memory. We use it for two things: storing the queue, and passing live messages between the worker and the API.
- **SSE (Server-Sent Events)** — a one-way connection from server to browser. The server keeps pushing small updates ("events") and the browser listens. This is how the user sees the AI "typing".
- **Delta** — one small piece of the AI answer (a few words). The AI sends many deltas, one after another, until the answer is complete.
- **R2** — Cloudflare's file storage (same idea as AWS S3). We save the generated HTML files there.
- **Artifact / Version** — the **artifact** is "the landing page of this project". A **version** is one saved copy of that page. Every generation creates a NEW version. Old versions are never changed or deleted (this is what "immutable" means). The artifact has a pointer that says which version is the current one.
- **jsonb** — a Postgres column type that stores JSON data.
- **Parts** — the format of a chat message in the AI SDK. One message is a list of "parts" (today just text; later it can hold images or @-mentions).
- **RTL** — right-to-left text direction, needed for Arabic.
- **Honeypot** — a hidden form field that humans never fill, but spam bots do. If it is filled, we know it is a bot.
- **Stateless API** — the API does not keep anything about a running generation in its own memory. Everything lives in Redis and Postgres. So any API server (or a restarted one) can serve any user.

## What this feature owns

- The `chats` and `messages` tables (one chat per project in the MVP; messages store AI SDK v7 **parts** as jsonb, so we are ready for @-mentions later).
- The `artifacts` and `versions` tables. Versions point to files in R2, stored under the key pattern `sites/{project_id}/{version_id}/`.
- The endpoint to send a message + the SSE stream endpoint, and the Redis relay between worker and API.
- The generation job itself: it calls the AI with Vercel AI SDK v7 `streamText`, through the **Vercel AI Gateway** (one API that gives access to many models). The system prompt forces the **page rules** (see below). When done, the job writes the version to R2, moves the artifact pointer, and consumes credits.
- The workspace UI: the shell layout (resizable chat pane, header, tabs Page | Assets | Leads | Settings), the chat message list + input, the Page tab with a safe iframe preview, a version switcher, a desktop/mobile toggle, and "open in new tab". The Assets tab in MVP is a simple list of artifacts/versions, with a Library / Canvas view toggle.

## How it works, step by step

1. The user sends a message. The API **saves it** in Postgres, **adds a job** to the queue, and answers "OK" right away (no waiting).
2. The browser opens the stream: `GET /api/chats/:chatId/stream` (SSE).
3. The worker takes the job and calls the AI model with `streamText` through the Gateway.
4. While the AI writes, the worker publishes every delta to a Redis channel that belongs to this chat.
5. The API listens to that Redis channel and forwards each delta to the browser through SSE.
6. When the AI finishes, the worker: saves the final assistant message in Postgres → writes the new page version to R2 → moves the artifact pointer to it → consumes credits → sends an `artifact-updated` event through the stream (this tells the Page tab to refresh).
7. If the user leaves and comes back: the page loads the old messages from Postgres and subscribes to the stream again. If a job is still running, the live stream simply continues.

Because the API is stateless, a refresh or a lost connection breaks nothing — the user just re-subscribes.

## Rules for the generated page (the "page contract")

The system prompt forces the AI to always produce:

- One single HTML file, using Tailwind CSS and plain ("vanilla") JavaScript.
- External libraries only from the allowed list: **Swiper, Alpine.js, AOS** (loaded from CDN).
- A lead form that posts to our capture endpoint with the project's `form_id`, plus a honeypot field, plus a small script that copies ad-tracking values from the page URL (`utm_*`, `fbclid`, `ttclid`, referrer) into the form.
- A viewport meta tag, and placeholder spots for ad pixels.
- `dir="rtl"` and Arabic support when the page language is Arabic.
- Mobile-first design.

## Preview (temporary MVP solution)

The Page tab shows the page inside an iframe with `sandbox="allow-scripts allow-forms"` and **no** `allow-same-origin`. In simple words: the generated page can run its scripts, but it cannot read our cookies, our storage, or anything from our app. The HTML is fetched through the API (so it requires login). This is safe and needs no extra infrastructure.

Later, previews will move to `{token}.<preview-domain>` URLs when the edge worker is ready (see the publishing-serving doc). Previews use the Tailwind Play CDN.

## What this feature does NOT own

- The publish pipeline: Tailwind compile, pixel injection at publish time, edge serving (→ publishing-serving).
- The lead capture endpoint that the generated form posts to (→ leads-crm; our page rules must match its spec).
- Credit prices and the credits ledger (→ credits; this feature only calls a `consume` interface).
- Image/video generation and visual editing — post-MVP.

## Work breakdown (3 issues)

### 1. Chat + streaming backbone (DB → API → worker relay)

Build the `chats`/`messages` tables + contracts (parts as jsonb). `POST /api/chats/:chatId/messages` saves the message and enqueues the job. The generation queue lives in `packages/jobs`. The worker job skeleton is wired to AI SDK v7 + the AI Gateway (which model to use comes from env variables, not from code). One Redis channel per chat; the SSE endpoint relays it (with heartbeats, reconnect using `last-event-id`, and closing when the job ends). The final assistant message is saved when generation completes. **Dependencies to add (ask first): `ai` v7, Redis client.**

**Done when:**
- Sending a message returns fast; deltas arrive over SSE; the final assistant message is in Postgres.
- If you kill the browser in the middle of a generation and open the workspace again, you see the completed result. If you re-subscribe while it is still running, the live stream continues.
- Model/gateway can be changed via env, with zero code changes.

### 2. Landing-page generation pipeline (versions → R2)

Build the `artifacts`/`versions` tables + contracts. R2 client + the bucket layout `sites/{project_id}/{version_id}/index.html`. Write the generation system prompt that enforces the page rules above, with the project's `form_id` injected into it. On completion: write the version file to R2, insert an immutable `versions` row, move the artifact pointer, call the credits `consume` interface (a do-nothing stub until the Credits feature lands), and emit `artifact-updated` on the stream. The first generation, triggered by creating a project, must work end to end.

**Done when:**
- Every generation creates a NEW version (never overwrites); the pointer moves; all versions can be listed.
- The generated HTML passes the rules: single file, allowed CDNs only, form posts to the capture endpoint with the correct `form_id` + honeypot, viewport meta, RTL when Arabic.
- The R2 keys follow the layout and the API can fetch them for the preview.

### 3. Workspace UI: shell, chat pane, page preview

The workspace shell on `/p/$projectId`: header (logo → dashboard, project dropdown, tabs), a chat pane you can drag-resize and collapse, and the main pane floating as an inset card. Chat UI: message list that renders parts, a streaming indicator, and an input that is disabled while a generation runs. Page tab: the sandboxed iframe (`allow-scripts allow-forms`, no same-origin) showing the active version; a toolbar with the version switcher, a desktop/mobile viewport toggle (mobile is the default), and open in new tab. Assets tab: a simple artifact/version list with a Library (grid) / Canvas (freeform board) toggle. Leads/Settings tabs: placeholders, ready for their own features.

**Done when:**
- The full loop works: type a prompt → text streams into the chat → the page appears in the Page tab when the version is saved.
- The version switcher flips the iframe between versions; the mobile/desktop toggle resizes correctly.
- The iframe has no same-origin access (checked: the page's JS cannot reach cookies/storage).

**Files:** `packages/db/src/schema/{chats,artifacts}.ts`, `packages/jobs/src/**`, `packages/contracts/src/v1/{chats,artifacts}.ts`, `apps/server/src/modules/generation/**` (chats, artifacts, SSE relay), `apps/worker/src/processors/ai-generation.processor.ts`, `apps/web/src/routes/_auth/p.$projectId.tsx`, `apps/web/src/features/workspace/**`.

Source docs: docs/PRD.md, docs/features/chat-generation.md
