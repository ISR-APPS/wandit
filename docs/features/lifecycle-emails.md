# Lifecycle emails (Resend Automations)

Status: Resend side is built. Backend side is built on branch `feat/lifecycle-emails` (see section 7). All 14 automations in Resend are **disabled**, and the backend kill switch `lifecycleEmailsEnabled` is **off** by default. Nothing is sent until both are turned on.

## 1. Overview

- Platform: Resend Automations (event-driven). The backend sends one event per user action. Resend runs the sequence.
- 15 events, 14 automations, 25 Arabic (RTL) templates. Sender: `Wandit <hello@wandit.dev>`. Sign-off: `فريق Wandit`.
- Every template declares one variable, `NAME` (fallback `بك`, so the greeting reads `مرحبًا بك،` when the name is unknown). `w01-welcome` also declares `FREE_CREDITS` (number, fallback 50).
- Every template contains `{{{RESEND_UNSUBSCRIBE_URL}}}`. Resend handles the unsubscribe flow. After a global unsubscribe, later send steps in a run are skipped.
- Source of the templates: the generator `scratchpad/emails/build.py` (session scratchpad). Edit a template in the Resend dashboard, or regenerate and call `update-template` + `publish-template`.

## 2. Automations

Semantics that the design depends on (confirmed by test on 2026-08-24):

- A `wait_for_event` step matches only events that arrive **after** the run reaches that step. A step with no outgoing connection ends the run.
- A `condition` on a boolean payload field works (`eq true`).
- A missing payload field in `variables` does not fail the send. The template fallback applies.
- Every event creates a new run. The backend must send milestone events **once per user**.

| # | Automation (Resend name) | ID | Trigger | Steps |
|---|---|---|---|---|
| W1 | Activation | `01a03122-516c-718b-a05a-8f9146141f30` | `signup_completed` | if `skip_activation` → W01 → end. Else W01 → wait `first_prompt_sent` 4h → [timeout] W02 → wait `first_prompt_sent` 3d → [timeout] W03 |
| W2 | First website | `01a03122-672c-7781-af56-75a63612f2c5` | `website_generated` | if `done_landing_page` → end. Wait `landing_page_generated` 1h → [received] end / [timeout] W04 → wait 2d → [timeout] W05 |
| W3 | First landing page | `01a03122-7d56-72aa-be3e-7f65a0c591ec` | `landing_page_generated` | if `done_image` → end. Wait `image_generated` 1h → [timeout] W06 → wait 2d → [timeout] W07 |
| W4 | Image → strategy | `01a03122-8b2a-7148-b1be-be042db635ab` | `image_generated` | if `done_strategy` → end. Wait `marketing_strategy_generated` 3d → [timeout] W08 |
| W5 | Video tips | `01a03122-960b-74a2-a7f8-899c30c31ded` | `video_generated` | delay 4h → W09 |
| W6 | Strategy → connect ads | `01a03122-a3eb-717b-8f0e-f60ae32c72c0` | `marketing_strategy_generated` | if `done_ads_connected` → end. Wait `ads_connected` 3d → [timeout] W10 |
| W7 | Ads connected | `01a03122-b71d-735d-8d45-9dce0ecd1580` | `ads_connected` | if `done_analysis` → end. Wait `ads_analysis_completed` 1h → [timeout] W11 → wait 2d → [timeout] W12 |
| W8 | Analysis → launch | `01a03122-c70f-700b-b41e-60cbaa8bb484` | `ads_analysis_completed` | if `done_campaign` → end. Wait `campaign_launched` 3d → [timeout] W13 |
| W9 | Campaign launched | `01a03122-d3f7-723b-a50c-565a3c098e6a` | `campaign_launched` | W14 → delay 7d → W25 |
| W10 | Credits 25 | `01a03122-df86-73cd-8e8a-dd99cf2acb07` | `credits_25_used` | wait `credits_40_used` 6h → [received] end / [timeout] W15 |
| W11 | Credits 40 | `01a03122-ee41-73b3-9a7e-f836706c5456` | `credits_40_used` | W16 → wait `upgrade_clicked` 3d → [received] end / [timeout] W17 |
| W12 | Pricing viewed | `01a03122-f962-76df-b1a5-7a2ffe0376d5` | `pricing_viewed` | wait `upgrade_clicked` 2d → [received] end / [timeout] W18 |
| W13 | Checkout started | `01a03123-0cb9-727a-b900-5f9b308d4ca7` | `upgrade_clicked` | if `method == "offline"` → end. Wait `payment_completed` 1h → [timeout] W19 → wait 2d → [timeout] W20 |
| W14 | Paid customer | `01a03123-261c-70cb-8cf4-0dc7d5e8aacd` | `payment_completed` | W21 → delay 3d → W22 → delay 7d → W23 → delay 14d → if `interval == "month"` → W24 |

"[received] end" means the run stops without an email. In every wait step the `event_received` branch ends the run.

## 3. Templates

| Alias | ID | Subject |
|---|---|---|
| `w01-welcome` | `5ac01cba-6664-452c-a29f-5e5e6d0bfe6e` | مرحبًا بك في Wandit — صفحتك الأولى في دقائق |
| `w02-prompt-nudge` | `b32a1840-00cf-4bca-9f72-babd055ecf96` | لم تكتب وصفك بعد؟ دقيقتان تكفيان |
| `w03-help-offer` | `710ca1ce-3602-4778-9f5a-b2c7ff32350b` | نبني صفحتك الأولى معك |
| `w04-website-ready` | `f4618186-c9fc-45b6-a6c0-4d69092bad54` | موقعك جاهز — الآن اجعله يبيع |
| `w05-landing-nudge` | `9f02c06d-1292-404b-ad5a-13edab2343c1` | الفرق بين موقع وصفحة تبيع |
| `w06-landing-ready` | `5c9e836f-14ab-4471-97fd-d375f601d3c8` | صفحة الهبوط جاهزة — خطوتان قبل الإطلاق |
| `w07-creatives-nudge` | `56022c5e-c281-491d-a7f5-9d608e2662ca` | إعلانك بدون كاميرا ولا مصوّر |
| `w08-strategy-nudge` | `301f9090-f003-41c1-9818-08485c9c7b36` | قبل أن تدفع دينارًا للإعلانات |
| `w09-video-tips` | `7d8037de-87de-40fc-b942-5637e7456b65` | فيديوك جاهز — ثلاث طرق لاستخدامه |
| `w10-connect-ads-nudge` | `d0c59977-0e2a-4d48-b204-20180d6c1334` | لا أحد يرى ما بنيت |
| `w11-ads-connected` | `f51be3a7-2806-450a-9839-8431b7b64483` | تم ربط حسابك الإعلاني — ماذا تطلب الآن؟ |
| `w12-analysis-nudge` | `2280b1c4-0b3d-4b17-967d-bb76881f6b84` | دع Wandit يقرأ أرقامك |
| `w13-launch-nudge` | `2440fda3-dce0-4052-b99a-9bf86fc6daf3` | من التحليل إلى الإطلاق |
| `w14-campaign-launched` | `7079b3fc-d8d1-4bd0-a7e8-56ead374f538` | حملتك انطلقت — ماذا تراقب في أول 72 ساعة؟ |
| `w15-credits-25` | `9a2e939c-d939-4509-9433-15316b018fa6` | استخدمت 25 رصيدًا — وهذا خبر جيد |
| `w16-credits-40` | `b6ec5f98-11d6-49c8-b99c-dbc2323c7a34` | رصيدك المجاني على وشك الانتهاء |
| `w17-credits-40-reminder` | `c1e3bea4-2cac-480b-a6e2-4c64c7217576` | لا تتوقف في منتصف الطريق |
| `w18-plan-question` | `59eb6d0a-bcce-4aa3-9839-7947af5e5e08` | أي خطة تناسبك؟ سؤال واحد يحسمها |
| `w19-checkout-abandoned` | `fc379df3-5903-4bf2-8260-7aa25990c30c` | هل واجهت مشكلة في الدفع؟ |
| `w20-checkout-reminder` | `96caba0d-82f3-42c9-83d9-745147a3d05a` | حسبة صغيرة قبل أن تقرر |
| `w21-paid-welcome` | `a39dcf8f-f556-4bec-b168-26c057833eb0` | تمّ الدفع بنجاح — خطة أسبوعك الأول |
| `w22-paid-checkin` | `beede05e-d648-4018-b6e5-7f3b67a554d1` | هل أطلقت شيئًا؟ |
| `w23-review-affiliate` | `6c78d55f-3f6c-47d8-a1a4-124c01d9bca3` | طلب صغير، وفرصة |
| `w24-pre-renewal` | `877ce1b0-c00c-4be7-a5b2-1da814071d4f` | قبل تجديد اشتراكك — ماذا بنيت هذا الشهر؟ |
| `w25-campaign-report` | `1e82ddba-ef75-40ba-9497-981c39ef2475` | مرّ أسبوع على حملتك — اطلب تقريرها |

## 4. Backend event contract

### 4.1 The call

```ts
await resend.events.send({
  event: "website_generated",          // one of the 15 names below, exactly
  email: user.email,                   // canonical, lowercase. Never displayEmail.
  payload: { first_name: "أحمد", plan: "free", done_landing_page: false },
});
```

`resend` is the existing client in `apps/server/src/modules/email/application/services/email.service.ts` (SDK 6.18.1 has `events.send`). The API returns `202` (queued).

### 4.2 Payload fields

Common to every event:

| Field | Type | Rule |
|---|---|---|
| `first_name` | string | First word of `user.name`. Omit the field when the name is empty. The template then prints `مرحبًا بك،`. |
| `plan` | `"free" \| "pro" \| "business"` | Computed at dispatch time. |

Per event (the automation reads these in `condition` steps):

| Event | Extra fields | Notes |
|---|---|---|
| `signup_completed` | `skip_activation` (boolean) | `true` when the user is an invited workspace member, or already sent a first prompt at dispatch time. Then only the welcome is sent. |
| `website_generated` | `done_landing_page` (boolean) | `true` if the user already generated a landing page. |
| `landing_page_generated` | `done_image` (boolean) | |
| `image_generated` | `done_strategy` (boolean) | |
| `marketing_strategy_generated` | `done_ads_connected` (boolean) | |
| `ads_connected` | `done_analysis` (boolean), `connector` (`"meta-ads" \| "tiktok-ads"`) | |
| `ads_analysis_completed` | `done_campaign` (boolean) | |
| `upgrade_clicked` | `method` (`"card" \| "offline"`), `surface` (string) | `"offline"` ends the checkout-abandoned flow. |
| `payment_completed` | `interval` (`"month" \| "year" \| "topup"`) | `"month"` enables the pre-renewal email on day 24. |
| all others | none | |

The `done_*` flags are one query on the lifecycle-events table: "did this user already capture event X?" Any existing row counts, including pending or dropped rows, because capture means the user completed the action.

### 4.3 Event semantics and hooks

| Event | Meaning | Where to emit (from the codebase audit) |
|---|---|---|
| `signup_completed` | User row created | `apps/server/src/modules/auth/auth.module.ts` `onUserCreated`. Hold 10 minutes in the outbox, then dispatch with `first_name` from onboarding and `skip_activation`. |
| `first_prompt_sent` | First user prompt persisted | `projects.service.ts` `create()` after the transaction commits. |
| `website_generated` | `generate-page` task success, `pageKind === "website"` | `apps/server/src/trigger/generate-page.task.ts` next to `captureGenerationCompleted`. |
| `landing_page_generated` | same task, `pageKind === "cod"` | same place. |
| `image_generated` | image attempt `succeeded` | `apps/server/src/trigger/image-generation.runtime.ts`. |
| `video_generated` | any video kind `succeeded` | `image-animation.runtime.ts`, `product-video.runtime.ts`, `video-edit-extension.runtime.ts` (or extend `captureGenerationCompleted`). |
| `marketing_strategy_generated` | marketing asset `succeeded` with `assetType === "marketing-strategy"` | `apps/server/src/trigger/marketing-asset.runtime.ts`. |
| `ads_connected` | OAuth tokens saved for `meta-ads` or `tiktok-ads` | `mcp-oauth.service.ts` after `exchangeAndStoreTokens`. |
| `ads_analysis_completed` | connector operation `feature === "ads_analysis" && status === "succeeded"` | `mcp-chat-tools.service.ts` `recordConnectorOperation`. |
| `campaign_launched` | connector write that turns delivery on (`classifyAdsToolApproval(...) === "user-approval"`), `succeeded` | same place. |
| `credits_25_used` / `credits_40_used` | cumulative consumption of a **personal** owner reaches 2500 / 4000 centi-credits at settle time | end of `CreditsService.consume` for `reason === "ai_usage_settle"`. Use the `userCreditsConsumed` SQL from `admin.repository.ts`. |
| `pricing_viewed` | pricing page or plan picker opened | existing `product-events` module (web emitter). |
| `upgrade_clicked` | **checkout started**: Stripe checkout session created (`method: "card"`) or offline request submitted (`method: "offline"`) | `plan-picker-dialog.tsx` checkout call and the offline request submit. Today the web emits `upgrade_clicked` when the picker opens. Change that: picker open = `pricing_viewed`. |
| `payment_completed` | first successful payment of the user: Stripe `invoice.paid` (subscription), top-up `checkout.session.completed`, or manual request `approved` | `stripe-webhook-processor.service.ts` after the event is terminalized, and `manual-subscriptions.service.ts` approve path. |

### 4.4 Delivery rules

1. **Outbox, not fire-and-forget.** Insert a row (`user_id`, `event`, `payload`, `idempotency_key`, `dispatch_after`, `dispatched_at`) and let a Trigger.dev sweep every 5 minutes send undelivered rows. Same pattern as `signup_grant_outbox` + `sweep-signup-grants.task.ts`. Retry until Resend returns 202.
2. **Once per user** for: `signup_completed`, `first_prompt_sent`, `website_generated`, `landing_page_generated`, `image_generated`, `video_generated`, `marketing_strategy_generated`, `ads_connected`, `ads_analysis_completed`, `campaign_launched`, `credits_25_used`, `credits_40_used`, `payment_completed`. Idempotency key `<event>:<userId>` with a unique index.
3. **Free users only** for `credits_25_used`, `credits_40_used`, `pricing_viewed`, `upgrade_clicked`. "Free" = no entitled subscription (Stripe or manual), no top-up ever, no open manual payment request.
4. **Cooldowns:** `pricing_viewed` 7 days per user, `upgrade_clicked` 3 days per user.
5. **Holds:** `signup_completed` 10 minutes (name and first prompt become known). `pricing_viewed`, `upgrade_clicked`, `credits_40_used` 15 minutes; drop the row at dispatch if the user paid meanwhile.
6. Compute `plan`, `done_*`, `skip_activation` **at dispatch time**, not at capture time.
7. Keep the transactional emails (magic link, OTP, invitation, receipts) on `emails.send`. Do not route them through automations.

## 5. Test log (2026-08-24)

Target: `zakareasb@gmail.com`. W1 and W2 were enabled for the test, then disabled.

| Test | Result |
|---|---|
| `signup_completed` with `skip_activation: true`, `first_name: "زكرياء"` | Condition evaluated `true`. W01 delivered. Body reads `مرحبًا زكرياء،` and `50 رصيدًا مجانيًا`. Run completed. |
| `signup_completed` with `skip_activation: false`, no `first_name` | Condition evaluated `false`. W01 delivered with fallback `مرحبًا بك،`. Run waited at `first_prompt_sent`. |
| `first_prompt_sent` sent 15 s later | Wait step completed (`received_event_instance_id`). Remaining steps skipped. No nudge. |
| `website_generated` with `done_landing_page: true` | Condition evaluated `true`. All send steps skipped. No email. |

## 6. Before you enable

1. **Mailbox.** `hello@wandit.dev` is routed by Cloudflare Email Routing to `contact@scalemindapps.com` (done 2026-08-24). Eight emails say "ردّ على هذا البريد". To reply *from* `hello@wandit.dev`, add it in Gmail "Send mail as" with SMTP `smtp.resend.com:465`, user `resend`, password = a Resend API key.
2. **WhatsApp.** Removed from W03 and W19 on 2026-08-24. No template contains a phone number.
3. **Free credits.** W01 prints `FREE_CREDITS` (fallback 50). Make sure that `signupGrantEnabled` is on in production and the grant is 50. Change the fallback in the template if not.
4. **Purchases.** W10–W13 send users to `/pricing`. Do not enable them while `paidSubscriptionsEnabled` and `manualPaymentsEnabled` are off.
5. **Old automations.** The five older automations (A1–A6) and their 13 templates are still in the account, disabled. Remove them when you are sure.
6. Enable in this order after the backend ships: W1, W2, W3 first (one week of runs), then the rest.

## 7. Backend implementation (branch `feat/lifecycle-emails`)

### 7.1 Parts

| Part | Where |
|---|---|
| Outbox table `lifecycle_events` (enum of the 15 names, `idempotency_key` unique, `dispatch_after`, `dispatched_at`, `dropped_at` + `drop_reason`, `attempts`, `last_error`) | `packages/db/src/schema/lifecycle-events.ts`, migration `0054_lifecycle-emails.sql` |
| `product_events.properties` jsonb (carries `method` for `upgrade_clicked`) | migration `0054_lifecycle-emails.sql` |
| Kill switch `lifecycleEmailsEnabled` (default `false`) | `product_settings`, admin → Settings → Product controls |
| Module `lifecycle-events` (global): domain rules, repository, `LifecycleEventsService.enqueue()` / `enqueueCreditThresholds()`, `LifecycleEventsDispatcher` | `apps/server/src/modules/lifecycle-events/` |
| `EmailService.sendLifecycleEvent()` → `resend.events.send()` | `apps/server/src/modules/email/application/services/email.service.ts` |
| Trigger.dev sweep `lifecycle-events-sweep`, cron `*/5 * * * *`, queue concurrency 1 | `apps/server/src/trigger/sweep-lifecycle-events.task.ts` (+ `lifecycle-events.runtime.ts`, `lifecycle-events.queue.ts`) |
| Worker process wiring (`MeteringService` needs the lifecycle service) | `apps/worker/src/worker.module.ts`, `apps/worker/tsconfig.json` |

### 7.2 Flow

1. A hook calls `enqueue()` at the moment the action completes (inside the same transaction when one exists). Once-per-user events use the key `<event>:<userId>`; a replay is a no-op. `pricing_viewed` / `upgrade_clicked` go through a per-user advisory lock with the 7-day / 3-day cooldown. Holds: signup 10 min, pricing/checkout/credits-40 15 min.
2. Every 5 minutes the sweep loads due rows (`dispatched_at` and `dropped_at` null, `dispatch_after <= now`), 100 per run.
3. For each row the dispatcher loads one context row (canonical email, name, personal entitled subscription with manual grace, personal top-up history, open manual request, accepted invitation, the user's other lifecycle rows). Then:
   - switch off → `dropped_at` with reason `disabled` (the row stays as history)
   - no email → `no_email`
   - free-only event and the user is not free → `not_free`
   - otherwise send `{ event, email, payload }` and set `dispatched_at`; on error keep the row pending, `attempts + 1`, `last_error`.
4. Payload at dispatch time: `plan`, `first_name` (omitted when empty), `skip_activation` (signup), `done_*` (next-step flags), plus the captured fields (`connector`, `method`, `surface`, `interval`).

### 7.3 Hooks (15)

| Event | Hook |
|---|---|
| `signup_completed` | `auth.module.ts` `onUserCreated`, after `user_signed_up` |
| `first_prompt_sent` | `ProjectsService.create()` after the first-message transaction commits |
| `website_generated` / `landing_page_generated` | `generate-page.task.ts` success transaction via `generate-page-lifecycle.ts` (`pageKind` website / cod), actor = `subject.actorUserId` |
| `image_generated` | `image-generation.runtime.ts` `markSucceeded` + API recovery in `image-generations.service.ts`; actor = queue payload user (snapshotted at claim) |
| `video_generated` | `image-animation.runtime.ts`, `product-video.runtime.ts`, `video-edit-extension.runtime.ts` + recovery in `media-generations.repository.ts` |
| `marketing_strategy_generated` | `marketing-asset.runtime.ts` when `assetType === "marketing-strategy"` |
| `ads_connected` | `McpOauthService.exchangeAndStoreTokens()` after `saveTokens()` for `meta-ads` / `tiktok-ads`, payload `connector` |
| `ads_analysis_completed` | `mcp-chat-tools.service.ts` succeeded call with feature `ads_analysis` |
| `campaign_launched` | same place, gated by the pure predicate `domain/campaign-launch.ts` (`isCampaignLaunch`) |
| `credits_25_used` / `credits_40_used` | `MeteringService.applyCreditAdjustment()` final state and the late fixed-completion path, personal payer only, via `CreditsRepository` net-consumption SQL |
| `pricing_viewed` / `upgrade_clicked` | `ProductEventsService.create()` bridge after an accepted product event or replay (the lifecycle outbox deduplicates/cooldowns) |
| `payment_completed` | inside the credit-grant transactions: `SubscriptionCreditsService.grantForPaidInvoice()` (`subscription_create` only), `grantTopup()` (completed + async success), `ManualSubscriptionsService.grant()` |

Web: `upgrade_clicked` now fires only after a Stripe checkout session is created (`method: "card"`) or an offline request is accepted (`method: "offline"`), with the originating `surface`. Opening the plan picker stays `pricing_viewed`. Top-up checkout never emits `upgrade_clicked`.

### 7.4 Rollout

1. Merge and deploy `apps/server`, `apps/worker`, `apps/web`, `apps/admin`. Run the migration (`0054_lifecycle-emails`).
2. Make sure that `RESEND_API_KEY` is set in production (it already is for transactional email). No other env var.
3. Deploy the Trigger.dev tasks (the sweep registers itself).
4. Keep `lifecycleEmailsEnabled` **off** for a few days. Rows are recorded and then dropped as `disabled`; watch `select event, drop_reason, count(*) from lifecycle_events group by 1, 2` to check the hooks fire as expected.
5. Enable the Resend automations W1–W3 first, then turn `lifecycleEmailsEnabled` on in the admin Product controls. Then W4–W9, then W10–W14 once purchases are open.

### 7.5 Verification done on 2026-08-24

- Type checks: db, contracts, server, admin, web, worker — pass.
- Unit tests: server 4250/4251 (the one failure, `admin-analytics.repository.spec.ts` "reuses live-owner policy", fails on `dev` as well — pre-existing), web 763/763, worker 22/22, admin settings dto 7/7.
- Live smoke test against the local database with a stub sender: once-per-user replay no-op, `disabled` drop, `done_landing_page: true` at dispatch time, `pricing_viewed` cooldown reject + 15-min hold, `signup_completed` 10-min hold with `skip_activation: false`, credit thresholds at 2499 (none) and 4000 (both, the 40 one held 15 min).
