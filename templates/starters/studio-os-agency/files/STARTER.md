# Studio OS: starter notes

Studio OS runs the operations of a creative agency: clients, projects and budgets, team capacity, and invoices.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Studio OS" in `src/styles/theme.json`. Each text is in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: tabs `?tab=overview\|projects\|team\|invoices`, a period `?days=7\|30\|90`, trends against the period before | `src/features/overview` |
| `/app/clients` | Clients: four figures, relation tabs, a table, and a side panel for one client | `src/features/clients` |
| `/app/projects` | Projects: four figures, view tabs, a service filter, and a table with the budget burn | `src/features/projects` |
| `/app/projects/$projectId` | One project: budget, burn chart, deliverables, phases, people, invoices | `src/features/projects` |
| `/app/team` | Team: utilization per person for a period, and a side panel with the timesheet | `src/features/team` |
| `/app/invoices` | Invoices: four money figures, status tabs, a table, and a dialog with the lines | `src/features/invoices` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/studio` holds the shared parts: the code lists, the time helpers, the summaries, the badges, the figure band, and the burn meter.

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
   - `src/features/overview/api/overview.queries.ts`: the figures and the running and weekly series of one period.
   - `src/features/projects/api/projects.queries.ts`: the project list, and one project with its burn series.
   - `src/features/clients/api/clients.queries.ts`, `src/features/team/api/team.queries.ts`,
     `src/features/invoices/api/invoices.queries.ts`.
4. Move the sums of `summaries.ts`, `overview-data.ts`, `team-load.ts`, and `project-detail.ts` into SQL views or read functions.
5. Delete the two sample files when no `queryFn` reads them.

## What is not built

The app has no form. Add these when the tables exist:

- A timesheet entry form for each person, and a week view to approve the hours.
- "New project" with a budget, a billing type, and a team. "Edit deliverable" with its status.
- "Create invoice" from a fee stage, a retainer month, or the open hours of a project. "Record payment".

## Rules of the pages

- A fixed fee bills in three stages: 40 %, 30 %, 30 %. A retainer bills on the 1st of each month. Hourly work bills monthly.
- Payment terms are 30 days. An unpaid invoice past its due day is overdue.
- Project health: over budget above 100 % of the fee. At risk when the spend runs 8 points ahead of the elapsed time.
- A retainer compares the spend of the last 30 days with its monthly fee. Up to 8 % over is at risk.
- Utilization is billable hours against contract hours on workdays. Above 100 % shows red.
