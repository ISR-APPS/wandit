# Custom Domains (buy in-app + bring your own)

**Status:** Name.com + Stripe purchase fulfillment and BYO configuration use Trigger.dev v4 tasks; paid renewal remains intentionally disabled · **Direction updated:** 2026-08-17

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
- **Canonical host:** `www.{domain}` is the hostname that serves the site; it CNAMEs to `customers.wandit.app`. The bare apex `https://{domain}` is also served through Cloudflare for **purchased** domains and, as an option the owner performs, for **external** (bring-your-own) domains: `ApexZoneStep` hosts the domain's DNS in a Cloudflare zone of **our** account (`CLOUDFLARE_ACCOUNT_ID`), writes DNS-only (grey-cloud) CNAMEs `{domain}` → `customers.wandit.app` and `www.{domain}` → `customers.wandit.app` plus both custom hostnames' ownership TXT records into that zone, creates a second, bare-name Cloudflare custom hostname for `{domain}`, and delegates the Name.com nameservers to the zone. Once the zone is active, both custom hostnames verify through the zone's CNAMEs and Cloudflare issues the apex certificate; `apps/edge` then 301-redirects any apex request to `https://www.{domain}`. Name.com URL forwarding is still written first as the fallback (and is what the apex uses when the kill switch `DOMAINS_APEX_ZONE_ENABLED=false` is set): the registrar's forwarding host has no TLS certificate, so `https://{domain}` fails on it. **Why not an ANAME or forwarding at the registrar:** Cloudflare for SaaS on the Free plan requires a custom hostname to CNAME to the SaaS zone — the verifier answers `Zone does not have apex proxying entitlement and custom hostname does not CNAME to zone.` — and a flattened ANAME at Name.com never satisfies it (tried and reverted, PR #173/#176). A DNS-only apex CNAME inside a Cloudflare zone does: Cloudflare flattens it publicly while its SaaS verifier still sees the CNAME. The apex path is best-effort and never blocks or delays the www path.
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
- managed www DNS and registrar apex forwarding (the fallback);
- Cloudflare custom-hostname creation and challenge propagation;
- best-effort apex serving (Cloudflare zone in our account, apex custom hostname, zone DNS records, nameserver delegation), tracked in `dns.zoneId` / `dns.zoneNameServers` / `dns.zoneNameserversExposedAt` / `dns.zoneStatus` / `dns.zoneActive` / `dns.apexCustomHostnameId` / `dns.apexConfigured` / `dns.apexError`;
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
  -> state -> Name.com registration -> managed www DNS + apex forwarding
  -> Cloudflare www hostname/challenges
  -> best-effort apex zone (zone + apex hostname + zone DNS + NS delegation)
  -> one-probe verification loop (apex zone polled before each probe)
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

**Search:** normalize the query → check the supported launch TLDs with Name.com → correlate unordered results by domain name → expose availability plus the **retail** USD registration price (the live wholesale quote rounded to cents plus $2) for safe results → mark premium, non-registration, missing-price, and over-ceiling results not purchasable. Name.com's wholesale quote never crosses the wire; it stays server-side as the fail-closed pricing guard.

**Purchase:** choose a domain and provide registrant details → `POST /api/v1/orders/domain` re-checks availability and both wholesale/retail margin guards, freezes a price snapshot, and creates Stripe Checkout → Stripe webhook or return-page reconciliation verifies payment → `DomainRegistrationFulfillment` creates/reuses the fenced row and dispatches `domain-purchase` → the task re-checks the fence and registers with the stable Name.com key → persists the registrar receipt → writes the managed `www` CNAME and the apex URL forwarding at Name.com (unchanged; the forwarding is the fallback) → creates the Cloudflare `www` hostname and writes its validation TXT at Name.com → best-effort apex zone: find-or-create the Cloudflare zone in our account, upsert the zone's DNS-only `www` CNAME and the `www` hostname's ownership TXT, find-or-create the bare-name apex custom hostname, upsert the DNS-only apex CNAME and that hostname's ownership TXT, persist `dns.zoneDelegated` (before the registrar call, so cleanup can never delete a zone the registry may delegate to), `setNameservers` at Name.com, request an activation check, persist `dns.apexConfigured` (a failure is stored in `dns.apexError` and never fails the purchase) → resumes durable certificate verification for the `www` hostname; before each probe the apex zone pass runs again (retrying configuration until `dns.apexConfigured`, then polling the zone — `pending` → another activation check, `active` → one PATCH nudge of the apex hostname) → publishes KV when applicable → domain `active` on the www hostname alone → order `fulfilled`. The apex certificate finishes on Cloudflare's own schedule; activation never waits for the zone or the apex hostname. The `www` hostname verifies just as well through the zone's `www` CNAME after the nameserver move as through the Name.com CNAME before it. A domain that reaches `active` with the apex still deferred is www-only until an operator runs `domains:backfill-apex`; the `domain-configure` task (manual verify) does not retry it because it asserts no registrar credentials.

**BYO:** run the registration check → create an external-domain row → create the Cloudflare `www` custom hostname → persist only `dns.records` = `www` CNAME + ownership/validation TXT and `cfCustomHostnameId` → return those records → dispatch `domain-configure` with a global domain+nonce key. On each external pass the runner probes the `www` hostname first and keeps Cloudflare's `hostnameStatus` (ownership) distinct from `sslStatus`. When `hostnameStatus === "active"`, it authorizes `ApexZoneStep` to find/adopt/create the domain's Cloudflare zone; the first fenced write of the zone also exposes its `NS` records and stores `dns.zoneNameserversExposedAt`. A row that already has `dns.zoneId` is maintained and polled even when the current ownership probe is pending. Zone work remains best-effort and never blocks activation; the row becomes `active` only after both hostname and SSL are active. BYO needs neither registrar credentials nor payment.

The UI is staged. Before ownership is confirmed it shows the `www` CNAME + TXT records and explains that the Wandit-nameserver option unlocks after Cloudflare verifies the ownership TXT. Once the zone nameservers are persisted, the user chooses between:

- **Option A — use Wandit nameservers (recommended, `example.com` and `www.example.com` both work):** at the registrar, replace the nameservers with the two Cloudflare nameservers of the zone. Before that switch can matter, the configure task imports the domain's CURRENT public DNS into the zone once (`POST /zones/{id}/dns_records/scan`, marker `dns.zoneScanned` + `dns.zoneScanRecordsAdded`) so mail (MX) and subdomains keep resolving, then turns every imported A/AAAA/CNAME DNS-only (our zone hosts DNS only; the site is proxied by the SaaS fallback origin) — the normalization runs whatever the scan reported, since a client-side scan timeout (the scan has its own 60 s budget) does not stop Cloudflare from finishing the import — then writes the **`www` records first** (removes address records that conflict with our traffic CNAME at `www`, Cloudflare error 81053, upserts the DNS-only `www` CNAME and the `www` ownership TXT), and only then creates the bare-name apex custom hostname, writes the apex CNAME and its ownership TXT, and requests an activation check. An apex-hostname failure (quota, transient error) therefore never leaves an owner who already delegated without `www`; the apex part is retried on the next pass. **No registrar call**: the user delegates. Caveat shown in the UI: if DNSSEC is enabled at the registrar, disable it before switching; check mail/subdomains after the switch (the scan only sees public records).
- **Option B — add DNS records only (unchanged behaviour):** the `www` CNAME + ownership TXT at the registrar; the bare domain must be redirected to `https://www.{domain}` at the registrar. New rows remain on this pre-zone view while ownership is pending. Rows whose zone attempt fails are retried by later configuration probes; rows attached with the kill switch off and legacy active rows without a zone stay on this option alone.

Everything zone/apex related for external rows is best-effort: any failure is logged, stored in `dns.apexError`, and the www path continues exactly as today. Diagnostics resolve the `NS` records like any other row; while a user is on option B they read "missing"/"mismatch" for the NS rows and vice-versa — the option titles make that expected. Legacy active rows without a zone are not backfilled. A zone that no longer exists (deleted out of band, purged by Cloudflare while pending) is **withdrawn** as soon as a pass notices it (`getZoneStatus` → `null` on 404): the `NS` records leave `dns.records`, every zone key and `apexConfigured` are cleared, and `dns.apexError` says `Cloudflare zone {id} no longer exists`. `ApexZoneStep` may replace that lost zone only when the current external ownership probe authorized creation; otherwise the row returns to the pre-zone view until ownership is verified again.

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
| `POST /api/v1/domains/:id/verify` | Recheck BYO state; a configuring external row is handed back to `domain-configure`, so manual verification cannot bypass ownership-gated zone creation |
| `POST /api/v1/domains/:id/auto-renew` | Disable renewal intent; enabling is rejected until paid renewals exist |
| `POST /api/v1/domains/:id/primary` | Set the project's primary domain |
| `POST /api/v1/domains/:id/transfer-unlock` | Unlock and reveal the auth code when registrar policy permits |
| `DELETE /api/v1/domains/:id` | Detach from the project; never release the registration |

All routes are authenticated and ownership-guarded. Registrar and payment failures are exposed as typed, sanitized errors.

## Provider infrastructure

`DomainProvider` owns availability, registration, renewal, managed DNS (A/AAAA/CNAME/NS/TXT), nameserver delegation, apex forwarding, auth-code, lock, and domain-info operations. `NamecomProvider` maps that port to Name.com CORE v1:

- sandbox `https://api.dev.name.com`; production `https://api.name.com`;
- HTTP Basic authentication with username plus API token;
- `X-Idempotency-Key` on registration;
- individual DNS-record reconciliation that preserves records Wandit does not own;
- URL-forwarding upsert for the apex (the fallback);
- `setNameservers`: `POST /core/v1/domains/{domain}:setNameservers { nameservers }` delegates the domain to its Cloudflare zone; idempotent;
- structured retryability for `429`, transient `5xx`, and network failures.

Cloudflare adapters (`apps/server/src/modules/domains/infrastructure/cloudflare`):

- `CustomHostnameService`: `www` custom hostname (canonicalized), the bare-name apex custom hostname (`createApexCustomHostname`), exact-name lookup (`findCustomHostnameByName`, adopts an existing hostname instead of a duplicate error), status, PATCH re-validation nudge (`refreshCustomHostnameValidation`), delete.
- `CustomerZoneService`: per-domain zones in our account — `findZoneByName` (`GET /zones?name=`), `createZone` (`POST /zones { name, account: { id: CLOUDFLARE_ACCOUNT_ID }, type: "full" }`), `getZoneStatus` (`null` when the zone no longer exists), `requestActivationCheck` (`PUT /zones/{id}/activation_check`; Free zones accept about one per hour, refusals are best-effort), `upsertDnsRecord` (find by type+name, then PATCH or POST; DNS-only, automatic TTL), `scanDnsRecords` (`POST /zones/{id}/dns_records/scan`, no body, own 60 s timeout; imports the domain's current public DNS, returns `{ recordsAdded, recordsParsed }`; duplicates surface as `messages`, not errors), `disableProxyOnAllRecords` (paged `GET /zones/{id}/dns_records`, `PATCH { proxied: false }` on every proxied A/AAAA/CNAME), `deleteDnsRecords` (every A/AAAA at one exact name and any CNAME whose content differs from the kept fallback origin; a 404 counts as deleted), `deleteZone` (404 counts as deleted).

### Apex zone state and cleanup policy

All apex state lives in the `domains.dns` jsonb (no new columns), for purchased and external rows alike: `zoneId`, `zoneNameServers`, `zoneNameserversExposedAt` (external only, written atomically with the first `zoneId` + NS exposure), `zoneStatus`, `zoneActive`, `zoneCreated` (true only when the pipeline created the zone; an adopted zone never carries it), `zoneDelegated` (purchased: written right before the Name.com `setNameservers` call; external: written together with the zone as soon as its nameservers were exposed to the user — either way the registry may delegate to the zone from then on), `zoneScanned` / `zoneScanRecordsAdded` (external only: the one-time public-DNS import ran), `apexCustomHostnameId`, `apexCustomHostnameStatus`, `apexCustomHostnameNudged`, `apexConfigured`, `apexError`. The only records merged into `dns.records` are the `NS` records (one per nameserver, purpose `nameserver`, name `@`) — for external rows as soon as the ownership-gated zone exists, for both sources again on `apexConfigured` (idempotent) — so the UI shows and diagnostics resolve exactly what the user must do; the apex `CNAME` and both ownership TXTs are written INTO the zone only (`mapDomain` exposes only `records`, never the ids). Every apex write is a jsonb **merge** (`DomainsRepository.mergeDnsIfStatus`, fenced on `registering`/`configuring`/`active`, `updated_at` untouched), so a live verification cursor is never clobbered.

Cleanup parity: wherever the www custom hostname is deleted (terminal purchase failure, failed-row cleanup during activation, `DELETE /api/v1/domains/:id` detach), the apex custom hostname recorded in `dns.apexCustomHostnameId` is deleted best-effort as well. Zones follow a stricter rule: **only a terminal purchase failure** (registration failed, order refunded, verification timed out) deletes the zone, and only when `dns.zoneCreated` is set and neither `dns.zoneDelegated` nor `dns.apexConfigured` is — the zone was ours and the pipeline never reached the Name.com nameserver call. `zoneDelegated` is persisted (status-fenced) BEFORE `setNameservers`, so a timed-out registrar call, a lost fence, or a crash after the call still counts as delegated. An adopted zone, or a zone whose delegation may have gone live, is left in place and logged. **An external row's zone is never deleted by cleanup** (`bestEffortDeleteCustomerZone` refuses on `source === "external"`; such rows also carry `zoneDelegated`): its owner may delegate at any time. **Detach and unpublish never delete the zone**: the registry (or the owner of an external domain) still delegates to it, so deleting it would black-hole the customer's DNS; the service logs `Leaving Cloudflare zone … in place` instead. A stray Free zone is harmless.

### Kill switch

`DOMAINS_APEX_ZONE_ENABLED` (default `true`). With `false`, `ApexZoneStep` creates no new zone: purchased domains keep the Name.com apex URL-forwarding fallback (`http://` only), and new external rows never unlock the nameserver option. External attach always returns only the `www` CNAME + TXT, independent of this switch. One exception: an **external row that already carries `dns.zoneId`** (its nameservers were shown to the owner, who may have delegated already) is still finished by the configure task — its zone gets the records, the import, and the apex hostname — because nothing else can fill a zone whose nameservers are already public. The purchase and configure tasks read it at preflight; the backfill script refuses to run while it is off.

### ApexZoneStep compositions

`ApexZoneStep` takes `{ enabled, fallbackOrigin, sources }` plus an explicit per-call creation authorization and returns any row whose `source` is not listed untouched. `createDomainPurchaseRuntime` and `createDomainApexBackfillRuntime` wire `sources: ["purchased"]` with the Name.com registrar; their ordering is unchanged. `createDomainConfigurationRuntime` (`domain-configure`) wires `sources: ["external"]` with a registrar whose `setNameservers` throws (`External domains delegate nameservers manually`) — the step never calls it for external rows. For external rows, `DomainConfigurationRunner` probes the `www` custom hostname first, authorizes new-zone find/adopt/create only when `hostnameStatus === "active"`, then runs the apex pass. A persisted `zoneId` is always maintained/polled/configured, independent of authorization; if it is found missing, the step withdraws it and applies the same authorization before creating a replacement. External `configure()` also persists the `NS` records + `zoneDelegated` + first-exposure timestamp; the one-time DNS import runs before our records are written (a scan failure is logged and retried on a later configure pass, or on a verify pass while the zone is still pending, without aborting the pass; the DNS-only normalization runs even when the scan failed); there is no `setNameservers` call or lone `zoneDelegated` write. For both sources the `www` CNAME and `www` ownership TXT are written before the apex hostname is created, and the apex CNAME + TXT after it; conflicting address records are removed before each traffic CNAME (a fresh purchased zone has none; idempotent). Activation still requires both the `www` hostname and SSL to be active, while any zone failure is ignored for that decision. `verify()` (zone polling, activation check, one apex-hostname nudge, withdrawal of a lost zone) is otherwise identical for both sources.

### Backfill existing purchased domains

Purchased domains fulfilled before the apex zone step exist only serve `www.{domain}`. Run the backfill once per environment (it is safe to repeat; rows already carrying `dns.apexConfigured` are skipped and rows with `dns.apexError` are retried):

```bash
cd apps/server
pnpm domains:backfill-apex -- --dry-run            # list candidates, change nothing
pnpm domains:backfill-apex                         # process every candidate
pnpm domains:backfill-apex -- --domain example.com # one domain
```

It selects purchased/`namecom` rows in `configuring` or `active` without `dns.apexConfigured` and runs the same `ApexZoneStep` as the purchase runtime. Domains whose zone, apex hostname, and nameserver delegation were created by hand (`zaaaaaak.com`, `cosmetiquemilano.shop`) are adopted by name — the step only records their state and re-asserts the DNS records. It reads `apps/server/.env` like the other scripts and needs `DATABASE_URL`, `NAMECOM_ENVIRONMENT`/`NAMECOM_USERNAME`/`NAMECOM_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID_WANDIT_APP`, `CLOUDFLARE_ACCOUNT_ID`, and `DOMAINS_FALLBACK_ORIGIN`. It prints a table of `name / status / zoneId / zoneNameServers / zoneStatus / apexCustomHostnameId / apexConfigured / apexError` and exits non-zero while any domain still needs a retry.

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
| `CLOUDFLARE_ZONE_ID_WANDIT_APP` | Purchase, BYO configuration, activation, and cleanup | Custom-hostname zone and Cloudflare account resolution for KV. |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Purchase/BYO activation and cleanup | KV `domain:{host}` pointer mutations. |
| `CLOUDFLARE_ACCOUNT_ID` | Purchase (apex zone step), BYO configuration (external apex zone step), backfill | Account that owns the per-domain zones (`POST /zones`). Not asserted at preflight: without it the apex step records `dns.apexError` and the domain stays www-only. |
| `DOMAINS_APEX_ZONE_ENABLED` | Purchase and BYO configuration (apex zone step), backfill | Kill switch, default `true`. `false` = no new zone: registrar URL forwarding for a purchased apex and no nameserver option for a new external row; an external row that already exposed its zone (`dns.zoneId`) is still finished. |
| `DOMAINS_FALLBACK_ORIGIN` | Purchased managed DNS | `www` CNAME target at Name.com and both CNAME targets inside the domain's Cloudflare zone; set explicitly (current shared-schema default: `customers.wandit.app`). |
| `STRIPE_SECRET_KEY` | Refund; purchase preflight | Required for a captured-payment refund. Purchase asserts it before any Name.com spend. |

Task-specific first operations:

- `domain-purchase` asserts DB, all Name.com values and sandbox pairing, all three Cloudflare values, fallback origin, and Stripe secret before availability, registration, or DB mutation, and reads the apex kill switch. Configuration failures use its normal five-attempt budget and terminal refund path.
- `domain-configure` asserts DB and the three Cloudflare values before its first probe/KV mutation and reads the apex kill switch + fallback origin (`assertDomainConfigurationConfiguration()` now returns `apexZoneEnabled` and `fallbackOrigin`; `domainApexZoneOptions()` is the shared reader). An external row requires neither Name.com nor Stripe.
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
- The only keys added for the apex zone step are the optional `CLOUDFLARE_ACCOUNT_ID` and the `DOMAINS_APEX_ZONE_ENABLED` kill switch in `packages/env/src/server.ts`; they are consumed by the Trigger task runtimes, not external attach.

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
- **BYO flow:** domain input → two setup options side by side (A: the two nameservers to set at the registrar, both `example.com` and `www.example.com` work, with the mail/subdomain and DNSSEC caveats; B: copyable `www` CNAME + TXT records, bare domain redirected at the registrar) → verify → live. Rows without nameserver records render exactly today's single-table UI.
- **Domain list:** status, primary domain, expiry, transfer-out, and detach; auto-renew remains off/disabled until paid renewals exist.
- Payment cancellation or failure returns to a recoverable state; it never shows registration progress.

## Launch gates

- Name.com sandbox: availability, idempotent registration, contact mapping, DNS, forwarding (apex `host: ""`), `setNameservers` (colon path), lock/auth-code, and retry behavior verified.
- Cloudflare: zone create/adopt in our account, DNS-only apex + www CNAMEs, ownership TXTs, apex custom hostname active with a valid certificate after zone activation (verified live on `zaaaaaak.com`; `.shop` registry delegation lagged more than 20 minutes, hence the durable poll).
- Payments: signed webhook verification, amount/currency/order matching, duplicate events, checkout expiry, refund reconciliation, and fulfillment tests green.
- Name.com account funding and low-balance alerts configured.
- Retail price catalog calibrated against complete Name.com cost, including renewal, privacy, and tax exposure.
- Contact-verification notifications and operational handling exist.
- Cloudflare custom-hostname and publishing-serving path works end to end.
- The production cutover runbook above is completed and recorded before deploying consumer removal.

## Historical note — not current architecture

The first July 2026 prototype targeted OpenProvider, consumed Wandit credits, and later used Bull-backed domain/refund consumers. That work informed the provider port, state fences, and lifecycle tests, but it no longer describes the runtime. OpenProvider credentials, credit purchase/renewal flows, credit-ledger refunds, and legacy Redis domain/refund delivery must not be treated as current requirements.
