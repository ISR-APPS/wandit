# edge — serves published customer sites

One Cloudflare Worker on the `*/*` route of the `wandit.app` zone. It answers
`{slug}.wandit.app` and customer domains (Cloudflare for SaaS custom
hostnames), resolves `Host → KV pointer → R2 object`, and streams the
published HTML. Full design + production checklist:
`docs/features/edge-serving.md`.

## Configs

- `wrangler.jsonc` — canonical; used by deploy and by the vitest pool.
- `wrangler.dev.jsonc` — local-dev twin used by `pnpm dev` and the seed
  script. Only intended delta: **no `routes`** (a zone route makes
  `wrangler dev` fail every local request with an opaque internal error,
  verified on wrangler 4.114). Keep every other field in lockstep.

## Local development

Everything runs locally (Miniflare) — no Cloudflare account needed.

```bash
# 1. Seed local KV + R2 state (from apps/edge)
node scripts/seed-local.mjs --project <projectId> --slug acme [--html ./page.html]

# 2. Start the worker
pnpm --filter edge dev            # http://127.0.0.1:8799

# 3. Probe with spoofed Host headers — wrangler dev rewrites request.url
#    from the Host header, so no /etc/hosts entries are needed.
curl -sI -H "Host: acme.wandit.app"       http://127.0.0.1:8799/   # 200 text/html + ETag
curl -sI -H "Host: www.brand.com"         http://127.0.0.1:8799/   # 200 (domains-pipeline pointer)
curl -sI -H "Host: brand.com"             http://127.0.0.1:8799/   # 301 → https://www.brand.com/
curl -sI -H "Host: nope.wandit.app"       http://127.0.0.1:8799/   # 404 + no-store
curl -sI -H "Host: banned.wandit.app"     http://127.0.0.1:8799/   # 403 suspended
curl -sI -H "Host: customers.wandit.app"  http://127.0.0.1:8799/   # 200 health
curl -s  -X POST -H "Host: acme.wandit.app" http://127.0.0.1:8799/ # 405
```

To pull a page published by the local API into the worker's local R2 state,
download it from real R2 first (the API writes
`published/{projectId}/current.html`), save to a file, and pass `--html`.

## Tests

```bash
pnpm --filter edge test          # @cloudflare/vitest-pool-workers, real local bindings
pnpm --filter edge check-types
```

## Invariants

- **Pointer contract:** `projectId` is the ONLY required field of a
  `domain:{host}` KV value. The domains pipeline writes
  `{projectId, source:"domain"}` — never require more.
- **Never enable the new Workers Cache (`ctx.cache`)** without the
  `ctx.props` two-entrypoint design: it is host-blind and would serve one
  customer's page on another customer's domain. `caches.default` keys on the
  full URL including host and is safe.
- Key formats are owned elsewhere — R2:
  `apps/server/src/infrastructure/storage/r2.ts` (`publishedCurrentKey`);
  KV prefix: `apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts`.
