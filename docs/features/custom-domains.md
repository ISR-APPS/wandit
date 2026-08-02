# Custom Domains (buy in-app + bring your own)

**Status:** Name.com + Stripe purchase fulfillment and BYO configuration use Trigger.dev v4 tasks; paid renewal remains intentionally disabled · **Direction updated:** 2026-08-01

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

## Payment safety boundary

**Domain checkout runs through the orders module (`payment_orders` + Stripe Checkout); registrar mutations happen only after verified payment.**

- A browser redirect, checkout success page, or client mutation is never proof of payment. The success page calls `POST /api/v1/orders/reconcile-session`, which re-reads the session from Stripe and asserts amount/currency/customer/mode/purpose invariants before marking the order paid.
- DomainsModule owns the registrant snapshot, availability/ceiling checks, and fulfillment state. The orders module owns `payment_orders`, Stripe checkout sessions, webhook reconciliation, and refund state; it references domains through `DomainRegistrationFulfillment`.
- Paid fulfillment creates or reuses one order-linked domain under the existing advisory-lock fence, then dispatches the strict `{ domainId, orderId }` `domain-purchase` task with a global order-derived key.
- `DomainRegistrationStep` re-checks the order and availability/ceiling immediately before Name.com spend. Every post-registration write remains a status compare-and-set; losing a race to a refund records `MANUAL REVIEW REQUIRED`.
- If registration fails terminally after payment, `DomainTerminalFailureStep` asks Trigger.dev to durably accept `order-refund` **inside the order+domain fence and before either terminal DB write**. A handoff failure rolls the transaction back so reconciliation can retry it.
- A canceled, expired, underpaid, mismatched, or unverifiable checkout produces no registrar mutation.

## Trigger.dev architecture

The database remains the product source of truth. `payment_orders.status`, fulfillment/refund fields, `domains.status`, `domains.error`, and the private configuration cursor drive recovery and the UI. Trigger run state, handles, tags, and metadata are operational aids only.

Task files are thin composition wrappers. Each wrapper validates a strict payload, asserts only the configuration required by that task, opens one task-local database pool, adapts checkpointed `wait.until` or `wait.for`, calls a framework-light runner, and closes the pool in `finally`. It does not contain Name.com, Cloudflare, Stripe, or lifecycle logic.

Business work is split into independently testable steps with narrow structural dependencies:

- fulfillment-state validation and the pre-spend order fence;
- Name.com registration and receipt persistence;
- managed DNS/apex forwarding;
- Cloudflare custom-hostname creation and challenge propagation;
- one read-only verification probe;
- cursor-owned verification orchestration;
- activation, KV publication, and order completion;
- terminal failure and refund dispatch;
- the independent Stripe refund step and durable refund runner;
- bounded maintenance and reconciliation services.

`DomainPurchaseOrchestrator` composes those steps without owning provider details. `DomainConfigurationRunner` owns only the bounded probe/wait loop. Nest services depend on dispatcher ports; only Trigger adapters import the SDK and task types.

```text
verified Stripe payment
  -> fenced domain row + global domain-purchase handoff
  -> thin task wrapper + task-local runtime
  -> state -> Name.com registration -> managed DNS
  -> Cloudflare hostname/challenges -> one-probe verification loop
  -> activation + KV + order fulfilled
  -> on terminal failure: accept global order-refund first
  -> refund runner -> Stripe refund with the order-derived key

scheduled backstops
  -> heal stale/lost purchase handoffs
  -> heal eligible paid failures without a recorded refund
```

### Tasks, queues, and schedules

Two Trigger queues serialize provider work with `concurrencyLimit: 1`. Checkpointed waits enter `WAITING`, release the queue/environment concurrency slot, and retain no database transaction or checked-out connection.

| Task | Queue | Behavior |
|---|---|---|
| `domain-purchase` | `domain-operations` | Strict `{ domainId, orderId }`; five attempts with 60/120/240/480-second task backoff; composes registration through activation and terminalization. |
| `domain-configure` | `domain-operations` | Strict `{ domainId, nonce }`; three attempts for runtime failures; provider-pending state stays in the durable cursor loop. |
| `order-refund` | `order-refunds` | Strict `{ orderId, failureReason }`; durable fixed-60-second runner retries without holding compute and escalates logs from failure 30. |
| `reconcile-domain-purchases` | `domain-operations` | Every 15 minutes UTC; bounded scan for stale fulfillment, lost handoffs, and active rows whose order needs healing. |
| `reconcile-order-refunds` | `order-refunds` | Every 5 minutes UTC; bounded scan for eligible failed paid domain orders without a recorded Stripe refund. |
| `domain-renewal-notices` | `domain-operations` | `0 2 * * *` UTC; expiry notices only, including `autoRenew=false`; never charges or renews. |
| `domain-registrar-sync` | `domain-operations` | `0 3 * * 0` UTC; weekly expiry, transfer-lock, and `transferred_out` reconciliation with per-row error isolation. |

The two reconcilers are durability backstops, not parallel sources of business state. They re-check DB eligibility, preserve live runs, and reuse global keys. Purchase recovery may reset only a terminal canceled or successful-but-DB-inconsistent handle after the configured stale threshold; refund recovery re-checks eligibility before resetting a terminal canceled handle. Trigger v4 clears a failed run's key automatically. Neither reconciler calls Stripe directly.

### Durable verification cursor

Cloudflare certificate polling does not self-enqueue and does not trust process-local state. A private cursor lives in `domains.dns.triggerConfiguration`:

```text
{ nonce, nextAttempt, nextProbeAt }
```

- New flows probe at attempt 0 immediately. A purchased flow uses `purchase:${orderId}`; BYO attach/manual verification supplies its domain+nonce identity. A retry, cancellation recovery, or reconciler run resumes the same persisted cursor.
- After a pending/transient probe at attempt N below 100, the runner atomically advances the cursor to attempt N + 1 and persists the absolute deadline `now + min(30 * 2^N, 900)s` **before** `wait.until`.
- Attempts 0–99 create 100 wait windows totaling 24h00m30s; attempt 100 probes once more. An absolute deadline prevents a retry from adding a new delay or restarting the verification budget.
- Cursor updates compare status, nonce, and expected attempt while merging the DNS JSON. Cursor-only writes preserve public `updatedAt`, DNS markers, and challenge records.
- Purchased timeout terminalizes with `Cloudflare SSL verification timed out`; external timeout returns pending and leaves the row `configuring`. Activation/terminalization clears the cursor; deliberate manual verification uses a new nonce.

### Idempotency layers

These keys solve different replay boundaries and must not be collapsed:

| Boundary | Stable key |
|---|---|
| Trigger purchase run | global `domain-purchase:${orderId}` |
| Name.com registration request | `domain-purchase:${domainRowId}` |
| Trigger BYO configuration run | global `domain-configure:${domainId}:${nonce}` |
| Trigger refund run | global `order-refund:${orderId}` |
| Stripe refund request | `order-refund:${orderId}` |

Trigger global idempotency prevents duplicate ordinary delivery. DB status guards and provider receipts protect registrar replay; the Stripe key guarantees one financial effect even when recovery legitimately creates a later task run.

## Working model

**Search:** normalize the query → check the supported launch TLDs with Name.com → correlate unordered results by domain name → expose availability plus the **retail** USD registration price from `DOMAIN_REGISTRATION_USD_CENTS` for safe results → mark premium, non-registration, missing-price, and over-ceiling results not purchasable. Name.com's wholesale quote never crosses the wire; it stays server-side as the fail-closed margin guard.

**Purchase:** choose a domain and provide registrant details → `POST /api/v1/orders/domain` re-checks availability and both wholesale/retail margin guards, freezes a price snapshot, and creates Stripe Checkout → Stripe webhook or return-page reconciliation verifies payment → `DomainRegistrationFulfillment` creates/reuses the fenced row and dispatches `domain-purchase` → the task re-checks the fence and registers with the stable Name.com key → persists the registrar receipt → manages DNS/apex forwarding → creates the Cloudflare hostname and registrar validation records → resumes durable certificate verification → publishes KV when applicable → domain `active` → order `fulfilled`.

**BYO:** create an external-domain row → create the Cloudflare custom hostname → return required CNAME/TXT records → user configures DNS → dispatch `domain-configure` with a global domain+nonce key → durable verification resumes until active or returns external-pending. BYO needs neither registrar credentials nor payment.

**Renewal:** not wired. `auto_renew` defaults to false, enabling it is rejected, and the daily scheduled task records expiry notices only. Paid renewals require a `domain_renewal` payment-order kind; nothing renews or charges silently.

**Lifecycle:** `registering → configuring → active → expired | transferred_out`, with `failed` for terminal fulfillment errors. Weekly registrar sync reconciles expiry and registrar state; Name.com webhooks should supplement polling for transfers, registry rejection, and contact-verification events.

## Data ownership

- `domains` stores ownership, project attachment, registrar (`namecom`), registrar receipt, registrant snapshot, privacy/autorenew intent, lifecycle state, expiry, DNS orchestration state, private Trigger configuration cursor, and Cloudflare hostname id.
- DomainsModule owns registrant snapshots, availability/ceiling checks, and fulfillment state. Orders/billing owns `payment_orders`, checkout sessions, captured amounts, provider event IDs, refunds, and reconciliation. The frozen `priceSnapshot` lives on both the payment order and domain row.
- Public DTOs hide registrar/Cloudflare ids, the private cursor, raw metadata, safety ceilings, wholesale quotes, upstream errors, and payment-provider secrets. Search exposes only the retail USD price for a safe result.

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

## Provider infrastructure

`DomainProvider` owns availability, registration, renewal, managed DNS, apex forwarding, auth-code, lock, and domain-info operations. `NamecomProvider` maps that port to Name.com CORE v1:

- sandbox `https://api.dev.name.com`; production `https://api.name.com`;
- HTTP Basic authentication with username plus API token;
- `X-Idempotency-Key` on registration;
- individual DNS-record reconciliation that preserves records Wandit does not own;
- URL-forwarding upsert for the apex;
- structured retryability for `429`, transient `5xx`, and network failures.

## Trigger.dev environment requirements

### Feature-specific task values

Set these in every Trigger.dev environment that can run the relevant tasks. Production must set defaults explicitly instead of relying on local defaults.

| Variable | Required by | Assertion/reason |
|---|---|---|
| `DATABASE_URL` | Every domain, refund, maintenance, and reconciliation task | Nonempty before constructing the task-local Postgres runtime. |
| `NAMECOM_ENVIRONMENT` | Purchase and weekly registrar sync | Exactly `sandbox` or `production`; set explicitly even though the shared schema defaults to `sandbox`. |
| `NAMECOM_USERNAME` | Purchase and weekly registrar sync | Required; ends in `-test` iff the environment is `sandbox`, preventing credential/environment mixing. |
| `NAMECOM_API_TOKEN` | Purchase and weekly registrar sync | Required Name.com Basic-auth secret. |
| `CLOUDFLARE_API_TOKEN` | Purchase, BYO configuration, activation, and cleanup | Custom hostname, zone lookup, and KV operations. |
| `CLOUDFLARE_ZONE_ID_WANDIT_APP` | Purchase, BYO configuration, activation, and cleanup | Custom-hostname zone and Cloudflare account resolution. No `CLOUDFLARE_ACCOUNT_ID` is needed. |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Purchase/BYO activation and cleanup | KV `domain:{host}` pointer mutations. |
| `DOMAINS_FALLBACK_ORIGIN` | Purchased managed DNS | `www` CNAME target; set explicitly (current shared-schema default: `customers.wandit.app`). |
| `STRIPE_SECRET_KEY` | Refund; purchase preflight | Required for a captured-payment refund. Purchase asserts it before any Name.com spend. |

Task-specific first operations:

- `domain-purchase` asserts DB, all Name.com values and sandbox pairing, all three Cloudflare values, fallback origin, and Stripe secret before availability, registration, or DB mutation. Configuration failures use its normal five-attempt budget and terminal refund path.
- `domain-configure` asserts DB and the three Cloudflare values before its first probe/KV mutation. An external row requires neither Name.com nor Stripe.
- `order-refund` asserts DB and Stripe inside the durable runner loop, so missing configuration repeats after 60 seconds instead of being dropped.
- `domain-registrar-sync` asserts DB plus Name.com values/pairing. `domain-renewal-notices` and both reconcilers require DB only.

### API producer value

`TRIGGER_SECRET_KEY` is required in the **Nest API deployment** for the pre-payment availability gate and typed `tasks.trigger` calls. It is not a business credential consumed inside a Trigger task run. Missing or empty configuration preserves the existing `DOMAINS_TEMPORARILY_UNAVAILABLE` 503 before Stripe or Name.com work.

### Eager shared-environment bootstrap caveat

The reused adapters and `createDb()` import `@wandit/env/server`, which eagerly validates the full shared server schema at module evaluation. Until that package is refactored, every Trigger.dev deployment must also carry these bootstrap values even though domain/refund tasks do not use them directly:

- `BETTER_AUTH_SECRET` (at least 32 characters)
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The feature table above is the domain/refund contract; this second list is only an existing shared-import requirement. Explicit task assertions still produce targeted errors for optional feature credentials.

### Values not required by these tasks

- `QUEUE_ENABLED`, `QUEUE_PREFIX`, and `REDIS_URL` are not Trigger task dependencies. They remain for API/worker generation features and Redis chat events.
- `STRIPE_WEBHOOK_SECRET` is API-webhook-only.
- R2, AI model/gateway, and `SITES_DOMAIN` values are unrelated to this migration.
- No new environment keys or changes to `packages/env/src/server.ts` are required.

## Production cutover runbook

> This is deploy-time operational work. It is preserved here for production execution and was **not performed in this feature-branch workspace**.

Follow this order; it is designed to survive restarts and preserve elapsed certificate-polling time.

1. Deploy the transitional worker with legacy domain scheduler registration removed while the API still produces legacy jobs. Restart it and confirm neither scheduler is recreated.
2. Remove the persisted Redis scheduler ids `domain-renewals-daily` and `domain-sync-weekly`. Restart the worker again and verify both remain absent. Do not delete already-emitted maintenance jobs; allow the transitional consumer branches to finish them.
3. Deploy and index all seven Trigger tasks with all four schedules initially paused. In a test environment, confirm `domain-purchase`, `domain-configure`, and `order-refund` accept runs before changing the API.
4. Deploy the API producer and availability-gate switch. Keep the transitional worker running for existing Redis jobs, while confirming every new domain/refund handoff goes only to Trigger.
5. Activate each of the four Trigger schedules exactly once: purchase reconciliation every 15 minutes, refund reconciliation every 5 minutes, renewal notices at `0 2 * * *` UTC, and registrar sync at `0 3 * * 0` UTC. The three domain schedules share `domain-operations`; refund reconciliation uses `order-refunds`.
6. Before deleting any consumer, audit the legacy Redis `domains` and `order-refunds` queues across `waiting`, `active`, `delayed`, and `failed`, and audit the DB for:
   - paid/fulfilling orders with purchased domains in `registering` or `configuring`;
   - active domains whose order is not `fulfilled`;
   - failed paid domain orders without `providerRefundId`.
7. Allow active legacy jobs to finish. Translate delayed/waiting/failed configuration jobs without resetting their time budget:
   - For a purchased domain, seed `dns.triggerConfiguration` from the job's exact `{ nonce, attempt }` and absolute due time `job.timestamp + job.delay` (clamped to now if already due), then trigger global `domain-purchase`. The purchase runner must adopt that cursor.
   - For an external domain, seed the same cursor and trigger global `domain-configure` with the original nonce.
   - Remove the legacy job only after both the cursor compare-and-set and Trigger handoff succeed.
8. Let every other old order-backed purchase/refund job finish or explicitly trigger its new globally idempotent task. A credits-backed purchase payload without `orderId` cannot satisfy the strict new contract and **must finish on the transitional worker**. Never remove an old refund job until Trigger has accepted the corresponding `order-refund` run.
9. Confirm both Trigger reconcilers report no stranded eligible rows. Every persisted configuration cursor must map to a live/recovery run or a deliberate external-pending outcome. The legacy queues must be empty, or every remaining DB row must have a confirmed Trigger recovery run.
10. Only after those gates pass, deploy the Stage 4 code that removes the legacy domain/refund consumers, registrations, contracts, and direct worker Stripe dependency. Keep the remaining AI/media/lead/publish worker and its BullMQ/ioredis infrastructure runnable.
11. After deployment, verify all four Trigger schedules are active exactly once, the remaining worker starts, no new legacy domain/refund jobs appear, the reconcilers stay clean, and purchase/configuration/refund smoke runs update DB truth as expected.

## UI

- **Buy flow:** Name.com search → retail USD price → registrant form → Stripe Checkout → `/billing/success` reconciliation and DB polling. The UI never simulates payment, registration, or activation.
- **BYO flow:** domain input → copyable DNS records → verify → live.
- **Domain list:** status, primary domain, expiry, transfer-out, and detach; auto-renew remains off/disabled until paid renewals exist.
- Payment cancellation or failure returns to a recoverable state; it never shows registration progress.

## Launch gates

- Name.com sandbox: availability, idempotent registration, contact mapping, DNS, forwarding (apex `host: ""`), lock/auth-code, and retry behavior verified.
- Payments: signed webhook verification, amount/currency/order matching, duplicate events, checkout expiry, refund reconciliation, and fulfillment tests green.
- Name.com account funding and low-balance alerts configured.
- Retail price catalog calibrated against complete Name.com cost, including renewal, privacy, and tax exposure.
- Contact-verification notifications and operational handling exist.
- Cloudflare custom-hostname and publishing-serving path works end to end.
- The production cutover runbook above is completed and recorded before deploying consumer removal.

## Historical note — not current architecture

The first July 2026 prototype targeted OpenProvider, consumed Wandit credits, and later used Bull-backed domain/refund consumers. That work informed the provider port, state fences, and lifecycle tests, but it no longer describes the runtime. OpenProvider credentials, credit purchase/renewal flows, credit-ledger refunds, and legacy Redis domain/refund delivery must not be treated as current requirements.
