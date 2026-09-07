# V2 research: publish and host user-generated web apps at scale

Date: 2026-09-03. Author: Claude Fable research agent. Scope: hosting and publishing only. Sandbox choice, mobile preview, and Supabase provisioning are separate research tasks.

Notation: "UNVERIFIED" marks a claim that I could not confirm from a primary source. All prices are USD, before tax, as read from vendor pages on 2026-09-03.

Note on method: the session web-search budget was exhausted before this task started. All web evidence below comes from direct fetches of official documentation pages, plus DNS and WHOIS lookups run locally. Vendor blog posts and third-party articles were not used.

---

## 1. What wandit has today (V1)

The V1 edge stack is already the shape of a multi-tenant static host. The V2 design should extend it, not replace it.

| Component | Evidence |
|---|---|
| One Worker, `wandit-edge`, on route `*/*` of the `wandit.app` zone. It catches slug subdomains and Cloudflare for SaaS custom hostnames. | `apps/edge/wrangler.jsonc:21-27`, `apps/edge/src/index.ts:1-21` |
| Host to project resolution: KV key `domain:{host}` gives `{projectId, status?}`. | `apps/edge/src/index.ts:61-70`, `apps/edge/src/index.ts:171-182` |
| Bytes: R2 key `published/{projectId}/current.html`. One HTML file per project. | `apps/edge/src/index.ts:56-59`, `apps/server/src/infrastructure/storage/r2.ts:83-85` |
| Rollback: an immutable archive per deployment, `published/{projectId}/v/{deploymentId}.html`. Rollback copies the archive back over `current.html`. | `apps/server/src/infrastructure/storage/r2.ts:87-95`, `apps/server/src/modules/sites/application/services/sites.service.ts:177-202` |
| Publish pipeline: validate slug, pending row, R2 writes, KV pointer, promote. | `apps/server/src/modules/sites/application/services/sites.service.ts:254-372` |
| Suspend: pointer `status: "suspended"` returns a 403 page. | `apps/edge/src/index.ts:180-182` |
| Only `GET` and `HEAD` are served. Everything else is 405. | `apps/edge/src/index.ts:139-145` |
| Cache: legacy `caches.default`, keyed on full URL including host. The new `ctx.cache` is host-blind and must not be enabled as-is. | `apps/edge/src/index.ts:157-169`, `apps/edge/wrangler.jsonc:35-40` |
| Custom domains: Cloudflare for SaaS custom hostnames, HTTP validation, fallback origin `customers.wandit.app`. | `apps/server/src/modules/domains/infrastructure/cloudflare/custom-hostname.service.ts:25-27,126`, `apps/edge/src/index.ts:51-54` |
| Apex domains: a Cloudflare zone in our account with DNS-only CNAMEs, because the Free plan has no apex proxying. | `docs/features/custom-domains.md` ("Canonical host" bullet) |
| Universal SSL covers only one level: `x.wandit.app`, not `x.y.wandit.app`. | `docs/features/edge-serving.md` ("One-time Cloudflare dashboard setup", item 5) |
| Known limits recorded: 100 free SaaS hostnames, then $0.10 each per month. | `docs/features/edge-serving.md` ("Limits worth knowing") |

What V1 cannot do:

1. It serves one file per project. A Vite app is a directory of hashed files.
2. It serves no server code. It cannot run SSR or API routes for a user app.
3. It has no preview URL per version. The doc defers "preview-host design" because of the Universal SSL depth limit.

---

## 2. Cloudflare options

### 2.1 Workers Paid plan and static assets (the plain Workers route)

Facts from the official pages:

- Workers Paid: $5 per month. 10 million requests included, then $0.30 per million. 30 million CPU-ms included, then $0.02 per million CPU-ms. Source: https://developers.cloudflare.com/workers/platform/pricing/
- "Requests to static assets are free and unlimited." "There are no additional charges for data transfer (egress) or throughput (bandwidth)." Source: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- "There is no additional cost for storing Assets." Source: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Static asset limits: 20,000 files per Worker version on Free, 100,000 on Paid. 25 MiB per file. `_headers` 100 rules, `_redirects` 2,100 rules. Source: https://developers.cloudflare.com/workers/platform/limits/
- Script size: 3 MB compressed on Free, 10 MB compressed on Paid, 64 MB uncompressed. Source: https://developers.cloudflare.com/workers/platform/limits/
- Workers per account: 100 on Free, 500 on Paid. Cloudflare points to Workers for Platforms for more. Source: https://developers.cloudflare.com/workers/platform/limits/
- SPA mode: `assets.not_found_handling = "single-page-application"` serves `/index.html` with 200 for unknown paths. A Worker script is optional. With compatibility date 2025-04-01 or later, navigation requests do not invoke the Worker script. Source: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- `run_worker_first` can be `true` or a list of patterns such as `["/api/*", "!/api/docs/*"]`. Source: https://developers.cloudflare.com/workers/static-assets/
- Versions and deployments: preview URLs per version, rollback, gradual deployments, and a history of the 100 most recent versions. Source: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/
- Preview URL format: `<VERSION_PREFIX_OR_ALIAS>-<WORKER_NAME>.<SUBDOMAIN>.workers.dev`. Source: https://developers.cloudflare.com/workers/configuration/previews/

Verdict: the 500 Workers per account limit makes "one plain Worker per user app" a non-starter. Plain Workers fit two designs only: (a) one Worker that serves every app from R2 (the V1 pattern, extended), or (b) Workers for Platforms.

### 2.2 Cloudflare Pages

- 100 projects per account. "This limit is not routinely increased." Source: https://developers.cloudflare.com/pages/platform/limits/
- Custom domains per project: 100 Free, 250 Pro, 500 Business and Enterprise. Source: same page.
- The migration guide does not declare Pages deprecated. It lists Workers as the more feature-rich option (gradual deployments, rollbacks, Workers Logs, Vite plugin, Durable Objects). Last update 2026-08-14. Source: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

Verdict: 100 projects per account rules Pages out for per-user apps. Do not build new things on Pages.

### 2.3 Workers for Platforms (W4P)

Pricing (page last updated 2026-04-21). Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/

| Item | Included | Overage |
|---|---|---|
| Subscription | $25 per month | |
| Requests | 20 million per month | $0.30 per million |
| CPU time | 60 million CPU-ms per month | $0.02 per million CPU-ms |
| Scripts | 1,000 | $0.02 per script per month |
| Subrequests | not billed separately | |
| Request chain | one request is billed across dispatch Worker, user Worker, outbound Worker | |

Script cost at scale: 10,000 user Workers = 9,000 extra x $0.02 = $180 per month. 100,000 user Workers = about $1,980 per month.

Architecture. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/how-workers-for-platforms-works/ and https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/

- A dispatch namespace holds all user Workers. Cloudflare recommends one namespace such as `production`, not one per customer.
- A dynamic dispatch Worker receives every request. It calls `env.DISPATCHER.get(scriptName)` and then `userWorker.fetch(request)`.
- User Workers run in untrusted mode. They never share a cache. They cannot read `request.cf`. `caches.default` is disabled for namespaced scripts. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/limits/
- "Cloudflare provides an unlimited number of scripts for Workers for Platforms customers." Source: same limits page.
- Tags: maximum eight per script. Filter and bulk delete by tag. Use for `customer:{id}`, `project:{id}`, `env:{name}`. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/tags/
- Custom limits: `dispatcher.get(name, {}, { limits: { cpuMs, subRequests } })`. The user Worker throws when it exceeds a limit. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/custom-limits/
- Outbound Workers intercept every `fetch()` from user Workers. Use for logging, allowlists, blocklists, and injecting credentials. TCP `connect()` is disabled when an outbound Worker is set. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/outbound-workers/
- Bindings go in the `metadata` object of the multipart upload. `keep_bindings` preserves existing ones. Each user Worker sees only its own bindings. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/bindings/
- Hostname routing: use a `*/*` route on the SaaS zone so one route covers subdomains and vanity domains. The dispatch Worker looks up the hostname in KV. If the Worker is the origin, use a dummy DNS record. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/
- API rate limits: 1,200 client API calls per 5 minutes per token, 200 per second per IP. Source: W4P limits page above.

Static assets on user Workers. Source: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/static-assets/

1. `POST /accounts/{account_id}/workers/dispatch/namespaces/{namespace}/scripts/{script_name}/assets-upload-session` with a manifest of `{path: {hash, size}}`. The hash is 32 hex characters. The response returns a JWT (valid one hour) and buckets of hashes still needed.
2. `POST /accounts/{account_id}/workers/assets/upload?base64=true` with multipart form data. Field name is the hash, value is base64 content. Returns a completion JWT.
3. `PUT /accounts/{account_id}/workers/dispatch/namespaces/{namespace}/scripts/{script_name}` with `metadata.assets.jwt` and optional `assets.config` (for example `html_handling`).

Caveat on the same page: files with equal hashes can be reused across user Workers in a namespace. If strict isolation matters, salt the hash with the account id.

Gaps found:

- Preview URLs: "Preview URLs are not currently generated for Workers for Platforms user Workers. This is a temporary limitation." Source: https://developers.cloudflare.com/workers/configuration/previews/
- Versions and rollback for user Workers: the versions page does not say whether it applies to namespaced scripts. UNVERIFIED. Plan as if it does not: keep one script per deployment and switch the pointer.
- Whether static asset requests through the dispatch Worker are free: the W4P pricing page does not mention static assets. Because every request enters the dispatch Worker first, count every request at $0.30 per million. UNVERIFIED that Cloudflare bills it another way.
- Script size limit for user Workers: not on the W4P limits page. Assume the Workers Paid value, 10 MB compressed. UNVERIFIED.

Cloudflare's own reference architecture for "AI vibe coding platforms" uses Sandboxes or Containers for untrusted builds, preview URLs for testing, Workers for Platforms for production hosting ("each application running in its own isolated Worker instance"), an outbound Worker as an egress firewall, and custom limits against abuse. Source: https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-vibe-coding-platform/

### 2.4 Cloudflare for SaaS (custom domains)

- Free, Pro, and Business plans include 100 custom hostnames. Extra hostnames cost $0.10 per hostname per month. Hard cap 50,000 on these plans. Enterprise: unlimited, custom certificates, wildcard custom hostnames, selectable CA. Source: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/
- A hostname counts toward usage from creation until deletion, also while pending. Deleting stops billing. Source: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/quotas-and-billing/
- Validation: pre-validation (TXT or HTTP before DNS cutover) or real-time. Two token sets: `ownership_verification` for the hostname and `ssl.validation_records` for the certificate. Both must reach `active`. Source: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/
- Cloudflare issues two certificates per hostname (ECDSA P-256 and RSA 2048). Source: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/
- Apex proxying (customer points an A record at your static IPs) is limited to "certain customers". The standard path for non-Enterprise is CNAME flattening at the customer's DNS. Source: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/apex-proxying/

V1 already solved the apex problem with a customer zone in our account (`docs/features/custom-domains.md`). This carries over to V2 with no change.

### 2.5 Cloudflare storage and compute used by a publish pipeline

- R2: $0.015 per GB-month. Class A $4.50 per million. Class B $0.36 per million. Egress free. Free tier: 10 GB, 1 million Class A, 10 million Class B. Source: https://developers.cloudflare.com/r2/pricing/
- Containers (Workers Paid): 25 GiB-hours memory, 375 vCPU-minutes, 200 GB-hours disk included. Then $0.0000025 per GiB-second, $0.000020 per vCPU-second, $0.00000007 per GB-second. Egress $0.025 per GB in NA and EU after 1 TB. Instance types from `lite` (1/16 vCPU, 256 MiB) to `standard-4` (4 vCPU, 12 GiB). Source: https://developers.cloudflare.com/containers/pricing/
- Sandbox SDK: runs untrusted code in Cloudflare Containers from a Worker. Command execution, file I/O, preview URLs for ports. Needs Workers Paid. Version 1.0 is a preview (`@cloudflare/sandbox@next`). Source: https://developers.cloudflare.com/sandbox/
- Workers Builds: git-driven CI for Workers. No API for many projects is documented. Source: https://developers.cloudflare.com/workers/ci-cd/builds/

---

## 3. Vercel

### 3.1 Vercel for Platforms

- Two models. "Multi-tenant": one codebase, one deployment, many domains. "Multi-project": one project and deployment per tenant. Vercel names the multi-project model for "AI coding platforms, user-generated apps". Source: https://vercel.com/docs/platforms (last updated 2026-08-11)
- Multi-project: create a project with `vercel.projects.createProject`, add a domain with `vercel.projects.addProjectDomain`. Each project gets `project-name.vercel.app` and preview URLs. Source: https://vercel.com/docs/platforms/multi-project-platforms/concepts
- Deploy API: `POST /v13/deployments`. Files are inlined (`data` + `encoding`) or uploaded first with `POST /v2/files` and referenced by `sha` and `size`. `target: "production"` assigns the project aliases; omitted means preview. `projectSettings.framework` sets the build. `skipAutoDetectionConfirmation=1` avoids a 400 in automation. Source: https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment (last updated 2026-09-03)
- Platform Elements: a `deploy-files` server action wraps the flow (files, optional `projectId`, `domain`, `config`). A `claim-deployment` block shows a claim button. Source: https://vercel.com/docs/platforms/platform-elements/actions/deploy-files and https://vercel.com/docs/platforms/platform-elements/blocks/claim-deployment
- Claim Deployments: `POST /projects/:idOrName/transfer-request` returns a code valid 24 hours. The user opens `https://vercel.com/claim-deployment?code=...&returnUrl=...` and picks a team. Supabase, Neon, and Prisma resources transfer with the project. Source: https://vercel.com/docs/deployments/claim-deployments (last updated 2026-08-21)
- Platform Template: a full AI app builder reference. Vercel Sandbox runs the agent CLI and the dev server. The preview is an iframe of the sandbox. Deploy reads sandbox files and creates a deployment. Unsigned users deploy to the partner team, then claim by OAuth. Source: https://vercel.com/docs/platforms/examples/platform-template

### 3.2 Pricing and limits

- Pro: $20 per month per deploying seat, includes $20 usage credit. Included: 1 TB Fast Data Transfer, 10 million Edge Requests. Source: https://vercel.com/docs/plans/pro (last updated 2026-08-25)
- Overage: Fast Data Transfer $0.15 to $0.35 per GB by region. Edge Requests $2.00 to $3.20 per million. Fast Origin Transfer $0.06 to $0.43 per GB. Source: https://vercel.com/docs/pricing/regional-pricing (last updated 2026-02-27)
- Limits: Projects 200 on Hobby, unlimited on Pro. Deployments per day 100 Hobby, 6,000 Pro, custom Enterprise. Deployments per hour 450 Pro. Domains per project 50 Hobby, unlimited Pro (soft limit 100,000 per project). Static file uploads 100 MB Hobby, 1 GB Pro. 15,000 source files per CLI deployment. Build time 45 minutes. Concurrent builds up to 500 on Pro. Source: https://vercel.com/docs/limits (last updated 2026-08-25)
- Vercel Sandbox (Pro): Active CPU $0.128 per hour, memory $0.0212 per GB-hour, creations $0.60 per million, network $0.15 per GB out (downloads free), 10,000 concurrent, 24-hour sessions, 8 vCPU max. Vercel's own example: a 30-minute build-and-test on 4 vCPU costs about $0.34; a 5-minute run on 2 vCPU about $0.03. Source: https://vercel.com/docs/vercel-sandbox/pricing (last updated 2026-08-21)

Verdict: Vercel is the most complete "deploy on behalf of users" API of the group. The costs are the issue. At 10 TB per month of visitor traffic, overage is 9 TB x $0.15 to $0.35 = $1,350 to $3,150 per month, plus edge requests. Cloudflare charges $0 for the same bytes. A second issue is the deployments-per-day cap (6,000 on Pro) which a busy builder can hit. Vercel makes sense only as an optional "export to your own Vercel" target through Claim Deployments, not as the default host.

---

## 4. Netlify

- New plans are credit based (accounts created on or after 2025-09-04): Free $0 with 300 credits, Personal $9 with 1,000, Pro $20 with 3,000, Enterprise custom. Usage: production deploy 15 credits ($0.10), bandwidth 20 credits per GB ($0.13), web requests 2 credits per 10k, compute 10 credits per GB-hour. Source: https://www.netlify.com/pricing/
- My reading of that table: Pro's 3,000 credits buy about 150 GB of bandwidth. Legacy Pro included 1 TB and charged $55 per 100 GB over. Legacy plans allow 500 sites maximum. Source: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/
- Deploy API: `POST /api/v1/sites`, then `POST /api/v1/sites/{site_id}/deploys` with a `{path: sha1}` digest; Netlify returns the hashes it needs; upload each with `PUT /api/v1/deploys/{deploy_id}/files/{path}`. Zip deploys allowed (25,000 files). `draft: true` makes a preview. Rollback with `POST /api/v1/sites/{site_id}/deploys/{deploy_id}/restore`. Custom domain SSL with `POST /api/v1/sites/{site_id}/ssl`. Source: https://docs.netlify.com/api/get-started/
- API rate limits: 500 requests per minute, "3 deploys per minute, 100 deploys per day". Higher limits need support. Source: same page.

Verdict: 100 deploys per day and 500 sites per team make Netlify unusable as the default host for thousands of user apps without an Enterprise contract. Bandwidth is about $0.13 per GB.

---

## 5. Fly.io

- Machines are API-driven VMs that start and stop in under a second. Fly publishes a "one app per customer" pattern and blueprints for per-user machines and warm pools. Source: https://fly.io/docs/machines/ and https://fly.io/docs/blueprints/
- Pricing: `shared-cpu-1x` about $2.02 per month in Amsterdam, about $5 per GB extra RAM per month. Stopped machine rootfs $0.15 per GB per month. Egress $0.02 per GB in NA and EU, $0.04 in APAC and South America, $0.12 in Africa and India. Certificates: single hostname $0.10 per month (first 10 free), wildcard $1 per month. Dedicated IPv4 $2 per month. Source: https://fly.io/docs/about/pricing/

Verdict: good for long-running backends and containers, for example a Node SSR server per user. Not a static host. Each app needs a running or stopped machine with disk cost. Egress $0.02 per GB is cheap but not free. A candidate for phase 2 SSR apps if we do not use W4P.

---

## 6. Railway

- Hobby $5 per month with $5 usage. Pro $20 per workspace with $20 usage. vCPU $0.00000772 per second (about $20 per vCPU-month). Memory $0.00000386 per GB-second (about $10 per GB-month). Egress $0.05 per GB. Custom domains: 2 on Hobby, 20 on Pro. Source: https://railway.com/pricing
- GraphQL API creates projects, services, deployments, domains. Rate limits: Hobby 1,000 per hour, Pro 10,000 per hour and 50 per second. Source: https://docs.railway.com/reference/public-api

Verdict: 20 custom domains on Pro rules Railway out for user domains. Fine for our own backend services, not for user apps.

---

## 7. How Lovable, Bolt, and Base44 host

### 7.1 Lovable

Docs:

- Publish deploys a snapshot to `[subdomain].lovable.app`. Republish overwrites the live snapshot. No rollback described. Source: https://docs.lovable.dev/features/deploy
- Custom domains: an A record to `185.158.133.1` plus a TXT `_lovable` verification record, or a CNAME to the `lovable.app` URL when a proxy is in front. SSL is automatic, up to 72 hours. One primary domain per project; the others 302 to it. AAAA records must be removed. Source: https://docs.lovable.dev/features/custom-domain
- Lovable Cloud is "built on Supabase's open-source foundation": database, auth, storage, edge functions, secrets, background jobs, email, logs. Billed in run credits. Source: https://docs.lovable.dev/features/cloud

DNS and WHOIS (run locally on 2026-09-03):

- `lovable.app` nameservers: `ivan.ns.cloudflare.com`, `rafe.ns.cloudflare.com`.
- `*.lovable.app` resolves to `185.41.148.1` and `185.41.148.2`. WHOIS for `185.41.148.0/24`: netname `LOVABLE-APP`, descr "Lovable Application Traffic", origin `AS13335` (Cloudflare).
- The custom-domain IP `185.158.133.1` is in `185.158.133.0/24`, also origin `AS13335`.

Reading: Lovable serves published apps and custom domains through Cloudflare, on its own IP prefixes announced by Cloudflare (BYOIP). That is why Lovable can give customers a bare A record for the apex. The origin behind Cloudflare is not visible from DNS. Whether Lovable uses Workers for Platforms or a plain Worker plus object storage is UNVERIFIED. The published artifact is a static Vite SPA plus Supabase; the docs say the frontend and the Cloud backend are separate, and the custom-domain guide only ever mentions static hosting concerns (CNAME, A record, SSL).

### 7.2 Bolt

Docs:

- "Bolt offers built-in hosting." Sites publish to a random `*.bolt.host` name that the user can rename. Updates need a manual "Update". Public or private visibility. Source: https://support.bolt.new/cloud/hosting/publish
- Custom domain: `www` CNAME to `site-dns.bolt.host`; apex as ALIAS, ANAME, or flattened CNAME to the same target. Propagation 3 to 24 hours. Source: https://support.bolt.new/cloud/domains/connect

DNS and WHOIS:

- `bolt.host` nameservers are Cloudflare. The apex resolves to Cloudflare proxy IPs (`104.26.12.118`, `104.26.13.118`, `172.67.75.9`; WHOIS `CLOUDFLARENET`).
- `site-dns.bolt.host` resolves to `35.157.26.135` and `63.176.8.218`; WHOIS `Amazon Technologies Inc.`

Reading: Bolt's custom-domain edge terminates on AWS, not on Netlify. The current docs never mention Netlify. Any earlier Bolt-to-Netlify integration is not documented on these pages; its current status is UNVERIFIED.

### 7.3 Base44

DNS only: `base44.app` nameservers are Cloudflare; `app.base44.app` is a CNAME to `base44.onrender.com` behind Cloudflare. So the Base44 editor runs on Render behind Cloudflare. How Base44 hosts published user apps is UNVERIFIED.

### 7.4 Lesson

All three put Cloudflare in front. Lovable's product is exactly "static SPA + Supabase-based backend". That is the cheapest thing to host and the same shape as wandit V1's edge stack.

---

## 8. Build pipeline: where does `vite build` run?

Two options.

### Option A: build inside the agent sandbox, then upload the output

Flow: the coding agent already runs in a sandbox with the project checked out. After each accepted change, run `vite build` there. Hash every file in `dist/`. Upload only new hashes to R2 (or to the W4P assets endpoint). Write a manifest. Flip the pointer.

Evidence that this is the industry pattern:

- Vercel's Platform Template deploys by "reading sandbox files and creating a Vercel deployment". Source: https://vercel.com/docs/platforms/examples/platform-template
- Cloudflare's reference architecture uses Sandboxes or Containers for untrusted builds and W4P for hosting. Source: https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-vibe-coding-platform/

Cost: Vercel's own example puts a 5-minute 2-vCPU sandbox run at about $0.03 (https://vercel.com/docs/vercel-sandbox/pricing). A typical Vite build of a small app takes 10 to 60 seconds. Cloudflare Containers bill CPU at $0.000020 per vCPU-second, so a 60-second 1-vCPU build is about $0.0012 plus memory (https://developers.cloudflare.com/containers/pricing/).

Pros: no git, no CI queue, no second copy of the code, the same node_modules the agent used. Publish takes seconds. Cons: the sandbox must stay up or restart for a publish, and build output must be verified (size, file count) before upload.

### Option B: build on a CI service

Workers Builds and Vercel builds both start from a git repository (https://developers.cloudflare.com/workers/ci-cd/builds/, https://vercel.com/docs/platforms/multi-project-platforms/concepts). This forces a git repo per project, which the product wants to hide. Vercel Pro caps builds at 45 minutes and 500 concurrent, and deployments at 6,000 per day (https://vercel.com/docs/limits). Netlify caps at 100 deploys per day (https://docs.netlify.com/api/get-started/).

Verdict: Option A. Keep a repository per project internally for history (a later decision), but never make the publish path depend on a CI service.

---

## 9. SPA-only versus SSR frameworks

| Stack | Hosting fit | Evidence |
|---|---|---|
| Vite + React SPA | Best. Pure static files. Works on the extended V1 edge Worker, on W4P assets, on Vercel, Netlify, or any object store. Cloudflare's own scaffold is `npm create cloudflare@latest -- my-app --framework=react`. | https://developers.cloudflare.com/workers/static-assets/ |
| React Router v8 framework mode (Remix successor) | Works on Workers with SSR, but "SPA mode and prerendering are not currently supported" with the Cloudflare Vite plugin. Cloudflare recommends React Router as a library inside the React template for SPAs. | https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/ |
| TanStack Start | Works on Workers with `@cloudflare/vite-plugin`, `nodejs_compat`, and `main` = `@tanstack/react-start/server-entry`. Prerender runs at build time with local bindings. | https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack/ |
| Next.js via OpenNext | `@opennextjs/cloudflare` supports Next.js 16 and the latest 14 and 15 minors. Node middleware (15.2) and the Edge runtime are unsupported. The 10 MB compressed Worker limit is the practical ceiling. | https://opennext.js.org/cloudflare |

Recommendation for the generated stack (phase 1): Vite + React + TypeScript + Tailwind + shadcn/ui + React Router in library mode + `@supabase/supabase-js` for auth, database, storage, realtime, and edge functions. Reasons:

1. The output is a directory of static files. Any host serves it. No server bundle, no script size limit, no cold starts.
2. It is the same shape as Lovable (Section 7.1), which proves the market accepts it.
3. Server logic lives in Supabase Edge Functions, not in the hosted bundle, so the host never runs user server code. That removes most abuse and isolation work from the publish path.
4. The V1 edge Worker can serve it after a small change (Section 10).

Phase 2, if a user needs SSR or server routes on the host: put those apps on Workers for Platforms with TanStack Start or React Router framework mode. Keep Next.js out of the generated stack; the OpenNext path has the most caveats and the 10 MB limit bites first there.

---

## 10. Recommended V2 hosting design

### 10.1 Phase 1: extend `wandit-edge` to serve static app bundles from R2

Keep the zone, the `*/*` route, Cloudflare for SaaS, and the KV pointer contract. Change what the pointer points at and what R2 holds.

R2 layout:

```
apps/{projectId}/builds/{deploymentId}/manifest.json   -> {files: {"/assets/x.js": {hash, size, type}}, spaFallback: "/index.html"}
apps/blobs/{sha256}                                    -> content-addressed file bodies (dedupe across builds and projects)
```

KV pointer: `domain:{host}` -> `{projectId, deploymentId, status?}`. `projectId` stays the only required field, as the contract in `apps/edge/src/index.ts:13-17` demands. Readers without `deploymentId` fall back to the V1 `current.html` key, so V1 sites keep working during migration.

Edge logic per request:

1. Resolve host to pointer (KV, 60-second cache, as today).
2. Load the manifest (KV or R2, cached by `deploymentId`; manifests are immutable so cache them for a long time).
3. Match the path. If the path is missing and the request is a navigation, serve `/index.html` with 200 (SPA fallback). Otherwise 404.
4. Stream the blob from R2 with `Content-Type` from the manifest. Hashed assets get `Cache-Control: public, max-age=31536000, immutable`. `index.html` gets `max-age=60`.
5. Keep `caches.default` for the URL-keyed cache. The host-blind `ctx.cache` stays off (`apps/edge/wrangler.jsonc:35-40`).

Rollback: write the pointer to an older `deploymentId`. Nothing else moves. Unpublish: delete the pointer. Suspend: `status: "suspended"` as today.

Previews per version: serve every build at a flat single-level host, for example `d-{deploymentId}--{slug}.wandit.app` or a shorter random id. A flat single-level host stays inside Universal SSL, which does not cover two-level names (`docs/features/edge-serving.md`, setup item 5). Add `X-Robots-Tag: noindex` on previews. Gate previews with a signed token in a cookie if the user wants them private.

Costs at this design: Workers Paid $5 per month, $0.30 per million requests over 10 million, R2 storage $0.015 per GB-month, R2 Class B reads $0.36 per million (only on cache misses), egress $0. For 100 million requests per month: about $27 in Workers plus a few dollars of R2 reads. For 10 TB of egress per month: $0.

Static asset serving through the Worker counts as Worker requests, not as free asset requests, because the files live in R2 and not in Worker assets. That is still cheap.

### 10.2 Phase 2: Workers for Platforms for apps that need server code on the host

Adopt W4P when a real share of apps needs SSR, API routes, or bindings at the edge. Design:

- One dispatch namespace `production`. The dispatch Worker replaces `wandit-edge` and keeps the same KV pointer and route. The pointer now holds `scriptName`.
- One user Worker per deployment, named `p-{projectId}-d-{deploymentId}`, with tags `project:{id}`, `customer:{id}`, `state:live|archived`. Publish uploads a new script; the pointer switch is the deploy; rollback is a pointer switch to an old script. Delete archived scripts older than N by tag filter. This avoids the unverified versions and preview gaps (Section 2.3) and stays within eight tags.
- Static assets go through the three-step assets upload on the namespaced script. Salt file hashes with the project id if we want no cross-project blob sharing.
- Always call `dispatcher.get(name, {}, { limits: { cpuMs, subRequests } })` with plan-based limits. Configure an outbound Worker that logs and enforces an allowlist for egress. Both are the abuse controls in Cloudflare's reference architecture.
- Script count cost: $0.02 per script per month beyond 1,000. Keeping the last 3 builds of 20,000 projects is 60,000 scripts, about $1,180 per month. Keep fewer builds as scripts and archive the rest as R2 bundles that can be re-uploaded on rollback.
- Custom domains are unchanged: Cloudflare for SaaS custom hostnames on the same zone.

### 10.3 Optional: export to the user's own Vercel

Offer "Deploy to Vercel" as an export for power users: upload files with `POST /v2/files`, create the deployment, create a transfer request, hand the user the claim URL. The user pays Vercel after the claim. This is the documented Claim Deployments flow (Section 3.1). It needs the app to be a plain Vite project, which the phase-1 stack guarantees.

### 10.4 Custom domains and SSL for V2

No change in mechanism. Points to carry into V2:

- Budget $0.10 per hostname per month after the first 100. 10,000 domains cost about $990 per month. Include this in the paid plan price. Delete hostnames on unpublish or non-payment; billing stops at deletion.
- The 50,000-hostname hard cap on non-Enterprise plans is the point where an Enterprise contract or a second zone becomes necessary.
- Keep the customer-zone approach for apex on BYO domains; apex proxying is not available to us.
- Submit `wandit.app` to the Public Suffix List PRIVATE section once V2 apps set cookies (Supabase auth stores sessions in localStorage by default, but apps may set cookies). The owner must file the request; small or short-term projects are refused. Source: https://publicsuffix.org/submit/

---

## 11. Bandwidth cost at scale

Assume 10 TB per month of visitor egress and 200 million requests.

| Host | Egress | Requests | Total (approx.) | Source |
|---|---|---|---|---|
| Cloudflare Workers (+ R2) | $0 | 190M x $0.30 = $57 | about $62 with the $5 plan | https://developers.cloudflare.com/workers/platform/pricing/ |
| Cloudflare W4P | $0 | 180M x $0.30 = $54 | about $79 with the $25 plan, plus scripts | https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/ |
| Vercel Pro | 9 TB x $0.15 to $0.35 = $1,350 to $3,150 | 190M x $2 to $3.20 = $380 to $608 | $1,750 to $3,780 | https://vercel.com/docs/pricing/regional-pricing |
| Netlify (credits) | 10 TB x $0.13 = $1,300 | 200M / 10k x $0.01 = $200 | about $1,500 | https://www.netlify.com/pricing/ |
| Fly.io | 10 TB x $0.02 = $200 (NA/EU) | n/a | $200 plus machines | https://fly.io/docs/about/pricing/ |
| Railway | 10 TB x $0.05 = $500 | n/a | $500 plus compute | https://railway.com/pricing |

Cloudflare wins by one to two orders of magnitude. This is the single strongest reason to stay on the existing edge stack.

---

## 12. Abuse, phishing, and takedown tooling

What Cloudflare does:

- For content hosted on Workers, Pages, KV, R2, and Stream, Cloudflare is the hosting provider and "will remove or disable access to that content" that violates its terms. It notifies the operator and can restore content after a response. Source: https://www.cloudflare.com/trust-hub/abuse-approach/
- Reports arrive at https://abuse.cloudflare.com/. For pass-through services Cloudflare forwards the complaint to the operator and the hosting provider. Source: https://www.cloudflare.com/abuse/

Because wandit's zone and Worker serve every user site, an abuse action against `wandit.app` hits every customer. The platform must find and remove abuse before Cloudflare does.

Tooling available to us:

1. Cloudflare URL Scanner API (`/accounts/{account_id}/urlscanner/`): returns `verdicts.overall.malicious`, phishing verdicts, screenshots, technologies, and request chains. Scans are kept 12 months. Rate limits and pricing are not on the page (UNVERIFIED). Source: https://developers.cloudflare.com/radar/investigate/url-scanner/
2. Google Web Risk Lookup API: 100,000 `uris.search` calls per month free, then $0.50 per 1,000 up to 10 million. Evaluate and Submission APIs priced on request. Source: https://cloud.google.com/web-risk/pricing
3. Cloudflare Security Center Brand Protection finds look-alike domains; manual scans need Business or Enterprise. No public API is described on the overview page. Source: https://developers.cloudflare.com/security-center/
4. W4P outbound Workers (egress allowlist and logging) and custom limits (CPU, subrequests). Section 2.3.
5. Existing V1 controls: pointer `status: "suspended"` (`apps/edge/src/index.ts:180-182`), reserved slug list (`sites.service.ts:134-137`), and the 405 on non-GET (`index.ts:139-145`).

Recommended controls for V2 publish:

- Scan every publish and every custom-domain attach: run a static check on `dist/` (external form actions, credential-harvesting keywords, brand names of banks and wallets in text and title), then a URL Scanner scan of the live preview before the pointer flips for new accounts. Hold suspicious publishes for review.
- Rate-limit publishes per account and per IP. Require a verified email before the first publish and a paid plan or payment method before a custom domain.
- Keep the `noindex` header on previews and on unverified accounts' sites.
- Add an `abuse@wandit.app` inbox and an admin action that sets `status: "suspended"` on all pointers of a project in one call. Log every action for the operator notice that Cloudflare expects.
- For W4P apps, always run behind an outbound Worker with a default-deny list for well-known credential-exfiltration hosts and a per-plan CPU limit.
- Submit `wandit.app` to the Public Suffix List (Section 10.4). Cloudflare did this for `pages.dev`, and it isolates cookies between customer sites.

---

## 13. Risks

1. Universal SSL depth: any two-level preview host fails TLS. Use flat single-level preview hosts or buy Advanced Certificate Manager for a multi-level wildcard (price UNVERIFIED on this pass).
2. W4P preview URLs do not exist for user Workers today. The per-deployment script design works around it.
3. W4P per-script versions and rollback are UNVERIFIED for namespaced scripts. Do not depend on them.
4. Custom hostname costs grow linearly ($0.10 per month each) and hit a 50,000 hard cap without Enterprise.
5. One zone serves every customer. A single abuse action or a mistaken route exclusion has a full-platform blast radius (see `docs/features/edge-serving.md`, setup item 3).
6. Netlify new pricing is credit based; the "150 GB on Pro" figure is my arithmetic from the pricing table, not a vendor statement.
7. Bolt's current hosting provider is inferred from DNS (AWS behind Cloudflare). Lovable's use of W4P versus a custom Worker is UNVERIFIED.
8. Cloudflare Sandbox SDK 1.0 is a preview release; the build-in-sandbox step should not depend on it until it is GA.
9. Pages is not deprecated, but 100 projects per account makes it a dead end. Anyone proposing Pages for V2 should be redirected to Workers.

---

## 14. Sources

Cloudflare
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- https://developers.cloudflare.com/workers/configuration/versions-and-deployments/
- https://developers.cloudflare.com/workers/configuration/previews/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/limits/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/how-workers-for-platforms-works/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/static-assets/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/tags/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/outbound-workers/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/custom-limits/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/bindings/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/quotas-and-billing/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/apex-proxying/
- https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-vibe-coding-platform/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/containers/pricing/
- https://developers.cloudflare.com/sandbox/
- https://developers.cloudflare.com/radar/investigate/url-scanner/
- https://developers.cloudflare.com/security-center/
- https://www.cloudflare.com/trust-hub/abuse-approach/
- https://www.cloudflare.com/abuse/

Vercel
- https://vercel.com/docs/platforms
- https://vercel.com/docs/platforms/multi-project-platforms/concepts
- https://vercel.com/docs/platforms/examples/platform-template
- https://vercel.com/docs/platforms/platform-elements/actions/deploy-files
- https://vercel.com/docs/platforms/platform-elements/blocks/claim-deployment
- https://vercel.com/docs/deployments/claim-deployments
- https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment
- https://vercel.com/docs/plans/pro
- https://vercel.com/docs/limits
- https://vercel.com/docs/pricing/regional-pricing
- https://vercel.com/docs/manage-cdn-usage
- https://vercel.com/docs/vercel-sandbox/pricing

Netlify, Fly.io, Railway
- https://www.netlify.com/pricing/
- https://docs.netlify.com/api/get-started/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/
- https://fly.io/docs/about/pricing/
- https://fly.io/docs/machines/
- https://fly.io/docs/blueprints/
- https://railway.com/pricing
- https://docs.railway.com/reference/public-api

Competitors and frameworks
- https://docs.lovable.dev/features/deploy
- https://docs.lovable.dev/features/custom-domain
- https://docs.lovable.dev/features/cloud
- https://support.bolt.new/cloud/hosting/publish
- https://support.bolt.new/cloud/domains/connect
- https://opennext.js.org/cloudflare
- https://publicsuffix.org/submit/
- https://cloud.google.com/web-risk/pricing

Local evidence
- `dig` and `whois` output for `lovable.app`, `185.41.148.0/24`, `185.158.133.0/24`, `bolt.host`, `site-dns.bolt.host`, `app.base44.app` (run 2026-09-03).
- Repo files cited inline in Section 1.
