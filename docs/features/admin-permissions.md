# Admin dashboard staff permissions

> Status: **Implemented**. This document describes the role and permission model for the
> admin dashboard (`apps/admin`) and its NestJS API surface under `/api/v1/admin/*`.

## 1. Purpose

The admin dashboard supports two kinds of staff account without changing how those people use
the normal Wandit product:

- `admin` has every dashboard permission.
- `support` can sign in to the dashboard, investigate customers, and perform the limited
  operational actions in §3.
- `user` remains the default product role and cannot discover the admin API surface.

The server is the authorization authority. The SPA also hides inaccessible sections and actions
so staff do not encounter controls that the API will reject.

## 2. Stored platform roles

The shared role vocabulary is:

```ts
type AdminUserRole = "user" | "support" | "admin";
type StaffRole = "support" | "admin";
```

Better Auth may persist several roles as a comma-joined value such as `"user,support"` or
`"user,admin"`. Code must split, trim, and lowercase every stored value; it must never authorize
with `role === "admin"`. Shared helpers in `packages/contracts/src/v1/admin.ts` provide the only
normalization rules:

```ts
parseStoredRoles(role);   // all non-empty stored components
isAdminRole(role);        // any component is admin
isStaffRole(role);        // any component is support or admin
normalizeStoredRole(role); // highest privilege: admin > support > user
```

Unknown or empty components grant nothing. API DTOs use `normalizeStoredRole`, while permission
checks evaluate every component in the raw stored string.

## 3. Permission statement and role matrix

`packages/auth/src/admin-permissions.ts` is the single source of truth. Resources correspond to
dashboard sections; `read` opens a section and the additional action gates its mutations.

```ts
type AdminPermissionRequest = {
	[K in keyof typeof adminStatement]?: readonly (typeof adminStatement)[K][number][];
};
```

| Resource | Action | Admin | Support |
| --- | --- | :---: | :---: |
| `overview` | `read` | Yes | Yes |
| `users` | `read` | Yes | Yes |
| `users` | `grant-credits` | Yes | No |
| `users` | `ban` | Yes | Yes |
| `users` | `set-role` | Yes | No |
| `organizations` | `read` | Yes | Yes |
| `organizations` | `manage` | Yes | No |
| `billing` | `read` | Yes | Yes |
| `billing` | `manage` | Yes | No |
| `publications` | `read` | Yes | Yes |
| `feedback` | `read` | Yes | Yes |
| `feedback` | `manage` | Yes | Yes |
| `affiliates` | `read` | Yes | No |
| `affiliates` | `manage` | Yes | No |
| `links` | `read` | Yes | Yes |
| `links` | `manage` | Yes | No |
| `costs` | `read` | Yes | No |
| `costs` | `manage` | Yes | No |
| `academy` | `read` | Yes | Yes |
| `academy` | `manage` | Yes | No |
| `analytics` | `read` | Yes | No |
| `analytics` | `manage` | Yes | No |
| `settings` | `read` | Yes | No |
| `settings` | `manage` | Yes | No |

The Better Auth `createAccessControl` evaluator requires all requested actions to be granted by
one stored role. A comma-joined role value succeeds when any one component grants the complete
request.

## 4. Server enforcement

Admin controllers use two complementary decorators:

```ts
@AdminOnly()
@AdminPermission({ users: ["read"] })
```

`@AdminOnly()` couples the route to the separate admin-auth surface and installs `AdminGuard`.
`@AdminPermission(...)` declares the resource and action. It can be a controller default or a
handler override; for example, the users controller defaults to `users:read`, while grant
credits, role changes, and ban changes declare their own action.

The guard evaluates requests in this order:

1. A non-staff stored role receives 404, preserving the existing non-discoverability policy.
2. Non-safe methods must be JSON requests from the configured `ADMIN_ORIGIN` (the Admin surface
   section in `docs/api-security.md`).
3. The declared permission is evaluated with the shared matrix.
4. Staff without the permission receive 403 with code `ADMIN_PERMISSION_REQUIRED`. Staff already
   know that the dashboard exists, so the outsider-only 404 secrecy rule does not apply.

A route carrying `@AdminOnly()` but no permission metadata is restricted to a full admin. This is
a safe runtime default, not an authoring shortcut: the decorator coverage test enumerates every
admin controller handler and fails if its class or method lacks explicit, non-empty permission
metadata.

## 5. SPA gating

The admin SPA consumes the same client-safe matrix through
`@wandit/auth/admin-permissions`:

- Navigation items carry a required `permission`; invisible items and empty groups are removed
  from the sidebar and command search.
- Every dashboard route renders its page through `RequireAdminPermission`.
- Direct navigation to a denied URL keeps the URL and renders an access-denied state instead of
  redirecting.
- Mutation controls use `useAdminPermission` and are hidden or disabled when the action is not
  granted.

This gating is cosmetic and improves usability. It never replaces the NestJS guard in §4. A
stale tab or a role change can still submit a mutation, and the API will reject it.

## 6. Provisioning and session freshness

An admin provisions support access from the Users page by changing a user's platform role to
**Support**. There is no `SUPPORT_EMAILS` bootstrap variable. `ADMIN_EMAILS` continues to promote
configured accounts to `admin` only.

Server enforcement changes on the next admin API request because the separate admin Better Auth
instance does not use a cookie session cache. The SPA's cached session can remain stale: route
guards may serve `getSession()` for up to 30 seconds, while open components may keep the old role
from the reactive `useSession` store until the page reloads or the session refetches. Controls can
therefore remain visible, but any such action is rejected with 403 `ADMIN_PERMISSION_REQUIRED`;
after that response, the SPA drops its session cache.

Staff accounts cannot be banned. An admin must demote a staff account to `user` before banning
it. Staff can continue using the regular web application exactly like any other user.

## 7. How to tweak support access

Edit the `support` entry in `packages/auth/src/admin-permissions.ts`. A one-line action addition
or removal changes both NestJS authorization and SPA visibility. Keep the admin role explicit so
TypeScript reports a new statement resource that was not granted to full admins.

After a matrix edit, run:

```sh
npx -y pnpm@11.7.0 -F server test -- admin-permissions.spec.ts
npx -y pnpm@11.7.0 -F admin test -- permissions.spec.ts navigation.spec.ts
```

The server matrix test snapshots support grants as a readable table so every permission change
is an intentional review diff.

## 8. How to add an admin section

1. Add its resource and action list to `adminStatement`, then explicitly grant the required
   actions to `admin` and, if appropriate, `support`.
2. Add `@AdminPermission` to the controller and stricter handler overrides to each mutation.
3. Give the SPA navigation item its `permission` field.
4. Wrap each route page in `RequireAdminPermission` with the section permission.
5. Gate every mutation control with the matching action.
6. Update the matrix, controller coverage, navigation, and permission tests.

## 9. Key files

| Area | File |
| --- | --- |
| Role vocabulary and error code | `packages/contracts/src/v1/admin.ts` |
| Session role contract | `packages/contracts/src/v1/auth.ts` |
| Permission statement and staff roles | `packages/auth/src/admin-permissions.ts` |
| Admin Better Auth instance | `packages/auth/src/index.ts` |
| NestJS route metadata | `apps/server/src/modules/admin/presentation/http/decorators/admin-permission.decorator.ts` |
| NestJS authorization | `apps/server/src/modules/admin/presentation/http/guards/admin.guard.ts` |
| SPA permission helpers | `apps/admin/src/features/auth/lib/permissions.ts` |
| SPA route boundary | `apps/admin/src/features/auth/components/require-admin-permission.tsx` |
| SPA navigation requirements | `apps/admin/src/lib/navigation.ts` |
