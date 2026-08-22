# Leads & Order CRM

## Purpose

The value loop for COD sellers: order forms on published pages flow back into the platform as leads, managed in a mini order-CRM with phone-based confirmation. Lead collection is always free — never gated by credits.

## Owns

- `leads` table: projectId, deploymentId, name, phone (canonical E.164), wilaya, commune, extra fields (jsonb), ad attribution (jsonb: utm_*, fbclid, ttclid, referrer), status, timestamps.
- Status pipeline: `to_confirm → confirmed → shipped → delivered / returned`, plus `cancelled` — the terminal state when phone confirmation fails (refused / unreachable / fake order).
- Public capture endpoint (implemented): `POST /api/public/leads/{publicFormId}` — keyed by the project's unguessable `public_form_id`, Zod validation, honeypot `_hp` (silently accept + discard), per-IP rate limit, in-window duplicate updates (same phone + form; newest honest submission wins, no submission is dropped), E.164 normalization with Arabic-Indic digit folding. Accepts text/plain JSON as a CORS simple request (no preflight, no cookies); the caller never reads the response — capture is fire-and-forget by design.
- Authed endpoints (implemented): `GET /api/v1/projects/{projectId}/leads` (full list; counters, filtering, search, pagination and CSV export are client-side over it) and `PATCH .../leads/{leadId}/status`.
- Leads tab UI: table with inline status changes, tap-to-call (`tel:`) + tap-to-WhatsApp (`wa.me`), CSV export, counters (leads today / this week, confirmation rate), empty state.
- Lead-count aggregates consumed by the dashboard grid.

## Page contract (`wandit:lead`)

Generated pages never fetch/XHR/sendBeacon and invent no endpoints. Instead, the instant form validation passes — as the success flow starts — the page dispatches `document.dispatchEvent(new CustomEvent("wandit:lead", { detail: fields }))`, where `fields` is a flat object of everything the form collected as strings: canonical keys `name`, `phone` (raw user input — the server normalizes), `wilaya`, `commune` when collected. Order facts also use canonical extras keys — `product`, `quantity`, `price`, `delivery`, `total` — so the CRM and exports can promote them into first-class columns; any other field (size, color…) travels under its own key; uncollected keys are omitted. Each form also carries exactly one bot decoy: `<input type="text" name="website" data-wandit-hp tabindex="-1" autocomplete="off" aria-hidden="true">`, hidden offscreen (never `display:none`), never read by the page's own script. In preview no listener exists and the event is a no-op; the success state never waits on it.

## Runtime injection

At publish time, `injectLeadsRuntime` (being built under `apps/server/src/modules/leads/runtime/`) injects a script into the page that listens for `wandit:lead`, reads the `data-wandit-hp` decoy, attaches whitelisted ad attribution from the landing URL (utm_*, fbclid, ttclid, referrer, landing URL), and posts the capture body — the injected script is the only thing that knows the capture URL. The publish pipeline (slice 0, in progress elsewhere) calls this seam.

After the capture endpoint accepts a lead, the runtime also fires Meta `Purchase` and TikTok `CompletePayment` with `value` set to the order total, or `0` when unknown, and `currency: "DZD"`. These events use the same phone dedupe and honeypot suppression rules as the existing Lead events.

## Working model

Wilaya/commune are first-class columns (Algeria); anything else the page collects lands in the jsonb. Phones are normalized to canonical E.164 at capture (Arabic-Indic digits folded, `0`/`00213` prefixes mapped to `+213`; raw input kept in extras; unparseable → validation error — a DB CHECK enforces the shape). Source is derived server-side from attribution (fbclid/utm_source → facebook, ttclid → tiktok, else direct). Status changes are single-tap from the table (the audience works phone-first, mobile-first). CSV and Sheets exports put the fixed columns first, then five always-present promoted order columns (product, quantity, price, delivery, total — filled from the canonical extras keys plus a French/Arabic/English synonym recognizer in `@wandit/contracts`, so pages generated before the canonical-keys rule still land in them), then one column per remaining dynamic form field (first-appearance order over the newest-first lead list, capped at 100 with a serialized "Autres champs" catch-all), UTF-8 BOM for Arabic names. The lead tables show the same promoted facts as an always-visible order summary line under the buyer's name. Confirmation rate = confirmed ÷ (confirmed + cancelled).

## Does not own

- The form markup inside generated pages (→ site-builder prompt + design worlds; the `wandit:lead` contract above is the shared spec).
- Lead email/push notifications (post-MVP).
- Google Sheets sync, analytics dashboards (post-MVP).

## Issue breakdown

### 1. Lead capture slice (DB → public API) — implemented

`leads` table + migration + contracts (`packages/contracts/src/v1/leads.ts` is the source of truth). `public_form_id` generation on projects. Capture, list and status endpoints as above.

**Acceptance criteria**
- A form submit on a published page creates a lead visible in the workspace within a refresh.
- Honeypot-filled submissions answer `{ ok: true }` without creating rows; a duplicate inside the window answers `{ ok: true }` and updates the recent row in place (newest honest submission wins; no submission is dropped); rate-limited requests → HTTP 429; unknown `publicFormId` → 404.
- Status transitions persist with timestamps.

### 2. Leads tab UI (order-CRM)

Leads tab in the workspace: TanStack Query table (name, phone, wilaya/commune, date, status), inline status control per row, tap-to-call and tap-to-WhatsApp actions, header counters (today, this week, confirmation rate), CSV export button, empty state ("publish your page to start collecting orders"). Mobile-first layout — the table must degrade to cards on small screens. Dashboard lead counts wired to the aggregate.

**Acceptance criteria**
- Status change is optimistic and single-tap; counters update accordingly.
- `tel:` and `wa.me` links work with Algerian numbers (+213 normalization).
- Usable on a 360px viewport; Arabic names render correctly (RTL-safe cells).

**Files:** `packages/db/src/schema/leads.ts`, `packages/contracts/src/v1/leads.ts`, `apps/server/src/modules/leads/**`, `apps/web/src/features/workspace/components/leads/**`, `apps/web/src/features/workspace/api/leads.{services,queries,mutations}.ts`.

Source docs: docs/PRD.md, docs/features/leads-crm.md
