# Casefile: starter notes

Casefile is a practice management tool for a small law firm. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Casefile" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Matters board: one column for each stage, four practice figures, and the matters closed in the last 30 days | `src/features/board` |
| `/app/matters` | Matters: a table with stage tabs (`?stage=`), an area filter (`?area=`), a search, and a sort | `src/features/matters` |
| `/app/matters/$matterId` | One matter: stage path, facts, time entries, fees, deadlines, team, invoices | `src/features/matters` |
| `/app/clients` | Clients: a table with kind tabs, and a side sheet for one client (`?client=`) | `src/features/clients` |
| `/app/billing` | Billing: hours per day, hours by practice area, the invoice list, and one invoice in a dialog (`?invoice=`) | `src/features/billing` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/practice` holds the parts that all pages use: the stage and status lists, the formats,
the series functions, the matter ledger, the badges, and the avatar.

## Sample content

The app has no business table. All rows come from one file: `src/features/practice/lib/sample-data.ts`.
The file makes the same rows for the whole day. The dates are relative to the current day, so the rows change at midnight.
It holds 6 people of the firm (5 attorneys and 1 paralegal), 30 clients, 71 matters, their stage changes, 88 deadlines, about 2,400 time entries, and about 140 invoices with their payments.
The people, firms, courts, mail addresses, and phone numbers are fictional.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `AttorneyRow` to `attorneys`, `ClientRow` to `clients`, `MatterRow` to `matters`, `StageChangeRow` to `matter_stage_changes`,
   `DeadlineRow` to `deadlines`, `TimeEntryRow` to `time_entries`, `InvoiceRow` to `invoices`, `PaymentRow` to `payments`.
   Keep the values of `matter-stage.ts` and `invoice-status.ts` in `src/features/practice/lib` as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/matters/api/matters.queries.ts`: the matter list and one matter file.
   - `src/features/board/api/board.queries.ts`: the closed matters per day and the four figures.
   - `src/features/clients/api/clients.queries.ts`: the client list and one client file.
   - `src/features/billing/api/billing.queries.ts`: hours per day, hours by area, invoices, totals, one invoice.
   The sums must come from SQL read functions. `src/features/practice/lib/ledger.ts` and `series.ts` show the math.
3. Delete `src/features/practice/lib/sample-data.ts` and its export when no `queryFn` reads it.
4. `CURRENCY` in `src/features/practice/lib/format.ts` is `USD`. Set the currency of the firm there.

## What is not built

The app has no form. A matter, a client, a time entry, and an invoice cannot be added, changed, or deleted yet.
Add these when the tables exist:

- "New matter" with a conflict check, and "Change stage": a stage change writes one row to `matter_stage_changes`.
- "Log time": a dialog on the matter page. A billable entry stays unbilled until an invoice charges it.
- "Create invoice" from the unbilled time of a matter, and "Record payment" in the invoice dialog.
- "Add client" on the Clients page.

## Rules of the pages

- A deadline in the next 7 days (`DEADLINE_SOON_DAYS`) shows a flag on the board and in the matter list.
- The fee estimate shows a warning from 90 % use (`ESTIMATE_WARNING_SHARE`). A flat-fee matter has no estimate.
- An invoice is overdue after its due date (net 30) while a balance is open.
- The closed column and the figures cover `BOARD_DAYS` (30) days. The billing breakdown covers `BILLING_DAYS` (30) days.
