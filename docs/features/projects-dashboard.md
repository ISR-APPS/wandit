# Projects & Dashboard

## Purpose

The project is the hub everything hangs off — chats, artifacts, versions, deployments, leads, and later campaign integrations. This feature owns the project lifecycle and the dashboard where users see and enter their projects.

## Owns

- `projects` table: id, userId, name, status (derived: draft/published), `public_form_id` (for lead capture), `preview_token` (draft-preview subdomain), pixel IDs, timestamps, soft delete.
- CRUD API: list (with lead counts + published state), **create-with-prompt orchestration**, rename, delete. Ownership guards.
- Dashboard `/dashboard`: projects grid (thumbnail placeholder, status badge, lead count), prompt box (same component as landing), empty state.
- Auto-create flow: first prompt (from `/` or `/dashboard`) → create project + chat → enqueue first generation → navigate to `/p/$projectId` with the stream already running.
- Project-name dropdown in the workspace header (switch projects).
- Settings tab, general section: rename + danger-zone delete.

## Working model

`POST /api/projects` accepts `{ prompt }`, creates the project and its chat, enqueues the first generation job, and returns ids — the client navigates straight into the workspace and subscribes to the already-running stream (streaming internals → chat-generation). Project names are AI-suggested from the prompt later; MVP derives a short name from the prompt text. Lead counts come from a cheap aggregate; thumbnails are a gradient placeholder in MVP (screenshots post-MVP). Delete is soft (recoverable) and cascades visibility, not data.

## Does not own

- Chat/streaming internals and versions (→ chat-generation).
- Publish slug + pixel injection at publish (fields live here; pipeline → publishing-serving).
- Lead rows (→ leads-crm; this feature only reads counts).

## Issue breakdown

### 1. Projects domain slice (DB → API)

`projects` table + relations + migration. Zod contracts in `packages/contracts`. Endpoints: `GET /projects` (with lead count + published flag), `POST /projects` ({ prompt } orchestration: project + chat + enqueue first generation — queue call behind an interface until chat-generation lands), `PATCH /projects/:id` (rename, pixel IDs), `DELETE /projects/:id` (soft). Ownership guard on every route.

**Acceptance criteria**
- Create-with-prompt returns `{ projectId, chatId }` and has enqueued exactly one generation job (or the stub interface records the call).
- List returns only the caller's non-deleted projects with correct counts; other users' ids 404.
- All request/response shapes validated by shared contracts on both sides.

### 2. Dashboard + project switching (UI)

Dashboard grid with cards (name, status badge, lead count, updated-at, gradient thumbnail), empty state pushing to the prompt box. Prompt box wired: signed-out → auth modal continuation; signed-in → create → navigate to workspace. Project-name dropdown in the workspace header listing projects + "back to dashboard". Settings tab general section: rename inline, danger zone delete with confirm.

**Acceptance criteria**
- First prompt from `/` (through auth) and from `/dashboard` both land in `/p/$projectId` without a dead screen.
- Rename reflects immediately in header, dropdown, and dashboard (Query cache updated).
- Delete removes the project from the grid and blocks the workspace route.

**Files:** `packages/db/src/schema/projects.ts`, `packages/contracts/src/v1/projects.ts`, `apps/server/src/modules/projects/**`, `apps/web/src/routes/_auth/dashboard.tsx`, `apps/web/src/features/projects/**`.

Source docs: docs/PRD.md, docs/features/projects-dashboard.md
