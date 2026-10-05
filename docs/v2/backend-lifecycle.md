# Backend lifecycle (WANDIT-184)

Each V2 project gets one hidden Supabase project at creation (D18). A
running Supabase project costs money also when nobody uses it (D3). This
file tells how wandit pauses an idle backend, wakes it again, deletes it
after a project delete, and limits the number of backends per plan.

All numbers in this file are provisional defaults from D3. They are not
settled product rules. The Supabase for Platforms contract (WANDIT-153)
replaces them. The code reads every number from `BACKEND_DEFAULTS` in
`apps/server/src/modules/app-builder/domain/backend-lifecycle.ts`.

## States

The `app_backends.status` column holds the state. Each write is a
compare-and-set in `AppBackendsRepository`, so two writers never undo
each other.

| State | Meaning | Who writes it |
| --- | --- | --- |
| `creating` | The provisioning task creates the Supabase project. | `BackendsService.provisionBackend` (insert, or a retry of an `error` row) |
| `active` | The project runs. | The `provision-backend` task (`markActive`); a finished restore (`markRestored`) |
| `paused` | Supabase paused the project. It costs no compute. | The pause sweep (`markPaused`, only from `active`) |
| `restoring` | A restore call went out. Supabase brings the project up. | The Cloud tab restore and the turn wake (`markRestoring`, only from `paused`) |
| `deleting` | The project of the backend is deleted. The Supabase project waits for the grace window. | The `delete-app-project` task, or the sweep for an orphaned backend (`markDeleting`) |
| `deleting`, `ref` null | Terminal. The Supabase project is gone. | The pause sweep (`markDeleted`) |
| `error` | Provisioning failed, or a `creating` row had no write for 30 minutes (`backend_provision_timeout`), or a restore failed: Supabase reported `RESTORE_FAILED` or `REMOVED`, or the project was still not up 10 minutes after the restore call (`backend_restore_failed`). | The `provision-backend` task (`markError`); `GET cloud/backend` and the sweep (`markCreatingTimedOut`, only from `creating`); the wake, `GET cloud/backend`, and the sweep (`markRestoreFailed` and `markRestoreTimedOut`, only from `restoring`) |

`markActive` and `markError` never change a `deleting` row. A project
that is deleted while its backend is provisioned keeps `deleting`, so the
sweep still deletes the Supabase project; the provisioning task then
answers `skipped` and writes no audit row.

## Retry of a failed backend

`POST cloud/backend` on an `error` row provisions it again. The Cloud tab
shows the "Try again" button for this. `writeCreatingWithinLimit` moves
the row back to `creating` under the per-payer lock, with the same plan
check as a new row, because an `error` row is not in the count. The
update is a compare-and-set on `error`, so a second click starts no
second run. The row gets a new request key, so the new run gets a new
Trigger idempotency key. Every write of the runtime (`markCreated`,
`markActive`, `markError`) applies only while the row holds the request
key of its run, so a run of the old key cannot change the retried row.

The retry keeps the ref. The new run reads the status of that project
first:

- A running or coming-up project is reused. A paused (`INACTIVE`) or a
  `RESTORE_FAILED` project gets one restore call. Its data stays.
- An `INIT_FAILED` project never came up and holds no data. The run
  deletes it, then creates a new project.
- A `REMOVED` project, or a 404, is gone. The run creates a new project.

The create call gets one fetch only: a retry after a lost answer could
create a second paid project that no row holds. A reused project that was
active before (the row has an anon key) keeps its schema and its auth
config: the run skips the base schema and the auth step, so a migration of
the app or a published auth URL stays. A reused project that never went
active gets both again; the base schema (`0000_base.sql`) can run twice.

A `creating` row with no write for 30 minutes (longer than the 15 minute
`maxDuration` of the task plus a queue wait) moves to `error` with
`backend_provision_timeout` on the next `GET cloud/backend` or sweep run
(`markCreatingTimedOut`). This ends a run that never started or stopped
without a status write, and the Cloud tab shows "Try again".

Before a create call, the run looks for a live project named
`wandit-<projectId>` (`GET /v1/organizations/{slug}/projects?search=`,
checked in the Supabase OpenAPI on 2026-10-04 as
`v1-get-all-projects-for-organization`). A create call whose answer was
lost leaves such a project on no row; the run adopts it with the password
that it stored before that call. The create call gets no retry after a
timeout or a 5xx; a 429 still retries, because the upstream ran nothing.
An `INIT_FAILED` project of a row that went active before is not deleted:
the run fails and keeps it for an operator.

The enum has no `deleted` value. A `deleting` row without a ref is the
terminal state, so the Cloud tab contract and the web states stay as
they are.

## Activity

`app_backends.last_active_at` is the activity stamp. `touchActive` writes
it, only on an `active` row. Four events stamp it:

- The end of a builder turn, a failed or stopped turn too (`finishTurn`
  in `builder-turn.runtime.ts`).
- A publish or a rollback that went live (`runPublishApp` in
  `publish-app.runtime.ts`).
- A Cloud tab panel read (`CloudService.requireActiveBackend`).
- An agent backend tool call (`resolveActiveBackend`).

A wake (`markRestored`) and provisioning (`markActive`) also set the
stamp. A failed stamp logs `backend.touch-failed` and never fails the
caller.

Limits of the stamp:

- Wandit cannot see the traffic of a published app. A published app with
  real users and no builder activity pauses after the published window.
  The longer window is the only guard.
- A pause stops the `pg_cron` jobs of the project until the next wake.
- A turn that starts after the idle window and runs across 03:00 UTC can
  see its backend paused in the middle of the turn. The next turn wakes
  it.

## Windows

| Window | Default | Env override |
| --- | --- | --- |
| Idle days before the sweep pauses an unpublished backend | 7 | `BACKEND_IDLE_DAYS` |
| Idle days before the sweep pauses a published backend (ESTIMATE) | 30 | `BACKEND_IDLE_DAYS_PUBLISHED` |
| Grace days between `deleting` and the Supabase delete | 7 | none |

A backend counts as published when its project has an `active` row in
`deployments`. WANDIT-178 writes that row for a V2 app. A row that never
got a stamp counts from `created_at`: creation alone is no activity. A
row exactly on the window stays until the next run.

## Pause sweep

The Trigger task `backend-pause-sweep` runs every day at 03:00 UTC. It has
its own queue at concurrency 1, so it never takes a slot of the
provisioning queue. It runs one attempt with `maxDuration` 900 s.

1. It runs only in the Trigger.dev PRODUCTION and STAGING environments.
   In another environment it logs
   `backend.pause-sweep.environment-skipped` and does nothing: a dev
   worker can read a database that holds refs of another environment.
2. Without `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID` it logs
   `backend.pause-sweep.unconfigured` and does nothing.
3. It reads the candidates in one query, all with a ref: `active` rows
   older than the shorter window, every `creating`, `restoring`, and
   `deleting` row, every `error` row without the stopped mark (`paused_at`
   null; a restore call clears the mark of the idle pause), and every row
   of a soft-deleted project.
4. **Orphans.** A backend of a project deleted more than one day ago that
   is not `deleting` moves to `deleting` now (`markDeleting`), and an
   `active` project gets a pause. This catches a failed delete step and the
   projects deleted before WANDIT-184.
5. **Stale restores.** For a `restoring` row it reads the Supabase status
   (a 404 counts as `REMOVED`). `ACTIVE_HEALTHY` moves the row to `active`
   (`markRestored`);
   `RESTORE_FAILED` or `REMOVED` moves it to `error`. Any other status on
   a row that entered `restoring` more than 10 minutes ago also moves it
   to `error` with `backend_restore_failed` (`markRestoreTimedOut`). The
   restore start is `updated_at`: every other write to a `restoring` row
   also moves it out of `restoring`.
6. **Stuck creates.** A `creating` row with no write for 30 minutes moves
   to `error` (`markCreatingTimedOut`), so the next run stops its project.
7. **Failed backends.** A failed provisioning or wake can leave a project
   that runs and costs money. For an `error` row it reads the Supabase
   status; a 404 counts as `REMOVED`. `ACTIVE_HEALTHY`, `ACTIVE_UNHEALTHY`,
   or `PAUSE_FAILED` gets the pause call, after one more read of the row:
   a row that a retry moved since the list read keeps its project. When a
   retry moves the row during the pause call, the sweep sends a restore to
   undo the pause.
   Then the row gets the stopped mark: `paused_at` is set and the row
   stays `error` (`markErrorProjectStopped`), with the audit row
   `backend.paused`. `INACTIVE`, `INIT_FAILED`, `REMOVED`, or
   `RESTORE_FAILED` gets only the mark. Any other status waits for the
   next run. The mark keeps a stopped project out of the next runs; a
   retry clears it.
8. **Pauses.** It pauses the idle backends: `POST /v1/projects/{ref}/pause`,
   then `markPaused`, then the audit row `backend.paused`. When the pause
   call fails, it reads the status: `INACTIVE` or `PAUSING` means Supabase
   paused the project, and the row follows.
9. **Deletes.** It deletes the `deleting` backends past the grace window:
   first the `project_secrets` rows of the project (a second try of the
   delete step), then `DELETE /v1/projects/{ref}` (a 404 counts as done),
   then `markDeleted`, then the audit row `backend.deleted`. The audit row
   keeps the ref. A throw keeps the ref, so the next run tries again.
10. Each step takes at most 50 rows (`sweepBatchCap`, ESTIMATE). Above the
   cap it logs `backend.pause-sweep.capped` with `action` and `left`; the
   next day continues. A failed row logs and the loop continues.

The completion line `Backend pause sweep completed` carries the counters
`scanned`, `orphaned`, `orphanFailed`, `restored`, `restoreFailed`,
`restoreTimedOut`, `restoreCheckFailed`, `creatingTimedOut`, `errorPaused`, `errorMarked`,
`errorCheckFailed`, `idle`, `paused`, `pauseFailed`, `expired`,
`deleted`, and `deleteFailed`. The query has no order, so rows that fail
every run can keep the cap slots of a step (a LIMIT in the code).

Both Supabase paths were checked in the Supabase OpenAPI
(`https://api.supabase.com/api/v1-json`) on 2026-09-25:
`v1-pause-a-project` and `v1-delete-a-project`.

## Wake

- **Turn start.** `runBuilderTurn` reads the backend row before it boots
  the sandbox. A `paused` row gets `POST /v1/projects/{ref}/restore`
  and `markRestoring`. When the restore call fails, one status read
  decides: a project in `ACTIVE_HEALTHY`, `COMING_UP`, or `RESTORING` only
  needs the wait. A `paused` or `restoring` row then gets one status
  read every 5 s. At `ACTIVE_HEALTHY` the row moves to `active`
  (`markRestored`) and the turn writes the Supabase URL and anon key to
  the sandbox `.env`. `RESTORE_FAILED` or `REMOVED` ends the wake at once and
  moves the row to `error`. The turn card shows the `sandbox_waking`
  status with the message `Waking up the database`. A cancel during the
  wake stops it, and the turn ends `canceled` before any sandbox boots.
- **Ceiling.** The status poll runs at most 180 s. The restore call and
  the last status read can each add about 60 s, so a turn waits at most
  about 300 s. After that, or when the restore fails, the turn runs
  without the database and shows the note `Backend not ready yet`. A slow
  database never fails the turn. Without the Supabase platform env no
  wake starts.
- **Cloud tab.** `POST cloud/backend/restore` sends the restore call and
  moves the row to `restoring`. A failed call reads the status the same
  way as the turn wake. `GET cloud/backend` reads the Supabase
  status of a `restoring` row: `ACTIVE_HEALTHY` moves it to `active`,
  `RESTORE_FAILED` or `REMOVED` to `error`, and a wake older than 10
  minutes to `error` too. The Cloud tab then shows "Try again". The daily
  sweep ends a restore that nobody reads.
- The agent backend tools never wake a backend. They answer
  `backend_paused`.

## Project delete

The `delete-app-project` task runs the backend step after the Worker
delete:

1. It moves the row to `deleting` and sets `deleting_at`. This comes
   first, so the sweep deletes the Supabase project also when the pause
   fails.
2. It pauses an `active` project at once, so the grace window costs no
   compute. A `creating`, `restoring`, or `error` project can run until
   the grace delete (a LIMIT in the code).
3. It deletes every `project_secrets` row of the project.

The audit row `project.deleted` carries `backend` (`paused`, `deleting`,
`skipped`, or `error`) and `secretsDeleted`. A backend that a user
claimed must stay. WANDIT-199 adds the claim flag; until then every
backend goes.

## Entitlement

`BackendsService.provisionBackend` checks the plan before it inserts a
new row or retries an `error` row. The payer is the org of an org
project, else the user. `writeCreatingWithinLimit` runs the project row
check, the count, and the write in one transaction under a Postgres
advisory lock per payer, so two parallel creates cannot both pass the
limit.
`countActiveForOwner` counts the payer's rows in `creating`, `active`,
`paused`, or `restoring`, on projects that are not soft-deleted.

| Plan | Backends (`BACKEND_DEFAULTS.backendsPerPlan`) |
| --- | --- |
| `starter` | 1000 |
| `pro` | 1000 |
| `business` | 1000 |

Every plan has 1000 (no practical limit) for the staging tests. The
per-plan caps come back after the tests. WANDIT-153 decides the price.

At the limit the call throws `BackendLimitReachedError`: HTTP 403 with
the code `BACKEND_LIMIT_REACHED` and the message `Backend limit reached:
the <plan> plan allows <limit>`. `BackendsService` logs
`supabase.provisioning.limit-reached`. Project creation catches the error
and creates the project without a backend. `POST cloud/backend` answers
the 403 with `details: { plan, limit }`. The Cloud tab shows a text that
names the plan and the limit, with a link to the billing page. The Stripe add-on and the
`extra_backend_slots` column are not built.

## Billing

No ledger row records the backend cost yet. A later issue must:

1. Pick the cost source: the list price or the flat fee of the Supabase
   for Platforms contract (WANDIT-153).
2. Register `backend_provision` and `backend_hosting` as evidence rows
   that bill no credits. The registry cannot mark a `fixed` entry as not
   billable; a `measured` entry with `customerBillable: false` can.
3. Add the two values to the `ai_usage_operation` enum, the registry,
   `creditActivityOperations`, the web icon map, and the web dictionary
   labels, and decide if the credit activity list shows them.
4. Write the rows through `reserveWithReplay` with the keys
   `backend:<ref>:provision` and `backend:<ref>:<yyyy-mm>`.

## Operator steps

Do these steps only on staging first. Never print or paste the platform
token into a ticket or a chat.

**Pause one backend by hand.**

1. Read the row: `SELECT id, ref, status FROM app_backends WHERE
   project_id = '<projectId>'`. Continue only when `status` is `active`.
2. Send `POST https://api.supabase.com/v1/projects/<ref>/pause` with the
   header `Authorization: Bearer <SUPABASE_PLATFORM_TOKEN>`.
3. Write the row: `UPDATE app_backends SET status = 'paused', paused_at =
   now() WHERE project_id = '<projectId>' AND status = 'active'`.

**Wake one backend by hand.** Click restore in the Cloud tab, or start a
turn on the project. Both call the restore and finish the wake. Without
the web app:

1. Send `POST https://api.supabase.com/v1/projects/<ref>/restore` with
   the same header.
2. Write `UPDATE app_backends SET status = 'restoring', updated_at = now(),
   paused_at = null WHERE project_id = '<projectId>' AND status = 'paused'`.
   Without the `updated_at`, the next sweep or Cloud tab read ends the wake
   at once.
3. The next `GET cloud/backend` or turn start moves the row to `active`.

**Test the sweep on staging.** Set `BACKEND_IDLE_DAYS=0` on the staging
Trigger.dev environment, run `backend-pause-sweep` from the Trigger.dev
dashboard, and check the pause in the Supabase dashboard. Start a turn on
a paused project and watch the wake. Remove the override after the test.

The restore time is UNVERIFIED (expect minutes). Write the measured time
into this file after the staging test; the 180 s wake ceiling depends on it.
