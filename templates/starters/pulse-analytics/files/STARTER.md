# Pulse: starter notes

Pulse is a product analytics app for the team of a SaaS product. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Pulse" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: daily active users, four figures, feature adoption, newest accounts. One period control (7, 30, 90 days) | `src/features/overview` |
| `/app/events` | Events: the totals of a period, the event catalog, one event in detail, and the 100 newest single events | `src/features/events` |
| `/app/accounts` | Accounts: the health mix, a plan filter, status tabs, a search, and a sort | `src/features/accounts` |
| `/app/accounts/$accountId` | One account: activity chart, most active users, details, feature adoption, timeline | `src/features/accounts` |
| `/app/reports` | Reports: retention by sign-up week, activation funnel, sign-ups by channel, active users by platform | `src/features/reports` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/tracking` holds the parts that all pages use: the event list, the plans and the other value lists,
the series functions, the time and text formats, the area chart, the delta pill, and the period control.

## Sample content

The app has no business table. All rows and counters come from `src/features/tracking/lib/sample-data.ts`.
The file plays 180 days of product use for 72 accounts and about 3,700 users, with a seeded generator.
So each total agrees with its parts on every page. The rows stay the same for the whole day.
Each date is relative to the current day. The totals count complete days only: yesterday is the last day.
Only the "Latest events" list shows events of today, and only events before the current time.
The companies, the people, and the mail addresses are fictional (`account-seeds.ts`, `person-names.ts`).
The pages read `queryOptions` from the `api/` folder of each feature, not these files.

## How to make each part real

1. Create the tables with `apply_migration`: `accounts` (`AccountRow`), `people` (`PersonRow`),
   and `events` (person, account, event name, platform, `occurred_at`). The product sends one row for each event.
   Keep the event names of `src/features/tracking/lib/event-types.ts` and the lists of `dimensions.ts` as check constraints.
2. Write one SQL read function for each counter of `ProductUsage` and `AccountUsage` in `sample-data.ts`:
   active users for each day, unique users of a period, sign-ups by channel, event counts, the funnel, and the retention weeks.
   `src/features/tracking/lib/series.ts` shows the period math.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/overview/api/overview.queries.ts`: the four figures, the daily series, the feature adoption.
   - `src/features/events/api/events.queries.ts`: the catalog, one event, the newest events.
   - `src/features/accounts/api/accounts.queries.ts`: the list, one account, its activity.
   - `src/features/reports/api/reports.queries.ts`: retention, funnel, sign-ups by channel, platforms.
4. The timeline of an account reads `MilestoneRow`. Make a table for it, or build it from the events.
5. Delete `sample-data.ts`, `account-seeds.ts`, and `person-names.ts` when no `queryFn` reads them.

## What is not built

The app only reads. It has no form, and no page writes data. Add these when the tables exist:

- An Edge Function that receives the events of the product.
- "Add event" in the catalog, notes on the account page, a saved report, and an export of a table.

## Rules of the pages

- An account is "dormant" after 14 days with no event, "new" in its first 7 days, and "at risk" when its active users
  fell by 20 % or more against the 30 days before. The rule is in `src/features/accounts/lib/account-status.ts`.
- A new user is "activated" at the first completed task (`ACTIVATION_STEP` in `event-types.ts`).
- "Stickiness" is the active users of an average day over the active users of the period.
- A retention cell stays empty until its week is complete for each user of the row.
