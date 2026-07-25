# Edge serving — how published sites reach visitors

`apps/edge` is a single Cloudflare Worker that serves every published
customer site: `{slug}.wandit.app` subdomains and customer-owned domains
onboarded through Cloudflare for SaaS. This doc records the architecture and
the **manual Cloudflare dashboard steps** that code cannot apply.

## Request path

```
visitor → Cloudflare edge (wandit.app zone, route */*) → wandit-edge Worker
   host = Host header
   ptr  = KV get "domain:{host}"                (60 s edge cache)
   obj  = R2 get "published/{ptr.projectId}/current.html"
   → stream obj (ETag, Cache-Control: public, max-age=60)
```

- **Custom domains arrive with the customer's Host header**, which is why the
  Worker route must be `*/*` on the zone: a `*.wandit.app/*` pattern would
  miss all Cloudflare-for-SaaS traffic. Worker Custom Domains can't do
  wildcards at all.
- **Publish is instant** because the R2 key derives from `projectId` alone
  and R2 is strongly consistent: overwriting `current.html` changes what
  every host of that project serves, with no KV write on the publish path.
- **Pointer contract:** `projectId` is the only required field of a
  `domain:{host}` value. The domains pipeline writes
  `{projectId, source:"domain"}` (see `domain-routing.service.ts`);
  publishing writes `{projectId, source:"slug", slug}`. Readers must
  tolerate unknown extras; writers must never *require* more. An optional
  `status: "suspended"` triggers the 403 page.
- **Key formats** are owned by the server:
  `publishedCurrentKey`/`publishedArchiveKey` in
  `apps/server/src/infrastructure/storage/r2.ts`, and the `domain:` prefix in
  `apps/server/src/modules/domains/infrastructure/cloudflare/domain-routing.service.ts`.
  The Worker duplicates the two literal strings with cross-references.

## Cache strategy

`caches.default` (legacy Cache API) + `Cache-Control: public, max-age=60`,
**no purge call**. Republish propagates within ≤60 s (R2 is strongly
consistent; only the HTTP cache lags). Miss/suspended/not-published responses
are `no-store` so negative results are never cached.

**Never enable the new Workers Cache (`ctx.cache`) as-is.** It is host-blind:
one cache entry per path is shared across every hostname, which in a
multi-tenant site server serves customer A's page on customer B's domain. If
request collapsing or tag purge is ever wanted, use the two-entrypoint design
(gateway resolves KV → `ctx.exports.CachedSite.fetch(request, { props:
{ projectId } })`; `ctx.props` participates in the cache key) and `?.`-guard
every `cache.purge` call — it is undefined in local dev.

## One-time Cloudflare dashboard setup (production)

Nothing in code applies these; they must be clicked once per environment.

1. **DNS (wandit.app zone), two originless proxied records:**
   - `*` AAAA `100::` (proxied) — wildcard so `{slug}.wandit.app` resolves.
   - `customers` AAAA `100::` (proxied) — the SaaS fallback origin host.
2. **SSL for SaaS:** enable Custom Hostnames on the zone and set the
   **fallback origin** to `customers.wandit.app` — BOTH the DNS record above
   AND the dashboard selection are required, or custom hostnames return
   Error 1016. (`DOMAINS_FALLBACK_ORIGIN` in `packages/env/src/server.ts`
   must stay in sync.)
3. **Worker routes:** deploy `wandit-edge` (route `*/*` ships in
   `wrangler.jsonc`), then add **route exclusions** so the app keeps working:
   `wandit.app/*`, `www.wandit.app/*`, `api.wandit.app/*` each assigned to
   Worker **None**. The Worker also passes these hosts through in code
   (belt and braces), but the exclusions keep app traffic off the Worker
   entirely. This is the highest-blast-radius step: `*/*` with no exclusions
   swallows the marketing site and the API.
4. **Bindings:** fill `kv_namespaces[0].id` with the production KV namespace
   (`CLOUDFLARE_KV_NAMESPACE_ID`) and confirm `r2_buckets[0].bucket_name`
   points at the bucket the API writes (`R2_BUCKET`).
5. **Universal SSL** covers `wandit.app` + first-level subdomains (`*` cert),
   which is exactly what slug sites need. Two-level hosts (e.g.
   `x.y.wandit.app`) are NOT covered — the deferred preview-host design must
   account for that.
6. Never onboard `wandit.app` or any `*.wandit.app` host as a SaaS custom
   hostname (documented Cloudflare limitation).

## Limits worth knowing

- Workers Free: 100k requests/day — fine for testing; budget Workers Paid
  (~$5/mo) before real traffic.
- SaaS custom hostnames: first 100 free on every plan, $0.10/mo each after.
- Slug-reuse window: a slug freed by unpublish and instantly reclaimed by
  another project can serve the previous owner's page for up to ~60 s
  (KV + HTTP cache propagation). Accepted for v1.

## Local development

See `apps/edge/README.md` — `wrangler dev` simulates KV/R2 locally, a spoofed
`Host:` header rewrites `request.url`, and local dev runs off
`wrangler.dev.jsonc` (identical to `wrangler.jsonc` minus `routes`, which
breaks `wrangler dev`). A spoofed
`Host:` header rewrites `request.url`, and `scripts/seed-local.mjs` seeds
pointers + a published object, so the full host-routing matrix is testable
with curl and in `@cloudflare/vitest-pool-workers` tests without a Cloudflare
account.
