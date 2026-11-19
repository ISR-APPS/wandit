# Peopledesk

An app starter for the HR desk of a company of about 84 people. The pages are behind login.
The company, the people, the requests, and the candidates are fictional sample content.

## Pages and routes

- `/` sends the visitor to `/app`. The `/app` layout sends a visitor with no session to `/login`.
- `/app` is the dashboard. It has a period select (7, 30, or 90 days) and an "Export CSV" button.
  It shows four KPI cards (headcount, open roles, out today, average time to hire).
  Then three cards: new joiners, the hiring funnel, and headcount by team.
  Then a month calendar of leave beside the table of upcoming time off.
- `/app/employees` is the directory: one table with search, filters, columns, row selection, and a row menu.
- `/app/employees/$employeeId` is one profile, for example `PD-1042`. Tabs: Overview, Time off, Team.
- `/app/time-off` is the leave calendar (month or week) and the table of every request. `?request=TO-4127` opens one request.
- `/app/hiring` is the pipeline board (applied to hired) with a Table tab. `?position=` filters, `?candidate=` opens a candidate.
- `/app/profile` is the base profile page of the signed-in user.
- The bell in the header lists pending time-off requests and offers that wait for an answer.

## Where the code is

- `src/features/people/` holds what every page shares: the code lists, the leave math, the month grid, the avatar, and the alerts.
- `src/features/dashboard/`, `employees/`, `time-off/`, and `hiring/` hold one page each.
- `src/shared/ui/record-table.tsx` is the table of every list: search, filters, sort, columns, selection, pages.
- Each page reads its data through `api/<entity>.queries.ts`. The route loader fills the same queries first.
- The nav groups (Overview, People, Account) are in `src/features/app-shell/lib/nav-items.ts`.

## Sample data

- All rows come from `src/features/people/lib/sample-data.ts`. A seeded generator builds them from today.
- The same day gives the same rows. The dates move with the calendar, so the pages never look old.
- A hired candidate whose start day has come is also an employee, so the joiners and the headcount move.
- The code lists (departments, statuses, types, stages) are in `src/features/people/lib/codes.ts`.
- Every text is in `src/shared/i18n/messages.ts`. Change a text there, not in a component.

## The look

- `src/styles/theme.json` holds the colors and the fonts. Only the host writes it. Change the look with the theme tool.
- The charts and the calendar chips use the chart tokens. One time-off type keeps one color on every page
  (`TIME_OFF_TYPE_COLOR`, `TIME_OFF_TYPE_CHIP`). One hiring stage keeps one dot color (`STAGE_DOT`).

## How to make each part real

1. Create five tables: `employees`, `career_events`, `time_off_requests`, `positions`, `candidates`.
   The row types in `sample-data.ts` give the columns. The lists in `codes.ts` give the check constraints.
2. Give each table row level security. Only signed-in staff of the company read the rows.
3. In each `api/*.queries.ts` file, replace the `readPeopleTables()` call with a Supabase select. Keep the query keys.
4. Move the dashboard sums to a SQL function when the tables grow: headcount on a day, out per day, time to hire.
5. Delete `sample-data.ts` when no query reads it.

## Actions that need a real table first

- Approve or decline a request: add a mutation in `time-off/api/`, then buttons in `request-dialog.tsx`.
  Write `decided_at`, `decided_by_id`, and `decision_note`. Invalidate the `time-off`, `dashboard`, and `alerts` queries.
- Move a candidate to the next stage: add a mutation in `hiring/api/`, then buttons in `candidate-dialog.tsx`.
  Add one row to the stage history for each move. The board has no drag and drop until then.
- Add or edit an employee: add a form page under `/app/employees`, with a zod schema for the fields.
- The pages show no such buttons today, so no control pretends to save.
