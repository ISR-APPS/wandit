# SlickPay (CIB / Edahabia) payments

SlickPay is the card gateway for Algeria. The buyer pays with a CIB or Edahabia card (SATIM) on a SlickPay page, in DZD.
One payment buys one month or one year of one plan. It never renews automatically. The buyer renews with a new payment.

## Who sees it

- The API has `SLICKPAY_PUBLIC_KEY`, and the Cloudflare header `cf-ipcountry` of the visitor is `DZ`.
- These visitors see every price in DZD: `dzdPriceFor(priceUsd, rate)`. The rate is the admin setting "USD → DZD rate" (default 270).
- Their plan picker shows the "CIB / Edahabia" tab, not the Stripe Card tab. The Cash / transfer tab does not change.
- All other visitors see USD prices and Stripe.
- SlickPay does not depend on the admin switches "Paid subscriptions" or "Offline payments". To turn it off, remove `SLICKPAY_PUBLIC_KEY`.

## Flow

1. The web calls `GET /api/v1/billing/local-pricing`. A `slickpay` value that is not null turns on DZD and the SlickPay tab.
2. `POST /api/v1/billing/slickpay/checkout` writes a `slickpay_payments` row and creates a SlickPay invoice (`merchants/invoices`).
   One user can start 5 checkouts in 10 minutes. The 6th gets 429 `RATE_LIMITED`.
3. The web sends the buyer to the invoice URL. After the payment, SlickPay sends the buyer to `/billing/slickpay?payment=<id>`.
4. That page polls `/api/v1/billing/slickpay/payments/<id>/confirm` every 3 s, for a maximum of 3 min.
   The API then reads the invoice state from SlickPay with our own key. There is no webhook.
5. A paid invoice grants or renews a manual subscription (`provider = "manual"`) through `ManualSubscriptionsService`.
   The payment row has method `slickpay`, currency DZD, and the invoice id as reference.
   Expiry, grace days, receipts, and the admin Offline billing pages then work as for an offline payment.
6. The Trigger.dev task `slickpay-payment-sweep` does steps 4 and 5 every 5 min, for buyers who closed the tab.
   It reads 50 open rows per run, least recently checked first. A failed check writes `last_error` and keeps the status.

## Statuses (`slickpay_payment_status`)

| Status | Meaning |
| --- | --- |
| `created` | The row exists, but the invoice does not exist yet. After 1 h, the row becomes `failed`. |
| `pending` | The invoice exists and the buyer did not pay. After 24 h unpaid, the row becomes `expired`. |
| `paid` | SlickPay says "paid". The subscription is not granted yet. |
| `fulfilled` | The subscription is granted or renewed. Final. |
| `failed` | SlickPay did not create the invoice, or an admin closed the row after a refund. Final. |
| `expired` | The invoice was still unpaid 24 h after creation. The sweep stops. When the buyer opens the return page, confirm asks SlickPay again, and a late payment becomes `paid`. |

## Environment variables

Set these variables in Railway (staging and production) and in the Trigger.dev dashboard (staging and prod). The sweep calls SlickPay too.
- `SLICKPAY_PUBLIC_KEY`: the merchant API key from the SlickPay dashboard. Without it, all visitors see USD and Stripe.
- `SLICKPAY_ENVIRONMENT`: `sandbox` (default, `devapi.slick-pay.com`) or `production` (`prodapi.slick-pay.com`).
- `SLICKPAY_ACCOUNT_TYPE`: `merchant` (default, `merchants/invoices`) or `user` (`users/invoices`). The key must match it.

Production: the Wandit merchant key, `SLICKPAY_ENVIRONMENT=production`, `SLICKPAY_ACCOUNT_TYPE=merchant`.
Staging: the shared test key from developers.slick-pay.com (Authentication page), `SLICKPAY_ENVIRONMENT=sandbox`, `SLICKPAY_ACCOUNT_TYPE=user`. No real money moves.

## Resolve a "paid" row with `last_error`

The API does not grant when the owner has a Stripe subscription, or a manual one with another plan, tier, or cycle.
Then the row stays `paid` with `last_error`. Sentry gets the error once, and the sweep tries the row again every 5 min.

1. Find the row: `select * from slickpay_payments where status = 'paid' and last_error is not null;`
2. If `last_error` names an open Stripe checkout, do nothing. A Stripe session expires in 24 h. Then the sweep grants.
3. To give the paid plan, end the conflicting subscription. The sweep then grants within 5 min.
   Or grant or renew by hand in admin Offline billing. Use method "SlickPay (CIB/Edahabia)" and `invoice_id` as Reference.
   The API finds your payment by that reference and sets the row to `fulfilled`. Without it, the sweep can renew a second time.
4. To refund, refund the buyer in the SlickPay dashboard and set the row to `failed`. Else the sweep grants when the conflict ends.

## Show the Stripe Card tab to Algerians later

The rule lives in one place: `cardAvailable` in `apps/web/src/features/billing/lib/billing-ui-policy.ts`.
Remove its `slickpayAvailable` condition. The plan picker then shows Card and CIB / Edahabia.
The Card tab shows USD prices, because Stripe charges USD.
