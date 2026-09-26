# preview-proxy — gates the preview origins

One Cloudflare Worker on the `*.wanditpreview.app/*` route. It answers hosts
of the form `r-<rid12>--p-<projectId>.wanditpreview.app`, checks a signed
15-minute token, and forwards verified requests (HTTP and WebSocket) to the
sandbox dev-port origin stored in the token claim `up`. It also answers the
phone hosts `m-<phoneId>--p-<projectId>.wanditpreview.app` of Expo Go
(WANDIT-193, see "The phone link" below).

## The token

The API route `GET /api/v2/projects/:id/preview-token` signs the claims
`{pid, rid, uid, up, exp, jti}` with `PREVIEW_TOKEN_SIGNING_KEY`
(`packages/contracts/src/v2/preview-token.ts`). The flow:

1. The browser opens `https://<host>/?wt=<token>` (the `previewUrl` of the
   route response).
2. The Worker verifies the token, compares `pid`/`rid12` to the host, sets
   `Set-Cookie: __Host-wandit_preview=<token>; Secure; HttpOnly;
   SameSite=None; Path=/`, and answers 302 to the same URL without `wt`.
3. Later requests carry the cookie. The Worker verifies it, rate-limits per
   `jti` (600/min), strips the wandit pair from `Cookie`, and forwards to
   the `up` origin with the upstream `Host` header.
4. A dead upstream (fetch failure or 502/503/504) answers 503 with
   `Retry-After: 5` and the "Preview not running" page. Every error page
   posts its `wandit:preview` event to the parent frame (WANDIT-173 reads it).

Every forwarded request carries `X-Forwarded-Host: <preview host>` and
`X-Forwarded-Proto: https`. Metro builds the bundle and source map URLs
from these two headers, so the vendor host does not reach the browser or
the phone.

## The phone link

Expo Go sends no cookie, so a phone gets its own host instead of the
`?wt=` exchange (WANDIT-193):

1. The API mints a token with `GET .../preview-token?client=phone` and an
   optional `expoUsername` claim.
2. The caller POSTs the token as a plain-text body to
   `https://<run host>/__wandit/phone-link`. The Worker verifies it, checks
   `pid`/`rid12` against the host, spends one request of the token `jti`,
   and writes `phone:<phoneId>` to `PREVIEW_KV`. The row holds the claims
   with a 60-minute `exp` and a new `jti`, and KV deletes it after 60
   minutes. `phoneId` is 13 random bytes in lower-case base32 (21
   characters), so the host label has 63 characters. The answer is
   `{expoUrl: "exps://<phone host>", expiresAt}` with
   `Access-Control-Allow-Origin: *`: the body token is the only
   credential.
3. Each request on the phone host reads the row. A missing, broken, or
   expired row answers a plain 401; another project answers 403. The
   Worker rate-limits on the row `jti` and forwards with no cookie and no
   redirect. WebSockets (`/hot`, `/message`) pass through.
4. The sandbox runs Metro with
   `EXPO_PACKAGER_PROXY_URL=https://p-<projectId>.wanditpreview.app`. On
   `/`, `/manifest`, and `/index.exp`, a manifest answer
   (`application/json`, `application/expo+json`, or the `manifest` part of
   `multipart/mixed`) gets the phone host over that fixed host. With an
   `expoUsername` claim, the Worker also writes `extra.expoGo.username`:
   the store Expo Go on an iPhone opens a dev server only for its
   signed-in account. The Worker serves nothing on the `p-` host.

Every response sets `Content-Security-Policy: frame-ancestors
<FRAME_ANCESTORS>`, `X-Robots-Tag: noindex`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`,
`Cache-Control: no-store`, and drops the upstream `X-Frame-Options`
(security.md 9.3 item 4).

Each forwarded request also writes `preview:last-seen:<pid>` to `PREVIEW_KV`
(at most once per 60 s per isolate; the idle sweep reads it) and one data
point to the `wandit_preview_proxy` Analytics Engine dataset. The outcome
blob is one of: `forwarded` (preview served), `redirect` (token exchange),
`phone_link` (phone link minted),
`unauthorized` (token rejected), `forbidden` (claims mismatch),
`not_running` (sandbox down), `rate_limited` (over budget), `not_found`
(host unknown), `error` (proxy bug).

## Configs

- `wrangler.jsonc` — canonical; used by deploy and by the vitest pool.
- `wrangler.dev.jsonc` — local-dev twin used by `pnpm dev`. Only intended
  delta: **no `routes` and no `env` block** (a zone route makes
  `wrangler dev` fail every local request with an opaque internal error,
  verified on wrangler 4.114). Keep every other field in lockstep.

## Local development

Everything runs locally (Miniflare) — no Cloudflare account needed.

```bash
# 1. Give the local worker the signing secret (gitignored)
echo "PREVIEW_TOKEN_SIGNING_KEY=test-key" > .dev.vars

# 2. Mint a token (prints the token, the host, and the curl line)
node scripts/mint-token.mjs --key test-key \
  --project 11111111-1111-4111-8111-111111111111 \
  --run 22222222-2222-4222-8222-222222222222 \
  --up http://127.0.0.1:5173

# 3. Start the worker
pnpm --filter preview-proxy dev    # http://127.0.0.1:8787

# 4. Probe with a spoofed Host header — wrangler dev rewrites request.url
#    from the Host header, so no /etc/hosts entry is needed.
curl -i -H "Host: r-222222222222--p-11111111-1111-4111-8111-111111111111.wanditpreview.app" \
  "http://127.0.0.1:8787/?wt=<token>"
# → 302 with Set-Cookie. Follow it (the cookie request forwards to --up).
```

## Tests

```bash
pnpm --filter preview-proxy test          # @cloudflare/vitest-pool-workers, real local bindings
pnpm --filter preview-proxy check-types
# Same dry run as CI; `--env ""` names the top-level config (see Deploy).
cd apps/preview-proxy && npx wrangler deploy --dry-run --outdir dist --env ""
```

## Deploy

- The zone `wanditpreview.app` must exist in the Cloudflare account first
  (WANDIT-155 still decides the staging domain; the `staging` env therefore
  has no `routes` yet).
- Set the real `PREVIEW_KV` namespace id in `wrangler.jsonc` (and the
  `staging` block) at deploy time; the file ships `TODO-set-at-deploy`.
- Set the secret once per environment: `wrangler secret put
  PREVIEW_TOKEN_SIGNING_KEY` (with `--env staging` for staging). It must
  equal the API env `PREVIEW_TOKEN_SIGNING_KEY`, or every token fails the
  signature check.
- CI `.github/workflows/preview-proxy-deploy.yml` runs the checks plus
  `npx wrangler deploy --dry-run --outdir dist --env ""` on pull requests.
  On pushes it deploys `npx wrangler deploy --env staging` for `staging`
  and `npx wrangler deploy --env ""` for `main`. Without an `--env` flag
  wrangler 4.114 warns that no target environment was named; `--env ""`
  selects the top-level config.
