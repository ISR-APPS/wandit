# Pulse: starter notes

Pulse is a product analytics app for the team of a SaaS product. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Pulse" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

The sidebar has three groups: Dashboards (Overview), Product (Events, Accounts, Reports), and Account (Profile).
The header has a page search (Cmd/Ctrl+K) and a bell with the accounts at risk.

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: four KPI cards, event volume by weekday and area, activation donut, sign-up sources, average daily events, devices, top accounts, sign-ups of 6 weeks, product areas. One period select (7, 30, 90 days) and a CSV download | `src/features/overview` |
| `/app/events` | Event log: an area select, the tabs Today and Yesterday, the 12 newest events of each day, a CSV download | `src/features/events` |
| `/app/accounts` | Accounts: a filter field, filters for status, plan, and region, a column menu, row selection, a CSV export | `src/features/accounts` |
| `/app/accounts/$accountId` | One account: tabs Overview (profile, seats, features used, timeline, top events, users), Users (a table of all users), Timeline | `src/features/accounts` |
| `/app/reports` | Reports: email reports, sign-ups of 8 weeks, week 1 retention, team notes, active users against the period before, recent sign-ups, and a form that schedules an email report | `src/features/reports` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/tracking` holds the parts that all pages use: the event list, the plans and the other value lists,
the series functions, the time and text formats, the CSV export, the clipboard copy, the delta pill, and the period select.
`src/shared/ui/record-table.tsx` is the table of the list pages: filter field, sort, selection, column menu, row menu, pages.

## Sample content

The app has no business table. All rows and counters come from `src/features/tracking/lib/sample-data.ts`.
The file plays 180 days of product use for 72 accounts and about 3,700 users, with a seeded generator.
So each total agrees with its parts on every page. The rows stay the same for the whole day.
Each date is relative to the current day. The totals count complete days only: yesterday is the last day.
Only the event log shows events of today, and only events before the current time.
The companies, the people, and the mail addresses are fictional (`account-seeds.ts`, `person-names.ts`).
The email reports and the team notes come from `src/features/reports/lib/sample-reports.ts`.
The pages read `queryOptions` from the `api/` folder of each feature, not these files.

## Writes

Two forms write data. Each write lasts until the page reloads (a list in memory):

- The Reports page adds an email report (`useAddScheduleMutation`) and changes its rhythm (`useSetFrequencyMutation`).
- The Reports page adds a team note (`useAddNoteMutation`).

The mutations are in `src/features/reports/api/reports.mutations.ts`. Zod parses each form first (`lib/schedule-schema.ts`).

## How to make each part real

1. Create the tables with `apply_migration`: `accounts` (`AccountRow`), `people` (`PersonRow`),
   and `events` (person, account, event name, platform, `occurred_at`). The product sends one row for each event.
   Keep the event names of `src/features/tracking/lib/event-types.ts` and the lists of `dimensions.ts` as check constraints.
2. Write one SQL read function for each counter of `ProductUsage` and `AccountUsage` in `sample-data.ts`:
   active users for each day, unique users of a period, sign-ups by channel, event counts, the funnel, and the retention weeks.
   `src/features/tracking/lib/series.ts` shows the period math.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/overview/api/overview.queries.ts`: the KPI figures, weekday and area totals, the funnel, devices, top accounts.
   - `src/features/events/api/events.queries.ts`: the newest events of today and yesterday for one area.
   - `src/features/accounts/api/accounts.queries.ts`: the list, one account. `alerts.queries.ts`: the accounts at risk.
   - `src/features/reports/api/reports.queries.ts`: sign-up weeks, retention, active users, recent sign-ups.
4. Create `report_schedules` (kind, recipient name, recipient email, frequency, weekday, hour) and `report_notes`
   (author, text, created at), with row level security for the team. Replace the bodies of `schedulesQueryOptions`,
   `notesQueryOptions`, and the three `mutationFn`s with Supabase calls. Keep the `onSuccess` lines.
   An Edge Function on a cron sends the email reports.
5. The timeline of an account reads `MilestoneRow`. Make a table for it, or build it from the events.
6. Delete `sample-data.ts`, `account-seeds.ts`, `person-names.ts`, and `sample-reports.ts` when no `queryFn` reads them.

## What is not built

- An Edge Function that receives the events of the product.
- The send of the email reports. A schedule is only a row today.

## Rules of the pages

- An account is "dormant" after 14 days with no event, "new" in its first 7 days, and "at risk" when its active users
  fell by 20 % or more against the 30 days before. The rule is in `src/features/accounts/lib/account-status.ts`.
- A new user is "activated" at the first completed task (`ACTIVATION_STEP` in `event-types.ts`).
- On the Reports page, a new user that is not activated is "exploring" while the last event is at most 7 days old,
  else "dropped" (`src/features/reports/lib/sign-up-status.ts`).
- Week 1 retention is the share of the new users of a week that had an event in the week after.
  The two newest sign-up weeks are not shown: their week 1 is not complete for each user yet.
