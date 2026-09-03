# Admin dashboard staff permissions and view grants

> Status: **Implemented**. This document describes the role and permission model for the
> admin dashboard (`apps/admin`) and its NestJS API surface under `/api/v1/admin/*`.

## 1. Purpose

The admin dashboard supports two kinds of staff account without changing how those people use
the normal Wandit product:

- `admin` has every dashboard permission.
- `support` can sign in to the dashboard. Each support account gets an admin-managed set of
  visible dashboard views and the safe actions for those views described in §3 and §4.
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
dashboard sections; `read` opens a section and the additional action gates its mutations. The
Support column below is the default support view set, which preserves the original support-role
behaviour when no per-user grants row exists.

```ts
type AdminPermissionRequest = {
	[K in keyof typeof adminStatement]?: readonly (typeof adminStatement)[K][number][];
};
```

| Resource | Action | Admin | Support default |
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
| `conversations` | `read` | Yes | No |
| `conversations` | `read-raw` | Yes | No |
| `settings` | `read` | Yes | No |
| `settings` | `manage` | Yes | No |

The `conversations` resource controls access to customer transcripts. It is not a default support
view. If an admin grants it to a support account, support receives `read` but never `read-raw`, so
full tool data remains restricted to admins.

The Better Auth `createAccessControl` evaluator requires all requested actions to be granted by
one stored role. A comma-joined role value succeeds when any one component grants the complete
request.

## 4. Per-user view grants

`admin_view_grants` stores one optional row per user. Its primary key is `user_id`; `views` is a
JSONB array of the 13 contract view keys; `updated_by_user_id` records the admin who last changed
it. Deleting a user cascades to the row, while deleting the updating admin sets the audit pointer
to null.

The absence of a row is intentional fallback state, not an empty grant. A support account without
a row receives `defaultSupportViews`, which is today's eight-view matrix: overview, users,
organizations, billing, publications, feedback, links, and academy. An existing row is the exact
set the admin selected. Admin accounts always receive all views; normal admin authorization and
the SPA's admin path do not need a grant-table read.

The attribute layer still evaluates through Better Auth access control:

```ts
const statements = supportStatementsForViews(storedViews ?? defaultSupportViews);
const allowed = adminAccessControl.newRole(statements).authorize(required).success;
```

`supportViewActions` defines the safe action subset for every view. Granting all 13 views still
does not grant money or privilege mutations such as `users:set-role`, and conversations remains
read-only. Unknown stored view names are ignored.

Only a full admin can manage these grants. Setting a role to Support may save the checklist in the
same role-change flow; editing an existing support account loads its stored row (or defaults when
there is none). The role and grant row are committed in one per-user transaction, so a failed
grant write cannot expose the default set accidentally. Changing the account away from support
deletes the grants row. The dedicated `PUT /api/v1/admin/users/:userId/admin-views` endpoint
rejects non-support targets.

Migration `0064_admin-view-grants.sql` must be applied in each environment with:

```sh
pnpm db:migrate
```

Phase 2 can evolve the JSONB payload from a view-key array into a view-to-actions map without a
column-per-action redesign. Phase 1 deliberately stores no individual action checkboxes.

## 5. Server enforcement

Admin controllers use two complementary decorators:

```ts
@AdminOnly()
@AdminPermission({ users: ["read"] })
```

`@AdminOnly()` couples the route to the separate admin-auth surface and installs `AdminGuard`.
`@AdminPermission(...)` declares the resource and action. It can be a controller default or a
handler override; for example, the users controller defaults to `users:read`, while grant
credits, role changes, and ban changes declare their own action.

`@AdminPermission("any-staff")` means that the route needs the authenticated staff check but no
resource/action check. It is reserved exclusively for `AdminMeController.permissions`
(`GET /v1/admin/me/permissions`, exposed beneath the application's `/api` prefix). The decorator
coverage test pins `"any-staff"` to that exact handler and also asserts that the handler is a GET,
so adding it to another route or to a mutation fails the suite.

The guard evaluates requests in this order:

1. A non-staff stored role receives 404, preserving the existing non-discoverability policy.
2. Non-safe methods must be JSON requests from the configured `ADMIN_ORIGIN` (the Admin surface
   section in `docs/api-security.md`).
3. Admin role components authorize immediately with the full role and perform no grant-table read.
4. For a session that identifies as support, one database query reads the user's current role and
   grant row from the same snapshot by LEFT JOINing from the user table. A missing user or a
   DB-fresh non-staff role receives 404, so a stale support session cannot fall through to default
   grants after demotion. A DB-fresh admin role uses the full matrix; otherwise support statements
   are built from the joined views (or defaults) and evaluated through a Better Auth role.
5. Staff without the permission receive 403 with code `ADMIN_PERMISSION_REQUIRED`. Staff already
   know that the dashboard exists, so the outsider-only 404 secrecy rule does not apply.

The effective-permissions endpoint also reads role and grants with the same joined snapshot before
reporting them, rather than combining a cached session role with a later grant-row lookup.

A route carrying `@AdminOnly()` but no permission metadata is restricted to a full admin. This is
a safe runtime default, not an authoring shortcut: the decorator coverage test enumerates every
admin controller handler and fails if its class or method lacks explicit, non-empty permission
metadata.

## 6. SPA gating

The admin SPA uses one shared permission hook after the reactive Better Auth session resolves.
Admins use the complete local `adminStatement` map immediately and do not fetch the
effective-permissions endpoint. For support sessions, mounted consumers of the hook enable the
React Query request to `GET /api/v1/admin/me/permissions`; this includes the initial landing-page
choice, navigation, route boundaries, and action gates. The returned server-computed map is
considered fresh for 30 seconds. Non-staff sessions receive an empty map.

- Navigation items carry a required `permission`; invisible items and empty groups are removed
  from the sidebar and command search.
- Every dashboard route renders its page through `RequireAdminPermission`.
- Direct navigation to a denied URL keeps the URL and renders an access-denied state instead of
  redirecting.
- Mutation controls use `useAdminPermission` and are hidden or disabled when the action is not
  granted.

This gating is cosmetic and improves usability. It never replaces the NestJS guard in §5. A
stale tab or a role change can still submit a mutation, and the API will reject it.

## 7. Provisioning and session freshness

An admin provisions support access from the Users page by changing a user's platform role to
**Support** and selecting at least one dashboard view. There is no `SUPPORT_EMAILS` bootstrap
variable. `ADMIN_EMAILS` continues to promote configured accounts to `admin` only.

Server enforcement changes on the next admin API request because the separate admin Better Auth
instance does not use a cookie session cache. The SPA's cached session can remain stale: route
guards may serve `getSession()` for up to 30 seconds, while open components may keep the old role
from the reactive `useSession` store until the page reloads or the session refetches. Controls can
therefore remain visible. Revoking a support permission produces 403
`ADMIN_PERMISSION_REQUIRED`, after which the SPA drops its session and permissions caches. A
support-to-user demotion produces the guard's deliberate 404 instead; the current SPA does not
invalidate its session cache from that response, so the stale controls disappear on the next
normal session refresh or reload.

Staff accounts cannot be banned. An admin must demote a staff account to `user` before banning
it. Staff can continue using the regular web application exactly like any other user.

## 8. How to tweak support access

Edit `supportViewActions` to change the safe action subset a granted view provides, or
`defaultSupportViews` to change the no-row fallback. Keep the admin role and every support-view
entry explicit so TypeScript reports a new statement resource until both policies are chosen.

After a matrix edit, run:

```sh
npx -y pnpm@11.7.0 -F server test -- admin-permissions.spec.ts
npx -y pnpm@11.7.0 -F admin test -- permissions.spec.ts navigation.spec.ts
```

The server matrix test snapshots support grants as a readable table so every permission change
is an intentional review diff.

## 9. How to add an admin section

1. Add its resource and action list to `adminStatement` and the matching key to
   `adminViewValues`, then explicitly grant every action to `admin` and choose its safe
   `supportViewActions` subset.
2. Add `@AdminPermission` to the controller and stricter handler overrides to each mutation.
3. Give the SPA navigation item its `permission` field.
4. Wrap each route page in `RequireAdminPermission` with the section permission.
5. Gate every mutation control with the matching action.
6. Update the matrix, controller coverage, navigation, and permission tests.

## 10. Key files

| Area | File |
| --- | --- |
| Role vocabulary and error code | `packages/contracts/src/v1/admin.ts` |
| Session role contract | `packages/contracts/src/v1/auth.ts` |
| Permission statement and staff roles | `packages/auth/src/admin-permissions.ts` |
| View-grant API contracts | `packages/contracts/src/v1/admin.ts` |
| View-grant table | `packages/db/src/schema/admin-view-grants.ts` |
| View-grant migration | `packages/db/src/migrations/0064_admin-view-grants.sql` |
| Admin Better Auth instance | `packages/auth/src/index.ts` |
| NestJS route metadata | `apps/server/src/modules/admin/presentation/http/decorators/admin-permission.decorator.ts` |
| NestJS authorization | `apps/server/src/modules/admin/presentation/http/guards/admin.guard.ts` |
| SPA permission helpers | `apps/admin/src/features/auth/lib/permissions.ts` |
| SPA route boundary | `apps/admin/src/features/auth/components/require-admin-permission.tsx` |
| SPA navigation requirements | `apps/admin/src/lib/navigation.ts` |
