# Web deployment environments

This document defines the web and API origin configuration for production, staging, and Vercel preview deployments.

## Origin architecture

| Environment | Web origins | API origin | Browser site relationship |
| --- | --- | --- | --- |
| Production | `https://wandit.dev`, `https://www.wandit.dev` | `https://api.wandit.dev` | Same site under `wandit.dev` |
| Staging today | `https://wandit-web-git-staging-isrgroups.vercel.app` | `https://api-staging.wandit.dev` | Cross-site |

The production web and API hosts share the registrable domain `wandit.dev`. Browsers therefore treat production web-to-API requests as same-site.

Better Auth cookies are first-party in this architecture. The API still needs an exact CORS allowlist because the web and API use different origins.

`vercel.app` is on the Public Suffix List. A Vercel staging hostname is not the same site as `api-staging.wandit.dev`.

This relationship makes staging auth cookies third-party. Safari ITP and browser third-party-cookie restrictions can block these cookies and break staging auth.

### Fixed staging domain

Use a fixed staging domain on the production registrable domain:

1. Attach `staging.wandit.dev` to the staging branch in the Vercel project.
2. Set the staging server value to `CORS_ORIGIN=https://staging.wandit.dev`.
3. Redeploy the staging web and server applications.

After this change, `staging.wandit.dev` and `api-staging.wandit.dev` are same-site. Staging auth cookies then have the same first-party relationship as production cookies.

## Web API origin

`VITE_SERVER_URL` is the absolute API origin that the web application uses. Vite writes this value into the browser bundle during the build.

A Vercel dashboard change does not change an existing bundle. Redeploy the web application after each `VITE_SERVER_URL` change.

The verified production bundle contains `https://api.wandit.dev`. The verified staging bundle contains `https://api-staging.wandit.dev`.

Both bundles therefore send application requests directly to their API origin. They do not use the Vercel `/api` rewrite today.

## Vercel `/api` rewrite

`apps/web/vercel.json` rewrites `/api/:path*` to the production Railway server. The rewrite predates the current custom-domain architecture.

The rewrite was an auth workaround for the earlier `vercel.app` and `railway.app` cross-site deployment. That deployment had Better Auth cookie and CORS failures.

The same-site production domains later solved those failures. The rewrite remained in the Vercel configuration.

The current bundles use absolute API origins, so normal application traffic bypasses the rewrite. A new relative `/api` request would use it.

Every preview deployment inherits the rewrite and its production upstream. A relative preview request can therefore reach the production API without an obvious error.

If the repository keeps the rewrite, it preserves a same-origin proxy fallback. If it removes the rewrite, unintended relative requests fail visibly.

The repository owner deliberately deferred this decision. Leave the rewrite unchanged until the owner selects one trade-off.

## Server CORS variables

`CORS_ORIGIN` is required and contains one canonical web origin. Server features also use it as the base for redirects and callback URLs.

`CORS_EXTRA_ORIGINS` is optional. It contains a comma-separated list of additional exact HTTP or HTTPS origins.

The server trims each entry and drops empty entries. Server startup fails if an entry is not an origin or contains a path.

The extra origins extend Nest CORS, Better Auth trusted origins, and the manual CORS headers on chat streams. They do not replace the canonical origin.

Use this production configuration:

```dotenv
CORS_ORIGIN=https://wandit.dev
CORS_EXTRA_ORIGINS=https://www.wandit.dev
```

If `CORS_EXTRA_ORIGINS` is unset, the existing single-origin behavior does not change.
