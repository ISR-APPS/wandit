# Workspaces and project sharing (Lovable model)

Status: design, revision 3. Revision 2 applied the three-lens review (money, authorization,
fit). Revision 3 closes five gaps found in a second check of that review.
Branch `feat/workspaces`. It extends `teams-workspaces.md` (Teams v1). The target is the
Lovable model of November 2026 (docs.lovable.dev: workspace, people, share-project,
collaboration, project-visibility, projects/settings).

## 0. Decisions (Zack, 2026-11-04)

1. Every user has a **personal workspace**. Its money is the owner's personal credit pool and
   personal plan. Invited members spend the owner's credits. No Stripe or ledger migration.
   Personal projects stay where they are (`projects.organization_id IS NULL`).
2. **No plan gates on roles.** Every plan can use Admin, Editor, Viewer, Can edit, Can view.
3. Extras in scope: project **Workspace access** (Can edit / Can view / Restricted),
   **invite links** (workspace and project), **transfer project owner**, **move project to
   another workspace**.
4. **Project-level sharing is for V2 app projects only.** V1 page projects get
   workspace-level access only (members and the Viewer role still apply).

Deliberate differences from Lovable (keep them):
- Billing stays **owner-only** (Zack, 2026-08-03). In a personal workspace, also member
  credit limits and project cost caps are owner-only, because the money is the owner's.
- A personal workspace has **exactly one owner**, its `personal_owner_user_id`. Nobody can
  grant `owner` there (web, Better Auth, or staff admin).
- In a personal workspace, the workspace owner owns every project (`projects.user_id` =
  owner), also a project that a member creates. Transfer of project owner is for team
  workspaces only.
- **Move to another workspace needs the workspace owner** of the source workspace. Project
  creators and admins cannot move a project out.
- Workspace Editors can invite Viewers, but they cannot remove members or cancel
  invitations (owners and admins do that).
- Team workspace creation keeps the Business checkout (unchanged).
- The `organizationsEnabled` toggle stops NEW collaboration (section 3.4). Access that
  exists stays.

## 1. Data model (migration `0091_workspaces-sharing`)

| Change | Notes |
|---|---|
| `organization.personal_owner_user_id text NULL UNIQUE` FK user (restrict) | Set = the personal workspace of that user. NULL = team workspace. |
| `projects.workspace_access` pg enum `project_workspace_access` (`can_edit`, `can_view`, `restricted`), NOT NULL default `can_edit` | Lovable "Workspace access" row. |
| `ai_usage_events.payer_user_id text NULL` FK user (restrict) + partial index `(payer_user_id, user_id, created_at) WHERE payer_user_id IS NOT NULL` | Set only when a personal pool pays for another user's work. `user_id` stays the actor. |
| `connector_generation_attempts.payer_user_id text NULL` FK user | Same rule. Recovery rebuilds the subject from it. |
| `device_sessions.payer_user_id text NULL` FK user | `user_id` = actor (end, lock). Payer = `organization_id` or `payer_user_id ?? user_id` (allowance, billing). |
| New `project_members` | `id uuid`, `project_id` FK projects (cascade), `user_id` FK user (restrict), `role` enum `project_member_role` (`admin`, `editor`, `viewer`), `invited_by_user_id` FK user NULL, `created_at`, `updated_at`. UNIQUE `(project_id, user_id)`, index `(user_id)`. |
| New `project_invitations` | `id uuid`, `project_id` FK (cascade), `email text` (canonical lower case), `role project_member_role`, `status` (`pending`, `accepted`, `declined`, `canceled`), `inviter_user_id` FK user, `expires_at`, `created_at`, `responded_at NULL`. Partial UNIQUE `(project_id, email) WHERE status = 'pending'`. Index `(email, status)`. |
| New `invite_links` | `id uuid`, `token text UNIQUE` (32 random bytes, base64url), `organization_id` FK NULL (cascade), `project_id` FK NULL (cascade), `role text`, `created_by_user_id` FK user, `expires_at`, `revoked_at NULL`, `created_at`. CHECK exactly one of `organization_id`, `project_id`. Partial UNIQUE `(organization_id, role) WHERE revoked_at IS NULL AND organization_id IS NOT NULL`, partial UNIQUE `(project_id) WHERE revoked_at IS NULL AND project_id IS NOT NULL`. |

Expiry: workspace links **5 days**, project links **7 days**, email invitations **30 days**
(workspace and project). Better Auth `invitationExpiresIn` changes from 7 to 30 days, and the
invitation email renders the expiry from that value. One active link per role (workspace)
and one per project: a new link revokes the old one in the same transaction. The token is
stored in clear text, like the Better Auth invitation id in the invite URL.

Personal workspace rows:
- `name` = first word of `user.name` (or the email local part), cut to 38 characters, +
  `'s workspace`. The name is 50 characters at most, and the suffix always stays. The
  invitation email no longer appends " workspace" to the name.
- `slug` = `personal-` + a random hex string. Better Auth `beforeCreateOrganization` and
  `beforeUpdateOrganization` refuse any user slug that starts with `personal-`.
- The conflict target is `personal_owner_user_id` only, so a rerun is a no-op.
- Backfill: SQL after the generated DDL creates one organization and one `owner` member row
  for each user that has none. Runtime: `ensurePersonalWorkspace(userId)` (idempotent, same
  rules) runs in `onUserCreated` and on `GET /api/v1/workspaces`.

## 2. Roles

### 2.1 Workspace roles (`member.role`)

| Key | UI label | Notes |
|---|---|---|
| `owner` | Owner | Team workspaces can have several owners. Personal: only the personal owner. |
| `admin` | Admin | Everything except owners and billing. In a personal workspace also no limits. |
| `member` | **Editor** | The key stays `member` (Better Auth default role, no data migration). |
| `viewer` | Viewer | New. Read only. |

Permission statements (`packages/auth/src/permissions.ts`):
- owner, admin: unchanged.
- member (Editor): `project: [create, update]`, `publish: [manage]`, `invitation: [create]`.
- viewer: Better Auth `memberAc` statements only.

Invitation rules run in the global `hooks.before` branch for
`/organization/invite-member` (`packages/auth/src/index.ts`), BEFORE the plugin handler,
because the plugin cancels or resends a pending invitation before `beforeCreateInvitation`.
One pure function with a spec decides:
- A caller who is not owner or admin may send only `role: "viewer"`, may not send
  `resend`, and may not invite an email that has a pending invitation in that workspace.
- Only an owner may invite `owner`, and only in a team workspace.
- Invitations into a personal workspace need `organizationsEnabled`.

Other guards on the personal-owner rule: `beforeUpdateMemberRole` refuses `owner` in a
personal workspace and any change of the personal owner. Staff `setMemberRole` refuses
`owner` on a personal org. `projectRoleOf` gives workspace owner power in a personal
workspace only to `personal_owner_user_id`, never to `member.role = owner`.

Leave, removal, and downgrade (remove-member uses `afterRemoveMember`; leave has no plugin
hook, so a global `hooks.after` matcher on `/organization/leave` runs the same cleanup;
role update to viewer uses `afterUpdateMemberRole`). In one transaction where possible:
- Delete the user's `project_members` rows on projects of that workspace (removal and
  leave only).
- Cancel the user's non-terminal builder turns on that workspace's projects through the
  existing cancel path (it refunds the holds). This also runs on a downgrade to viewer.
- Team workspace, removal and leave: projects with `user_id` = that user move to the
  earliest `owner` member.
- Removal and downgrade to viewer: revoke the active invite links of the workspace and of
  its projects. The user knows the tokens, and a link gives a member row or a grant again.
- Removal only: cancel pending project invitations to the user's email on the workspace's
  projects.
- Staff `setMemberRole` to `viewer` runs the same downgrade cleanup. On a cleanup error it
  writes the old role back, as the Better Auth hook does.

### 2.2 Project roles (V2 only)

Effective role of user U on project P: `owner`, `admin`, `editor`, `viewer`, or none (404).

Rules (pure function `projectRoleOf`, table-driven spec):
1. Personal project (`organization_id IS NULL`): U = `projects.user_id` gives `owner`.
   Team project: U has the workspace role `owner` gives `owner`. U = `projects.user_id`
   and U is a member whose roles are not only `viewer` gives `owner`.
2. Role from the workspace membership (team org, or the personal workspace of
   `projects.user_id`):
   - owner (team only): `owner`
   - admin: `admin`; Restricted gives none
   - member (Editor): Can edit gives `editor`; Can view gives `viewer`; Restricted gives none
   - viewer: `viewer`; Restricted gives none
3. A `project_members` row gives its role.
4. The result is the highest of 1, 2, and 3. Deleted projects and, on `/v2` routes,
   projects whose engine is not `v2_app` give none.

Capabilities:

| Action | Needs |
|---|---|
| Open the project, chat history, code, versions, diff, theme, preview, wake the sandbox, publish status, stream turns, turn estimate, sharing state | viewer |
| Prompt (start or cancel a turn), restore a version, edit the theme, publish, rollback, unpublish, secrets, Cloud, mobile builds, device sessions, rename | editor |
| Invite or change Can edit / Can view people, set Workspace access to Can edit or Can view, project invite link, see pending invitations and the link token | editor |
| Invite or change project admins | admin |
| Cost caps: team project | admin |
| Cost caps: personal project | owner |
| Delete, transfer owner (team only), set or clear Restricted, Publish anyway | owner |
| Move to another workspace | workspace owner of the source (team: role `owner`; personal: the personal owner) |
| Custom domains and domain orders | unchanged: `/v1` routes, header-scoped, workspace `domain:manage` (owner, admin) in the project's own workspace. A direct grant alone never manages domains. |

Everyone may remove their own direct grant (leave the project). Nobody removes the project
owner. An editor manages only editor and viewer grants; admin and owner manage all grants.
Removing or downgrading a direct grant revokes the project invite link and cancels the
user's non-terminal turns on that project (downgrade to viewer or removal). A narrower
Workspace access (Can edit to Can view or Restricted, Can view to Restricted) also revokes
the project invite link.

`DELETE /api/v1/projects/:projectId` on a V1 project keeps the workspace rule
`project:delete`, checked against the project's own workspace role, not the header.

## 3. Request scope

### 3.1 Workspace context (header `x-wandit-workspace`, unchanged authority)

```ts
type WorkspaceContext =
  | { kind: "personal" }                       // the caller's own personal workspace
  | { kind: "shared-personal"; organizationId: string; ownerUserId: string; role: string; roles: WorkspaceRoleName[] }
  | { kind: "org"; organizationId: string; role: string; roles: WorkspaceRoleName[] };
```

- No header, `personal`, or the caller's own personal org id gives `personal`.
- Another user's personal org id where the caller is a member gives `shared-personal`.
- A team org id where the caller is a member gives `org`. Not a member gives 404.
- `@RequireWorkspacePermission` checks roles in `shared-personal` and `org`. In
  `shared-personal`, `billing` and `limits` are always denied. `@PersonalWorkspaceOnly`
  allows only `personal`.
- Every existing branch on `workspace.kind`, and every place that turns an org id into a
  `CreditOwner`, must handle a personal org on purpose. A personal org id maps to
  `userOwner(personal_owner_user_id)`, never to `orgOwner(personalOrgId)`.

### 3.2 Project scope

```ts
type ProjectScope =
  | { kind: "personal"; ownerUserId: string; actorUserId: string; actorRoles: WorkspaceRoleName[]; actorIsLimitExempt: boolean }
  | { kind: "org"; organizationId: string; actorUserId: string; actorRoles: WorkspaceRoleName[]; actorIsLimitExempt: boolean };
```

The old field `userId` is gone on purpose: the compiler shows every site, and each site
picks owner (authorization, payer, owner columns) or actor (attribution, analytics, uploads,
preview-token and device-session `uid`, locks per person).

- `personal`: `ownerUserId` = caller, `actorRoles` = `["owner"]`. `shared-personal`:
  `ownerUserId` = workspace owner, `actorRoles` = the member roles.
- `projectScopePredicate`: personal = `user_id = ownerUserId AND organization_id IS NULL`;
  org = `organization_id = O`. Restricted rule, added to both, matching `projectRoleOf`:
  no filter when the actor is the workspace owner (team `owner` role, or the personal owner).
  Otherwise `workspace_access <> 'restricted' OR (user_id = actor AND roles are not only
  viewer) OR EXISTS (project_members row of the actor)`.
- `meteringSubjectFrom`: personal = `{ actorUserId, payerUserId: ownerUserId when it differs
  from the actor, actorIsLimitExempt }`; org = unchanged.
- `projectOwnerColumns`: personal = `{ organizationId: null, userId: ownerUserId }`; org =
  `{ organizationId, userId: actorUserId }`.
- Limit exemption: the personal owner and team owners/admins are exempt from the DEFAULT
  member limit. An explicit per-member row binds everybody except the personal owner, who
  cannot have one.

### 3.3 V2 project routes: project access, not the header

- `ProjectAccessService.resolve(userId, projectId)`: one query on `projects`
  (`deleted_at IS NULL`) with LEFT JOIN on `organization` (personal owner), `member` (team
  org, or the personal org of `projects.user_id`), and `project_members`. It returns the
  project row (id, user_id, organization_id, engine, workspace_access), the workspace (kind,
  organization id, name, personal owner), the caller's workspace roles, and the effective
  role from `projectRoleOf`.
- `ProjectAccessGuard` is a global `APP_GUARD` registered after `WorkspaceContextGuard`. It
  reads `@RequireProjectRole("viewer" | "editor" | "admin" | "owner")` and the `:projectId`
  param, answers 404 for none (and for a non-`v2_app` engine on `/v2` routes), and attaches
  the access to the request. `@CurrentProjectAccess()` reads it.
- Every route that gets `@RequireProjectRole` loses `@RequireWorkspacePermission`, so the
  header role never decides a `:projectId` route. This includes
  `GET/PATCH/DELETE /api/v1/projects/:projectId` (view / editor / owner; V1 delete: see 2.2).
- `projectScopeFromAccess(access, actorUserId)` builds the `ProjectScope` from the PROJECT
  ROW: team project gives `org` with the project's org; personal project gives `personal`
  with `ownerUserId = projects.user_id`. Existing services keep their scope reads.
- `V2BuilderEnabledGuard` passes when the request has a resolved project access (an invited
  collaborator does not need the rollout flag). `POST /v2/projects` keeps the flag.
  `GET /v2/models` opens to every signed-in user (it reads no database).
- V1 write routes without a permission decorator get `project:update` (a viewer must not
  write): leads status and archive, sheet-sync POST, `v1/chats/:chatId/ai-stream`.

### 3.4 Toggle `organizationsEnabled`

When it is false: Better Auth invite-member and accept-invitation into a personal
workspace, project invitation create and accept, and invite link create and accept answer
403 `ORGANIZATIONS_DISABLED`. The web hides the switcher (unless the user has a membership
other than the own personal workspace), People, Share, and Shared with me. Existing members
and grants keep their access.

## 4. Money rules

| Work on | Payer | Actor |
|---|---|---|
| Team project | org pool of `projects.organization_id` | caller |
| Personal project | personal pool of `projects.user_id` | caller |

Metering and credits:
- `MeteringSubject` gains `payerUserId?: string | null`. `subjectPayer` = org if
  `organizationId`, else user `payerUserId ?? actorUserId`.
- The event row writes `payer_user_id` only when it differs from the actor. `eventPayer` =
  org if `organization_id`, else user `payer_user_id ?? user_id`. Personal fingerprints keep
  their current shape when payer = actor.
- `credits.repository.ts` `usageEventOwnerPredicate` (settled balance in-flight CTE,
  activity feed, sum reserved): personal pool X = `organization_id IS NULL AND ((user_id = X
  AND payer_user_id IS NULL) OR payer_user_id = X)`.
- Member limits in a personal workspace: limit rows of the owner's personal org; spend =
  events with `payer_user_id = owner AND user_id = actor` this calendar month (UTC). The
  settle/reconcile re-check rebuilds the subject with `payer_user_id`. Limit writes for a
  personal org take the owner's personal credit lock (`creditOwnerLockValue(userOwner(...))`).
- Member limits GET/PUT also accept external collaborators (users with a `project_members`
  row on the workspace's projects).
- Credit threshold emails go to the payer, not the actor.
- `// LIMIT:` the 3-parallel-turns cap stays per actor. A shared pool with N editors can run
  3N turns, as an org pool can today.

Background paths:
- builder-turn (Trigger task and harness host): the runtime reads the hold event row by its
  idempotency key with no payer check and builds the subject from the row (`user_id`,
  `payer_user_id`, `organization_id`, and the exemption from the hold snapshot). When
  billing is on and the hold is missing or does not match the turn, the turn fails. No
  payload field is added. Turn promotion and host recovery use the same rule.
- Image and marketing-asset runners: the payer comes from the loaded project row
  (`payerUserId = projects.user_id` when `organization_id` is null and it differs from the
  payload actor). The strict personal user-equality check goes away. No payload field.
- Connector generation attempts write and read `payer_user_id`.
- Mobile builds: `mobile_builds.user_id` stays the actor; the runtime takes the payer from
  the hold event row (same as builder-turn).
- Device sessions: `user_id` = actor; `payer_user_id` set; allowance and its lock use the
  payer; end and the per-person lock use the actor.
- Backend provisioning, its plan slot, publish balance, set-secret host tool, lead sheet
  auto-sync: payer and scope from the project row.
- Column rules: `builder_turns.user_id`, `app_builds.user_id`, `mobile_builds.user_id` hold
  the actor. `app_backends`, `project_secrets`, `sandbox_sessions` owner columns hold the
  project owner/payer.

Views:
- `GET /v1/credits/balances`: skip the caller's own personal org; map another user's
  personal org to the owner's personal pool.
- Credits in `shared-personal`: the owner's pool balance is visible to every member; the
  ledger needs `admin`. Billing routes in `shared-personal` answer 403
  `WORKSPACE_PERMISSION_DENIED` (catalog reads stay open).
- 402 and member-limit 403 details gain `payer: { kind: "user" | "org", isActor: boolean,
  organizationId: string | null }`. The turn-estimate answer gains `payer: { isActor,
  outOfCredits }`, so the builder reads the payer pool, not the header pool.

## 5. API (contracts first; routes under `/api`)

Compatibility: new response fields are `.optional()` or have `.default()` in the first
release, so an older API answer still parses.

Workspace (header-scoped, `packages/contracts/src/v1/workspaces.ts`):
- `GET /v1/workspaces`: own personal workspace first (ensured), then every membership.
  Summary gains `kind: "personal" | "team"` (default `team`) and `isOwnPersonal` (default
  false). Role enum gains `viewer`.
- `GET /v1/workspace/collaborators` (owner/admin): external collaborators on this workspace's
  projects: user, email, and each project with its role. Restricted projects an admin cannot
  open are left out.
- `GET/POST /v1/workspace/invite-links`, `DELETE /v1/workspace/invite-links/:linkId`
  (owner/admin; roles `member`, `viewer`).

Invite links (signed-in user with a verified email):
- `GET /v1/invite-links/:token`: kind, workspace or project name, role, inviter, expired.
- `POST /v1/invite-links/:token/accept`: workspace link adds a member. A user who is
  already a member keeps their role (no change), so a member that an admin downgraded cannot
  raise their role with an old link. Project link upserts a grant (no downgrade), only for a
  live V2 project. Answers `{ kind: "workspace", organizationId } | { kind: "project",
  projectId }`.

Project sharing (`packages/contracts/src/v2/sharing.ts`):
- `GET /v2/projects/:projectId/sharing` (viewer): owner, workspace, workspace access, direct
  members, the caller's role. Editor and higher also get pending invitations and the active
  link with its token; a viewer gets only `{ role, expiresAt }` of the link. Spec case: a
  viewer gets no token and no pending invitations.
- `POST /v2/projects/:projectId/invitations` `{ emails: 1..20, role }` (editor; admin role
  needs admin). One email each through `EmailService` and the invitation send policy.
- `DELETE /v2/projects/:projectId/invitations/:invitationId` (editor).
- `PATCH /v2/projects/:projectId/members/:userId` `{ role }`,
  `DELETE /v2/projects/:projectId/members/:userId` (rules in 2.2).
- `PATCH /v2/projects/:projectId/workspace-access` `{ workspaceAccess }`.
- `PUT /v2/projects/:projectId/invite-link` `{ role: "editor" | "viewer" }`,
  `DELETE /v2/projects/:projectId/invite-link` (editor).
- `POST /v2/projects/:projectId/transfer` `{ newOwnerUserId }` (owner; team project; target
  is an owner, admin, or editor of the workspace).
- `POST /v2/projects/:projectId/move` `{ destinationWorkspaceId: "personal" | orgId,
  keepCollaborators: boolean }` (workspace owner of the source; the caller can create
  projects in the destination). 409 `PROJECT_MOVE_BLOCKED` with a reason when: a builder
  turn is in any non-terminal status (also `waiting`), an `ai_usage_events` row of the
  project is `reserved`, a publish or mobile build is in flight, a device session is
  active, a custom domain is attached, or the destination payer has no free backend slot.
  The backend slot count and the owner-column update run in one transaction under the
  destination payer's `app-backends` lock. The move updates the project owner columns and
  the owner columns of `app_backends`, `project_secrets`, `sandbox_sessions`; resets
  `workspace_access` to `can_edit`; revokes the project link; deletes direct grants and
  pending invitations unless `keepCollaborators`.
- `GET /v2/shared-projects`: projects with a direct grant for the caller, with role and
  workspace name.
- Invitee (session email = invitation email, canonical, verified, on every route):
  `GET /v2/project-invitations` (mine, pending), `GET /v2/project-invitations/:id`,
  `POST .../:id/accept` answers `{ projectId }`, `POST .../:id/decline`. Accept checks again
  that the project is not deleted and its engine is `v2_app`, else 404
  `PROJECT_INVITATION_INVALID`.
- `projectSchema` (v1, so also `appProjectSchema`) gains optional `access: { role,
  workspaceAccess, workspace: { id, name, kind } }`. The web treats a missing `access` as the
  old behavior (full access).
- New error codes: `PROJECT_MOVE_BLOCKED`, `INVITE_LINK_INVALID`,
  `PROJECT_INVITATION_INVALID`.

## 6. Web

- Switcher: own personal workspace (org name, scope id `personal`, no header), team
  workspaces, other users' personal workspaces (org id header). Role labels Owner / Admin /
  Editor / Viewer. The switcher and the invitations banner count only memberships other
  than the own personal workspace when they check the toggle. People and limits links show
  for every workspace while the toggle is on. While it is off, the own personal workspace
  shows no People and no limits link.
- People page `/workspace/people` in `DashboardShell`: rename (owner/admin), invite by email
  (several emails, role select limited by the caller's role), invite links per role,
  members with role select and remove (AlertDialog), pending invitations (role label, copy
  link, cancel), collaborators, leave (AlertDialog). Calls live in `features/workspaces/api`.
- V2 top bar: **Share** button with an avatar stack. Share dialog: invite by email + role
  (Admin / Can edit / Can view), people with access (role menu, remove), pending
  invitations, Workspace access row, Invite link row with copy.
- V2 panels read `project.access.role`, never the `useWorkspace()` role flags: viewers get a
  read-only builder (composer, restore, theme, publish, Cloud, secrets, mobile builds hidden
  or disabled with a short note); caps and delete follow the table in 2.2.
- Exception, the Domains panel: its routes stay header-scoped. It allows domain actions only
  when `project.access.workspace` is the active workspace and that workspace role has
  `domain:manage`. Otherwise it shows a short note: owners and admins of the project's
  workspace manage domains.
- The composer reads the payer state from the turn-estimate answer. The billing modal opens
  the plan picker only when the payer is the caller's active workspace and the caller can
  manage its billing; otherwise it shows the existing "pool empty" notice.
- V2 Settings panel: Transfer ownership (team only) and Move to workspace.
- Dashboard: "Shared with me" section; card menu Share / Rename / Delete by role.
- Accept pages: `/project-invite/$invitationId`, `/join/$token`. The pending invitations
  banner shows project invitations too.
- i18n keys in en, fr, ar.

## 7. Admin

- Role lists gain `viewer`; `primaryRole` keeps unknown roles visible (no silent "member").
- Organizations list: filter `kind` (team by default, personal on demand); a "Personal" badge.
- A personal org: the admin credit grant, the offline org subscription grant, and set-role
  `owner` answer 400. The detail page shows the balance of the owner's personal pool.

## 8. Release order

The Trigger worker (`trigger.dev deploy`) and the harness host (`start:host`) deploy apart
from the API. Two rules give the order:
- The new worker and host read the new `payer_user_id` columns. Migration 0091 must run
  first. It runs as the Railway pre-deploy step of the API.
- An old worker or host reads a member's hold with a payer check, fails, and runs the turn
  free. Old image and marketing runners fail member runs with `ownership_mismatch`. Only a
  member or collaborator of another user's personal workspace makes such a hold.

Order:
1. Set `organizationsEnabled` to false (or keep it false). Then no new member or
   collaborator joins a personal workspace. Existing team members keep their access.
2. Deploy the API. Its pre-deploy step runs migration 0091. The old worker and the old host
   ignore the new nullable columns.
3. Deploy the Trigger worker and the harness host from the same commit.
4. Set `organizationsEnabled` to true.

On staging, Railway and the Trigger GitHub Action start in parallel. A turn that starts on
the new worker before the migration ends fails. Retry it after the API deploy ends.

## 9. Accepted limits

- A removed collaborator keeps an issued preview token until it expires: 15 minutes in the
  builder, up to 60 minutes for a phone device link.
- The native app shows the caller's own personal workspace only.
- Admin per-user AI spend counts the actor's events, also when another pool paid.
- The parallel-turn cap is per actor (section 4).
