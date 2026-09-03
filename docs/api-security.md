# API Security

Deny by default: every API route requires an authenticated session unless it is explicitly marked `@Public()`.
Every API slice must pass this checklist before merge.

## Handled globally — never repeat per endpoint

| Status | Control | Convention |
| --- | --- | --- |
| SHIPPED | Auth guard | Global `AuthGuard` is wired as a Nest `APP_GUARD`; handlers require a session unless marked `@Public()`. |
| SHIPPED | CORS | Exact-origin CORS with credentials; no wildcard credentialed origins. |
| SHIPPED | Cookies | Better Auth owns session cookies; cookies are httpOnly by default. |
| SHIPPED | Error envelope | `ApiExceptionFilter` logs 500s server-side and returns `code` / `message` / `requestId` to clients; no stack traces or DB errors leave the API. |
| SHIPPED | Validation pipe | `ZodValidationPipe` is available for contract-backed body, query, and param validation. |
| SHIPPED | Secrets | `t3-env` validates required secrets at boot and fails fast. |
| PLANNED | Security headers | ISRECOM-41: add `@fastify/helmet`; CSP decision is left to implementation. |
| PLANNED | Auth rate limits | ISRECOM-41: enable Better Auth `rateLimit` on `/api/auth/*`; memory storage for MVP, Redis secondary storage at scale. |
| PLANNED | Global body limit | ISRECOM-41: set an explicit global Fastify `bodyLimit` around 1 MiB. |

## Admin surface

The admin dashboard uses a separate Better Auth instance mounted at `/api/admin-auth`. Routes
that serve the dashboard carry `@AdminOnly()`, which couples them to that session surface and
installs `AdminGuard`; each handler also declares its resource/action requirement with
`@AdminPermission(...)`.

Platform roles may be stored as comma-joined values. A role containing `support` or `admin` is
staff and may discover the admin surface. Non-staff callers receive 404. Staff callers who are
authenticated but lack a declared permission receive 403 with error code
`ADMIN_PERMISSION_REQUIRED`; see `docs/features/admin-permissions.md` for the matrix and safe
full-admin fallback.

Admin writes retain the explicit SPA CSRF posture: the request must use a JSON content type and
its `Origin` must match `ADMIN_ORIGIN`. These checks run before permission evaluation for every
non-safe HTTP method.

## Per-endpoint checklist

1. Validate every input.
   Body, query, and route params use the shared Zod contract via `ZodValidationPipe`; handlers do not read raw request data. Malformed IDs 400 before reaching SQL.

2. Scope ownership in SQL.
   Protected reads and writes filter by `userId` from `@CurrentUser()`; never trust a `userId` from the body. Ownership misses return 404, never 403, because 403 confirms existence.

3. Return contract-shaped DTOs.
   Controllers return explicit DTOs, never raw DB rows; `GET /api/v1/auth/me` is the reference. Raw rows leak token columns and other users' data.

4. Rate limit money and abuse surfaces.
   Credits consumption and public endpoints get per-IP limits. Use Redis-backed storage once the API runs more than one instance.

5. Cap public request bodies tighter.
   Public endpoints set endpoint-level body limits below the global cap. A lead form is a few KB, not 1 MiB.

6. Require idempotency keys on money-touching mutations.
   Credits ledger writes, webhooks, and retried jobs dedupe by idempotency key. PRD §9 makes `credit_ledger` dedupe the source of truth.

7. Check state beyond ownership.
   The action must be valid now, not just owned by the user. No publish on a soft-deleted project; no consume on someone else's job.

8. Armor public endpoints.
   Lead capture (ISRECOM-37) uses `@Public()`, honeypot returns 200 and discards, unknown `formId` to project resolution returns 404. CORS is restricted to the sites domain, fields are strictly validated, body cap is tight, and cookies are not involved.

9. Log mutation audit context.
   Mutations log the authenticated `userId` alongside the envelope `requestId`. Audit correlation is nearly free.

10. Keep the SPA CSRF posture explicit.
    SameSite cookies, exact-origin CORS, and Better Auth origin checking cover the SPA; no CSRF tokens. Revisit only if auth cookies ever go cross-site.

Source docs: docs/PRD.md, docs/features/auth-accounts.md
