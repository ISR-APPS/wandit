# Dealflow: starter notes

Dealflow is a CRM for a small sales team. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Dealflow" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Pipeline: a board with one column for each stage, and the won amount of the last 30 days | `src/features/pipeline` |
| `/app/deals` | Deals: a table with stage tabs (`?stage=`), an owner filter, a search, and a sort | `src/features/deals` |
| `/app/deals/$dealId` | One deal: stage path, facts, activity timeline, main contact, follow-ups | `src/features/deals` |
| `/app/contacts` | Contacts: the people and the companies in two tabs, and a side panel for one person | `src/features/contacts` |
| `/app/activities` | Activities: a trend chart, a breakdown and the activity log of the last 30 days, and the follow-up tasks | `src/features/activities` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/crm` holds the parts that all pages use: the stage list, the activity types,
the money and time formats, the series functions, the stage badge, and the avatar.

## Sample content

The app has no business table. All rows come from one file: `src/features/crm/lib/sample-data.ts`.
The file makes the same rows for the whole day. The dates are relative to the current day, so the rows change at midnight.
It holds 5 reps, 24 companies, 60 contacts, 86 deals, their stage changes, about 1,500 activities, and 24 tasks.
The people, companies, mail addresses, and phone numbers are fictional.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `RepRow` to `reps`, `CompanyRow` to `companies`, `ContactRow` to `contacts`, `DealRow` to `deals`,
   `StageChangeRow` to `deal_stage_changes`, `ActivityRow` to `activities`, `TaskRow` to `tasks`.
   Keep the stage, source, and lost reason values of `src/features/crm/lib/deal-stage.ts` as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/deals/api/deals.queries.ts`: the deal list, one deal, the won amount for each day.
   - `src/features/contacts/api/contacts.queries.ts` and `companies.queries.ts`: people, companies, the deals of one person.
   - `src/features/activities/api/activities.queries.ts`: the log, the timeline of a deal, the daily series, the breakdown.
   - `src/features/activities/api/tasks.queries.ts`: the open tasks.
   The series and the totals must come from SQL read functions. `src/features/crm/lib/series.ts` shows the math.
3. Delete `src/features/crm/lib/sample-data.ts` and its export when no `queryFn` reads it.
4. `CURRENCY` in `src/features/crm/lib/format.ts` is `USD`. Set the currency of the business there.

## What is not built

The app has no form. A deal, a contact, an activity, and a task cannot be added, changed, or deleted yet.
Add these when the tables exist:

- "Add deal" and "Edit deal": a dialog on the Deals page and on the deal page. A stage change writes one row to `deal_stage_changes`.
- "Log activity": a dialog on the deal page and on the Activities page.
- "Add task" and "Mark as done": in the two Follow-ups cards. A done task needs a `done_at` column.
- "Add contact" and "Add company": on the Contacts page.

The board has no drag and drop. A deal changes stage in the edit dialog.

## Rules of the pages

- A deal is "stalled" after 14 days in one stage (`STALLED_AFTER_DAYS`). The board, the list, and the deal page show a flag.
- The chance to win of each stage is in `STAGE_PROBABILITY`. The weighted forecast uses it.
- The won column and the lost line of the board cover `BOARD_DAYS` (30) days. The breakdown and the log of Activities cover `ACTIVITY_DEFAULT_DAYS` (30) days.
