# Stride: starter notes

Stride is the front desk of a gym. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Stride" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.
The gym has 6 coaches, 8 class types, 4 studios, 5 plans, and 180 members. All content is sample content. No table exists yet.

## Shell

- The sidebar groups the pages: Overview, Club, and Account (`src/features/app-shell/lib/nav-items.ts`).
- The header has a page search (Cmd/Ctrl+K opens it), the language switch, and a bell.
- The bell lists the members at risk (`src/features/gym/api/alerts.queries.ts`). Each item opens its member.
- A member is at risk when the status is active, the member joined more than 14 days ago,
  and the last visit is more than 14 days ago (`AT_RISK_DAYS` in `src/features/gym/lib/at-risk.ts`).

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Dashboard: a period select (7, 30, 90 days), 4 KPI cards, check-ins (Daily and Hourly tabs, against the period before), the plan mix (donut), today's classes, the members at risk, the new sign-ups (weekly bars), and a member table | `src/features/dashboard` |
| `/app/members` | Members: the list with a search, a Status, a Plan (`?plan=annual`), and a Visits (`?visits=atRisk`) filter, sort, and pages | `src/features/members` |
| `/app/members/$memberId` | One member: the Overview and Visits tabs. Overview has the profile, the visits of this week, the classes attended, the check-in timeline, the payments, and the classes ahead | `src/features/members` |
| `/app/classes` | Classes: a week calendar (`?day=YYYY-MM-DD` picks the week), with Today, previous and next week, a class filter, and one chip for each session | `src/features/classes` |
| `/app/classes?session=<id>` | The roster panel of one session, with the check-in time of each member | `src/features/classes` |
| `/app/plans` | Plans: 4 KPI cards against 30 days ago, then a plan table with a Billing and an Access filter. The row menu opens the members of the plan | `src/features/plans` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/gym` holds the parts that all pages use: the sample data, the at-risk rule, the period list,
the money and time formats, the CSV export, the clipboard copy, the badges, the fill meter, and the avatar.

`src/shared/ui/record-table.tsx` is the table of the app: a filter field, filter buttons, a Columns menu, sort,
row selection, a row menu, and pages. Every table of the app uses it, with `src/shared/ui/checkbox.tsx`.

## Exports

The dashboard, the members page, the plan mix card, and the classes page have an "Export" button.
It downloads the rows on screen as a CSV file. Each table also exports the selected rows.
A field that starts with `=`, `+`, `-`, `@`, a tab, or a return gets a `'` in front,
so a spreadsheet does not run it as a formula.

## Where the sample content is

`src/features/gym/lib/` stands in for the database. Each `sample-*.ts` file is one or more tables:

| Sample module | Becomes the tables |
|---|---|
| `sample-plans.ts` | `plans` (name, summary, price, billing period, classes per month, access hours) |
| `sample-classes.ts` | `coaches`, `class_types` (name, coach, studio, length, capacity), `timetable_slots` (weekday, start, class type) |
| `sample-members.ts` | `members` (name, email, plan, status, join date, freeze dates, end date, favorite classes, note) |
| `sample-activity.ts` | `class_sessions` (dated sessions, cancelled flag, waitlist), `bookings` (session, member), `check_ins` (member, time, session or open gym) |

- Every date is "today plus N days". The activity holds 26 weeks of history and 6 days ahead.
- The rows depend only on the local midnight of today, so they stay the same during one day.
- `checkInsUntil` hides the check-ins that are later than now. Only the session phase follows the clock.
- 7 members are "drifting": they stop coming 15 to 45 days ago, so the at-risk list is not empty.
  The field `stopsComingFrom` of `Member` makes this. It is a sample field only. Do not make it a column.
- `seeded-random.ts` gives the same rows on each load. No file calls `Math.random()`.
- `session-rows.ts` joins a session with its class type, its coach, and its roster, as a read with embeds does.
- Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`.
  Each `queryFn` calls `~/features/gym` and a pure build function in `lib/`.

## How to make each part real

1. Create the tables with migrations: `owner_id`, RLS, and indexes.
   Keep `MEMBER_STATUSES` and `PLAN_IDS` as `check` constraints or as a lookup table.
2. Make `class_sessions` from `timetable_slots` with a scheduled job, some weeks ahead. Then edit a single session freely.
3. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Member`, `Plan`, `ClassSession`, `CheckIn`, `SessionRow`), or map the columns to them.
   The sample times are milliseconds. A `timestamptz` column gives text: convert it with `Date.parse`.
4. The queries to make real:
   - `dashboardQueryOptions` (`src/features/dashboard/lib/summary.ts`, `buildDashboardSummary`): write SQL read functions for the KPIs, the daily and hourly check-ins, the plan mix, and the sign-ups.
   - `membersQueryOptions` and `memberQueryOptions` (`src/features/members/lib/member-rows.ts`).
   - `classWeekQueryOptions` and `classSessionsQueryOptions` (`src/features/classes/api/classes.queries.ts`).
   - `plansOverviewQueryOptions` (`src/features/plans/lib/plan-summary.ts`).
   - `alertsQueryOptions` (`src/features/gym/api/alerts.queries.ts`): the at-risk rule as one SQL query.
5. There are thousands of check-ins. With real data, page the visits and the member list on the server.
6. When every query reads the database, delete `sample-*.ts` and `seeded-random.ts` of `src/features/gym/lib/`.

## What does not exist yet

- No page writes data. No form exists: no new member, no booking, no check-in scan, no plan change.
- To add a write: a mutation in `api/<entity>.mutations.ts` and a dialog. The "add" buttons go in the `actions` of each `PageHeader`.
- Good first writes: check a member in, book a class, cancel a session, freeze a membership, add a member.
- Payments are dates only. The paid days and the next payment follow the join day and the plan billing.
  No panel lists the payments of all members. Connect a payment provider to show real charges.
- The app name is `common.appName` in `messages.ts`. The gym itself has no name in the app.
