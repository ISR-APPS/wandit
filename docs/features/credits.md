# Credits & Usage (fake in MVP)

> **SUPERSEDED (billing v2):** this document describes the pre-v2 slice and no
> longer matches the shipped system. Current truth:
> `docs/features/billing.md` and
> `docs/features/billing-v2-subscriptions-credits-affiliates.md`.
> Key differences: signup grant is 20 credits (promo bucket, disabled by
> default via product_settings, delivered through the signup-grant outbox +
> Trigger.dev sweep — not an unconditional 100); consumption uses the
> reserve→settle→reconcile metering flow, not consume-at-job-start.

## Purpose

Usage metering with a real ledger but no payments yet: hardcoded signup grant, real consumption on generation, visible price tags. Stripe (then CIB) later slot in as ledger writers — no refactor.

## Owns

- `credit_ledger` table: userId, delta (±), kind (`grant | consume | topup | expire | revoke`), idempotency key (dedupes retried jobs / payment webhooks), meta (jsonb: reason, jobId…), createdAt. **Balance = sum(ledger).** Append-only.
- Balance service with concurrency-safe consume (transaction + per-user lock; reject when insufficient).
- Signup grant via the Auth signup hook.
- Consume integration: pre-check at generation enqueue, actual consume in the worker job (implements the `consume` interface stubbed in chat-generation).
- API: `GET /credits/balance`, `GET /credits/ledger`.
- UI: balance chip in the workspace/dashboard header, price tags on generate actions, insufficient-credits state (blocking modal with "top-up coming soon" placeholder).

## Working model

Payment-provider-agnostic by design: any future payment (Stripe subscription, top-up pack, CIB in DZD) is just a writer adding `grant`/`topup` rows. MVP constants (placeholders, config-level): signup grant **100**, landing-page generation **10**, chat-only message **1**. Consume is atomic: inside a transaction, take a per-user advisory lock, recompute balance, insert the negative row or fail — the generation job refunds (compensating `grant` row, meta-linked) if it errors after consuming. Publishing and lead collection never touch credits. Post-MVP expiry (`expire` rows re-granted per billing cycle) already fits the schema. Money reversals (Stripe refund/dispute, CIB reversal) claw purchased credits back with `revoke` rows meta-linked to the topup they reverse. **Slice 8 note:** burn order (plan before top-up) and cycle expiry need a nullable `bucket` (plan | topup) column on ledger rows — additive then; every earlier row is a free/plan grant.

## Does not own

- Stripe/CIB integration, plans, top-up packs, expiry cycles (post-MVP — see PRD roadmap).
- What a generation *does* (→ chat-generation; this feature only prices and gates it).

## Issue breakdown

### 1. Ledger slice (DB → API → worker integration)

`credit_ledger` table + migration + contracts. Balance service: `getBalance(userId)`, `consume(userId, amount, meta)` (tx + advisory lock + insufficient-funds error), `grant(...)`. Signup hook → grant 100. Costs as typed constants in `packages/contracts`. Wire the chat-generation `consume` stub: pre-check on enqueue (reject with a typed error), consume at job start, compensating refund on job failure. Endpoints: balance, paginated ledger.

**Acceptance criteria**
- New signup shows balance 100; a generation moves it to 90 with a `consume` row linked to the job id.
- Two concurrent generations cannot overspend (verified with a parallel test); insufficient balance rejects the enqueue with a typed error.
- A failed generation refunds: ledger shows consume + compensating grant, net 0.

### 2. Credits UI

Balance chip in headers (dashboard + workspace), refreshed via Query invalidation on generation events. Price tags on generation actions ("Generate — 10 credits" on the send affordance where a generation will trigger). Insufficient-credits blocking modal: current balance, cost, "top-up coming soon" placeholder CTA. Ledger history list (simple, in account menu).

**Acceptance criteria**
- Balance visibly decreases after a generation completes without a manual refresh.
- Attempting a generation with insufficient balance shows the modal and sends nothing.
- Price tags render on every credit-consuming action, and nowhere on publish/leads actions.

**Files:** `packages/db/src/schema/credits.ts`, `packages/contracts/src/v1/credits.ts`, `apps/server/src/modules/credits/**`, `apps/worker/src/processors/ai-generation.processor.ts` (consume wiring), `apps/web/src/features/credits/**`.

Source docs: docs/PRD.md, docs/features/credits.md
