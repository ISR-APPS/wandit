# Starter cancel-time retention offer

Decision date: 2026-09-12 (Zack). Status: current product decision.

The Starter A/B sales test ends with this decision. Starter becomes a retention offer.
The billing, web, contracts, and copy packages implement this decision.

## Product rules

- **R1 — New subscriptions:** A personal workspace can start Pro. A team workspace can start Business. The server and UI reject Starter.
- **R2 — Retention offer:** An entitled Stripe personal subscriber on a non-Starter plan sees Starter in the cancel dialog.
  Acceptance uses the existing preview and change flow. It schedules `pendingPlan` and `pendingTierCredits` at renewal.
  The UI shows "Changes at renewal." Stripe charges nothing when the subscriber accepts the offer.
- **R3 — Eligibility:** The offer does not appear for manual, team, Starter, pending-Starter, canceling, or non-entitled subscriptions.
  It also stays hidden when paid subscriptions are off or the catalog has no Starter tier.
- **R4 — Existing use:** Existing Starter subscriptions continue to work. Admin manual grants, filters, analytics, receipts, and Starter prices remain supported.
- **R5 — Public sales:** Landing pricing shows Free, Pro, and Business. The personal sidebar action says "Upgrade to Pro."
- **R6 — Public catalog:** `GET /api/v1/billing/plans` continues to return Starter for offers and existing Starter subscribers.

## Change map

- Contracts: `packages/contracts/src/v1/billing.ts` defines new-subscription plans.
- Server billing: `apps/server/src/modules/billing/application/services/billing.service.ts` rejects new Starter card checkouts.
  `apps/server/src/modules/billing/application/services/billing.service.spec.ts` covers this rule and preserves Pro-to-Starter changes.
- Server manual billing: `apps/server/src/modules/billing/application/services/manual-subscription-requests.service.ts` rejects new Starter offline requests.
  `apps/server/src/modules/billing/application/services/manual-subscription-requests.service.spec.ts` covers this rule.
  `apps/server/src/modules/billing/billing-catalog.spec.ts` covers the contract helper.
- Billing policy: `apps/web/src/features/billing/lib/billing-ui-policy.ts` defines offer eligibility and Starter visibility.
  `apps/web/src/features/billing/lib/billing-ui-policy.spec.ts` covers each eligible and ineligible state.
- Cancel flow: `apps/web/src/features/billing/components/cancel-subscription-dialog.tsx` shows the offer.
  `apps/web/src/features/billing/components/cancel-subscription-dialog.spec.ts` covers both paths.
  `apps/web/src/features/billing/pages/billing-page.tsx` opens the plan picker.
- Plan picker: `apps/web/src/features/billing/components/plan-picker-dialog.tsx` limits Starter visibility.
  `apps/web/src/features/billing/components/plan-picker-dialog.spec.ts` covers the four subscriber states.
- Public sales: `apps/web/src/features/landing/components/pricing.tsx` returns to three cards.
  `apps/web/src/features/landing/components/pricing.spec.ts` covers the cards.
  `apps/web/src/features/billing/components/upgrade-button.tsx` directs personal workspaces to Pro.
- Copy maps: `apps/web/src/features/billing/lib/upgrade-copy.ts` removes the Starter upgrade title.
  `apps/web/src/features/billing/components/upgrade-button.spec.ts` covers both workspace titles.
- Dictionaries: `packages/internationalization/dictionaries/{en,fr,ar}/billing.json` adds the offer text.
  The matching `landing.json` and `workspace.json` files remove new-buyer Starter text.
- Documentation: `docs/features/billing.md`, `manual-billing.md`, `pricing-v7-032-anchor.md`, and `teams-workspaces.md` reference this decision.

## Measurement

No product event records the offer. An accepted offer is a subscription row with
`pending_plan = 'starter'` until renewal, then `plan = 'starter'`. A refused offer is a row in
`cancellation_reasons`.

## Release notes

- This change needs no database migration.
- This change needs no Stripe seed change and no Stripe price change.
- The `starter_60_month` and `starter_60_year` prices remain required for scheduled downgrades.
- Deploy the contracts, server, web, and dictionaries together.

## Existing Starter and manual subscriptions

Existing card Starter subscribers remain entitled and can keep Starter or change its interval.
The plan picker shows their Starter card next to Pro.

Admins can grant Starter manually and renew existing manual Starter subscriptions.
Admin filters, analytics, receipts, and stored Starter subscription data remain valid.
