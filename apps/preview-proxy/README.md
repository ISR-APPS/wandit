# preview-proxy — gates the preview origins

One Cloudflare Worker on the `*.wanditpreview.app/*` route. It answers hosts
of the form `r-<rid12>--p-<projectId>.wanditpreview.app`, checks a signed
15-minute token, and forwards verified requests (HTTP and WebSocket) to the
sandbox dev-port origin stored in the token claim `up`.

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

Every response sets `Content-Security-Policy: frame-ancestors
<FRAME_ANCESTORS>`, `X-Robots-Tag: noindex`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`,
`Cache-Control: no-store`, and drops the upstream `X-Frame-Options`
(security.md 9.3 item 4).

Each forwarded request also writes `preview:last-seen:<pid>` to `PREVIEW_KV`
(at most once per 60 s per isolate; the idle sweep reads it) and one data
point to the `wandit_preview_proxy` Analytics Engine dataset.

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
