# Sprintboard: starter notes

Sprintboard is a delivery tracker for a product team. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Sprintboard" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Shell

The sidebar has three groups: Overview (`/app`), Work (Projects, Tasks, Team), and Account (Profile).
The header bar has a page search (Cmd+K or Ctrl+K) and a bell with the overdue tasks.
The bell count, the "Overdue tasks" figure of the overview, and the "Overdue" filter of the Tasks page use one rule (`isOverdue`).
The "Tasks due this week" figure, the "Due this week" filter of the Tasks page, and the Reminders link use one rule (`isDueBetween`).

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: a period of 7, 30, or 90 days, an Export menu, tabs `?tab=overview\|reports`. Overview: four figure cards, the work chart with its own period, team highlights, reminders, tasks done by month, on-time delivery, and a table of recent projects. Reports: the full project table | `src/features/overview` |
| `/app/projects` | Projects: one card per project with the key, the lead, the target day, the progress, the people, and the time left | `src/features/projects` |
| `/app/projects/$projectId` | One project: tabs `?tab=overview\|board`. Overview: the profile, completion, task mix, milestones, recent tasks, and people. Board: a search, an assignee filter, and five status columns | `src/features/projects` |
| `/app/tasks` | Tasks: a table of all tasks with filters for status, priority, project, and due day, row actions, and an export of the selected rows | `src/features/tasks` |
| `/app/team` | Team: a table of the people with their load, email, projects, and status, filters, and a side panel for one person | `src/features/team` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/tracker` holds the parts that all pages use: the status, priority, and kind lists and icons,
the task rules, the time and series functions, the CSV and clipboard helpers, the badges, the avatar, the load meter, and the task dialog.
`src/shared/ui/record-table.tsx` is the table of the Overview, Tasks, and Team pages: a search, filters, column choice, row selection, and pages.

## Sample content

The app has no business table. All rows come from one file: `src/features/tracker/lib/sample-data.ts`.
The file makes the same rows for the whole day: every event ends before today's midnight.
The dates are relative to the current day, so the rows change at midnight.
It holds 12 members, 10 projects, 32 milestones, and about 800 tasks over the last 210 days.
The people and the projects are fictional. Each email is `first.last@example.com`.
`loggedMinutes` of a task is a sample value. It is 0 for a task that did not start.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `MemberRow` to `members`, `ProjectRow` to `projects`, `MilestoneRow` to `milestones`, `TaskRow` to `tasks`.
   Keep the lists of `src/features/tracker/lib/codes.ts` as check constraints: task status, priority, kind, estimate, project status, health.
2. Add a `user_id` column to `members` when a page must know the member of the signed-in user.
3. Replace `loggedMinutes` with a `time_entries` table, and sum it in a SQL read function.
4. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/tracker/api/tasks.queries.ts`: the tasks with project and people names, the members.
   - `src/features/tracker/api/alerts.queries.ts`: the overdue tasks of the bell.
   - `src/features/projects/api/projects.queries.ts`: the project list with counts and points, one project with its tasks and milestones.
   - `src/features/overview/api/overview.queries.ts`: the daily series and the figures of one period.
   The series and the totals must come from SQL read functions. `src/features/tracker/lib/series.ts` and `src/features/overview/lib/overview-data.ts` show the math.
5. Delete `src/features/tracker/lib/sample-data.ts` and its export when no `queryFn` reads it.

## What is not built

The app has no form. A project, a milestone, and a task cannot be added, changed, or deleted yet.
Add these when the tables exist:

- "New task" and "Edit task": a dialog on the board and in the task dialog. A status change sets `started_at`, `review_at`, or `completed_at`.
- "New project" and "Edit project": on the Projects page. The lead sets the health of an active project.
- "Add milestone" and "Mark as done": in the Milestones card.

The board has no drag and drop. A task changes status in the edit dialog.

## Rules of the pages

- A task is overdue when it is not done and not in the backlog, and 17:00 of its due day has passed (`isOverdue`).
- A task is due in a window when it is not in the backlog, its due time is in the window, and it is open at the window start (`isDueBetween`). "This week" is the next 7 days. The figure compares with the 7 days before now.
- Committed work is To do, In progress, and In review (`workload.ts`). The load is committed points against `capacity`. From 85 % a person is "Busy", above 100 % "Over capacity".
- "The last N days" means N full calendar days up to yesterday (`periodOf` in `series.ts`). Each figure compares with the N days before.
- "Completed by month" shows the last three full calendar months. The sample history is too short for quarters.
- The on-time donut takes the done tasks of the period with a due day: done before the due day is "Early", on it "On time", 1 to 2 days after it "1 to 2 days late", later "3 days late or more".
- The Done column of the board shows the last `DONE_WINDOW_DAYS` (14) days. Each column shows `COLUMN_CARDS` (6) cards before "Show N more".
- The cycle time is the median time from start to done of the tasks done in the period.
- A project card counts whole weeks from 14 days left, else days.
