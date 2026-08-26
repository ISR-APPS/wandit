# CSRF defence and security headers

Status: implemented in the API and the two Vercel apps. DNS changes are manual (see the last section).

## Problem

CORS stops a third-party page from reading an API response. It does not stop the write. A page on any site can auto-submit an HTML form to `https://api.wandit.dev/api/v1/...`. If the browser attaches the victim's session cookie, the handler runs. Before this change:

- Production cookies were `SameSite=None`. The browser attached them to cross-site form posts.
- Nest registered an `application/x-www-form-urlencoded` body parser. A form body reached the handlers.
- Only the admin and manual-billing routes checked the `Origin` header.

Confirmed targets were `POST /api/v1/push-tokens` (leak lead PII to an attacker phone), `POST /api/v1/billing/cancel` and `/resume`, and `POST /api/v1/projects` (credit reserve).

## Defence (three independent layers)

1. **Cookie `SameSite`** — `packages/auth/src/index.ts` calls `resolveAuthCookieSameSite()` from `@wandit/env/cookie-same-site`. When every web/admin origin is on the API's site (production: `wandit.dev`, `admin.wandit.dev`, `api.wandit.dev`), the cookies are `SameSite=Lax`. When one origin is cross-site (staging on `vercel.app`), they stay `SameSite=None`. `AUTH_COOKIE_SAME_SITE=lax|none` overrides the guess.
2. **`CrossSiteWriteGuard`** — global guard, registered before `AuthGuard` in `apps/server/src/modules/auth/auth.module.ts`. For `POST/PUT/PATCH/DELETE`:
   - `Origin` present: it must be `CORS_ORIGIN`, one of `CORS_EXTRA_ORIGINS`, `ADMIN_ORIGIN`, a native scheme (`wandit://`, `exp://`), or `http://localhost:8081` outside production. `null` is rejected.
   - `Origin` absent: allowed (native app, Stripe webhook, curl), unless a browser signal remains: `Sec-Fetch-Site: cross-site`, or a `Referer` whose origin is not ours.
   - `http://localhost:8081` (Expo web / Metro) is trusted only while `BETTER_AUTH_URL` is on localhost, in this guard and in Better Auth's `trustedOrigins`.
   - Rejection is `403` with code `CROSS_SITE_WRITE_REJECTED`.
   - `@AllowCrossSiteWrite()` opts a route out. Only `POST /api/public/leads/:id` uses it (merchant sites on any origin).
3. **No urlencoded parser** — `apps/server/src/main.ts` removes Nest's default parser after `app.init()`. A form body gets `415` from Fastify before any handler.

## Expo authorization proxy (found during review, pre-existing)

`@better-auth/expo` mounts `GET /api/auth/expo-authorization-proxy?authorizationURL=...`. The native app uses it to open Google sign-in in the system browser: the proxy stores the OAuth `state` in a signed cookie and redirects. The plugin only checked "https and not our own origin", so the route was an open redirect and let an attacker plant a `state` cookie in a victim's browser (state fixation → login CSRF into the attacker's account).

`packages/auth/src/expo-authorization-proxy.ts` now pins the target inside the Better Auth `before` hook: host `accounts.google.com`, `client_id` = `GOOGLE_CLIENT_ID`, `redirect_uri` = `${BETTER_AUTH_URL}/api/auth/callback/google`. Anything else gets `400 UNTRUSTED_AUTHORIZATION_URL`. The native client always sends the exact URL that `POST /api/auth/sign-in/social` returned, so nothing legitimate changes.

`CORS_ORIGIN` and `ADMIN_ORIGIN` are now normalized to bare origins at env validation time: a trailing slash or upper-case host would otherwise block every write from the app (CORS, Better Auth and the guard all compare the raw string with the browser's `Origin`).

## Security headers

- API (`main.ts` `onSend` hook): `X-Content-Type-Options: nosniff`; `Strict-Transport-Security` when `BETTER_AUTH_URL` is https.
- Web and admin (`apps/web/vercel.json`, `apps/admin/vercel.json`): `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Nothing frames these apps: previews use `srcDoc` or `wandit.app` URLs.

## Verify after deploy

```sh
# 403: forged cross-site write
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.wandit.dev/api/v1/push-tokens \
  -H 'Origin: https://evil.example' -H 'Content-Type: application/json' --data '{}'
# 415: form body
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.wandit.dev/api/v1/push-tokens \
  -H 'Origin: https://wandit.dev' -H 'Content-Type: application/x-www-form-urlencoded' --data 'a=1'
# 400 UNTRUSTED_AUTHORIZATION_URL: open redirect closed
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://api.wandit.dev/api/auth/expo-authorization-proxy?authorizationURL=https%3A%2F%2Fevil.example%2F%3Fstate%3Dx'
# 401 (not 403): the web app's own origin still reaches AuthGuard
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.wandit.dev/api/v1/push-tokens \
  -H 'Origin: https://wandit.dev' -H 'Content-Type: application/json' --data '{}'
# SameSite=Lax on the production session cookie: sign in on wandit.dev and read
# the Set-Cookie header in the network panel.
```

## Manual: email spoofing (DNS)

`wandit.dev` had SPF `~all` and DMARC `p=none`; `wandit.app` had neither. Anyone could send mail "from `hello@wandit.dev`". Set in the Cloudflare DNS dashboard:

| Zone | Name | Type | Value |
|---|---|---|---|
| wandit.dev | `@` | TXT | `v=spf1 include:_spf.mx.cloudflare.net -all` |
| wandit.dev | `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:hello@wandit.dev; adkim=r; aspf=r; pct=100` |
| wandit.app | `@` | TXT | `v=spf1 -all` |
| wandit.app | `_dmarc` | TXT | `v=DMARC1; p=reject; rua=mailto:hello@wandit.dev` |

Resend signs with DKIM `d=wandit.dev` (selector `resend._domainkey`) and uses `send.wandit.dev` as MAIL FROM, so aligned mail keeps passing. After two weeks of clean reports, change `wandit.dev` to `p=reject`.
