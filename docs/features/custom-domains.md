# Custom Domains (buy in-app + bring your own)

**Status:** spec — post-MVP roadmap #6 · **Researched:** 2026-07-04 (registrar comparison via live web research)
Extends `docs/features/publishing-serving.md` with real domains on top of `{slug}.wandit.app`. This doc is the implementation spec: infrastructure module first, UI second.

## Purpose

Let a user put their published page on a real domain two ways: **buy a domain inside Wandit** (primary — paid in credits, registered via our reseller account, DNS + SSL fully automated, zero DNS knowledge needed) or **connect a domain they already own** (secondary — guided DNS records + verification). Buying in-app is a genuine unblocking feature for the Algerian market, not just convenience: CIB/EDAHABIA cards can't pay international registrars, so most users cannot buy a .com anywhere else. Revenue = markup over wholesale on registration and every renewal.

## Settled decisions

- **We are a reseller, not an affiliate, and not Cloudflare Registrar.** Cloudflare Registrar is at-cost, own-use-only, no reseller program — ruled out. We register through a wholesale registrar API, the user pays us in credits, we pay wholesale from a prepaid balance and keep the spread.
- **Provider #1: Openprovider**, behind a `DomainProvider` port (same philosophy as billing's `PaymentProvider` — the registrar is swappable, ledger/UX never change). Verified 2026-07: REST/JSON API + sandbox, IP whitelisting optional (OpenSRS/ResellerClub require it — bad fit while our deploy target is unsettled), free tier then ~$50/yr Basic S for cost pricing, ~$8 .com at member price (verify in panel), $20 minimum top-up, free WHOIS privacy. Fallback if onboarding/funding from Algeria balks: ResellerClub.
- **The customer is the registrant of record** (Openprovider owner handle = user's contact data). Legally their domain; we are the managing agent. WHOIS privacy on by default (free). Transfer-out always possible: auth-code endpoint, ICANN 60-day post-registration lock surfaced in UI.
- **TLD catalog is code** (billing convention): one config in `@wandit/contracts` — launch TLD set, credit price per TLD for registration and renewal, wholesale ceiling per TLD. Zack tunes numbers in one place. Prices include margin + FX buffer over USD wholesale.
- **Premium domains are blocked in v1.** At order time we re-check wholesale price against the catalog ceiling; anything above (premium flag or price drift) is rejected before credits are touched.
- **Serving reuses the settled pipeline** (PRD §7): Cloudflare for SaaS custom hostnames on the `wandit.app` zone, fallback origin `customers.wandit.app` bound to `apps/edge`. The edge worker already routes by hostname; custom domains are one more KV lookup (`domain:{host}`), same pointer shape as slugs. Publishing keeps updating pointers — a publish also refreshes the KV keys of the project's active domains.
- **Canonical host = `www.{domain}`** for purchased domains: `www` CNAME → `customers.wandit.app`; apex redirects to `www` (Openprovider URL forwarding — verify during implementation; fallback: A records / redirect worker). Kills the apex-CNAME problem class.
- **Domains belong to the user, attach to a project**: `user_id` NOT NULL, `project_id` nullable — deleting a project detaches the domain, never deletes it. A project may have several domains; one `is_primary`.
- **All sales final** in v1 (registries are effectively non-refundable). Refunds happen only when *we* fail: registration job hits a terminal error → compensating `grant` ledger row (same pattern as generation refunds).
- **`.dz` is out** (CERIST, manual process, not in reseller catalogs). ASCII domains only in v1 (IDN/Arabic domains = open question).

## Working model

**Purchase pipeline:** search (`checkAvailability` + catalog prices, rate-limited) → user picks domain + fills registrant contact (prefilled from account; phone E.164 like leads; address incl. wilaya) → `POST` purchase creates the `domains` row (`registering`), **atomically consumes credits** (tx + advisory lock, idempotency key = domain row id, typed `InsufficientCreditsError` → 402) → enqueues `domain-purchase` job → worker: wholesale-ceiling re-check → Openprovider register (owner handle from registrant snapshot, privacy on) → set DNS (`www` CNAME + apex forwarding) → create CF custom hostname → `configuring` → poll hostname/cert until active → KV `domain:{host}` → `active`. Terminal failure at any step → `failed` + compensating refund `grant` + user-visible error. Every provider call is idempotent against the order (re-runs check state before acting).

**BYO pipeline:** `source='external'` row → create CF custom hostname → return required records (`www` CNAME → `customers.wandit.app`, apex guidance, ownership TXT if needed) → user sets them at their registrar → `verify` endpoint re-polls until cert issues → `active`. (Entri auto-DNS is a later nicety.)

**Lifecycle:** `registering → configuring → active → expired | transferred_out` (+ `failed`); "expiring soon" is derived from `expires_at`, not a status. Repeatable daily `domain-renewals` job: `auto_renew` domains expiring ≤30d → consume renewal credits → provider renew → bump `expires_at`; insufficient credits → in-app notice, retry daily until T-5; not renewed → expires (registrar grace/redemption exists but we don't promise it). Manual renew endpoint + auto-renew toggle. Weekly `domain-sync` reconciles status/expiry from the provider. Renewal-due notices are in-app v1 (email provider still an open PRD question).

**Client reads state by polling** the domains list query while a domain is in a transitional status (SSE is overkill here — transitions take seconds-to-minutes and are queue-driven).

## Data model (packages/db)

- `domains` *(new)* — `id` uuid PK, `user_id` FK→user (restrict), `project_id` nullable FK→projects (set null), `name` text unique, `tld`, `source` (`'purchased'|'external'`), `status` (`'registering'|'configuring'|'active'|'failed'|'expired'|'transferred_out'`), `is_primary` bool, `registrant` jsonb (snapshot), `whois_privacy` bool default true, `auto_renew` bool default true, `expires_at`, `provider` (`'openprovider'`), `provider_domain_id`, `cf_custom_hostname_id`, `dns` jsonb (records set / required-for-BYO), `price_snapshot` jsonb (reg/renew credits at order time), `error` text, timestamps. Money trail lives in `credit_ledger` (consume/grant rows meta-linked to the domain id) — no separate orders table.

## API (packages/contracts src/v1 + modules/domains)

| Route | Behavior |
|---|---|
| `GET /api/v1/domains/search?q=` | availability across launch TLDs + credit prices (rate-limited; premium → shown unavailable) |
| `GET /api/v1/projects/:projectId/domains` | list with statuses (client polls during transitions) |
| `POST /api/v1/projects/:projectId/domains` | `{name, registrant}` → purchase (consume + enqueue) |
| `POST /api/v1/projects/:projectId/domains/external` | `{name}` → BYO attach → required records |
| `POST /api/v1/domains/:id/verify` | BYO re-check / cert poll kick |
| `POST /api/v1/domains/:id/renew` · `/auto-renew` | manual renew · toggle |
| `POST /api/v1/domains/:id/primary` | set primary |
| `POST /api/v1/domains/:id/transfer-unlock` | unlock + return auth code (60-day lock surfaced) |
| `DELETE /api/v1/domains/:id` | detach from project (never releases the registration) |

All authed + ownership-guarded (existing guard infra); envelope idiom; typed errors.

## Jobs (packages/jobs + apps/worker)

`domain-purchase` (register→DNS→hostname, per-step idempotent, refund on terminal fail) · `domain-configure` (BYO/cert polling with backoff) · `domain-renewals` (repeatable daily) · `domain-sync` (repeatable weekly reconcile).

## Provider port (modules/domains)

`DomainProvider`: `checkAvailability(names[])`, `getWholesalePrice(tld)`, `register(name, registrant, {privacy, years})`, `renew(name, years)`, `setDnsRecords(name, records[])`, `setUrlForwarding(name, target)`, `getAuthCode(name)`, `setTransferLock(name, bool)`, `getDomainInfo(name)`. `OpenproviderProvider` implements it (bearer token from username/password login, sandbox vs live via env). Explicit `@Inject` per repo DI convention. Cloudflare custom-hostname client is a thin separate service (`CustomHostnameService`) — it's serving infra, not registrar logic.

Env (packages/env server): `OPENPROVIDER_API_URL`, `OPENPROVIDER_USERNAME`, `OPENPROVIDER_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID_WANDIT_APP`. Prod fails loudly when missing; dev boots without (provider throws on use) — billing convention.

## UI (phase 2 — Settings tab, Domains section)

- **Buy modal:** search box → per-TLD availability list with credit prices → registrant form (prefilled) → confirm burn (price tag; insufficient-credits reuses the blocking modal) → progress states (`registering → configuring → live`) with polling → live URL.
- **Connect-your-own flow:** domain input → records table with copy buttons → "Verify" with status → live.
- **Domain list:** status chips, primary radio, auto-renew toggle, expiry + renewal price, renew-now, transfer-out (auth code reveal + 60-day note), detach.
- **Publish upsell:** after a successful publish to the slug, one-line "Connect a custom domain →" pointing here.

## Does not own

- Credit ledger mechanics and top-ups (→ credits.md / billing.md — this feature only writes consume/grant rows through `CreditsService`).
- The publish pipeline itself (→ publishing-serving.md; we add the domain-KV refresh touchpoint and the edge worker's custom-hostname branch in coordination with it).
- `.dz`, IDN/Arabic domains, transfers-in, email notifications, Entri auto-DNS, subdomain management under custom domains — all later.

## Open questions

- TLD launch set + credit prices + FX buffer % (catalog placeholders; Zack tunes — suggest `.com .net .shop .store .online .site`, first-year promo TLDs are attractive for the COD audience).
- Apex handling at Openprovider: URL forwarding vs A-record fallback — verify in sandbox during issue 2.
- Exact `.com` member price (panel check during ops bootstrap) → sets the `.com` credit price.
- IDN (Arabic) domain support — revisit with market feedback.

## Issue breakdown

### 1. Ops bootstrap — accounts, funding, catalog

Zack-led checklist with agent support: Openprovider free signup + KYC from Algeria; verify real panel prices (.com reg/renew); fund balance (≥$20; Wise/Payoneer/bank transfer); decide Basic S timing; enable Cloudflare for SaaS on the `wandit.app` zone + set fallback origin `customers.wandit.app` (Workers custom domain on `apps/edge`); pick TLD launch set + credit prices into the contracts catalog; env vars in all environments (sandbox + live).

**Acceptance criteria**
- Sandbox and live API credentials work (auth login returns a token) and are in env schemas.
- CF for SaaS active: fallback origin healthy, a test custom hostname can be created via API.
- Catalog committed with real wholesale numbers + ceilings; Algeria funding path documented (what worked).

### 2. Domain purchase & lifecycle infrastructure (DB → provider port → API → jobs → serving)

The whole backend module against the **sandbox**: `domains` table + migration; contracts (search/purchase/BYO/lifecycle routes + catalog); `modules/domains` (provider port, Openprovider impl, `CustomHostnameService`, endpoints, ownership guards, rate-limited search); credits integration (atomic consume, idempotency, compensating refund); the four worker jobs; edge-worker custom-hostname branch (`domain:{host}` KV) + publish-pipeline KV refresh touchpoint; transfer-out + renewal endpoints.

**Acceptance criteria**
- Sandbox e2e: search → purchase burns the catalog price → sandbox registration succeeds → DNS records + CF custom hostname created → KV routed → page served when requesting the edge worker with the custom Host (curl) — then one real cheap-TLD live smoke test.
- Forced registration failure → `failed` + compensating grant (net 0), visible in ledger; job retries never double-register or double-charge (idempotency proven by test).
- Renewals: dry-run renews a sandbox domain expiring ≤30d, burns renewal credits, bumps `expires_at`; insufficient balance leaves the domain untouched with a recorded notice.
- BYO: attach → records returned → after pointing a test domain, verify flips it `active` and it serves.
- Premium/over-ceiling names are rejected before any credit consumption.

### 3. Domains UI (Settings section + buy modal + BYO connect)

Phase 2, after the module: everything in the UI section above, `apps/web/src/features/domains/**` per frontend structure (api/dto+queries+mutations, lib, components), wired to the v1 contracts with TanStack Query polling during transitional statuses.

**Acceptance criteria**
- Full buy flow from Settings against sandbox: search → prices in credits → registrant form → confirm → live status progression without manual refresh.
- Insufficient credits shows the existing blocking modal and sends nothing; premium names show as unavailable.
- BYO flow: records table with copy, verify button transitions to `active`, page loads on the domain.
- Primary domain switch updates every live-URL display (Settings, header, dashboard card).

**Files:** `packages/db/src/schema/domains.ts` · `packages/contracts/src/v1/domains.ts` (+ TLD catalog) · `packages/env/src/server.ts` · `packages/jobs` (queue names/payloads) · `apps/server/src/modules/domains/**` · `apps/worker/src/processors/domain-*.processor.ts` · `apps/edge` (hostname branch) + publish processor touchpoint · `apps/web/src/features/domains/**`.

Source docs: docs/PRD.md §6, docs/features/custom-domains.md, docs/features/publishing-serving.md, docs/features/billing.md
