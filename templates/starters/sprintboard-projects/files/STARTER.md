# Sprintboard: starter notes

Sprintboard is a project tracker for a product team. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Sprintboard" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: tabs `?tab=overview\|tasks\|bugs`, a period of 7, 30, or 90 days, trends against the period before, delivery figures | `src/features/overview` |
| `/app/projects` | Projects: a table with status tabs (`?status=`), a search, progress, and health | `src/features/projects` |
| `/app/projects/$projectId` | One project: four facts, a task board with five status columns, milestones, people | `src/features/projects` |
| `/app/tasks` | My tasks: the open tasks of the signed-in person by due day, the backlog, the tasks done in 30 days, the load | `src/features/my-tasks` |
| `/app/team` | Team: committed points per person as a chart, a sortable table, and a side panel for one person | `src/features/team` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/tracker` holds the parts that all pages use: the status, priority, and kind lists,
the task rules, the time and series functions, the badges, the avatar, the load meter, and the task dialog.

## Sample content

The app has no business table. All rows come from one file: `src/features/tracker/lib/sample-data.ts`.
The file makes the same rows for the whole day: every event ends before today's midnight.
The dates are relative to the current day, so the rows change at midnight.
It holds 12 members, 10 projects, 32 milestones, and about 800 tasks over the last 210 days.
The people and the projects are fictional. `CURRENT_MEMBER_ID` (Rafael Moreau) stands for the signed-in user.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `MemberRow` to `members`, `ProjectRow` to `projects`, `MilestoneRow` to `milestones`, `TaskRow` to `tasks`.
   Keep the lists of `src/features/tracker/lib/codes.ts` as check constraints: task status, priority, kind, estimate, project status, health.
2. Add a `user_id` column to `members`. Replace `CURRENT_MEMBER_ID` with the member of the auth user.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/tracker/api/tasks.queries.ts`: the tasks with project and people names, the members.
   - `src/features/projects/api/projects.queries.ts`: the project list with counts and points, one project with its tasks and milestones.
   - `src/features/overview/api/overview.queries.ts`: the daily series and the figures of one period.
   The series and the totals must come from SQL read functions. `src/features/tracker/lib/series.ts` shows the math.
4. Delete `src/features/tracker/lib/sample-data.ts` and its export when no `queryFn` reads it.

## What is not built

The app has no form. A project, a milestone, and a task cannot be added, changed, or deleted yet.
Add these when the tables exist:

- "New task" and "Edit task": a dialog on the board and in the task dialog. A status change sets `started_at`, `review_at`, or `completed_at`.
- "New project" and "Edit project": on the Projects page. The lead sets the health of an active project.
- "Add milestone" and "Mark as done": in the Milestones card.

The board has no drag and drop. A task changes status in the edit dialog.

## Rules of the pages

- A task is overdue when it is not done and not in the backlog, and 17:00 of its due day has passed (`isOverdue`).
- Committed work is To do, In progress, and In review (`isCommitted`). The load is committed points against `capacity`. From 85 % the meter is amber, above 100 % red.
- "The last N days" means N full calendar days up to yesterday (`periodOf` in `series.ts`). The overview, the Done column, My tasks, and the Team page use this one rule.
- The Done column of the board shows the last `DONE_WINDOW_DAYS` (14) days. Each column shows `COLUMN_CARDS` (6) cards before "Show N more".
- The task counts of the overview tabs and of the Projects header take only active projects.
- The cycle time is the median time from start to done of the tasks done in the period.
