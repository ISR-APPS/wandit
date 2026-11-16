# Stride: front desk of a gym

This project started from the starter template "Stride". It is an app: the pages are behind sign-in.
The gym has 6 coaches, 8 class types, 4 studios, 5 plans, and 120 members. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Today: the classes of the day with a now line, the progress of the day, the figures of 7 days, the check-ins per day | `src/features/today` |
| `/app/members` | Members: the list, with status tabs, a plan filter (`?plan=annual`), search, and sort | `src/features/members` |
| `/app/members/$memberId` | One member: membership, recent visits, attendance of 12 weeks, booked classes, note | `src/features/members` |
| `/app/classes` | Classes: the timetable of one day (`?day=YYYY-MM-DD`), the week ahead, the fill of each class | `src/features/classes` |
| `/app/classes?session=<id>` | The roster panel of one session, with the check-in time of each member | `src/features/classes` |
| `/app/plans` | Plans: one card per plan, the monthly value of each plan, the payments of the next 14 days | `src/features/plans` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`.
The home follows the `app-dashboard` skill: home `briefing`, KPI form `meter`, chart form `area`.

## Where the sample content is

`src/features/gym/` stands in for the database. Each `sample-*.ts` file in `lib/` is one or more tables:

| Sample module | Becomes the tables |
|---|---|
| `sample-plans.ts` | `plans` (name, summary, price, billing period, classes per month, access hours) |
| `sample-classes.ts` | `coaches`, `class_types` (name, coach, studio, length, capacity), `timetable_slots` (weekday, start, class type) |
| `sample-members.ts` | `members` (name, email, plan, status, join date, freeze dates, end date, favorite classes, note) |
| `sample-activity.ts` | `class_sessions` (dated sessions, cancelled flag, waitlist), `bookings` (session, member), `check_ins` (member, time, session or open gym) |

- Every date is "today plus N days". The activity holds 26 weeks of history and 6 days ahead.
- The rows depend only on the local midnight of today, so they stay the same during one day.
- `checkInsUntil` hides the check-ins that are later than now. Only the session phase and the now line follow the clock.
- A member books at most one class a day, and the plan caps the classes of each month. In 7 days a member books the usual weekly visits, plus one class in about half of the weeks.
- `seeded-random.ts` gives the same rows on each load. No file calls `Math.random()`.
- `session-rows.ts` joins a session with its class type, its coach, and its roster, as a read with embeds does.
- Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`. Each `queryFn` calls `~/features/gym` and a pure build function in `lib/`.

## How to make each part real

1. Create the tables with migrations. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep `MEMBER_STATUSES` (`sample-members.ts`) and `PLAN_IDS` as `check` constraints or as a lookup table.
2. Make `class_sessions` from `timetable_slots` with a scheduled job, some weeks ahead. Then edit a single session freely.
3. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Member`, `Plan`, `ClassSession`, `CheckIn`, `SessionRow`), or map the columns to them.
   The sample times are milliseconds. A `timestamptz` column gives text: convert it with `Date.parse`.
4. Figures and chart of the home: write SQL read functions (`data.md`, section 3) for `buildWeekKpis` and
   `buildDailyCheckIns` of `src/features/today/lib/series.ts`. Do the same for the class fill and the plan summaries.
5. There are about 9,000 check-ins. With real data, page the visits and the member list on the server.
6. When every query reads the database, delete `sample-*.ts` and `seeded-random.ts` of `src/features/gym/lib/`.

## What does not exist yet

- No page writes data. No form exists: no new member, no booking, no check-in scan, no plan change.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows. The "add" buttons go in the `actions` of each `PageHeader`.
- Good first writes: check a member in, book a class, cancel a session, freeze a membership, add a member.
- Payments are dates only. The next payment follows the join day. Connect a payment provider to show real charges.
- The app name is `common.appName` in `messages.ts`. The gym itself has no name in the app.
