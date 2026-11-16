# Peopledesk

An app starter for the HR desk of a company of 80 people. The pages are behind login.
The company, the people, the requests, and the candidates are fictional sample content.

## Pages and routes

- `/` sends the visitor to `/app`. The `/app` layout sends a visitor with no session to `/login`.
- `/app` is the overview: days off, requests to review, and applications, for 7 or 30 days.
- `/app/employees` is the directory. `/app/employees/$employeeId` is one profile, for example `PD-1042`.
- `/app/time-off` is the two-week planner and the list of requests. `?request=TO-4127` opens one request.
- `/app/hiring` shows the positions and the pipeline board. `?position=` and `?candidate=` live in the URL.
- `/app/profile` is the base profile page of the signed-in user.

## Where the code is

- `src/features/people/` holds what every page shares: the code lists, the leave math, the series, the avatar, and the figures.
- `src/features/overview/`, `employees/`, `time-off/`, and `hiring/` hold one page each.
- Each page reads its data through `api/<entity>.queries.ts`. The route loader fills the same queries first.
- The nav entries are in `src/features/app-shell/lib/nav-items.ts`.

## Sample data

- All rows come from `src/features/people/lib/sample-data.ts`. A seeded generator builds them from today.
- The same day gives the same rows. The dates move with the calendar, so the pages never look old.
- The code lists (departments, statuses, types, stages) are in `src/features/people/lib/codes.ts`.
- Every text is in `src/shared/i18n/messages.ts`. Change a text there, not in a component.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The charts use the chart tokens. One time-off type keeps one color on every page (`TIME_OFF_TYPE_COLOR`).

## How to make each part real

1. Create five tables: `employees`, `career_events`, `time_off_requests`, `positions`, `candidates`.
   The row types in `sample-data.ts` give the columns. The lists in `codes.ts` give the check constraints.
2. Give each table row level security. Only signed-in staff of the company read the rows.
3. In each `api/*.queries.ts` file, replace the `readPeopleTables()` call with a Supabase select. Keep the query keys.
4. Move the sums to SQL views when the tables grow: absence per day, per type, per department.
5. Delete `sample-data.ts` when no query reads it.

## Actions that need a real table first

- Approve or decline a request: add a mutation in `time-off/api/`, then buttons in `request-dialog.tsx`.
  Write `decided_at`, `decided_by_id`, and `decision_note`. Invalidate the `time-off` and `overview` queries.
- Move a candidate to the next stage: add a mutation in `hiring/api/`, then buttons in `candidate-dialog.tsx`.
  Add one row to the stage history for each move.
- Add or edit an employee: add a form page under `/app/employees`, with a zod schema for the fields.
- The pages show no such buttons today, so no control pretends to save.
