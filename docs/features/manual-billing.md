# Manual (offline) billing — cash on delivery, wire, CCP

Status: implementation spec (branch `feat/manual-billing`). Foundations (DB schema,
migration `0041_manual-billing`, contracts) are DONE; this doc is the contract for the
server, web, and admin implementation packages.

## 0. Product model

Wandit sells in Algeria first (Tunisia / Morocco next). Many customers cannot or will not
pay by card, so Stripe is not the only way to subscribe.

1. In the plan picker the user sees two payment methods: **Card** (Stripe checkout, the
   existing flow) and **Cash / transfer** ("COD": cash on delivery, wire transfer, CCP,
   BaridiMob…).
2. On the Cash / transfer tab the user picks the plan tier + billing cycle and fills a short
   contact form (name, phone, company, country, city, preferred method, notes) → this creates
   a **manual subscription request**.
3. The request appears in the **admin app** ("Offline billing" page). An admin calls the
   customer, agrees on a payment method, collects the money outside Wandit (cash pickup,
   wire, CCP…) and then **grants a subscription** in the admin app, recording the payment
   (amount, currency, method, reference). The request becomes `approved`.
4. The granted subscription is a normal row in `subscriptions` with `provider = "manual"`.
   It is entitled exactly like a Stripe one (status `active`, plan credits granted, yearly
   refill slots, same `entitled` rule), so every credit/metering path works unchanged.
5. Manual subscriptions **never auto-renew**. A Trigger.dev cron (`manual-subscription-expiry`,
   every 10 min) ends every manual subscription whose `currentPeriodEnd` has passed:
   status → `canceled`, pending refill slots canceled, plan credits expired (same policy as a
   Stripe `customer.subscription.deleted`). The user is back on the free plan and must renew.
6. Renewal is an **admin action** after contact: "Renew" records a new payment and extends
   the period (credits refill at the cycle boundary, or immediately when the subscription had
   already ended). An admin can also "End now".
7. Kill switch: `product_settings.manual_payments_enabled` (admin Settings toggle "Offline
   payments"). Off → no Cash / transfer tab, `POST /billing/manual-request` answers 409
   `MANUAL_PAYMENTS_DISABLED`. Admin grants/renewals never depend on it.

Non-goals (v1): no automatic reminders before expiry, no self-serve renewal payment, no DZD
revenue in the admin revenue analytics (manual payments have their own table; analytics
stay USD/Stripe), no mobile (native) UI.

## 1. Schema (DONE — `packages/db/src/schema/billing.ts`, migration `0041_manual-billing`)

- enums `manual_subscription_request_status` (pending | contacted | approved | rejected |
  canceled), `manual_payment_method` (cash_on_delivery | bank_transfer | ccp | baridimob |
  other), `manual_subscription_payment_kind` (initial | renewal).
- `product_settings.manual_payments_enabled boolean not null default false`.
- `manual_subscription_requests`: owner = `organization_id ?? user_id` (same owner rule as
  subscriptions); plan / tier_credits (whole credits) / interval; contact fields; status;
  admin_notes; handled_by_user_id; handled_at; subscription_id (set on approval). Partial
  unique indexes: ONE open (pending|contacted) request per personal user and per org.
- `manual_subscription_payments`: append-only; subscription_id, request_id?, kind, method,
  amount_minor (minor units of `currency`, ≥ 0), currency (3 letters), reference?, note?,
  period_start/period_end (the funded period), idempotency_key (UNIQUE — the admin's
  client-minted uuid), recorded_by_user_id.
- `subscriptions_provider_status_periodEnd_idx` for the expiry sweep.
- Manual subscription rows: `provider = "manual"`, `providerSubscriptionId = "manual_<uuid>"`
  (the grant's idempotencyKey), `priceLookupKey = priceLookupKey(plan, tier, interval)`,
  `status = "active"`, `cancelAtPeriodEnd = false`, `userId` = contact/provenance user,
  `organizationId` = org pool or null.

## 2. Contracts (DONE — `packages/contracts`)

`v1/billing.ts`: `SUBSCRIPTION_PROVIDERS`, `isManualSubscription()`, `manualPaymentMethods`,
`manualSubscriptionRequestStatuses`, `OPEN_MANUAL_REQUEST_STATUSES`, `manualBillingCountries`
(DZ | TN | MA | OTHER), `createManualSubscriptionRequestBodySchema`,
`manualSubscriptionRequestSchema`, `manualSubscriptionRequestViewResponseSchema`,
`addBillingInterval(date, interval, count = 1)` (UTC calendar months), routes
`billingRoutes.manualRequest` (`/api/v1/billing/manual-request`) and
`billingRoutes.manualRequestCancel` (`…/manual-request/cancel`).

`v1/settings.ts`: `manualPaymentsEnabled` on product settings, public settings, and the
PATCH body.

`http/error-codes.ts`: `ALREADY_SUBSCRIBED`, `NO_ACTIVE_SUBSCRIPTION`,
`MANUAL_PAYMENTS_DISABLED`, `MANUAL_REQUEST_PENDING`, `MANUAL_SUBSCRIPTION_UNSUPPORTED`.

`v1/admin.ts`: `adminUserSubscriptionSchema` (and the org one that extends it) now carry
`id` + `provider`; `adminManualRequestSchema`, `adminListManualRequestsQuerySchema`
(status filter `open` default | `all` | each status; `q`), `adminUpdateManualRequestBodySchema`
(status pending|contacted|rejected, adminNotes), `adminGrantManualSubscriptionInputSchema`,
`adminRenewManualSubscriptionInputSchema`, `adminEndManualSubscriptionInputSchema`,
`adminManualPaymentSchema`, `adminManualSubscriptionSchema`,
`adminManualSubscriptionDetailSchema`, `adminListManualSubscriptionsQuerySchema`
(status `active` default | `ended` | `all`; `q`), and `adminRoutes.manualRequests`,
`manualRequest(id)`, `manualSubscriptions`, `manualSubscription(id)`,
`manualSubscriptionRenew(id)`, `manualSubscriptionEnd(id)`.

## 3. Server package (`apps/server`)

All new code lives in the billing module (`apps/server/src/modules/billing`). Reuse the
existing primitives; do not re-implement credit math.

### 3.1 Persistence

- `infrastructure/persistence/manual-subscription-requests.repository.ts`: insert; find open
  by owner (`CreditOwner`); find by id; list for admin (pagination, status filter, `q` ILIKE on
  full_name / phone / company / user.name / user.email — join `user` and `organization`);
  update status/adminNotes/handledBy/handledAt/subscriptionId; `cancelOpenByOwner`.
- `infrastructure/persistence/manual-subscription-payments.repository.ts`: insert
  (idempotent via unique idempotency_key: return the existing row on conflict), list by
  subscription, `findByIdempotencyKey`, count/last per subscription.
- `SubscriptionsRepository`: add `findActiveByOwner(owner, client, { provider? })` (or a
  sibling `findActiveByOwnerAndProvider`), `insertManual(input)` (plain insert, NOT the
  provider-id upsert), `updatePeriod(id, { currentPeriodStart, currentPeriodEnd, status })`,
  `listManualDueForExpiry(now, limit)` (provider = manual, status in ENTITLED, periodEnd <= now),
  admin list/detail queries for manual subscriptions (join user/org, payments count, last
  payment). Keep existing methods byte-identical.
- `SubscriptionStateEventsRepository.tryInsert` is provider-agnostic: write `created` /
  `ended` rows for manual subscriptions with `stripeEventId = "manual:<subscriptionId>:created"`
  / `"manual:<subscriptionId>:ended:<periodEndMs>"` and `stripeSubscriptionId =
  providerSubscriptionId` so admin analytics (starts / churn) stay honest.

### 3.2 `StripeSubscriptionSyncService` — REQUIRED FIX

`syncFromStripe` calls `findActiveByOwner(owner, tx)` and cancels the local non-terminal row
when it is not the Stripe canonical one. A manual subscription must never be touched by a
Stripe sync (a user with an old Stripe customer record who now pays cash would be canceled by
the checkout-return sync or any webhook). Scope that lookup to `provider = "stripe"`.

### 3.3 `ManualSubscriptionRequestsService` (user side)

- `getCurrent(user, workspace)` → `{ request }`: the owner's open (pending|contacted)
  request or null. Scope = same `resolveBillingScope` rule as BillingService (personal →
  `userOwner`, org → `orgOwner`; admission false).
- `create(user, body, workspace)`:
  1. `ProductSettingsService.get().manualPaymentsEnabled` else throw
     `ManualPaymentsDisabledError` (409, code `MANUAL_PAYMENTS_DISABLED`) — also expose a
     `ManualPaymentsEnabledGuard` in the settings module (same shape as
     `SubscriptionsEnabledGuard`) and use it on the POST route.
  2. Org scope requires `organizationsEnabled` (reuse the admission rule).
  3. Plan pairing: personal → `pro`, org → `business` (same `assertPlanMatchesScope` rule;
     throw `WorkspaceNotSupportedError`).
  4. If the owner has a live subscription that is NOT manual (Stripe) → `ActiveSubscriptionExistsError`
     (409 `ALREADY_SUBSCRIBED`). A live MANUAL subscription is allowed (the request is then a
     change/renewal request; the admin sees `currentSubscription`).
  5. If an open request exists → `ManualRequestPendingError` (409 `MANUAL_REQUEST_PENDING`).
     Insert under a per-owner advisory lock (reuse the owner-lock pattern) so a double
     submit hits the unique index / lock instead of creating two rows; map a unique
     violation to the same 409.
  6. Insert with `status = pending`; `AnalyticsService.capture(user.id,
     "manual_subscription_requested", { plan, tierCredits, interval, country })`.
  7. Best-effort admin notification: if `env.ADMIN_EMAILS` is set and
     `EmailService.isDeliverable()`, send ONE plain email to those addresses ("New offline
     subscription request — <name>, <phone>, <plan/tier/interval>, link to the admin page").
     Add `manualRequestEmail(...)` next to the auth templates. Never block or fail the request
     on email errors (log warn).
- `cancel(user, workspace)`: open request → `status = canceled` (404
  `NoActiveManualRequestError`? — use `NotFoundException` with code `NOT_FOUND`) and return
  `{ request: null }`.

Routes (`BillingController` or a new `ManualBillingController` under `v1/billing`):
`GET manual-request` (any workspace member may read), `POST manual-request`
(`@UseGuards(ManualPaymentsEnabledGuard)`, `@RequireWorkspacePermission("billing","manage")`),
`POST manual-request/cancel` (`billing:manage`). Bodies validated with `ZodValidationPipe`.

### 3.4 `ManualSubscriptionsService` (admin side + cron)

Deps: SubscriptionsRepository, SubscriptionCreditsRepository (owner lock +
`findCanonicalEntitledByOwner` + slot cancel), CreditsService, SubscriptionRefillService,
ManualSubscriptionPaymentsRepository, ManualSubscriptionRequestsRepository,
SubscriptionStateEventsRepository, AnalyticsService (optional). Everything money-related
runs inside `subscriptionCreditsRepository.withOwnerLock(owner, tx)`.

- `grant(adminId, input)`:
  - Resolve owner: `input.organizationId ? orgOwner : userOwner(input.userId)`. Validate the
    user exists (and the org exists when given); plan pairing (org → business, personal →
    pro) else 400.
  - Idempotency: `providerSubscriptionId = "manual_" + input.idempotencyKey`. If a
    subscription with that provider id already exists → return its detail (no double grant).
  - If the owner has ANY non-terminal subscription → 409 `ALREADY_SUBSCRIBED` ("renew or end
    the existing subscription first").
  - periodStart = input.periodStart ?? now; periodEnd = input.periodEnd ??
    `addBillingInterval(periodStart, interval)`; periodEnd must be > periodStart (400).
  - Inside the owner lock + tx: insert subscription (status active); insert payment
    (kind initial, idempotencyKey = input.idempotencyKey); `creditsService.grant(owner,
    tierCredits * 100, { bucket: "plan", idempotencyKey: "manual:<subId>:initial", meta: {
    reason: "manual_subscription_initial", subscriptionId, paymentId, grantedBy: adminId } }, tx)`;
    if interval = year → `subscriptionRefillService.createYearlySlots({ credits: tier*100,
    funding: { invoiceId: "manual:<paymentId>", chargeId: null, paymentIntentId: null },
    remainingAfter: periodStart, subscription: row }, tx)` (slots 2..12 land at periodStart +
    k months; the existing `subscription-refill-sweep` grants them — it skips Stripe
    reconciliation when `fundingChargeId` is null); state event `created`; if
    `input.requestId` → request status `approved`, `subscriptionId`, `handledBy`, `handledAt`,
    adminNotes (merge).
  - `analytics.capture(input.userId, "subscription_started", { plan, provider: "manual" })`.
  - Return `AdminManualSubscriptionDetail`.
- `renew(adminId, subscriptionId, input)`:
  - Subscription must exist and be manual (404 / 409 `MANUAL_SUBSCRIPTION_UNSUPPORTED` for a
    Stripe row). Idempotent on `input.idempotencyKey` (payment row exists → return detail).
  - Case A — still entitled and `currentPeriodEnd > now`: newStart = currentPeriodEnd; newEnd
    = input.periodEnd ?? `addBillingInterval(currentPeriodEnd, interval)` (must be > newStart).
    Update `currentPeriodEnd = newEnd` (keep `currentPeriodStart`, status active,
    cancelAtPeriodEnd false). Credits refill AT THE BOUNDARY, not now: insert a refill slot
    `{ subscriptionId, periodOrdinal: 2, dueAt: newStart, credits: tier*100, fundingInvoiceId:
    "manual:<paymentId>:cycle", fundingChargeId: null, fundingPaymentIntentId: null, status:
    pending }` (the sweep applies `applyCappedRefill` when due). For a yearly interval also
    create ordinals 2..12 from newStart via `createYearlySlots` with a subscription-shaped
    object whose `currentPeriodStart = newStart`, `currentPeriodEnd = newEnd`, funding
    `"manual:<paymentId>"`.
  - Case B — already ended (status canceled / period passed): newStart = now (or
    input-provided start = now), newEnd = input.periodEnd ?? now + interval; set status
    active, periods, cancelAtPeriodEnd false; **if another non-terminal subscription exists
    for the owner → 409**; `creditsService.applyCappedRefill(owner, tier*100, {
    capMultiplier: 1, idempotencyKey: "manual:<subId>:renewal:<paymentId>", meta: { reason:
    "manual_subscription_renewal", subscriptionId, paymentId, grantedBy } }, tx)`; yearly →
    createYearlySlots from newStart; state event `status_changed` (canceled → active) with
    id `"manual:<subId>:renewed:<paymentId>"`.
  - Insert payment (kind renewal, period newStart..newEnd). Return detail.
- `end(adminId, subscriptionId, input)` → `terminate(subscriptionId, reason, idempotencySuffix)`:
  inside owner lock: status → `canceled`, `cancelAtPeriodEnd = false`,
  `cancelPendingSlotsForSubscription`, and if `findCanonicalEntitledByOwner(owner, tx)` is
  null after the status write → `creditsService.expirePlanRemainder(owner, { idempotencyKey:
  "manual:<subId>:expire:<suffix>", meta: { reason, subscriptionId } }, tx)`; state event
  `ended`. No-op (idempotent) when already terminal. Also close any open cancellation-reason
  rows like Stripe's `ended` path if cheap (optional).
- `expireDue(now, limit = 200)` (cron entry): `listManualDueForExpiry(now, limit)` → for each,
  `terminate(id, "period_ended", periodEnd.getTime())` individually (one failure must not
  stop the sweep; count `ended` / `failed` / `skipped`). A subscription with
  `cancelAtPeriodEnd = true` ends the same way. Do NOT end rows whose period was extended
  concurrently (re-read inside the lock and skip when `currentPeriodEnd > now`).
- Admin reads: `listRequests(query)`, `getRequest(id)`, `updateRequest(adminId, id, body)`
  (status ∈ pending|contacted|rejected + adminNotes; approved/canceled rows cannot be moved
  back: 409), `listSubscriptions(query)`, `getSubscription(id)`.

### 3.5 `BillingService` branching for manual subscriptions

- `cancel`: when `isManualSubscription(subscription)` skip `paymentProvider.setCancelAtPeriodEnd`;
  still create the cancellation reason row, mark it scheduled, set local `cancelAtPeriodEnd`.
- `resume`: same — local only.
- `portal`, `previewChange`, `change`: manual → throw `ManualSubscriptionUnsupportedError`
  (409, code `MANUAL_SUBSCRIPTION_UNSUPPORTED`, message "This subscription is managed
  offline. Contact us to change it."). `checkout`/`topup` already block on any live
  subscription (`ActiveSubscriptionExistsError`) — keep; top-ups for manual subscribers stay
  a Stripe purchase if they have a card (no change).
- `sync`: unchanged (the sync service fix in 3.2 protects manual rows).

### 3.6 Settings

`product-settings.mapper.ts` / `getPublic()` / `DEFAULT_PRODUCT_SETTINGS` /
`ProductSettingsChanges` carry `manualPaymentsEnabled`. Add `ManualPaymentsEnabledGuard` +
`ManualPaymentsDisabledError` in the settings module and export the guard from
`modules/settings/index.ts`.

### 3.7 Admin controller

`presentation/http/controllers/admin-manual-billing.controller.ts` in the billing module,
`@Controller("v1/admin")` + `@AdminOnly()` (import the decorator from the admin module like
`AdminSettingsController` does):
- `GET manual-requests` (query `adminListManualRequestsQuerySchema`)
- `GET manual-requests/:id`
- `PATCH manual-requests/:id` (`adminUpdateManualRequestBodySchema`) → `AdminManualRequest`
- `GET manual-subscriptions` (query `adminListManualSubscriptionsQuerySchema`)
- `POST manual-subscriptions` (`adminGrantManualSubscriptionInputSchema`, 200) → detail
- `GET manual-subscriptions/:id` → detail
- `POST manual-subscriptions/:id/renew` (`adminRenewManualSubscriptionInputSchema`, 200)
- `POST manual-subscriptions/:id/end` (`adminEndManualSubscriptionInputSchema`, 200)
`@CurrentUser()` gives the acting admin id. Admin user / org detail mappers: include
`id` + `provider` on the subscription (contracts now require them).

### 3.8 Cron

`apps/server/src/trigger/manual-subscription-expiry.task.ts`: `schedules.task({ id:
"manual-subscription-expiry", cron: { pattern: "*/10 * * * *", timezone: "UTC" }, queue:
billingFinancialQueue, maxDuration: 240, retry: { maxAttempts: 1 }, ttl: "9m" })`;
`assertBillingDatabaseConfiguration()` (no Stripe key needed); `createDb({ max: 1 })`;
`createManualBillingRuntime(db).manualSubscriptions.expireDue(payload.timestamp, 500)`; log
the counts. Add `createManualBillingRuntime(db)` to `billing-maintenance.runtime.ts`
(compose the service with `new SubscriptionsRepository(db)`, `new
SubscriptionCreditsRepository(db)`, `createCredits(db)`, the refill service from
`createPaymentCore(db)` — `StripeProvider` constructs lazily without a key — and the two
new repositories). Mirror the pattern/specs of `subscription-refill.task.ts` and
`billing-maintenance.tasks.spec.ts`.

### 3.9 Tests (vitest, colocated `*.spec.ts`)

- `ManualSubscriptionRequestsService`: disabled switch, plan pairing, blocked by Stripe sub,
  allowed with manual sub, duplicate open request → 409, happy path, cancel.
- `ManualSubscriptionsService`: grant (credits ×100, yearly slots, request approved,
  idempotent replay, blocked when live sub exists), renew case A (slot at boundary, period
  extended, no immediate grant), renew case B (immediate capped refill, status active),
  end (slots canceled, plan remainder expired only when no other entitled sub),
  `expireDue` (ends due rows, skips extended rows, counts failures).
- `BillingService` manual branches (cancel/resume skip provider; portal/change throw).
- `StripeSubscriptionSyncService` never cancels a manual row.
- Task config spec for the new cron (id, cron pattern, queue), like the existing ones.

## 4. Web package (`apps/web`)

### 4.1 API layer (`features/billing/api`)

- `billing.services.ts`: `getManualSubscriptionRequest()`, `createManualSubscriptionRequest(body)`,
  `cancelManualSubscriptionRequest()` (parse with the contract schemas).
- `billing.queries.ts`: `billingKeys.manualRequest()` (workspace-scoped like `subscription`),
  `useManualSubscriptionRequestQuery()`.
- `billing.mutations.ts`: `useCreateManualSubscriptionRequest()` /
  `useCancelManualSubscriptionRequest()` — on success `setQueryData(billingKeys.manualRequest(), view)`.
- `billing.dto.ts`: re-export the new types.

### 4.2 Plan picker (`components/plan-picker-dialog.tsx`)

- Read `settings.manualPaymentsEnabled` (public settings) and the manual-request query.
- Replace the hard "purchases paused" gate with: `cardAvailable = settings.paidSubscriptionsEnabled`,
  `offlineAvailable = settings.manualPaymentsEnabled`. If neither → existing beta notice.
- When `offlineAvailable`: render a payment-method `Tabs` (`@wandit/ui/components/tabs`) at the
  top of the select step — **Card** (`CreditCard` icon) and **Cash / transfer** (`Banknote` or
  `HandCoins` icon). Default tab = Card when available, else Cash / transfer. When only one
  method is available render no tab list (just that content).
- Card tab = the existing picker content, unchanged.
- Cash / transfer tab (`ManualPaymentRequestPanel`, new file
  `components/manual-payment-request-panel.tsx`):
  - Shows the same billing-cycle toggle + tier select (reuse `PlanCard` for Pro/Business price
    display so the user sees the USD price; add a line "Local price agreed on the call").
  - Form: full name (prefilled from session name), phone (required), company (optional),
    country select (DZ default when locale is `ar`/`fr`? — default `DZ`), city (optional),
    preferred payment method select (optional), notes (textarea, optional). Client-validate
    with `createManualSubscriptionRequestBodySchema`; show field errors.
  - Submit → `useCreateManualSubscriptionRequest`. Success → replace the panel with a success
    notice ("We received your request. We will call you at {phone} shortly.") + close.
  - If an open request already exists → pending notice (plan/tier/interval, phone, created
    date) with **Cancel request** (confirm) and Close. Errors (409 codes) → inline messages via
    `getApiErrorMessage`.
  - While a user already has a LIVE MANUAL subscription: the select step shows a notice
    ("Your plan is managed offline. To change or renew, send us a request.") and the Cash /
    transfer panel is the only action (no Stripe preview/change). Never call
    `previewChange` for manual subscriptions.
- Emit the existing `pricing_viewed` event unchanged; add `emitUpgradeClicked`-style tracking
  only if trivial (optional).

### 4.3 Billing page (`pages/billing-page.tsx`)

- `SubscriptionCard`: for `isManualSubscription(subscription)` show a "Paid offline" badge,
  label the period date "Expires" (not "Renews"), hide **Billing portal** and **Change plan**,
  show **Request renewal / change** (opens the plan picker → Cash / transfer tab), keep
  **Cancel plan** (local). Status label for manual + `active` = "Active".
- New `ManualRequestNotice` card/banner (when an open request exists): "Offline payment request
  pending — we will call you at {phone}." with Cancel request.
- Keep everything else unchanged.

### 4.4 i18n (`packages/internationalization/dictionaries/{en,fr,ar}/billing.json` + `errors.json`)

Add every new string under `billing.planPicker.offline.*`, `billing.page.offline.*`, and the
new error codes in `errors.codes` (`ALREADY_SUBSCRIBED`, `NO_ACTIVE_SUBSCRIPTION`,
`MANUAL_PAYMENTS_DISABLED`, `MANUAL_REQUEST_PENDING`, `MANUAL_SUBSCRIPTION_UNSUPPORTED`) in
all three locales (French and Arabic must be real translations; Arabic copy must read well
RTL). Method labels: Cash on delivery / Bank transfer / CCP / BaridiMob / Other. Country
labels: Algeria / Tunisia / Morocco / Other.

### 4.5 Tests

Small vitest specs for any new pure helper (e.g. default tab resolution, request body
assembly); keep existing specs green.

## 5. Admin package (`apps/admin`)

### 5.1 Feature `features/offline-billing`

- `api/offline-billing.dto.ts|services.ts|queries.ts|mutations.ts` (pattern: organizations
  feature; `apiGet/apiPost/apiPatch` + contract types; query keys `admin-offline-billing`).
- Route `routes/_dashboard/offline-billing.tsx` → `OfflineBillingPage` with two tabs
  (`components/ui/tabs`): **Requests** and **Subscriptions**.
  - Requests table: contact (name, phone — `tel:` link, company), user (name/email link to
    `/users/$userId`), workspace (personal / org name), plan (tier · interval), country/city,
    preferred method, created, status badge, current subscription hint. Filters: status
    (open default), search. Row actions: **Mark contacted**, **Approve & grant** (opens
    `GrantManualSubscriptionDialog` prefilled: user, org, plan, tier, interval, requestId),
    **Reject** (note), **Edit note**. Detail sheet/drawer with all fields + notes.
  - Subscriptions table: owner, plan/tier/interval, period start → end, days left, status
    badge (Active / Ended), payments count, last payment, created. Filters: active default /
    ended / all, search. Row actions: **Renew** (`RenewManualSubscriptionDialog`: period end
    date picker default = current end + interval, payment fields), **End now** (confirm),
    **Details** (payments list).
- `GrantManualSubscriptionDialog` (shared): user picker (search users via existing
  `adminRoutes.users` list query with `q`) unless prefilled, org optional, plan (auto from org
  presence: org → Business, personal → Pro), tier select (CREDIT_TIERS), interval, period
  start/end (defaults), payment: method select, amount + currency (default DZD; allow USD/EUR;
  store minor units — amount input in major units ×100), reference, note; admin notes.
  `idempotencyKey` minted per payload like `grant-org-credits-dialog.tsx`.
- Navigation: add `{ title: "Offline billing", description: "Cash & transfer requests", to:
  "/offline-billing", icon: HandCoinsIcon (phosphor) }` after Organizations in
  `lib/navigation.ts` (+ `AdminRoutePath`).
- User detail page: `UserSubscriptionCard` shows provider badge ("Stripe" / "Paid offline")
  and, for manual subscriptions, **Renew** / **End** buttons wired to the dialogs; when the
  user has NO subscription the header gets a **Grant offline subscription** button (opens the
  grant dialog prefilled with the user). Org detail page: same for Business (prefill
  organizationId + attributionUserId).
- Settings: add `manualPaymentsEnabled` to `BOOLEAN_SETTING_KEYS` + `TOGGLE_DETAILS` in
  `product-controls-card.tsx` ("Offline payments" — consequence copy for on/off).
- Overview / dashboard: a small "Open offline requests" count is welcome if cheap (optional).

### 5.2 Tests

Specs for dto mapping / amount-to-minor conversion helpers; keep existing admin specs green.

## 6. Review hardening (implemented)

The adversarial review pass added, on top of the spec above:

- Termination idempotency keys are CYCLE-scoped (`manual:<subId>:expire:<periodStartMs>:<periodEndMs>`,
  same for the `ended` state event) — an end → renew → end sequence that restores the same
  period end must still expire credits the second time.
- `assertRequestCanFundOwner` only accepts OPEN (pending | contacted) requests: a grant or
  renewal can never resurrect a request the user canceled or an admin rejected.
- A grant WITHOUT `requestId` auto-links the owner's open request (grants from the user/org
  detail pages fulfill and close it instead of leaving it pending forever).
- Renewing an ENDED subscription refuses while a Stripe checkout attempt is open
  (409 `BILLING_CHECKOUT_PENDING`), mirroring the grant admission rule.
- `POST /billing/manual-request` and `…/cancel` sit behind `WebOriginWriteGuard`
  (CSRF: the Origin header must be an allowed web origin; SameSite=None cookies).
- Admin `:id` params validate as uuid (`ZodValidationPipe(uuidSchema)`).
- Web: a live CARD subscriber sees an explanation instead of a form that can only 409;
  a manual subscription with `cancelAtPeriodEnd` gets a Resume button on the billing page.
- Admin: renewing from a CHANGE request shows a plan-mismatch warning and the request row
  offers "End current subscription…"; TND amounts store millimes (ISO exponent 3).
- Two runtime bugs found by live smoke (Drizzle subquery aliases + `max()` string dates in
  the admin manual-subscription read path) are fixed.

### Codex review round (also implemented)

- USD revenue analytics (MRR, net-new/churned MRR, source/campaign MRR, priced retention)
  are scoped to `provider = 'stripe'`; paid-EXISTENCE analytics (funnel conversion,
  activePaidUsers, churned-customer counts) keep counting manual subscribers.
- `POST /billing/resume` lost its controller-level SubscriptionsEnabledGuard: a manual
  subscriber can resume in an offline-only rollout; the service still gates Stripe resumes.
- Top-up packs render on the offline-only picker path (manual subscribers can buy them).
- A grant that auto-resolves the owner's open request also stamps that request id on the
  payment row; a direct renewal auto-resolves a MATCHING open request but leaves change
  requests open.
- Note-only request edits no longer overwrite `handledAt` / `handledByUserId`.
- The phone contract requires at least 6 real digits.

### Offline stats (implemented)

`GET /api/v1/admin/manual-billing/stats` (AdminOnly) feeds a stats strip on top of the
Offline billing page: active manual subscriptions, open requests, expiring within 7 days,
and collected money this month vs last month — per currency, from the REAL recorded
payment rows (`manual_subscription_payments`), UTC calendar months. This is the offline
counterpart of MRR; the USD MRR analytics stay Stripe-only on purpose.

### Grace period (implemented)

A `manualGraceDays` product setting (integer, 0–30, default 0) gives offline customers a
collection window after their paid period ends. Policy: **grace keeps full access** — the
subscription stays `active` (entitled), remaining credits keep working, but no new credits
are granted until an admin records a renewal.

- **DB**: `product_settings.manual_grace_days integer NOT NULL DEFAULT 0` with a
  `0 <= x <= 30` check (migration `0042_manual-grace-days`).
- **Contracts**: `manualGraceDays` on `productSettingsSchema`, `publicSettingsSchema`
  (web needs it to compute the access-end date), and the PATCH body
  (`z.int().min(0).max(30)`).
- **Expiry cron**: `expireDue` reads the setting (via `ProductSettingsService`) and ends
  only subscriptions with `currentPeriodEnd <= now - graceDays`. The cycle-scoped
  idempotency keys are unchanged — grace only shifts WHEN the same termination runs.
- **Renewal during grace**: unchanged code path. `renewAtBoundary` is false (period end is
  past), so the renewal restarts the period from the payment day with a capped refill.
  The customer had access during grace; the new paid period starts when they actually pay.
- **Stats**: "Active subscriptions" and "Expiring in 7 days" use the EFFECTIVE end
  (`currentPeriodEnd + graceDays`); a new `inGrace` count (entitled, period end in
  `(now - graceDays, now]`) shows on the expiring tile.
- **Admin**: `adminManualSubscriptionSchema` gains `inGrace: boolean` and
  `accessEndsAt` (= `currentPeriodEnd + graceDays`); the subscriptions table shows an
  amber "In grace" badge; Settings gets an "Offline grace days" number input.
- **Web**: when a manual subscription is entitled and `currentPeriodEnd < now`, the
  billing page shows a "payment expected" notice with the real access-end date
  (`currentPeriodEnd + manualGraceDays` from public settings), localized en/fr/ar.
- `manualGraceDays = 0` reproduces the exact pre-grace behavior.

## 7. Rollout

1. Migrations `0041_manual-billing` and `0042_manual-grace-days` are additive; apply
   them with `db:migrate`.
2. Deploy server + Trigger.dev tasks (`npx trigger.dev deploy` picks up
   `manual-subscription-expiry`).
3. In admin → Settings turn on **Offline payments**.
4. If a collection window is wanted, set **Offline grace days** in admin → Settings.
   Keep it at `0` for strict expiry at the paid-period boundary.
5. Operations: requests → call → grant; before each period end → call → renew. The cron
   ends unpaid subscriptions after `currentPeriodEnd + manualGraceDays` (UTC, ±10 min).
