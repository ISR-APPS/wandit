# edge — serves published customer sites

One Cloudflare Worker on the `*/*` route of the `wandit.app` zone. It answers
`{slug}.wandit.app` and customer domains (Cloudflare for SaaS custom
hostnames) and resolves `Host → KV pointer`. A V1 page pointer streams the
published HTML from R2. A V2 app pointer (`kind: "app"`) hands the request
to the app's own Worker in the dispatch namespace (see "V2 apps" below).
Full design + production checklist: `docs/features/edge-serving.md`.

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
curl -sI -H "Host: acme-app.wandit.app"   http://127.0.0.1:8799/about # V2 app: 500 until WANDIT-200 adds DISPATCHER
curl -sI -H "Host: phishing-app.wandit.app" http://127.0.0.1:8799/ # 451 suspended app (abuse_phishing)
curl -sI -H "Host: unpaid-app.wandit.app" http://127.0.0.1:8799/   # 410 suspended app (billing)
```

Miniflare runs no dispatch namespace, so the V2 app host answers the 500
page locally. The two suspended app hosts answer before any dispatch.

To pull a page published by the local API into the worker's local R2 state,
download it from real R2 first (the API writes
`published/{projectId}/current.html`), save to a file, and pass `--html`.

## Tests

```bash
pnpm --filter edge test          # @cloudflare/vitest-pool-workers, real local bindings
pnpm --filter edge check-types
```

## Deploy

`.github/workflows/edge-deploy.yml` deploys the Worker through the reusable
`.github/workflows/worker-deploy.yml`:

- A push to `staging` deploys `wandit-edge-staging` (env `staging`): a test
  host on `workers.dev`, the `wandit-staging` bucket, no route.
- A push to `main` deploys `wandit-edge` (env `production`) with the `*/*`
  route on the `wandit.app` zone.
- A pull request runs the tests and a deploy dry run of env `production`.

The workflow reads the repository secret `CLOUDFLARE_V2_DEPLOY_TOKEN`
(Workers Scripts edit and Workers Routes edit on `wandit.app`). `SENTRY_DSN`
stays a Worker secret: set it by hand with `wrangler secret put SENTRY_DSN
--env <env>` for each environment.

Manual steps stay in the Cloudflare dashboard: the route exclusions, the DNS
records, and the SaaS fallback origin. See `docs/features/edge-serving.md`.
If a deploy breaks serving, run `wrangler rollback --env production`.

## V2 apps (WANDIT-177)

A V2 app is one Cloudflare Worker per app in a Workers for Platforms
dispatch namespace (D15). The edge does not read app files. It finds the
app's Worker and hands the request to it.

- **Pointer:** the same `domain:{host}` KV value, with `kind: "app"`. The
  fields live in `packages/contracts/src/v2/publish.ts` (`HostPointer`):
  `projectId`, `kind`, `source`, `slug`, `status`, `reasonCode`, `limits`.
  The publish task (WANDIT-178) writes `kind` and `limits`; the suspend
  switch (WANDIT-181) writes `status` and `reasonCode`. A pointer without
  `kind` takes the V1 path.
- **Lookup cache:** the Worker keeps a pointer, hit or miss, in isolate
  memory for 10 s, on top of the 60 s KV edge cache.
- **Dispatch:** `env.DISPATCHER.get(appWorkerName(projectId), {}, { limits })`,
  then `userWorker.fetch(request)` with the request as the visitor sent it:
  method, path, headers, and body. `limits` comes from the pointer, or
  `DEFAULT_APP_WORKER_LIMITS` when the pointer has none. The app owns its
  paths, content types, cache headers, CSP, and 404 pages. The edge adds
  only `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: strict-origin-when-cross-origin` when the app sets none.
  A 101 WebSocket answer returns untouched.
- **No edge cache on this path:** a server function answer must never enter
  `caches.default`. Every method passes; the V1 405 does not apply.
- **Errors:** a `get` or `fetch` that throws `Worker not found` answers the
  not-published page (404, `no-store`). Any other dispatch error answers the
  branded 500 page with a Sentry capture.
- **Suspended:** `status: "suspended"` answers before any dispatch with
  `suspendedAppPage(reasonCode)`: 451 for a code that starts with `abuse_`
  or `legal_`, 410 for every other code or no code. Both are `no-store`. A
  V1 pointer with `status: "suspended"` still answers 403.
- **Binding (WANDIT-200):** `DISPATCHER` in `Env` is the dispatch
  namespace. `wrangler.jsonc` binds it to the namespace `production` at the
  top level and in env `production`, and to the namespace `staging` in env
  `staging`. The API writes into the same namespace through
  `CLOUDFLARE_W4P_NAMESPACE`. A real deploy fails when the namespace does
  not exist in the account; the pull request dry run does not check it. So
  create both namespaces before the first deploy with this config (steps in
  `docs/v2/runbook.md`). `wrangler.dev.jsonc` has no binding: no user
  Worker runs locally, so `wrangler dev` answers the 500 page for a
  `kind: "app"` pointer.

## Invariants

- **Pointer contract:** `projectId` is the ONLY required field of a
  `domain:{host}` KV value. The domains pipeline writes
  `{projectId, source:"domain"}` — never require more. The fields are typed
  in `packages/contracts/src/v2/publish.ts`; the Worker reads them as a
  type and parses nothing, so zod stays out of the bundle.
- **Never enable the new Workers Cache (`ctx.cache`)** without the
  `ctx.props` two-entrypoint design: it is host-blind and would serve one
  customer's page on another customer's domain. `caches.default` keys on the
  full URL including host and is safe.
- Key formats are owned elsewhere — R2:
  `apps/server/src/infrastructure/storage/r2.ts` (`publishedCurrentKey`);
  KV prefix: `apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts`.
