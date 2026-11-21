# SlickPay (CIB / Edahabia) payments

> **Pricing v8 (2026-11-12):** one SlickPay payment is a wallet top-up of an amount. It buys no plan.
> See [`pricing-v8-pay-as-you-go.md`](pricing-v8-pay-as-you-go.md) section 5.
> **Starter pass (2026-11-20):** SlickPay also sells the Starter pass: 1 USD, so 250 DZD at the default rate.
> See [`pricing-v8-pay-as-you-go.md`](pricing-v8-pay-as-you-go.md) section 14.

SlickPay is the card gateway for Algeria. The buyer pays with a CIB or Edahabia card (SATIM) on a SlickPay page, in DZD.
One payment adds credits to the wallet of the workspace: 10 credits for each USD of the amount. Credits never expire.

## Who sees it

- When the API has `SLICKPAY_PUBLIC_KEY`, every visitor gets the rate. The rate is the admin setting "USD → DZD rate" (default 250).
- The web then shows each USD price with its DZD price next to it: `dzdPriceFor(amountUsd, rate)`. The "CIB / Edahabia" tab shows for every visitor too.
- The top-up dialog shows Card (Stripe, USD), then "CIB / Edahabia" (DZD), then Cash / transfer. Each tab shows only when its switch is on. The first available tab is the default.
- Without `SLICKPAY_PUBLIC_KEY`, all visitors see USD prices and no SlickPay tab.
- The checkout route does not read the country. Only `GET /billing/local-pricing` reads `cf-ipcountry`, for the old `slickpay` field.
- Three switches are independent: the card (admin setting "Card top-ups", `topups_enabled`), SlickPay (`SLICKPAY_PUBLIC_KEY`), and offline requests (admin setting "Offline payments", `manual_payments_enabled`). To turn SlickPay off, remove `SLICKPAY_PUBLIC_KEY`.

## Flow

1. The web calls `GET /api/v1/billing/local-pricing`. The answer is `{ dzdPerUsdRate, slickpay }`.
   - `dzdPerUsdRate` (decimal DZD for 1 USD) goes to every visitor, or is null without the key. A value that is not null turns on DZD and the SlickPay tab.
   - `slickpay` stays not null only when `cf-ipcountry` is `DZ`. An old cached web bundle reads it as "the visitor is in Algeria".
2. `POST /api/v1/billing/slickpay/checkout` writes a `slickpay_payments` row and creates a SlickPay invoice (`merchants/invoices`) with the item name "Wandit credits". The body is one of:
   - `{ amountUsd, fullName, phone, city }`: a top-up of whole USD, 10 to 1000.
   - `{ starterPass: true, fullName, phone, city }`: the Starter pass. The amount is `STARTER_PASS_USD` (1 USD, 10 credits). The invoice is `dzdPriceFor(1, rate)`, so 250 DZD at the default rate.
     If the pool does not need the pass (the switch is off, or the pool has a live pass), the API answers 409 `STARTER_PASS_NOT_AVAILABLE`.
     A pool has one open Starter pass page. A second request of the same buyer within 30 min gets the same URL and no new invoice. See section 14 of `pricing-v8-pay-as-you-go.md`.
   The row stores `amount_usd_cents`, `credits` (centi-credits), the DZD amount, and the rate. It stores NULL in `plan`, `tier_credits`, and `interval`.
   One user can start 5 checkouts in 10 minutes. The 6th gets 429 `RATE_LIMITED`.
3. The web sends the buyer to the invoice URL. After the payment, SlickPay sends the buyer to `/billing/slickpay?payment=<id>`.
4. That page polls `/api/v1/billing/slickpay/payments/<id>/confirm` every 3 s, for a maximum of 3 min.
   The API then reads the invoice state from SlickPay with our own key. There is no webhook.
5. A paid invoice tops up the wallet. Under the owner lock, in one transaction: `CreditsService.topup` (bucket `topup`, key `slickpay-topup:{paymentId}`),
   one `billing_topup_receipts` row (provider `slickpay`, reference `slickpay:{paymentId}`), and the row set to `fulfilled`.
   The grant also enqueues the lifecycle event `payment_completed` with `interval: "topup"`. A SlickPay top-up earns no affiliate commission.
   In the same transaction, a new receipt gives the credit pool its Starter pass (source `slickpay`, `receipt_id` of the receipt), if the pool has no live pass.
   This is true for each SlickPay top-up, not only for the 1 USD pass. The pass goes to the credit pool, never to the buyer of a team payment.
6. The Trigger.dev task `slickpay-payment-sweep` does steps 4 and 5 every 5 min, for buyers who closed the tab.
   It reads 50 open rows per run, least recently checked first. A failed check writes `last_error` and keeps the status.

## Statuses (`slickpay_payment_status`)

| Status | Meaning |
| --- | --- |
| `created` | The row exists, but the invoice does not exist yet. After 1 h, the row becomes `failed`. |
| `pending` | The invoice exists and the buyer did not pay. After 24 h unpaid, the row becomes `expired`. |
| `paid` | SlickPay says "paid". The credits are not granted yet. |
| `fulfilled` | The credits are granted. Final. |
| `failed` | SlickPay did not create the invoice, or an admin closed the row after a refund. Final. |
| `expired` | The invoice was still unpaid 24 h after creation. The sweep stops. When the buyer opens the return page, confirm asks SlickPay again, and a late payment becomes `paid`. |

## Environment variables

Set these variables in Railway (staging and production) and in the Trigger.dev dashboard (staging and prod). The sweep calls SlickPay too.
- `SLICKPAY_PUBLIC_KEY`: the merchant API key from the SlickPay dashboard. Without it, all visitors see USD and Stripe.
- `SLICKPAY_ENVIRONMENT`: `sandbox` (default, `devapi.slick-pay.com`) or `production` (`prodapi.slick-pay.com`).
- `SLICKPAY_ACCOUNT_TYPE`: `merchant` (default, `merchants/invoices`) or `user` (`users/invoices`). The key must match it.

Production: the Wandit merchant key, `SLICKPAY_ENVIRONMENT=production`, `SLICKPAY_ACCOUNT_TYPE=merchant`.
Staging: the shared test key from developers.slick-pay.com (Authentication page), `SLICKPAY_ENVIRONMENT=sandbox`, `SLICKPAY_ACCOUNT_TYPE=user`. No real money moves.

## Rows from before pricing v8

An old row has a plan and no `credits`. The fulfil step first looks for a payment that old code recorded
in `manual_subscription_payments` (by the idempotency key or the invoice reference). On a hit, it sets the row to `fulfilled` and grants nothing.
Else it grants the larger of `tier_credits` (times 12 for a yearly row) and 10 credits for each USD of `amount_dzd * 100 / dzd_per_usd_rate`.
A row never fulfils with zero credits.

## Resolve a "paid" row with `last_error`

When the grant fails, the row stays `paid` with `last_error`. Sentry gets each new error once, and the sweep tries the row again every 5 min.

1. Find the row: `select * from slickpay_payments where status = 'paid' and last_error is not null;`
2. Read `last_error` and fix the cause. The sweep then grants within 5 min.
3. Do not record the same money with "Record top-up" in admin Offline billing. The sweep can then grant a second time.

## Refund a SlickPay payment

SlickPay sends no refund event.

1. Refund the buyer in the SlickPay dashboard.
2. If the row is `fulfilled`: in admin Offline billing, open the top-up receipts, find the receipt `slickpay:{paymentId}`, and click "Reverse top-up".
   The API takes back all credits of the receipt (key `topup-reverse:{receiptId}`) and sets `reversed_at`. The balance can go below zero.
   If this receipt gave the Starter pass, the pass moves to the newest other live receipt of the pool. If the pool has no such receipt, the API revokes the pass.
3. If the row is still `paid`: set the row to `failed`, so that the sweep does not grant.
