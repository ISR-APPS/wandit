# Studio OS: starter notes

Studio OS runs the operations of a creative agency: clients, projects and budgets, team capacity, and invoices.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Studio OS" in `src/styles/theme.json`. Each text is in `src/shared/i18n/messages.ts`.

## Shell

- The sidebar nav has groups: Overview (Dashboard), Studio (Projects, Clients, Invoices, Team), and Account (Profile).
  The groups live in `src/features/app-shell/lib/nav-items.ts`.
- The header has a page search (Cmd/Ctrl+K lists the nav pages) and a bell.
  The bell lists the overdue invoices and the late deliverables from `alertsQueryOptions` of `src/features/studio`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Dashboard: tabs `?tab=overview\|reports`, a period `?days=7\|30\|90`, an export menu. Overview: four KPI cards, the hours chart, the team card, the reminders, the approvals by month, the hours by service, and the projects table. Reports: the budget table of every project | `src/features/overview` |
| `/app/projects` | Projects: one card per live project with its progress, its team, and the time left | `src/features/projects` |
| `/app/projects/$projectId` | One project: a facts card, then the deliverables as a board (one column per status) or a table, with a search and a priority filter | `src/features/projects` |
| `/app/clients` | Clients: a table with a filter field, Relation, Industry, and Lead filters, a columns menu, and a side panel for one client | `src/features/clients` |
| `/app/invoices` | Invoices: tabs Latest (sent in the period) and Upcoming (drafts), and a dialog with the lines | `src/features/invoices` |
| `/app/team` | Team: a table of the load of each person for a period, with Role and Load filters, and a side panel with the timesheet | `src/features/team` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/studio` holds the shared parts: the code lists, the time helpers, the summaries, the badges,
the priority rule, the period select, the CSV export, and the bell alerts.
`src/shared/ui/record-table.tsx` is the table of the home and the list pages. `src/shared/ui/checkbox.tsx` is its checkbox.

## Sample content

The app has no business table. The rows come from two files in `src/features/studio/lib/`:
`sample-catalog.ts` (12 people, 25 clients, 43 projects) and `sample-data.ts` (time entries, deliverables, invoices).
The rows are the same for the whole day. Every date is relative to today, so the rows move at midnight.
Each period ends yesterday. A draft invoice has a planned issue day in the next 14 days and no number yet.
The people and the companies are fictional. The pages read only the `queryOptions` of each `api/` folder.

## How to make each part real

1. Create the tables with `apply_migration`: `members`, `clients`, `projects`, `project_members`,
   `time_entries`, `deliverables`, `invoices`, `invoice_lines`, `payments`.
   Keep the lists of `src/features/studio/lib/codes.ts` as check constraints.
2. Store money in whole cents and hours in quarter hours. Keep `STUDIO_CURRENCY` in a settings row.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/overview/api/overview.queries.ts`: the KPIs, the 90-day hours series, the team card, the reminders,
     the approvals by month, and the hours by service of one period.
   - `src/features/projects/api/projects.queries.ts`: the project list, and one project with its people and deliverables.
   - `src/features/studio/api/alerts.queries.ts`: the overdue invoices and the late deliverables.
   - `src/features/clients/api/clients.queries.ts`, `src/features/team/api/team.queries.ts`,
     `src/features/invoices/api/invoices.queries.ts`.
4. Move the sums of `summaries.ts`, `overview-data.ts`, `team-load.ts`, and `project-detail.ts` into SQL views or read functions.
5. Delete the two sample files when no `queryFn` reads them.

## What is not built

The app has no form. Add these when the tables exist:

- A timesheet entry form for each person, and a week view to approve the hours.
- "New project" with a budget, a billing type, and a team. A status change of a deliverable (the board has no drag and drop).
- "Create invoice" from a fee stage, a retainer month, or the open hours of a project. "Record payment".

## Rules of the pages

- A fixed fee bills in three stages: 40 %, 30 %, 30 %. A retainer bills on the 1st of each month. Hourly work bills monthly.
- Payment terms are 30 days. An unpaid invoice past its due day is overdue. The bell counts the same overdue invoices.
- Project health: over budget above 100 % of the fee. At risk when the spend runs 8 points ahead of the elapsed time.
- A retainer compares the spend of the last 30 days with its monthly fee. Up to 8 % over is at risk.
- Project progress counts each deliverable by its step: To do 0, In progress 1/3, Client review 2/3, Approved 1.
- Deliverable priority: High when due today, tomorrow, or late, Medium up to 7 days, else Low. An approved deliverable has no priority.
- Utilization is billable hours against contract hours on workdays. Load: Over capacity above 100 %, Busy from 80 %.
- The export buttons download CSV files in the browser. Every table, filter, and select works on the rows of the browser.
