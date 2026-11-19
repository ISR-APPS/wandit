# Dealflow: starter notes

Dealflow is a CRM for a small sales team. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Dealflow" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Shell

- The sidebar groups the pages: Overview, Sales, and Account. It is inset, with a tinted ground.
- The header has a page search (Cmd/Ctrl+K opens it), the language switch, and a bell.
- The bell lists the overdue follow-ups and the stalled deals (`src/features/crm/api/alerts.queries.ts`).
  Each item opens its deal.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Dashboard: a period select, 4 KPI cards, deals by source (donut), the 3 most urgent follow-ups, the pipeline by stage, and a table of the deals that need attention | `src/features/dashboard` |
| `/app/deals` | Deals: a Board view (one column for each open stage) and a Table view with stage tabs (`?view=` and `?stage=`), an owner filter, and a search | `src/features/deals` |
| `/app/deals/$dealId` | One deal: facts, main contact, stage path, and the Activity and Follow-ups tabs. Call and Email links in the header | `src/features/deals` |
| `/app/contacts` | Contacts: the people and the companies in two tables, a company filter, and a side panel for one person | `src/features/contacts` |
| `/app/activities` | Activities: a period select, a trend chart, a breakdown by type or rep, and the follow-ups and the activity log in two tabs | `src/features/activities` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/crm` holds the parts that all pages use: the stage list, the activity types, the task rules,
the money and time formats, the series functions, the CSV export, the stage and priority badges, and the avatar.

`src/shared/ui/record-table.tsx` is the table of the app: a filter field, filter buttons, a Columns menu, sort,
row selection, a row menu, and pages. Every table of the app uses it.

## Exports

Each page has an "Export CSV" button in its header. It downloads the rows of the page as a file:
the deals that need attention (`/app`), the deals of the current filters (`/app/deals`),
the people or the companies (`/app/contacts`), and the activity log of the period (`/app/activities`).
Each table also exports the selected rows. A field that starts with `=`, `+`, `-`, `@`, a tab, or a return
gets a `'` in front, so a spreadsheet does not run it as a formula.

## Sample content

The app has no business table. All rows come from one file: `src/features/crm/lib/sample-data.ts`.
The file makes the same rows for the whole day. The dates are relative to the current day, so the rows change at midnight.
It holds 5 reps, 24 companies, 60 contacts, 85 deals, their stage changes, about 1,500 activities, and 24 tasks.
The priority of a task comes from its deal: high for a deal in negotiation or of 50,000 or more,
medium for a deal in proposal or of 20,000 or more, low for the others.
The people, companies, mail addresses, and phone numbers are fictional.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `RepRow` to `reps`, `CompanyRow` to `companies`, `ContactRow` to `contacts`, `DealRow` to `deals`,
   `StageChangeRow` to `deal_stage_changes`, `ActivityRow` to `activities`, `TaskRow` to `tasks`.
   Keep the stage, source, and lost reason values of `src/features/crm/lib/deal-stage.ts`,
   and the priority values of `src/features/crm/lib/task.ts`, as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/dashboard/api/dashboard.queries.ts`: the KPIs, the sources, and the stage totals of one period.
   - `src/features/deals/api/deals.queries.ts`: the deal list and one deal.
   - `src/features/contacts/api/contacts.queries.ts` and `companies.queries.ts`: people, companies, the deals of one person.
   - `src/features/activities/api/activities.queries.ts`: the log, the timeline of a deal, the daily series, the breakdown.
   - `src/features/activities/api/tasks.queries.ts`: the open tasks.
   - `src/features/crm/api/alerts.queries.ts`: the items of the bell.
   The series and the totals must come from SQL read functions. `src/features/crm/lib/series.ts` shows the math.
3. Delete `src/features/crm/lib/sample-data.ts` and its export when no `queryFn` reads it.
4. `CURRENCY` in `src/features/crm/lib/format.ts` is `USD`. Set the currency of the business there.

## What is not built

The app has no form. A deal, a contact, an activity, and a task cannot be added, changed, or deleted yet.
Add these when the tables exist:

- "Add deal" and "Edit deal": a dialog on the Deals page and on the deal page. A stage change writes one row to `deal_stage_changes`.
- "Log activity": a dialog on the deal page and on the Activities page.
- "Add task" and "Mark as done": on the Follow-ups card of the home and the Follow-ups tab. A done task needs a `done_at` column.
  The home card then shows a checkbox in place of the status icon.
- "Add contact" and "Add company": on the Contacts page.

The board has no drag and drop. A deal changes stage in the edit dialog.
The bell has no "read" state. Each item stays until its task is done or its deal moves.

## Rules of the pages

- A deal is "stalled" after 14 days in one stage (`STALLED_AFTER_DAYS`). The board, the tables, the deal page, and the bell show it.
- A deal "needs attention" when it is stalled or past its expected close date. The table of the home lists these deals.
- The chance to win of each stage is in `STAGE_PROBABILITY`. The weighted forecast uses it.
- The period select of the home and of Activities has 7, 30, or 90 days. Each change compares with the same number of days before.
- The won column and the lost line of the board cover `BOARD_DAYS` (30) days. A board column shows `COLUMN_CARDS` (12) cards and links to the table for the rest.
- The table has no period filter. So the "more" link of the won column and the link of the lost line open all won or lost deals, not only those of the board period.
