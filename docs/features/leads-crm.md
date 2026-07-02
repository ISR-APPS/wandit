# Leads & Order CRM

## Purpose

The value loop for COD sellers: order forms on published pages flow back into the platform as leads, managed in a mini order-CRM with phone-based confirmation. Lead collection is always free — never gated by credits.

## Owns

- `leads` table: projectId, deploymentId, name, phone (canonical E.164), wilaya, commune, extra fields (jsonb), ad attribution (jsonb: utm_*, fbclid, ttclid, referrer), status, timestamps.
- Status pipeline: `to-confirm → confirmed → shipped → delivered / returned`, plus `cancelled` — the terminal state when phone confirmation fails (refused / unreachable / fake order).
- Public capture endpoint keyed by the project's `public_form_id`: validation, honeypot, IP rate limiting (Redis), CORS restricted to `*.wandit.app`.
- Leads tab UI: paginated table, inline status changes, tap-to-call (`tel:`) + tap-to-WhatsApp (`wa.me`), CSV export, counters (leads today / this week, confirmation rate), empty state.
- Lead-count aggregates consumed by the dashboard grid.

## Working model

Generated pages contain a form (per the page contract in chat-generation) posting to `POST /api/public/leads/{formId}` — no auth, so defense is layered: Zod validation, hidden honeypot field (silently accept + discard when filled), per-IP rate limit, capped payload size, `formId` → project resolution (404 on unknown). Wilaya/commune are first-class columns (Algeria); anything else the page collects lands in the jsonb. Phones are normalized to canonical E.164 at capture (Arabic-Indic digits folded, `0`/`00213` prefixes mapped to `+213`; raw input kept in extras; unparseable → form validation error — a DB CHECK enforces the shape). Whitelisted ad params forwarded by the page's form script (utm_*, fbclid, ttclid, referrer, landing URL) are captured server-side into the attribution jsonb. Status changes are single-tap from the table (the audience works phone-first, mobile-first). CSV export is server-generated with a stable column order. Confirmation rate = confirmed ÷ (confirmed + cancelled).

## Does not own

- The form markup inside generated pages (→ chat-generation page contract; the spec must match this endpoint).
- Lead email/push notifications (post-MVP).
- Google Sheets sync, analytics dashboards (post-MVP).

## Issue breakdown

### 1. Lead capture slice (DB → public API)

`leads` table + migration + contracts. `public_form_id` generation on projects (unguessable). `POST /api/public/leads/{formId}`: Zod validation (name, phone required; wilaya/commune optional columns; extras → jsonb), honeypot handling, Redis per-IP rate limit, CORS for `*.wandit.app`, body-size cap. Internal endpoints: paginated list w/ filters, `PATCH /leads/:id/status`, counters aggregate, CSV export stream. Document the exact form spec for the generation system prompt.

**Acceptance criteria**
- A form POST from a published page creates a lead visible in the workspace within a refresh.
- Honeypot-filled and rate-limited submissions are rejected/discarded without creating rows; unknown `formId` → 404.
- Status transitions persist with timestamps; CSV export downloads with correct encoding (Arabic names intact — UTF-8 BOM).

### 2. Leads tab UI (order-CRM)

Leads tab in the workspace: TanStack Query paginated table (name, phone, wilaya/commune, date, status), inline status control per row, tap-to-call and tap-to-WhatsApp actions, header counters (today, this week, confirmation rate), CSV export button, empty state ("publish your page to start collecting orders"). Mobile-first layout — the table must degrade to cards on small screens. Dashboard lead counts wired to the aggregate.

**Acceptance criteria**
- Status change is optimistic and single-tap; counters update accordingly.
- `tel:` and `wa.me` links work with Algerian numbers (+213 normalization).
- Usable on a 360px viewport; Arabic names render correctly (RTL-safe cells).

**Files:** `packages/db/src/schema/leads.ts`, `packages/contracts/src/v1/leads.ts`, `apps/server/src/modules/leads/**`, `apps/web/src/features/workspace/components/leads/**`, `apps/web/src/features/workspace/api/leads.{services,queries,mutations}.ts`.

Source docs: docs/PRD.md, docs/features/leads-crm.md
