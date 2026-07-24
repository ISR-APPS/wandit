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

**Checkout and renewal are intentionally fail-closed until a `PaymentsModule` and verified payment-webhook integration exist.**

- A browser redirect, checkout success page, or client mutation is never proof of payment.
- DomainsModule owns the domain purchase/renewal order, registrant snapshot, quote, and fulfillment state.
- `PaymentsModule` owns checkout sessions, payment attempts, provider event IDs, captured/refunded money, and reconciliation. It references the domain order by opaque id; it does not import domain repositories.
- Only a signature-verified, amount/currency/reference-verified, idempotently recorded success webhook may notify DomainsModule to enqueue `domain-purchase` or paid renewal fulfillment.
- Duplicate webhook delivery and worker retries must reuse the same durable order/domain idempotency key.
- A canceled, expired, underpaid, mismatched, or unverifiable checkout produces no registrar mutation.
- If payment succeeds but registration fails terminally, compensation is a refund through `PaymentsModule`, not a credit-ledger grant.
- Until this seam is implemented and tested, purchase and renewal endpoints must return an unavailable/not-configured response and must not call Name.com.

## Working model

**Search:** normalize the query → check up to the supported launch TLDs with Name.com → correlate unordered results by domain name → expose availability plus Name.com's current USD registration estimate for safe results → mark premium, non-registration, missing-price, and over-ceiling results unavailable. This estimate is not a locked checkout quote; DomainsModule creates the authoritative short-lived quote once `PaymentsModule` is connected.

**Purchase:** user chooses an available name and supplies registrant details → server rechecks availability and produces a short-lived quote → `PaymentsModule` creates checkout → verified success webhook creates or advances the durable domain order → enqueue `domain-purchase` → worker rechecks availability/ceiling → register at Name.com with a stable idempotency key → ensure managed DNS and apex forwarding → create the Cloudflare custom hostname → poll certificate state → publish the KV host pointer → `active`.

**BYO:** create an external-domain row → create the Cloudflare custom hostname → return the required CNAME/TXT records → user configures DNS → verification polls until the certificate is active. BYO does not require registrar credentials or a payment.

**Renewal:** find opted-in domains approaching expiry → obtain a current renewal quote → complete the approved payment flow → verified success webhook enqueues renewal → call Name.com once → persist the returned expiry. Manual renewal follows the same rule. If automated off-session payments are not implemented, `auto_renew` may schedule reminders but must not renew or charge silently.

**Lifecycle:** `registering → configuring → active → expired | transferred_out` with `failed` for terminal fulfillment errors. Weekly sync reconciles expiry and registrar state; Name.com webhooks should supplement polling for transfers, registry rejection, and contact-verification events.

## Data ownership

- `domains` stores ownership, project attachment, registrar (`namecom`), registrar domain/order receipt, registrant snapshot, privacy/autorenew intent, lifecycle state, expiry, DNS orchestration state, and Cloudflare hostname id.
- Domain orders and domain-specific quotes belong to DomainsModule. Payment attempts, checkout sessions, captured amounts, provider event IDs, refunds, and reconciliation belong to `PaymentsModule`.
- Public DTOs hide registrar ids, Cloudflare ids, raw registrar metadata, safety ceilings, renewal costs, raw upstream errors, and payment-provider secrets. Search exposes only the current customer-facing USD registration estimate for a safe result.

## API behavior

| Route | Behavior |
|---|---|
| `GET /api/v1/domains/search?q=` | Read-only Name.com availability and non-binding USD registration estimate; rate-limited |
| `GET /api/v1/projects/:projectId/domains` | List domains and lifecycle state |
| `POST /api/v1/projects/:projectId/domains` | Start direct checkout; fail closed until `PaymentsModule` is wired |
| `POST /api/v1/projects/:projectId/domains/external` | Attach a BYO domain and return required DNS records |
| `POST /api/v1/domains/:id/verify` | Recheck BYO certificate/configuration state |
| `POST /api/v1/domains/:id/renew` | Start paid renewal; fail closed until verified webhook fulfillment exists |
| `POST /api/v1/domains/:id/auto-renew` | Store renewal intent; never bypass payment authorization |
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

- `domain-purchase`: paid fulfillment only; register → DNS/forwarding → Cloudflare hostname.
- `domain-configure`: poll Cloudflare certificate state with bounded backoff.
- `domain-sync`: reconcile expiry/status and flag operational exceptions.

`packages/jobs` contains registrar-neutral queue names and payloads. Server and worker must bind the same registrar implementation.

The old automatic-renewal job is removed. A future due-domain scheduler belongs
behind the payment boundary and may enqueue registrar renewal only after payment
authorization is recorded.

## UI

- **Buy flow now:** real Name.com search → USD-only registration estimate → registrant form → explicit payment-not-connected boundary. It must never simulate payment, registration, or activation. After payment integration: locked quote → direct checkout → verified webhook → order-status screen → poll paid fulfillment.
- **BYO flow:** domain input → copyable DNS records → verify → live.
- **Domain list:** status, primary domain, renewal intent, expiry, renew-now checkout, transfer-out, and detach.
- Payment cancellation or failure returns to a recoverable state; it never shows registration progress.

## Launch gates

- Name.com sandbox: availability, idempotent registration, contact mapping, DNS, forwarding, lock/auth-code, renewal, and retry behavior verified.
- `PaymentsModule`: signed webhook verification, amount/currency/order matching, duplicate-event handling, checkout expiry, refund/reconciliation, and purchase/renewal fulfillment tests.
- Name.com account funding and low-balance alerts configured.
- Retail price catalog calibrated against complete Name.com cost, including renewal and privacy exposure.
- Contact-verification notifications and operational handling exist.
- Cloudflare custom-hostname and publishing-serving path works end to end.

## Historical note

The first July 2026 prototype targeted OpenProvider and consumed Wandit credits. That implementation informed the provider port and worker lifecycle, but it is no longer the product direction. OpenProvider credentials, credit purchase/renewal flows, and credit-ledger refunds must not be treated as current requirements.
