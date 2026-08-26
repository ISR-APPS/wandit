# In-app feedback

> Status: **Implemented**. This document describes the feedback flow from the web
> workspace to Postgres, Linear, and the admin panel.

## Purpose

Users send feedback from the "Feedback" button in the web app. The server stores each
report in Postgres first. Then it mirrors the report to Linear. Staff triage the reports
in the admin panel at `/feedback`. The admin page reads real rows, not mock data.

## Owns

- `feedback` table (`packages/db/src/schema/feedback.ts`, migration `0054_feedback.sql`):
  - Reporter: `user_id` (FK, `set null` on delete), `reporter_name`, `reporter_email`
    (snapshot at submit time).
  - Content: `category` (`bug` | `idea` | `other` | null), `message`, `page_url`,
    `project_id` (parsed from `/p/{uuid}`, no FK), `replay_url`, `sentry_event_id`,
    `sentry_event_at`, `user_agent`, `viewport_width`, `viewport_height`, `locale`,
    `screenshot_url` (public R2 URL).
  - Linear mirror: `linear_issue_id` (for example `ISRECOM-123`), `linear_issue_url`.
    Both are null when the mirror did not run or failed.
  - Workflow: `status` (`new` | `reviewing` | `planned` | `resolved`, default `new`),
    `priority` (`urgent` | `high` | `medium` | `low`, default `medium`), `admin_note`,
    `resolved_at`.
- `feedback_activities` table: one row per event (`received`, `status_changed`,
  `priority_changed`, `note_updated`) with `from_value`, `to_value`, `actor_user_id`.
- Contracts:
  - `packages/contracts/src/v1/feedback.ts`: `POST /api/v1/feedback` request and response.
    The response is `{ feedbackId, issueId }`. `issueId` is null when Linear is not
    configured or when the mirror failed.
  - `packages/contracts/src/v1/admin-feedback.ts`: admin list query, summary, detail,
    stats, and update schemas. Routes live in `adminRoutes.feedback*`.
- Server module `apps/server/src/modules/feedback/**`:
  - `POST /api/v1/feedback` (session required, 5 posts per 10 minutes per user).
  - `GET /api/v1/admin/feedback` (list, pagination, `q`, `status`, `category`,
    `priority`, `sort`).
  - `GET /api/v1/admin/feedback/stats` (counts for the summary cards and status chips).
  - `GET /api/v1/admin/feedback/:feedbackId` (detail with the activity trail).
  - `PATCH /api/v1/admin/feedback/:feedbackId` (`status`, `priority`, `adminNote`).
- Admin section `/feedback` (`apps/admin/src/features/feedback/**`): inbox list,
  detail panel, summary cards, filters, search, sort, CSV export, and the workflow
  controls.

## Working model

1. The web widget posts the message, the optional category, the page URL, the browser
   context, and the optional screenshot.
2. The server creates a feedback id. It uploads the screenshot to R2 and to Linear in
   parallel. Each upload is optional. A failed upload gives a null URL.
3. The server inserts the `feedback` row and a `received` activity row. This is the
   source of truth.
4. The server creates the Linear issue. The issue description has a `Feedback id` line.
   On success, the server stores the Linear identifier and URL on the row.
5. A Linear failure does not fail the request. The server logs the error and sends it to
   Sentry. The response has `issueId: null`. The user does not have to send the report
   again.
6. Staff open `/feedback`. The list, the stats, and the detail come from the admin
   endpoints. A status, priority, or note change goes through `PATCH`. Each change adds an
   activity row. The status change to `resolved` sets `resolved_at`. A change away from
   `resolved` clears it.

## Permissions

- `feedback: ["read"]` opens the section and the `GET` routes.
- `feedback: ["manage"]` is necessary for `PATCH`.
- The `admin` role and the `support` role have both actions. The route coverage test
  (`admin-only.decorator.spec.ts`) lists `FeedbackAdminController.update` as a write
  handler that support can use.

## Stats definitions

- `byStatus`: count of rows per status.
- `openBugs`: `category = bug` and `status != resolved`.
- `highPriorityOpen`: `priority in (urgent, high)` and `status != resolved`.
- `resolvedLast7Days`: `resolved_at` in the last seven days.

## Environment

- `LINEAR_API_KEY`, `LINEAR_FEEDBACK_TEAM_ID`: optional. Without them the server stores
  the feedback and skips the mirror.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`: optional. Without them the admin panel shows no screenshot.
  The screenshot key is `feedback/{feedback_id}/screenshot.{png|jpg}`. The URL is
  public, like the other uuid-addressed R2 objects. Nobody can list the bucket.

## Does not own

- The Linear label logic and the markdown escaping. These did not change.
- User-facing feedback status. Users do not see the admin workflow.
- Deletion of feedback rows. There is no delete endpoint.

## Acceptance criteria

- A feedback post creates one `feedback` row and one `received` activity row before any
  Linear call.
- With Linear configured, the row gets the Linear identifier and URL. The Linear issue
  shows the feedback id.
- Without Linear, or when Linear fails, the post answers 201 with `issueId: null`, and
  the row exists. Sentry receives the Linear error.
- A non-staff session gets 404 from every `/api/v1/admin/feedback*` route.
- A `PATCH` with no changed field writes nothing and answers the current detail.
- The admin page shows no mock data. Filters, search, sort, and pagination run on the
  server.

## Expected files

`packages/db/src/schema/feedback.ts`, `packages/db/src/migrations/0054_feedback.sql`,
`packages/contracts/src/v1/feedback.ts`, `packages/contracts/src/v1/admin-feedback.ts`,
`apps/server/src/modules/feedback/**`, `apps/server/src/infrastructure/storage/r2.ts`
(`feedbackScreenshotKey`), `apps/admin/src/features/feedback/**`.

Source docs: docs/features/admin-permissions.md, docs/api-security.md
