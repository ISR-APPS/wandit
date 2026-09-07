# Backend-on-behalf research (wandit V2)

Date: 2026-09-03
Author: research agent (Claude)
Scope: how to provision and operate a backend (database, auth, storage, functions, secrets, logs, jobs, email, payments) on behalf of non-technical wandit users.

Rules used in this report:
- Facts come from primary pages fetched on 2026-09-03 unless marked otherwise.
- "UNVERIFIED" marks a claim that I could not confirm from a primary source in this session.
- Repo paths are relative to the worktree root `.claude/worktrees/v2-builder`.
- The web-search budget of this session was exhausted early. All web facts below come from direct page fetches of official docs, pricing pages, and GitHub repos. Pages that returned 404 are listed in section 11.

---

## 1. Short answer

1. Use Supabase as the primary backend provider. One Supabase project per wandit app. Create the project lazily, on the first request that needs a database, auth, storage, or a server function. This is the Lovable Cloud model. Lovable says the Supabase Management API handles "about 90%" of its Supabase interactions (https://supabase.com/customers/lovable).
2. Own the Supabase organizations yourself (platform-owned model). Do not ask users for a Supabase account. Keep the "claim" and "OAuth into the user's own org" flows as later options for technical users.
3. Contact Supabase partnerships for the "Supabase for Platforms" terms before launch. The public list price is USD 0.01344 per hour per running Micro project (about USD 9.8 per month). At 1,000 always-on projects this is about USD 9,800 per month. The platform program advertises "Nano Instances: Scale-to-zero" and custom pricing (https://supabase.com/solutions/ai-builders). Without a deal, pause idle projects with `POST /v1/projects/{ref}/pause` and restore them on demand.
4. Use Supabase Auth in generated apps. It is included in the project, it is configured with one `PATCH /v1/projects/{ref}/config/auth` call, and it does not add a vendor. Keep Better Auth for wandit itself (already in `packages/auth`) and as the auth option for Cloudflare-hosted apps that use Neon. Do not use Clerk for generated apps.
5. Email: one wandit Resend account. Create one Resend domain per tenant with `POST /domains`, then one `sending_access` API key scoped by `domain_id`, and store that key as a Supabase secret in the tenant project. Also set the tenant project's auth SMTP to this domain. Fallback: let the user paste their own Resend key (Lovable connector model).
6. Payments: phase 1 = the user's own Stripe secret key stored as a Supabase secret plus a checkout edge function (Lovable's documented approach). Stripe Connect is a phase 2 option and costs USD 2 per monthly active connected account when the platform sets pricing.
7. Jobs: Supabase Cron (`pg_cron`). Run history comes from `cron.job_run_details`.
8. Dashboard (tables, users, storage, secrets, logs, jobs, functions, SQL editor): build it on the Management API through a server-side proxy. The Supabase Platform Kit (`npx shadcn@latest add @supabase/platform-kit-nextjs`) already ships these panels and is the reference implementation.
9. Keep a provider abstraction (`BackendProvider` interface) so a Neon-backed "database only" tier can be added later. Neon has a claimable-project flow, per-project consumption quotas, scale-to-zero, and an "Agent Plan" that is marked "Coming Soon".

---

## 2. Repo context (what exists today)

Facts from the worktree:

- Monorepo `wandit`, pnpm 11.7.0, turbo. `package.json:1-40`.
- wandit's own auth is Better Auth: `packages/auth/package.json` depends on `better-auth`; `apps/server/package.json` also depends on `better-auth`.
- wandit's own database is Postgres with Drizzle: `packages/db/package.json` depends on `drizzle-orm` and `pg`.
- Background jobs for the wandit pipeline use Trigger.dev: `apps/server/package.json` depends on `@trigger.dev/sdk` 4.5.3; `packages/jobs/src/index.ts` exists.
- Email uses Resend (`resend` ^6.18.1) and payments use Stripe (`stripe` ^20.4.1) in `apps/server/package.json`.
- Analytics uses PostHog: `packages/analytics/package.json` depends on `posthog-js` and `posthog-node`.
- The edge serving stack is a Cloudflare Worker: `apps/edge/wrangler.jsonc` binds a KV namespace `PTR` (domain pointers) and an R2 bucket `SITES` (published HTML), and routes `*/*` on zone `wandit.app`. It also handles Cloudflare-for-SaaS custom hostnames (comment block in `apps/edge/wrangler.jsonc`, route section).
- The server already has modules for `leads`, `orders`, `domains`, `storage`, `uploads`, `billing`, `credits`, `metering`, `mcp-connectors`, `email` (`apps/server/src/modules/`).
- Product framing: "Lovable x Lovart, focused on e-com", COD landing pages, leads tab (`docs/PRD.md:10`, `docs/PRD.md:33`).

Consequences for V2:
- wandit already runs Postgres + Better Auth + Resend + Stripe + Trigger.dev + PostHog + Cloudflare. V2 adds a per-user backend provider. It does not replace the wandit control plane.
- The Cloudflare edge worker can keep serving published web apps. The generated app talks to its own Supabase project from the browser (supabase-js) and from edge functions.

---

## 3. Part A: Supabase

### 3.1 Management API basics

Source: https://supabase.com/docs/reference/api/introduction

- Base URL: `https://api.supabase.com/v1/`.
- Auth: `Authorization: Bearer <token>`. Two token types:
  - Personal Access Token (PAT). A PAT "carries the same privileges as your user account".
  - OAuth2 tokens for third-party apps, with scopes.
- Rate limits (per user, per project or organization):
  - Standard: 120 requests per minute.
  - Analytics endpoints (`logs.all`, `usage.api-counts`, `usage.api-requests-count`): 30 requests per minute.
  - "Database context": 10 requests per minute, plus 1 request per second burst.
  - Custom hostname and vanity subdomain: 10 requests per minute.
  - Database migrations: 120 requests per 3 minutes.
  - Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Endpoint groups: Projects, Organizations, Database, Auth, Secrets, Edge Functions, Storage, Analytics (Logs), Environments (Branches), Domains, Billing, Realtime, REST, Workers, Webhooks.

OpenAPI spec: `https://api.supabase.com/api/v1-json`. The spec lists these OAuth scopes: `projects:read`, `projects:write`, `organizations:read`, `database:read`, `database:write`, `secrets:read`, `secrets:write`, `api-keys:read`, `api-keys:write`, `environment:read`, `environment:write`, `rest:read`, `rest:write`, `auth:read`, `auth:write`, `domains:read`, `domains:write`. The reference pages also name `edge_functions:write`, `storage:read`, and `analytics:read` scopes (see 3.2).

Rate-limit consequence for a platform: if wandit uses one PAT (one user) for all tenant projects, the limit is 120 requests per minute per project. Project creation and per-project reads scale per project. Org-level calls (list projects, create project) share one org bucket. Put every Management API call behind a queue with per-project and per-org token buckets, and retry on 429 with `X-RateLimit-Reset`.

JS client: `supabase-management-js` (community, https://github.com/supabase-community/supabase-management-js). Construct with `new SupabaseManagementAPI({ accessToken })`. The README says the Management API is in beta. The repo is small (20 stars). Prefer generating a typed client from the OpenAPI spec (the Platform Kit does this: `createClient<paths>({ baseUrl: '/api/supabase-proxy' })`, https://raw.githubusercontent.com/supabase/supabase/master/apps/ui-library/registry/default/platform/platform-kit-nextjs/lib/management-api.ts).

### 3.2 Endpoint map by need

| Need | Endpoint | Notes | Source |
|---|---|---|---|
| Create organization | `POST /v1/organizations` body `{ name }` | Permission `organizations_create`. No plan or billing field documented. | https://supabase.com/docs/reference/api/v1-create-an-organization |
| List regions | `GET /v1/projects/available-regions` | Listed in the OpenAPI spec. Reference page 404 (see 11). | https://api.supabase.com/api/v1-json |
| Create project | `POST /v1/projects` body `{ name, organization_slug, db_pass, region?, desired_instance_size?, template_url?, postgres_engine?, release_channel? }` | Response has `id`, `ref`, `organization_id`, `organization_slug`, `name`, `region`, `created_at`, `status` (example `INACTIVE`). `plan` body field is deprecated; the plan is per organization. | https://supabase.com/docs/reference/api/v1-create-a-project |
| Poll project | `GET /v1/projects/{ref}` | Fields: `status`, `database.host`, `database.version`, `database.postgres_engine`, `database.release_channel`. Status values seen in docs navigation: `ACTIVE_HEALTHY`, `COMING_UP`, `INACTIVE`, `PAUSING`, `RESTORING` (full enum not on the page). | https://supabase.com/docs/reference/api/v1-get-project |
| Health | `GET /v1/projects/{ref}/health` | In spec. | https://api.supabase.com/api/v1-json |
| Get API keys | `GET /v1/projects/{ref}/api-keys?reveal=true` | Scope `secrets:read`, permission `api_gateway_keys_read`. Returns array with `api_key`, `id`, `type` (for example `legacy`), `name`, `prefix`. Create/update/delete key endpoints exist. | https://supabase.com/docs/reference/api/v1-get-project-api-keys |
| Run SQL | `POST /v1/projects/{ref}/database/query` body `{ query, parameters?, read_only? }` | Marked Beta. Scope `database:write` or permission `database_read`/`database_write`. 201 on success. This is the "SQL editor" and "table browser" primitive. | https://supabase.com/docs/reference/api/v1-run-a-query |
| Auth settings | `PATCH /v1/projects/{ref}/config/auth` | Scope `auth:write`. Fields include `site_url`, `uri_allow_list`, `disable_signup`, `jwt_exp`, `smtp_host/port/user/pass`, `smtp_admin_email`, `smtp_sender_name`, `smtp_max_frequency`, mailer templates, `external_<provider>_enabled/_client_id/_secret` for Google, GitHub, Discord, Facebook, Apple, Azure, GitLab, Slack, LinkedIn OIDC, Notion, Zoom, and more; MFA/WebAuthn options. Also signing keys and third-party auth endpoints under `/config/auth/...`. | https://supabase.com/docs/reference/api/v1-update-auth-service-config ; https://api.supabase.com/api/v1-json |
| Storage buckets (read) | `GET /v1/projects/{ref}/storage/buckets` | Scope `storage:read`. Returns `id`, `name`, `owner`, `public`, timestamps. Storage config get/update endpoints also exist. | https://supabase.com/docs/reference/api/v1-list-all-buckets |
| Storage buckets (create) | Use the project's Storage API, not the Management API: `supabase.storage.createBucket('avatars', { public, allowedMimeTypes, fileSizeLimit })` with the service role key, or SQL `insert into storage.buckets (id, name, public) values (...)`. | The SQL form can run through `database/query`. | https://supabase.com/docs/guides/storage/buckets/creating-buckets |
| Edge functions deploy | `POST /v1/projects/{ref}/functions/deploy?slug=...&bundleOnly=...` multipart with `file[]` and `metadata` | Scope `edge_functions:write`. Creates the function if missing. Related: `GET /v1/projects/{ref}/functions`, `GET /v1/projects/{ref}/functions/{id}/body`, `POST /v1/projects/{ref}/functions`. | https://supabase.com/docs/reference/api/v1-deploy-a-function |
| Secrets | `POST /v1/projects/{ref}/secrets` (bulk create, array body), `GET /v1/projects/{ref}/secrets` (list), `DELETE /v1/projects/{ref}/secrets` (bulk delete) | Scope `secrets:write`, permission `edge_functions_secrets_write`. Whether values are readable after creation is not stated on the page. Treat secrets as write-only in the UI. Edge functions get `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS` by default (legacy: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Secrets apply without redeploy. | https://supabase.com/docs/reference/api/v1-bulk-create-secrets ; https://supabase.com/docs/guides/functions/secrets |
| Logs | `GET /v1/projects/{ref}/analytics/endpoints/logs` (the intro page calls this `logs.all`) query `sql`, `iso_timestamp_start`, `iso_timestamp_end` | Scope `analytics:read`. ClickHouse SQL dialect. Time range at most 24 hours, rounded to the minute; default is the last minute. Sources include `edge_logs`, `postgres_logs`, `function_edge_logs`, `auth_logs`. Rate limit 30 per minute. Retention by plan: Free 1 day, Pro 7 days, Team 28 days, Enterprise 90 days. | https://supabase.com/docs/reference/api/v1-get-project-logs ; https://supabase.com/pricing |
| Branches | `GET/POST/DELETE /v1/projects/{ref}/branches`, `GET/PATCH/DELETE /v1/branches/{id}`, `POST /v1/branches/{id}/push|merge|reset|restore`, `GET /v1/branches/{id}/diff` | Branching works without GitHub ("directly through the dashboard (currently in beta)"). Preview branches are ephemeral; persistent branches are long-lived. A branch on Micro costs from USD 0.01344 per hour; branch usage counts against the org quota; no spend-cap protection. | https://supabase.com/docs/guides/deployment/branching ; https://supabase.com/docs/guides/platform/manage-your-usage/branching ; https://api.supabase.com/api/v1-json |
| Pause / restore | `POST /v1/projects/{ref}/pause`, `POST /v1/projects/{ref}/restore`, `POST /v1/projects/{ref}/restore/cancel`, `GET /v1/projects/{ref}/restore` | Scope `projects:write`. Returns `{}`. | https://supabase.com/docs/reference/api/v1-pause-a-project ; https://supabase.com/docs/reference/api/v1-restore-a-project |
| Project claim | `GET /v1/projects/{ref}/claim-token`, `GET /v1/oauth/authorize/project-claim` | The spec says: "initiates the OAuth authorization flow ... After successful authentication, the user can claim ownership of the specified project." Permissions `organization_admin_write`, `project_admin_write`. This is the flow for "platform creates project, user later claims it into their own Supabase org". The guide page returned 404 (UNVERIFIED details such as expiry and billing hand-off). | https://api.supabase.com/api/v1-json |
| Users (admin) | GoTrue admin API through `supabase.auth.admin.listUsers({ page, perPage })` with the service role key; also `createUser`, `deleteUser`, `getUserById`, `updateUserById`, `inviteUserByEmail`. Or SQL on `auth.users` through `database/query`. | Server-side only. | https://supabase.com/docs/reference/javascript/auth-admin-listusers |
| Cron jobs | SQL on `cron.job` and `cron.job_run_details` through `database/query`; schedule with `cron.schedule(...)`. | Supabase Cron is `pg_cron`. Intervals from every second to once a year. Recommendation: no more than 8 concurrent jobs, 10 minutes max per job. Jobs can call edge functions over HTTP. | https://supabase.com/docs/guides/cron |
| Add-ons | `GET/PATCH /v1/projects/{ref}/billing/addons`, `DELETE .../addons/{addon_variant}` | Compute size, PITR, custom domain. | https://api.supabase.com/api/v1-json |
| Custom hostname | `/v1/projects/{ref}/custom-hostname/*` | 10 requests per minute. USD 10 per domain per month per project (only needed if the API host must be branded). | https://supabase.com/pricing |

Note on "database context" endpoints: the intro page lists a 10 requests per minute limit for "Database context". I did not find the reference page for this endpoint group in this session. Treat it as UNVERIFIED which paths it covers.

### 3.3 Ownership models

Three ways to run Supabase on behalf of users. All three are used in production by AI builders.

1. Platform-owned (Lovable Cloud). wandit owns the organizations and pays Supabase. Users never see Supabase. Lovable's docs: "There is no automatic migration between the built-in backend (Cloud) and your own Supabase project, in either direction" (https://docs.lovable.dev/integrations/supabase.md). Lovable Cloud "utilizes Supabase's open-source foundation" (https://docs.lovable.dev/features/cloud).
2. OAuth into the user's org (Bolt, Lovable "own Supabase"). Register an OAuth app under an organization's OAuth Apps tab. Redirect to `https://api.supabase.com/v1/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `state`, and PKCE (`code_challenge`, `code_challenge_method=S256`). Exchange at `POST https://api.supabase.com/v1/oauth/token` with `grant_type=authorization_code` and basic auth `client_id:client_secret`. Refresh with the same endpoint. The token can create projects, read API keys, and set auth config. Limit stated in docs: "Only some features are available until we roll out fine-grained access control. If you need full database access, you will need to prompt the user for their database password." (https://supabase.com/docs/guides/integrations/build-a-supabase-integration). Bolt uses this flow; Supabase project creation from Bolt "requires a paid plan" on Bolt (https://support.bolt.new/integrations/supabase).
3. Create then claim. The platform creates the project in its own org, then hands the user a claim flow (`GET /v1/projects/{ref}/claim-token`, `GET /v1/oauth/authorize/project-claim`). Bolt documents "claim existing Bolt databases in Supabase" (https://support.bolt.new/integrations/supabase). Lovable Payments uses the same idea with Stripe: "Lovable creates a new empty sandbox environment" that the user claims (https://docs.lovable.dev/features/payments.md). UNVERIFIED: the exact Supabase claim guide (page 404).

Recommendation: model 1 for all users. Add model 3 later as "Export to your own Supabase". Model 2 is for technical users only and can come last.

### 3.4 "Supabase for Platforms"

Source: https://supabase.com/solutions/ai-builders

- Offer: "Management API: Programmatically provision Supabase backends for customers at scale", "OAuth Integration", "Development Branching", "Platform Kit: Embedded UI components", "Nano Instances: Scale-to-zero infrastructure for cost efficiency".
- Named partners with testimonials: Lovable, Bolt.new, v0 by Vercel, Tempo.
- Access: contact the partnerships team through the form. "Explore custom pricing". No self-serve application.
- The Nano scale-to-zero instance is the key commercial difference from list pricing. On the public Pro plan, "New projects cannot launch on Nano" and Nano is billed at Micro price (https://supabase.com/docs/guides/platform/manage-your-usage/compute).

Action: send the partnerships form before building. Ask for: Nano scale-to-zero, per-project pricing at 1k/10k projects, a higher project cap per org, Management API rate-limit lift, and log retention.

### 3.5 Pricing at platform scale (public list prices)

Sources: https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/billing-on-supabase ; https://supabase.com/docs/guides/platform/manage-your-usage/compute

Plans (per organization):
- Free: USD 0. "2 free active projects per account". "Free projects are paused after 1 week of inactivity". 500 MB database per project, 50,000 MAU, 1 GB file storage, 5 GB egress, 500,000 edge function invocations, 1 day log retention.
- Pro: "from USD 25/month". USD 10 compute credits per month per organization. 100,000 MAU then USD 0.00325 per MAU. 8 GB database per project then USD 0.125 per GB. 100 GB file storage then USD 0.0213 per GB. 250 GB egress then USD 0.09 per GB. 2 million edge invocations then USD 2 per million. 5 million realtime messages then USD 2.50 per million. 7 days daily backups, 7 days log retention.
- Team: from USD 599/month. 28 days log retention. Enterprise: custom.
- Third-party MAU (Clerk, Firebase Auth, Auth0, Cognito): 100,000 included on Pro, then USD 0.00325 per MAU. SSO MAU: 50 included, then USD 0.015.
- PITR: USD 100 per month per 7 days retention. Custom domain: USD 10 per domain per month per project.

Compute:
- Every running project bills compute per hour, rounded up. Micro = USD 0.01344 per hour (about USD 10 per month). Small USD 15, Medium USD 60, Large USD 110, XL USD 210, 2XL USD 410, 4XL USD 960, 8XL USD 1,870, 12XL USD 2,800, 16XL USD 3,730 per month.
- USD 10 credits per org per month cover one Micro. Credits do not roll over and do not cover branches or read replicas.
- "Paused projects do not count towards Compute usage." Deleted projects stop billing.
- Usage quotas (MAU, storage, egress, invocations) are summed per organization, not per project.

Cost model (list prices, one Pro org):

| Tenant projects | Always-on Micro cost per month | With 70 percent paused |
|---|---|---|
| 100 | about USD 981 + 25 base - 10 credit = about USD 996 | about USD 309 |
| 1,000 | about USD 9,810 + 25 - 10 = about USD 9,825 | about USD 2,960 |
| 10,000 | about USD 98,100 | about USD 29,450 |

(730 hours per month x USD 0.01344 = USD 9.81 per project.) These numbers exclude storage, egress, and MAU overage. They show why a platform deal with Nano scale-to-zero or an aggressive pause policy is required. Lovable itself pauses backends: "apps that rely on the built-in backend (Cloud) can pause until credits are added" (https://docs.lovable.dev/features/project-usage.md), and scheduled jobs "prevent automatic project pausing" (https://docs.lovable.dev/features/jobs.md).

Free plan for tenants: not usable for a platform. Two active projects per account, and pausing after 1 week. Do not build the tenant tier on many free accounts; this breaks Supabase's terms in spirit and is operationally fragile (UNVERIFIED as a terms-of-service statement; the limit itself is verified).

Per-org project caps on paid plans: not published on the fetched pages. UNVERIFIED. Ask partnerships.

Restore window: a paused project can be restored from Studio within 1 year; after that, only backup downloads (https://supabase.com/docs/guides/platform/upgrading#paused-projects). The `restore` endpoint exists in the API.

### 3.6 Regions and data residency

Source: https://supabase.com/docs/guides/platform/regions

- General regions (may land in any AWS region in the area): East US, Central EU, Southeast Asia. General regions do not support read replicas or API management.
- Specific regions: `us-west-1`, `us-west-2`, `us-east-1`, `us-east-2`, `ca-central-1`, `eu-west-1`, `eu-west-2`, `eu-west-3` (Paris), `eu-central-1`, `eu-central-2`, `eu-north-1`, `ap-south-1`, `ap-southeast-1`, `ap-southeast-2`, `ap-northeast-1`, `ap-northeast-2`, `sa-east-1`.
- The region sets where primary data lives. For compliance, choose a specific region. No Africa or Middle East region is listed. For wandit's Morocco and France users, `eu-west-3` (Paris) or `eu-west-1` (Ireland) are the nearest listed regions.
- Region migration is not described on the fetched page (UNVERIFIED whether an in-place move exists).

### 3.7 Building a Lovable Cloud style dashboard

Lovable's panels and what each shows (https://docs.lovable.dev/features/cloud ; database.md ; logs.md ; jobs.md ; secrets.md):
- Database: tables with row counts, inline edit, add row, filter, paginate 10 to 100 rows, CSV export, SQL editor with autocomplete and confirmation before destructive statements, read-only RLS policy view, daily backups with about 14 days retained.
- Users: manage app users, configure sign-in methods (email, phone, Google, Apple, Microsoft, SAML SSO).
- Storage: buckets, files, public access.
- Edge Functions: list, invocations, success rate, logs.
- Secrets: write-only key values; distinct from `VITE_` public variables.
- Jobs: list with enable/disable, run history (start, end, status Succeeded/Failed/Running), refresh button; created through chat or SQL.
- Logs: functions, database, auth, storage, realtime, PostgREST, pooler; text search; relative ranges from 15 minutes to 5 days; JSON export; paste a log line into chat to fix.
- Emails and Payments: see Part D.

Data source per panel (all through a server-side proxy that holds the platform token; never expose the Management token or the service role key to the browser):

| Panel | Call | Notes |
|---|---|---|
| Table list with row counts | `POST /database/query` with `select schemaname, relname, n_live_tup from pg_stat_user_tables where schemaname='public'` | `n_live_tup` is an estimate. Use `select count(*)` per table on demand for exact counts. |
| Table rows, edit, add, delete | `POST /database/query` with parameterized SQL (`parameters` array) | Set `read_only: true` for browse. Build per-table CRUD in the proxy; validate table and column names against `information_schema.columns`. |
| SQL editor | `POST /database/query` | Rate limit is 120 per minute per project. Show a confirmation for DDL and DELETE, as Lovable does. |
| RLS policies | `POST /database/query` on `pg_policies` | Read-only view. |
| Users | `auth.admin.listUsers` with service role key (server-side), or SQL on `auth.users` (`id, email, created_at, last_sign_in_at, raw_app_meta_data->>'provider'`) | Signups per day: `select date_trunc('day', created_at), count(*) from auth.users group by 1`. |
| Sign-in methods | `GET/PATCH /config/auth` | Toggle `external_google_enabled` and set client id and secret. |
| Storage | `GET /storage/buckets` for the list; the project Storage API (service role) for objects | Bucket create via Storage API or SQL. |
| Edge functions | `GET /functions`, `GET /functions/{id}/body` | Invocations and errors from `function_edge_logs` through the logs endpoint. |
| Secrets | `GET /secrets` (names), `POST /secrets`, `DELETE /secrets` | Do not display values. |
| Logs | `GET /analytics/endpoints/logs` with ClickHouse SQL, 24-hour windows | For a 5-day view, page in 24-hour windows. Retention: 7 days on Pro. |
| Jobs | SQL on `cron.job`, `cron.job_run_details`; `cron.schedule`, `cron.unschedule`, `cron.alter_job(active := false)` | Enable/disable maps to `active`. |
| Backups | Dashboard-only on the fetched pages. UNVERIFIED whether a Management API backup-restore endpoint exists for this use. | Lovable exposes restore; likely uses PITR or daily backups behind the scenes. |

Shortcut: Supabase Platform Kit (https://supabase.com/ui/docs/platform/platform-kit). "A collection of customizable API's, hooks and components" for "anyone who is providing Postgres databases to their users". Panels: database, auth, storage, users, secrets, logs and performance, optional AI SQL generation. Install: `npx shadcn@latest add @supabase/platform-kit-nextjs`. Main component: `SupabaseManagerDialog` with a `projectRef`. It talks to `/api/supabase-proxy/[...path]` and the proxy holds `SUPABASE_MANAGEMENT_API_TOKEN`. wandit's web app is not Next.js (UNVERIFIED which framework `apps/web` uses; not inspected), so port the hooks rather than install the kit as is.

### 3.8 Hardening each tenant project at creation

- Auth email: the default SMTP sends 2 messages per hour and only to team members; production needs custom SMTP. With custom SMTP the default becomes 30 per hour and is adjustable (https://supabase.com/docs/guides/auth/auth-smtp). Set SMTP through `PATCH /config/auth` with `external_email_enabled`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_admin_email`, `smtp_sender_name`.
- RLS on all tables. "Tables that do not have RLS enabled with reasonable policies allow any client to access and modify their data" (https://supabase.com/docs/guides/platform/going-into-prod). The agent must run advisors after migrations. The hosted Supabase MCP exposes "debugging/advisors" tools (https://supabase.com/docs/guides/getting-started/mcp).
- Auth rate limits and CAPTCHA on signup, sign-in, and password reset. Email confirmations on. OTP expiry 3600 seconds or lower.
- Set `site_url` and `uri_allow_list` to the wandit preview and published domains.
- Store the `db_pass` encrypted in wandit's database. The OAuth model needs it for "full database access"; the platform-owned model needs it for direct connections and migrations.

### 3.9 Supabase MCP for the coding harness

Source: https://supabase.com/docs/guides/getting-started/mcp

- Hosted server: `https://mcp.supabase.com/mcp`. Auth by dynamic client registration by default; PAT for CI; manual OAuth apps.
- Tool groups: account, database, docs, debugging (advisors), development, functions, branching (experimental), storage (off by default).
- Modes: read-only (queries run as a read-only Postgres user) and project-scoped (account-level tools disabled).
- Security guidance: do not connect to production, use branches, enable manual tool approval, limit tool groups, prompt injection is the main risk.

For wandit V2, the Claude Code harness inside the sandbox can get a project-scoped Supabase MCP config for the tenant project (PAT scoped by wandit's proxy, or a short-lived token). This gives the agent `apply_migration`, `execute_sql`, `deploy_edge_function`, and advisors without wandit writing those tools by hand. UNVERIFIED: exact tool names in the current hosted server.

---

## 4. Part B: Alternatives

### 4.1 Neon (Lakebase Postgres)

Sources: https://neon.com/docs/introduction/plans ; https://neon.com/pricing ; https://neon.com/docs/workflows/claimable-database-integration ; https://neon.com/auth.md ; https://neon.com/use-cases/ai-agents ; https://api-docs.neon.tech/reference/createproject ; https://neon.com/docs/guides/partner-billing ; https://neon.com/docs/neon-auth/overview ; https://neon.com/docs/data-api/get-started ; https://neon.com/docs/introduction/regions

- Model: project per user, created with `POST https://console.neon.tech/api/v2/projects`. Body includes `project.name`, `region_id` (for example `aws-us-east-2`), `pg_version` (14 to 19, default 18), `org_id`, `settings.quota` (`active_time_seconds`, `compute_time_seconds`, `written_data_bytes`, `data_transfer_bytes`, `logical_size_bytes`), `default_endpoint_settings` (`autoscaling_limit_min_cu` >= 0.25, `autoscaling_limit_max_cu`, `suspend_timeout_seconds`). Response includes `connection_uris[]` with host, pooler host, database, role, password.
- Quotas: when a quota is met "all active computes for that project are suspended" until the next billing period. Example tiers in docs: Trial 633,600 s active time, about 1 GB storage; Pro 2,592,000 s active time, about 50 GB storage.
- Claimable databases: create project, `POST /projects/{id}/transfer_requests` (TTL default 86,400 s, max 604,800 s, one-time use), share `https://console.neon.tech/app/claim?p=...&tr=...&ru=...`. Private preview. Agent-native variant ("Claimable Neon", `neon.com/auth.md`): register at `/v1/agent/identity`, get an `identity_assertion`, exchange at `/v1/oauth2/token`, credentials at `/v1/projects/{id}/credentials`, claim at `/v1/projects/{id}/claim`; unclaimed projects expire in 72 hours.
- Plans: Free (100 projects, 0.5 GB and 100 CU-hours per project, 10 branches), Launch (pay as you go, USD 0.106 per CU-hour, USD 0.35 per GB-month, 100 projects, scale to zero after 5 minutes), Scale (USD 0.222 per CU-hour, 1,000 projects soft limit, configurable scale-to-zero from 1 minute to always on), Agent Plan "Coming Soon": "Unlimited projects, Launch-rate compute, and credits for your free tier". Extra branches USD 1.50 per branch-month. Egress 500 GB per project included then USD 0.10 per GB.
- Idle cost: a scaled-to-zero project costs only storage. An always-on 0.25 CU project on Launch costs 0.25 x 730 x 0.106 = about USD 19.3 per month; at scale-to-zero the compute cost is near zero for idle apps.
- Extras: Neon Auth is "powered by Better Auth" (v1.4.18), stores users in `neon_auth` schema, included up to 60,000 MAU on Free and 1M on Launch/Scale, enabled by `neon neon-auth enable`, console, or the MCP `provision_neon_auth` tool. Data API is PostgREST-compatible with RLS through `auth.user_id()`, enabled per branch by console, CLI `neon data-api create`, API, or MCP. The AI-agents page lists "Lakebase Postgres, Managed Better Auth, Data API, Object Storage, Functions, and AI Gateway".
- Users: Replit, Retool ("over 300,000 Postgres instances on Neon with a single engineer"), Anything, Databutton, Vapi, Dyad, xpander.ai. v0's use of Neon: UNVERIFIED (v0 appears on Supabase's AI-builders page instead).
- Regions: `aws-us-east-1`, `aws-us-east-2`, `aws-us-west-2`, `aws-eu-central-1`, `aws-eu-west-2`, `aws-ap-southeast-1`, `aws-ap-southeast-2`, `aws-sa-east-1`. Azure regions are deprecated for new projects.
- Fit: best cost profile for thousands of mostly idle databases. Weaker than Supabase on the bundled auth, storage, functions, and logs surface. Data API limits: not with IP Allow or Private Networking; one database per branch; schema cache refresh needed.

### 4.2 Convex

Sources: https://docs.convex.dev/platform-apis ; https://docs.convex.dev/platform-apis/oauth-applications ; https://www.convex.dev/pricing ; https://docs.convex.dev/production/state/limits

- Platform APIs: create projects, deployments, and deploy keys on behalf of users. "Most often used by AI app builders" (Bloom, A0, Macaly). Team-scoped tokens or OAuth 2.0 apps. OAuth authorize URLs `https://dashboard.convex.dev/oauth/authorize/team` or `/project`; token at `https://api.convex.dev/oauth/token`; unverified apps can authorize up to 100 teams. Token rights follow the authorizing member.
- Pricing: Free/Starter USD 0 with 1M function calls, 0.5 GB DB, 1 GB files; Professional USD 25 per developer per month with 25M calls, 50 GB DB; Business USD 2,500 per month minimum. Deployment caps: 40 per team on Free/Starter, 300 on Professional, unlimited on Business.
- Fit: strong reactive backend and TypeScript functions, but a proprietary data model (not Postgres), platform-owned projects need the Business tier for unlimited deployments, and it does not match the "Supabase-like" dashboard expectations. Not recommended as primary.

### 4.3 Turso

Sources: https://turso.tech/pricing ; https://docs.turso.tech/api-reference/databases/create ; https://docs.turso.tech/api-reference/tokens/create

- Platform API: `POST /v1/organizations/{organizationSlug}/databases` with `name`, `group` (must exist), optional `seed`, `size_limit`, `remote_encryption`. API tokens: `POST /v1/auth/api-tokens/{tokenName}` scoped to org or group with scopes `db:create`, `db:delete`, `db:configure`, `db:mint-token`, `db:rotate-creds`; token "is never revealed again".
- Pricing: Free 100 databases, 5 GB, 500M rows read; Developer USD 4.99 per month unlimited databases, 9 GB; Scaler USD 24.92 per month unlimited databases, 24 GB; Pro USD 416.58 per month.
- Fit: cheapest "database per tenant" at scale (SQLite/libSQL). No bundled auth, storage, or functions. Good for a Cloudflare-hosted app tier. Requires the generated app to use libSQL clients, not Postgres.

### 4.4 PlanetScale

Source: https://planetscale.com/pricing

- No free tier on the pricing page. Postgres single node PS-5 at USD 5 per month; HA PS-5 at USD 15 per month; Metal M-10 from USD 50 per month. Pricing is per cluster, not per database. A provisioning API exists in PlanetScale's docs (UNVERIFIED in this session).
- Fit: too expensive per tenant (minimum USD 5 per cluster) and no bundled services. Not recommended.

### 4.5 Cloudflare D1 + Durable Objects + Workers for Platforms

Sources: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/ ; .../platform/pricing/ ; .../configuration/bindings/ ; https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/ ; https://developers.cloudflare.com/durable-objects/platform/pricing/ ; https://github.com/cloudflare/vibesdk

- Workers for Platforms: USD 25 per month, 20M requests and 60M CPU-ms included, 1,000 scripts included then USD 0.02 per script. Dispatch namespaces isolate each user Worker; bindings (KV, D1, R2, Durable Objects) are set in the `metadata` of the multipart upload; `keep_bindings` preserves existing ones. Custom hostnames supported. Per-customer limits on CPU and subrequests.
- D1: create with `POST /accounts/{account_id}/d1/database` (`name`, `primary_location_hint` in `wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`; token needs D1 Write). Limits: 10 databases on Free, 50,000 on Workers Paid (more on request); 500 MB per DB on Free, 10 GB on Paid; 100 columns per table; 30-second query cap; single-threaded per database. Pricing on Paid: first 25 billion rows read per month then USD 0.001 per million; first 50 million rows written then USD 1 per million; 5 GB then USD 0.75 per GB-month. No idle cost.
- Durable Objects SQLite: 1M requests then USD 0.15 per million; 400,000 GB-s then USD 12.50 per million GB-s; storage 5 GB then USD 0.20 per GB-month; same row-read and row-write rates as D1. "SQLite storage billing activates January 2026."
- Cloudflare VibeSDK (MIT): an open-source vibe-coding platform on Cloudflare. Generated apps get "isolated SQLite-backed storage through a Durable Object Facet, with database inspection and reset controls"; previews run as Dynamic Workers; version history in Cloudflare Artifacts; AI Gateway for models.
- Fit: the cheapest and most scalable hosting layer for generated web apps, and wandit already runs on Cloudflare (`apps/edge`). But there is no bundled auth, no user dashboard, and D1 is SQLite (single writer, 10 GB cap). Use it for hosting and static assets now; consider D1 or DO SQLite as a "lite" database tier later with Better Auth in generated code. Cron Triggers for user Workers inside a dispatch namespace: UNVERIFIED.

### 4.6 Firebase

Sources: https://firebase.google.com/docs/projects/api/reference/rest ; https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects

- Firebase Management API adds Firebase to a GCP project (`projects.addFirebase`), creates web/Android/iOS apps, and returns config. GCP project creation needs the Cloud Resource Manager API and is limited by a per-account project quota (`cloudresourcemanager.googleapis.com/projects_count`); the page does not state the default number, only that a warning shows under 30 remaining. Billing account is not required for creation.
- Fit: project-per-tenant on GCP is quota-bound and slow to scale; Firestore is not SQL; generated apps would need Firebase SDKs. Not recommended.

### 4.7 InsForge

Sources: https://docs.insforge.dev ; https://insforge.dev/pricing ; https://github.com/InsForge/InsForge

- "The all-in-one, open-source backend platform for agentic coding". Apache 2.0, 12.8k stars. Postgres with pgvector, auth (OAuth, JWT), S3-compatible storage, Deno edge functions, realtime, sites hosting, container compute, OpenAI-compatible model gateway. MCP server and CLI for Claude Code, Cursor, Windsurf, Codex. Self-host with Docker Compose (`deploy/setup.sh`).
- Pricing mirrors Supabase: Free (50,000 MAU, 500 MB DB, 1 GB storage, 100,000 function calls, pause after 1 week), Pro USD 25 per month with USD 10 compute credits, Nano USD 5 per month up to 16XL USD 2,560 per month, Enterprise with unlimited projects.
- Fit: interesting as a self-hosted multi-tenant option (one wandit-run InsForge cluster, many projects), but there is no documented public "create project on behalf of user" API on the fetched pages (UNVERIFIED). Young ecosystem. Keep as a watch item.

### 4.8 Nhost

Sources: https://nhost.io/pricing ; https://docs.nhost.io/

- Postgres + Hasura GraphQL + Auth + Storage + Functions + Run + Events + AI. Free: 1 project, paused after 1 week of inactivity; Pro from USD 25 per month per organization with USD 15 compute credits, 10 GB DB, 50 GB storage.
- Programmatic project creation: not documented on the fetched pages. UNVERIFIED.
- Fit: GraphQL-first, smaller ecosystem, no verified provisioning API. Not recommended.

### 4.9 PocketBase per tenant

Sources: https://github.com/pocketbase/pocketbase ; https://pockethost.io/pricing

- PocketBase: MIT, single Go binary, embedded SQLite, realtime, files, users, admin UI. One instance per app; no built-in multi-tenancy.
- PocketHost (managed): USD 9.99 per PocketBase per month, 250 MB DB, 10 GB files; no public provisioning API on the pricing page (UNVERIFIED).
- Self-run per-tenant PocketBase on Fly or Railway is possible but wandit would own upgrades, backups, and scaling for every tenant process. Not recommended for a non-technical audience at scale.

### 4.10 What the other AI builders do (for calibration)

- Lovable: Lovable Cloud on Supabase; own Supabase through OAuth; no migration between the two; Cloud has managed payments (Paddle MoR or Stripe sandbox that the user claims), custom emails managed by Lovable with Entri DNS automation, jobs, logs (5-day view), analytics built in.
- Bolt: "Bolt Database" with "unlimited free databases", Supabase through OAuth for paid users, claim Bolt databases into Supabase. Provider behind Bolt Database: UNVERIFIED (page 404).
- Base44: in-house managed backend (entities with JSON Schema, row- and field-level security, native auth with SSO, Deno backend functions with automations, managed OAuth connectors, media). No external DB documented (https://docs.base44.com/llms.txt).
- v0: listed as a Supabase for Platforms partner ("Seamless integration with account creation flows") (https://supabase.com/solutions/ai-builders).
- Cloudflare VibeSDK: DO-facet SQLite per generated app (section 4.5).

### 4.11 Comparison table

| Provider | Provision API | Bundled auth/storage/functions | Idle cost per tenant | Postgres | Dashboard data access | Verdict |
|---|---|---|---|---|---|---|
| Supabase | Yes (Management API, OAuth, claim) | Yes, all | About USD 9.8 per month at list; 0 when paused; Nano scale-to-zero by partnership | Yes | Excellent (SQL, logs, functions, keys) | Primary |
| Neon | Yes (API, claimable, agent identity, quotas) | Auth (Better Auth) and Data API; storage/functions newer | Near 0 (scale to zero) | Yes | SQL only; no logs API seen | Secondary tier |
| Cloudflare D1/DO + WfP | Yes | No | 0 | No (SQLite) | Via Worker | Hosting now; lite DB later |
| Turso | Yes | No | 0 | No (libSQL) | SQL | Niche |
| Convex | Yes (OAuth, team tokens) | Functions, files | 0 on usage; deployment caps | No | Convex API | No |
| InsForge | UNVERIFIED | Yes | 0 when paused (like Supabase) | Yes | Yes (self-host) | Watch |
| Firebase | Yes but quota-bound | Yes | 0 | No | Firebase APIs | No |
| Nhost | UNVERIFIED | Yes | Free tier pauses | Yes | GraphQL | No |
| PlanetScale | UNVERIFIED | No | >= USD 5 | Yes | SQL | No |
| PocketBase | Self-run only | Yes | Process cost | No | Admin API | No |

---

## 5. Part C: Auth for generated apps

Options:

1. Supabase Auth (in the tenant project).
   - Included with the project; 100,000 MAU on Pro then USD 0.00325 per MAU (https://supabase.com/pricing).
   - Configurable by API: providers, SMTP, site URL, redirect allow list, signup on/off, JWT expiry, MFA (https://supabase.com/docs/reference/api/v1-update-auth-service-config).
   - Works with RLS out of the box; the agent writes policies with `auth.uid()`.
   - Expo: supabase-js works in React Native (UNVERIFIED in this session; not fetched). Lovable Cloud offers email, phone, Google, Apple, Microsoft, SAML SSO on this foundation.
   - Cost of abuse: email rate limits and CAPTCHA settings exist (section 3.8).

2. Better Auth in generated code.
   - MIT, "framework-agnostic, universal authentication and authorization framework for TypeScript", plugins for 2FA, passkey, multi-tenancy, SSO (https://www.better-auth.com/docs/introduction ; https://github.com/better-auth/better-auth). Expo plugin `@better-auth/expo` with `expo-secure-store`, deep links, requires Expo SDK 55+ and the New Architecture (https://www.better-auth.com/docs/integrations/expo).
   - Needs a server runtime in the generated app (a Worker, an edge function, or a Node server) and auth tables in the tenant database. The agent must keep this code correct in every app. This is more surface for the harness to break.
   - Best fit: Cloudflare-hosted apps with Neon (Neon Auth is managed Better Auth) or D1.

3. Clerk.
   - Hobby: 50,000 MRU free; Pro USD 25 per month then USD 0.02 per MRU (https://clerk.com/pricing). Expo package `@clerk/expo` with `expo-secure-store` token cache; native components need a dev build (https://clerk.com/docs/expo/getting-started/quickstart).
   - With Supabase: third-party auth through JWKS, configured in the dashboard or `POST /config/auth/third-party-auth`; counts as Third-Party MAU on Supabase (100,000 included on Pro then USD 0.00325) (https://supabase.com/docs/guides/auth/third-party/clerk ; https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party).
   - Needs one Clerk application per tenant app; provisioning Clerk instances by API on behalf of users: UNVERIFIED. Adds a second vendor and a second bill. Not recommended.

Recommendation: Supabase Auth for the Supabase tier. Better Auth for a future Cloudflare-and-Neon tier. No Clerk.

---

## 6. Part D: Email, payments, jobs, analytics

### 6.1 Email on behalf of users (Resend)

Sources: https://resend.com/docs/api-reference/domains/create-domain ; https://resend.com/docs/api-reference/api-keys/create-api-key ; https://resend.com/pricing ; https://docs.lovable.dev/integrations/resend.md ; https://docs.lovable.dev/features/custom-emails.md

- Domains: `POST https://api.resend.com/domains` with `name`, `region` (`us-east-1`, `eu-west-1`, `sa-east-1`, `ap-northeast-1`), `custom_return_path`, tracking options, `tls`, `capabilities`. Response includes DNS records (SPF, DKIM, tracking CNAME) and status `not_started` until verified.
- Keys: `POST https://api.resend.com/api-keys` with `name`, `permission` (`full_access` or `sending_access`), `domain_id` (only with `sending_access`). Returns `token` starting with `re_`. Domain-scoped keys are the documented multi-tenant pattern.
- Plans: Free 3,000 emails per month, 100 per day, 3 domains. Pro USD 20 per month (50,000) or USD 35 (100,000), 10 domains, USD 0.90 per 1,000 overage. Scale USD 90 to USD 1,150 per month, 1,000 domains. Domains add-on USD 20 per month per 100 domains. Dedicated IP USD 30 per month.
- Lovable's two modes: (a) connector where the user pastes their own Resend key (`re_`), billed by Resend, "the connector does not configure DNS or verify domains for you"; (b) Lovable "Custom emails" managed by Lovable: SPF, DKIM, DMARC set automatically through Entri (user authorizes DNS or adds TXT and NS records), auth emails and app emails, 100 emails per hour per workspace, 50,000 emails per month included on paid workspaces, 4 credits per 1,000 overage, not on Free.

Plan for wandit:
1. Default sender: a shared wandit domain (for example `mail.wandit.app`) with a per-tenant `from` name. Zero setup. Rate-limit per tenant.
2. Custom domain: create a Resend domain per tenant; show the DNS records in the wandit UI; wandit already manages domains and Cloudflare-for-SaaS custom hostnames (`apps/server/src/modules/domains`). Poll Resend status.
3. Per-tenant key: `sending_access` key scoped by `domain_id`, stored as a Supabase secret `RESEND_API_KEY` in the tenant project. The generated edge function uses it.
4. Auth emails: `PATCH /config/auth` with Resend SMTP (host and port for Resend SMTP: UNVERIFIED in this session) and the tenant domain.
5. Fallback connector: user pastes their own Resend key.
6. Domain count: 10 on Pro, 1,000 on Scale, USD 20 per extra 100. Budget this in the tenant plan.

Alternative: Cloudflare Email Service. Sending is in Beta, needs Workers Paid, supports Workers bindings, REST, and SMTP (https://developers.cloudflare.com/email-service/). Not yet a fit for per-tenant domains at scale.

### 6.2 Payments

Sources: https://docs.lovable.dev/integrations/stripe ; https://docs.lovable.dev/features/payments.md ; https://stripe.com/connect/pricing ; https://docs.stripe.com/connect

- Lovable Stripe (documented): user's own Stripe Secret Key entered in an "Add API Key" form (not in chat), stored as a secret; Lovable generates checkout edge functions, tables with RLS, UI; webhooks optional (edge-function polling by default); "Stripe integration doesn't work in preview"; test with 4242 card.
- Lovable Payments (newer): "Lovable creates and manages accounts automatically". Paddle as merchant of record at 5.0 percent + 50 cents (10 percent under USD 10); or Stripe where "Lovable creates a new empty sandbox environment" that the user claims. Only one provider per project. No extra Lovable fee. Pro plan required.
- Stripe Connect: USD 2 per monthly active connected account and 0.25 percent + 25 cents per payout when the platform sets pricing; no account fee when Stripe sets pricing; card processing from 2.9 percent + 30 cents. Accounts v2 API, hosted or embedded onboarding, direct, destination, or separate charges, application fees.

Plan for wandit:
- Phase 1: user-owned Stripe key as a secret (Lovable's documented flow). Simple and fits COD-first users where card payments are secondary. wandit already uses Stripe (`apps/server/package.json`), so webhook patterns exist.
- Phase 2: Stripe Connect with embedded onboarding if wandit wants a platform fee or wants to hide Stripe. Stripe availability in Morocco: UNVERIFIED; check before promising card payments to Moroccan sellers.
- Paddle as merchant of record: only if wandit wants to avoid tax handling for global sellers. Not researched further.

### 6.3 Scheduled jobs

- Supabase Cron (`pg_cron`): SQL, database functions, or HTTP calls to edge functions; from every second to once a year; history in `cron.job_run_details`; keep at most 8 concurrent jobs and 10 minutes per job (https://supabase.com/docs/guides/cron). Lovable Jobs shows this history and lets users enable/disable; jobs stop automatic pausing (https://docs.lovable.dev/features/jobs.md).
- Trigger.dev stays for wandit's own pipeline (`apps/server`), not for tenant apps.
- For Cloudflare-hosted tenant Workers: Cron Triggers inside Workers for Platforms: UNVERIFIED.

### 6.4 Analytics

- Lovable: built-in, starts on publish, visitors, page views, views per visit, duration, bounce rate, live 5-minute counter, sources, top pages, devices, timezone-based location; no UTM; suggests PostHog or GA for more (https://docs.lovable.dev/features/analytics).
- wandit options: Cloudflare Web Analytics (available on all plans, JS snippet or automatic for proxied zones, per-site setup via API) (https://developers.cloudflare.com/web-analytics/). wandit-edge already serves every tenant hostname (`apps/edge/wrangler.jsonc`), so the beacon can be injected at the edge. PostHog: `POST /api/organizations/:organization_id/projects/` creates a project per app with a personal API key; project limits not stated (https://posthog.com/docs/api/projects). wandit already ships `posthog-js` (`packages/analytics`).
- Recommendation: Cloudflare Web Analytics per site for the free tier; PostHog project per app as a paid "product analytics" add-on later.

---

## 7. Recommended approach and provisioning flow

### 7.1 Architecture

- Control plane: wandit server (`apps/server`) keeps a `backend_projects` table: `app_id`, `provider` (`supabase`), `org_slug`, `project_ref`, `region`, `status`, `db_pass_encrypted`, `anon_key`, `service_role_key_encrypted`, `created_at`, `last_active_at`, `paused_at`, `plan_tier`.
- One Supabase Pro organization per wandit environment (preview, production). Later, several orgs to spread org-level rate limits and quotas (org-level quotas are summed across projects).
- A `SupabaseAdminClient` behind a rate-limited queue (120 per minute per project, 30 per minute for logs, 10 per minute for custom hostnames).
- Secrets never reach the browser or the sandbox by default. The sandboxed harness gets: `SUPABASE_URL`, the publishable (anon) key, a project-scoped MCP config or a short-lived proxy token for `database/query`, `functions/deploy`, and `secrets`. The service role key stays in the wandit server and in the tenant project's edge functions (default secret).

### 7.2 When to create the backend

Create lazily. Trigger conditions, evaluated by the agent through an `ensure_backend` tool:
1. The user asks for sign-up, login, accounts, or "save data", "orders", "bookings", "admin", "dashboard", "upload files", "send email", "payments", "schedule".
2. The generated code imports `@supabase/supabase-js` or the harness tries to write a migration or an edge function.
3. The user opens the Cloud tab and clicks "Enable backend".

Do not create a backend for pure landing pages and lead forms. wandit's existing Leads module already stores form submissions (`apps/server/src/modules/leads`); keep V1's lead form path for these apps.

Reason: each project costs about USD 9.8 per month at list when running, and provisioning takes minutes (project status goes through `COMING_UP`; exact time UNVERIFIED).

### 7.3 Provisioning sequence (Supabase)

1. `POST /v1/projects` with `name = wandit-<appId>`, `organization_slug`, generated `db_pass`, `region` chosen from the user's locale (default `eu-west-3` or `eu-central-1` for EU and Morocco, `us-east-1` for the Americas), `desired_instance_size = micro` (or Nano under a platform deal).
2. Poll `GET /v1/projects/{ref}` every 5 seconds until `status = ACTIVE_HEALTHY`; time out at 10 minutes and mark `failed`.
3. `GET /v1/projects/{ref}/api-keys?reveal=true`; store keys.
4. `PATCH /v1/projects/{ref}/config/auth`: `site_url` = preview URL, `uri_allow_list` = preview and published domains, `smtp_*` = wandit shared Resend domain, `smtp_sender_name` = app name, `mailer_*` subjects, `disable_signup = false`, CAPTCHA and OTP expiry settings.
5. `POST /v1/projects/{ref}/database/query`: enable `pg_cron`, create a `public` baseline schema convention, enable RLS by policy in the agent's migration template.
6. `POST /v1/projects/{ref}/secrets`: `RESEND_API_KEY` (tenant-scoped), `APP_URL`, any connector keys the user added.
7. Write the generated app's `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) into the sandbox and into the published build.
8. Mark `status = ready`. Show the Cloud tab.

While provisioning, the agent continues UI work in the sandbox with a local Supabase stub or with `supabase start` in the sandbox (UNVERIFIED that the sandbox can run Docker; the Supabase CLI local stack needs it). Simpler: block backend-dependent steps on `ready` and stream a "Setting up your backend" status.

### 7.4 Lifecycle and cost controls

- Pause: if `last_active_at` (from `edge_logs` and `auth_logs` counts, or from wandit's own publish traffic) is older than N days (start with 7, as Lovable and Supabase Free do) and the app has no cron jobs, call `POST /v1/projects/{ref}/pause`. Paused projects cost no compute.
- Restore on demand: first request to a paused app's Cloud tab, preview, or the agent's `ensure_backend` calls `POST /v1/projects/{ref}/restore` and shows a "Waking up" state. Published sites: show a friendly "app is waking up" page from wandit-edge while restoring (restore time UNVERIFIED; expect minutes).
- Delete: when the wandit app is deleted, keep the project paused for a grace period, then `DELETE /v1/projects/{ref}`.
- Quotas: track org-level MAU, storage, egress, invocations from Supabase usage endpoints (`usage.api-counts`) and wandit's `metering` module. Map to wandit credits like Lovable's run credits.
- Branching: not needed in phase 1. Use it later for "preview of schema changes" (USD 0.01344 per hour per branch).

### 7.5 Dashboard (Cloud tab)

Build the panels listed in section 3.7 on the proxy. Order of delivery: Database (tables, rows, SQL), Users, Secrets, Logs, Functions, Storage, Jobs. Reuse Platform Kit hooks as a reference.

### 7.6 Rollout

1. Preview environment: one Pro org, 10 internal projects, list prices.
2. Sign the Supabase for Platforms deal (Nano, project caps, rate limits).
3. Ship Cloud tab to a cohort with a per-user cap of N backends.
4. Add "export to your own Supabase" (claim flow) for advanced users.
5. Evaluate a Neon "lite" tier only if cost per idle app stays above target after the deal.

---

## 8. Risks

1. Cost per idle project at list price (about USD 9.8 per month). Without a platform deal or an aggressive pause policy, 1,000 apps cost about USD 9.8k per month.
2. Management API rate limits (120 per minute per project, 30 per minute for logs, 10 per minute for custom hostnames) bound dashboard freshness and bulk operations.
3. `database/query` is marked Beta. Build the proxy so the SQL path can switch to a direct Postgres connection with the stored `db_pass`.
4. Logs: 24-hour query windows, 7-day retention on Pro. A 5-day log view needs paging and a cache; longer history needs wandit-side storage.
5. Security: RLS mistakes by the agent expose tenant data. Run advisors after every migration; block publish on critical advisor findings.
6. Prompt injection through the Supabase MCP and user content; keep tool approval and project scoping.
7. Region gap: no Africa or Middle East Supabase region; latency for Moroccan users from Paris or Frankfurt.
8. Vendor lock-in: Lovable-style "no migration between Cloud and own Supabase" is a product decision; the claim flow can reduce it but its details are UNVERIFIED.
9. Email deliverability on a shared wandit domain; abuse by tenants can burn the shared reputation. Rate-limit and require domain verification for volume.
10. Payments availability by country (Stripe in Morocco UNVERIFIED).
11. Supabase project count caps per paid org are not published; ask partnerships.
12. Neon Agent Plan is "Coming Soon"; do not plan on its terms yet.

---

## 9. Unverified items

- Supabase project claim flow details (expiry, billing hand-off): the guide page 404. Only the OpenAPI entries are verified.
- Supabase per-organization project caps on Pro or Team.
- Supabase project creation and restore durations.
- Which paths the "database context" 10 requests per minute limit covers.
- Whether Supabase secret values can be read back through the Management API.
- Supabase region migration availability.
- Supabase MCP exact tool names in the hosted server today.
- Resend SMTP host and port for the Supabase SMTP settings.
- Bolt Database's underlying provider (support pages 404).
- Nhost, PlanetScale, PocketHost, and InsForge public provisioning APIs.
- Clerk instance provisioning on behalf of third parties.
- supabase-js and Expo compatibility details (not fetched).
- Stripe availability in Morocco.
- Cron Triggers for user Workers in Workers for Platforms.
- v0 using Neon claimable databases (Neon's page lists Replit, Retool, and others; Supabase lists v0 as a partner).
- The framework of `apps/web` (not inspected) for Platform Kit compatibility.
- Whether the V2 sandbox can run Docker for a local Supabase stack.

---

## 10. Sources (fetched 2026-09-03)

Supabase
- https://supabase.com/docs/reference/api/introduction
- https://api.supabase.com/api/v1-json
- https://supabase.com/docs/guides/integrations/build-a-supabase-integration
- https://supabase.com/docs/guides/integrations/oauth-apps/authorize-an-oauth-app
- https://supabase.com/docs/reference/api/v1-create-an-organization
- https://supabase.com/docs/reference/api/v1-create-a-project
- https://supabase.com/docs/reference/api/v1-get-project
- https://supabase.com/docs/reference/api/v1-get-project-api-keys
- https://supabase.com/docs/reference/api/v1-run-a-query
- https://supabase.com/docs/reference/api/v1-update-auth-service-config
- https://supabase.com/docs/reference/api/v1-list-all-buckets
- https://supabase.com/docs/reference/api/v1-deploy-a-function
- https://supabase.com/docs/reference/api/v1-bulk-create-secrets
- https://supabase.com/docs/reference/api/v1-get-project-logs
- https://supabase.com/docs/reference/api/v1-pause-a-project
- https://supabase.com/docs/reference/api/v1-restore-a-project
- https://supabase.com/docs/guides/platform/regions
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/manage-your-usage/compute
- https://supabase.com/docs/guides/platform/manage-your-usage/branching
- https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations
- https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party
- https://supabase.com/docs/guides/platform/upgrading#paused-projects
- https://supabase.com/docs/guides/deployment/branching
- https://supabase.com/docs/guides/cron
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/platform/going-into-prod
- https://supabase.com/docs/guides/auth/third-party/clerk
- https://supabase.com/docs/guides/storage/buckets/creating-buckets
- https://supabase.com/docs/reference/javascript/auth-admin-listusers
- https://supabase.com/docs/guides/getting-started/mcp
- https://supabase.com/ui/docs/platform/platform-kit
- https://raw.githubusercontent.com/supabase/supabase/master/apps/ui-library/registry/default/platform/platform-kit-nextjs/lib/management-api.ts
- https://supabase.com/solutions/ai-builders
- https://supabase.com/customers/lovable
- https://github.com/supabase-community/supabase-management-js

Lovable, Bolt, Base44
- https://docs.lovable.dev/features/cloud
- https://docs.lovable.dev/llms.txt
- https://docs.lovable.dev/features/database.md
- https://docs.lovable.dev/features/logs.md
- https://docs.lovable.dev/features/jobs.md
- https://docs.lovable.dev/features/custom-emails.md
- https://docs.lovable.dev/features/payments.md
- https://docs.lovable.dev/features/project-usage.md
- https://docs.lovable.dev/integrations/stripe
- https://docs.lovable.dev/integrations/resend.md
- https://docs.lovable.dev/integrations/supabase.md
- https://docs.lovable.dev/integrations/introduction
- https://docs.lovable.dev/features/analytics
- https://lovable.dev/pricing
- https://support.bolt.new/integrations/supabase
- https://docs.base44.com/llms.txt

Neon
- https://neon.com/docs/introduction/plans
- https://neon.com/pricing
- https://neon.com/docs/workflows/claimable-database-integration
- https://neon.com/auth.md
- https://neon.com/use-cases/ai-agents
- https://neon.com/docs/guides/partner-billing
- https://api-docs.neon.tech/reference/createproject
- https://neon.com/docs/neon-auth/overview
- https://neon.com/docs/data-api/get-started
- https://neon.com/docs/introduction/regions

Other providers
- https://docs.convex.dev/platform-apis
- https://docs.convex.dev/platform-apis/oauth-applications
- https://www.convex.dev/pricing
- https://docs.convex.dev/production/state/limits
- https://turso.tech/pricing
- https://docs.turso.tech/api-reference/databases/create
- https://docs.turso.tech/api-reference/tokens/create
- https://planetscale.com/pricing
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/bindings/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://github.com/cloudflare/vibesdk
- https://developers.cloudflare.com/email-service/
- https://developers.cloudflare.com/web-analytics/
- https://firebase.google.com/docs/projects/api/reference/rest
- https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects
- https://docs.insforge.dev
- https://insforge.dev/pricing
- https://github.com/InsForge/InsForge
- https://nhost.io/pricing
- https://docs.nhost.io/
- https://github.com/pocketbase/pocketbase
- https://pockethost.io/pricing

Auth, email, payments, analytics
- https://www.better-auth.com/docs/introduction
- https://www.better-auth.com/docs/integrations/expo
- https://github.com/better-auth/better-auth
- https://clerk.com/pricing
- https://clerk.com/docs/expo/getting-started/quickstart
- https://resend.com/docs/api-reference/domains/create-domain
- https://resend.com/docs/api-reference/api-keys/create-api-key
- https://resend.com/pricing
- https://docs.stripe.com/connect
- https://stripe.com/connect/pricing
- https://posthog.com/docs/api/projects

Repo files cited
- `package.json`
- `packages/auth/package.json`, `packages/db/package.json`, `packages/jobs/src/index.ts`, `packages/analytics/package.json`
- `apps/server/package.json`, `apps/server/src/modules/` (leads, orders, domains, storage, billing, credits, metering, mcp-connectors, email)
- `apps/edge/wrangler.jsonc`
- `docs/PRD.md:10`, `docs/PRD.md:33`, `docs/PRD.md:50-53`

## 11. Pages that returned 404 or failed in this session

- https://supabase.com/docs/guides/integrations/oauth-apps/oauth-scopes
- https://supabase.com/solutions/platforms
- https://supabase.com/docs/guides/platform/project-pausing
- https://supabase.com/docs/reference/api/v1-list-available-regions
- https://supabase.com/docs/reference/javascript/storage-createbucket
- https://supabase.com/docs/reference/api/v1-get-project-claim-token
- https://supabase.com/docs/guides/integrations/oauth-apps/project-claim
- https://neon.com/docs/manage/platform-integration-intro
- https://docs.lovable.dev/features/cloud/pricing, /features/cloud/emails, /features/cloud/email, /features/connectors, /features/cloud/connectors
- https://support.bolt.new/cloud/bolt-database, https://support.bolt.new/integrations/bolt-database
- https://docs.insforge.dev/core-concepts/architecture
- https://pocketbase.io/faq/ (connection refused)
- https://docs.nhost.io/platform/overview
- https://docs.base44.com/Builder/backend
