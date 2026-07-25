# Custom Domains (buy in-app + bring your own)

**Status:** backend and UI foundations built; paid purchase and renewal intentionally gated · **Direction updated:** 2026-07-24

Extends `docs/features/publishing-serving.md` with real domains on top of `{slug}.wandit.app`.

## Purpose

Users can either buy a domain inside Wandit or connect one they already own. Purchased domains are registered, configured, secured, and attached to a project without requiring DNS knowledge. Buying in-app is especially useful for Algerian customers who cannot pay an international registrar directly.

## Current decisions

- **Wandit is the reseller.** The customer pays Wandit through a direct checkout; Wandit pays the registrar from its funded reseller account and keeps the margin. Domain purchases and renewals do **not** use Wandit credits.
- **Registrar: Name.com CORE v1**, behind the `DomainProvider` port. New integrations use CORE v1, not legacy v4.
- **The customer is the registrant of record.** Their contact data is sent for registrant/admin/technical/billing roles. Contact-verification status must be surfaced because an unverified contact can eventually suspend resolution.
- **Premium and non-registration inventory are blocked in v1.** Availability calls are restricted to `purchaseType: registration`; a missing price, premium flag, or price above the configured wholesale ceiling fails closed.
- **Privacy starts disabled.** Name.com may charge separately for privacy and VAT. It can be offered only after checkout quotes and pays for the complete registrar cost.
- **Wandit owns renewal timing.** Registrar autorenew is disabled at registration; the local `auto_renew` flag expresses customer intent. No renewal call is allowed without a successful payment event for that renewal.
- **Serving remains registrar-independent.** Cloudflare for SaaS issues certificates, `apps/edge` routes hosts through KV/R2, and publishing refreshes each active domain pointer.
- **Canonical host:** `www.{domain}` CNAMEs to `customers.wandit.app`; Name.com URL forwarding redirects the apex to `www`.
- **Domain ownership survives project deletion.** Deleting a project detaches its domains; it never releases a registration.
- **`.dz`, IDNs, transfers-in, and aftermarket domains are deferred.**

## Payment safety gate

**Domain checkout runs through the orders module (`payment_orders` + Stripe Checkout); registrar mutations happen only after verified payment.**

- A browser redirect, checkout success page, or client mutation is never proof of payment. The success page calls `POST /api/v1/orders/reconcile-session`, which re-reads the session from Stripe and asserts amount/currency/customer/mode/purpose invariants before marking the order paid.
- DomainsModule owns the registrant snapshot, availability/ceiling checks, and fulfillment state. The orders module owns `payment_orders`, Stripe checkout sessions, webhook reconciliation, and durable refunds; it references domains through `DomainRegistrationFulfillment`.
- Fulfillment (`domain-purchase` job, `jobId: order-fulfill-{orderId}`) is enqueued only for a paid order, from the webhook processor or session reconciliation — both idempotent.
- The worker re-checks the order under an advisory-lock fence (`domain-order:{orderId}` → order row `FOR UPDATE`) immediately before spending money at the registrar, and every post-registration write is a status CAS; a lost CAS against a refunded order records a loud `MANUAL REVIEW REQUIRED` note.
- If payment succeeds but registration fails terminally, the durable Stripe refund is enqueued **inside the order+domain lock, before either terminal DB write** (`order-refunds` queue → `stripe.refunds.create`). Credits are not involved anywhere.
- A canceled, expired, underpaid, mismatched, or unverifiable checkout produces no registrar mutation.

## Working model

**Search:** normalize the query → check up to the supported launch TLDs with Name.com → correlate unordered results by domain name → expose availability plus the **retail** USD registration price from `DOMAIN_REGISTRATION_USD_CENTS` for safe results → mark premium, non-registration, missing-price, and over-ceiling results not purchasable. Name.com's wholesale quote never crosses the wire; it stays server-side as the fail-closed margin guard.

**Purchase:** user chooses an available name and supplies registrant details → `POST /api/v1/orders/domain` re-checks availability, validates the wholesale quote against the TLD ceiling **and** the retail charge (never sell at or below cost), freezes a price snapshot onto the order, creates Stripe Checkout → browser redirects to Stripe → return page reconciles the session (webhooks cover async/refund/dispute paths) → paid order fulfills via `DomainRegistrationFulfillment` → worker re-checks order state and availability/ceiling → registers at Name.com with the stable idempotency key `domain-purchase:{domainRowId}` (create is always replayed; existence in our account is never adopted as proof of ownership) → persists the registrar receipt (`provider_order_id`, `provider_total_paid_usd`, `transfer_lock_expires_at`) → ensures managed DNS and apex forwarding → creates the Cloudflare custom hostname and **pushes its validation records to registrar DNS** → polls certificate state → publishes the KV host pointer → `active` → order `fulfilled`.

**BYO:** create an external-domain row → create the Cloudflare custom hostname → return the required CNAME/TXT records → user configures DNS → verification polls until the certificate is active. BYO does not require registrar credentials or a payment.

**Renewal:** not wired yet. `auto_renew` defaults to false, `POST /domains/:id/auto-renew` rejects enabling it, and the daily sweep only records expiry notices (T-30 onward). Paid renewals arrive with a `domain_renewal` payment-order kind; until then nothing renews or charges silently.

**Lifecycle:** `registering → configuring → active → expired | transferred_out` with `failed` for terminal fulfillment errors. Weekly sync reconciles expiry and registrar state; Name.com webhooks should supplement polling for transfers, registry rejection, and contact-verification events.

## Data ownership

- `domains` stores ownership, project attachment, registrar (`namecom`), registrar domain/order receipt, registrant snapshot, privacy/autorenew intent, lifecycle state, expiry, DNS orchestration state, and Cloudflare hostname id.
- Registrant snapshots, availability/ceiling checks, and fulfillment state belong to DomainsModule. `payment_orders`, checkout sessions, captured amounts, provider event IDs, refunds, and reconciliation belong to the orders/billing modules. The frozen `priceSnapshot` (`tld`, ceiling, charged amount/currency, quoted wholesale) lives on the payment order and the domain row.
- Public DTOs hide registrar ids, Cloudflare ids, raw registrar metadata, safety ceilings, wholesale quotes, raw upstream errors, and payment-provider secrets. Search exposes only the retail USD registration price for a safe result.

## API behavior

| Route | Behavior |
|---|---|
| `GET /api/v1/domains/search?q=` | Read-only Name.com availability with the retail USD registration price; rate-limited |
| `GET /api/v1/projects/:projectId/domains` | List domains and lifecycle state |
| `POST /api/v1/orders/domain` | Create the domain payment order + Stripe Checkout session (margin-guarded) |
| `POST /api/v1/orders/reconcile-session` | Verify the checkout session against Stripe and advance the order |
| `POST /api/v1/projects/:projectId/domains/external` | Attach a BYO domain and return required DNS records |
| `POST /api/v1/domains/:id/verify` | Recheck BYO certificate/configuration state |
| `POST /api/v1/domains/:id/auto-renew` | Disable renewal intent; enabling is rejected until paid renewals exist |
| `POST /api/v1/domains/:id/primary` | Set the project's primary domain |
| `POST /api/v1/domains/:id/transfer-unlock` | Unlock and reveal the auth code when registrar policy permits |
| `DELETE /api/v1/domains/:id` | Detach from the project; never release the registration |

All routes are authenticated and ownership-guarded. Registrar and payment failures are exposed as typed, sanitized errors.

## Provider and infrastructure

`DomainProvider` owns availability, registration, renewal, managed DNS, apex forwarding, auth-code, lock, and domain-info operations. `NamecomProvider` maps that port to Name.com CORE v1:

- sandbox `https://api.dev.name.com`; production `https://api.name.com`;
- HTTP Basic authentication with username plus API token;
- `X-Idempotency-Key` on registration;
- individual DNS-record reconciliation that preserves records Wandit does not own;
- URL-forwarding upsert for the apex;
- structured retryability for `429`, transient `5xx`, and network failures.

Server environment:

- `NAMECOM_ENVIRONMENT=sandbox|production` (sandbox default)
- `NAMECOM_USERNAME`
- `NAMECOM_API_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID_WANDIT_APP`
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `DOMAINS_FALLBACK_ORIGIN` (default `customers.wandit.app`)

The app may boot without registrar credentials for unrelated features; registrar operations fail lazily and safely. Production credentials must never be used by local development or automated tests.

## Jobs

- `domain-purchase`: paid fulfillment only; order fence → register → DNS/forwarding → Cloudflare hostname + validation-record push. Producers share `DOMAIN_PURCHASE_JOB_ATTEMPTS`.
- `domain-configure`: poll Cloudflare certificate state with bounded backoff.
- `domain-renewals` (daily): expiry-notice sweep only — no charging, no registrar renewal.
- `domain-sync` (weekly): reconcile expiry/status/transfer-lock per row with per-row error isolation; a vanished domain is marked `transferred_out`.
- `order-refund`: durable Stripe refund executor, enqueued before any terminal domain/order write.

`packages/jobs` contains registrar-neutral queue names and payloads. Server and worker must bind the same registrar implementation.

## UI

- **Buy flow now:** real Name.com search → retail USD price → registrant form → Stripe Checkout redirect → `/billing/success` reconciliation + order polling. It never simulates payment, registration, or activation.
- **BYO flow:** domain input → copyable DNS records → verify → live.
- **Domain list:** status, primary domain, expiry, transfer-out, and detach; auto-renew shows off/disabled until paid renewals exist.
- Payment cancellation or failure returns to a recoverable state; it never shows registration progress.

## Launch gates

- Name.com sandbox: availability, idempotent registration, contact mapping, DNS, forwarding (verify the apex entry lands with `host: ""`), lock/auth-code, and retry behavior verified.
- Payments: signed webhook verification, amount/currency/order matching, duplicate-event handling, checkout expiry, refund/reconciliation, and purchase fulfillment tests (in place on this branch; keep green).
- Name.com account funding and low-balance alerts configured.
- Retail price catalog calibrated against complete Name.com cost, including renewal and privacy exposure.
- Contact-verification notifications and operational handling exist.
- Cloudflare custom-hostname and publishing-serving path works end to end.

## Historical note

The first July 2026 prototype targeted OpenProvider and consumed Wandit credits. That implementation informed the provider port and worker lifecycle, but it is no longer the product direction. OpenProvider credentials, credit purchase/renewal flows, and credit-ledger refunds must not be treated as current requirements.
