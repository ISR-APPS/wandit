# Northbank: a business banking portal

This project started from the starter template "Northbank". It is an app: the pages are behind sign-in.
The sample customer is a joinery company with three accounts and seven cards. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Overview: a notice band, four KPI tiles, card limits, cash flow (In / Out tabs), spending by category, the newest entries, the balance history | `src/features/overview` |
| `/app/transactions` | Transactions: Latest / Upcoming tabs (in the URL), a period select, CSV export, pages of 20 rows | `src/features/transactions` |
| `/app/transactions/$transactionId` | One entry: profile card, settlement bar, labels, status timeline, other entries with the same party, same-day entries | `src/features/transactions` |
| `/app/cards` | Cards: four KPI cards, then one table with a filter field, Status and Kind filters, columns, row selection, CSV export | `src/features/cards` |
| `/app/cards/$cardId` | One card: profile card, monthly limit bar, spend groups, latest payments, payment table, other cards | `src/features/cards` |
| `/app/payees` | Payees: one table with a filter field, Status, Group, and Method filters, columns, row selection, CSV export | `src/features/payees` |
| `/app/payees/$payeeId` | One payee: profile card, share of payee payments, labels, latest payments, payment table, other payees of the group | `src/features/payees` |
| `/app/statements` | Statements: account tabs, one tile per month with "money out of money in", the closing balance, and the status | `src/features/statements` |
| `/app/statements/$statementId` | One statement: profile card, money out of money in, categories, key moments, newest lines, other months, CSV export | `src/features/statements` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`: a "Banking" group with Overview, a "Money" parent (Transactions, Payees, Statements), and Cards, then an "Account" group.
The texts are in `src/shared/i18n/messages.ts`. The bell in the header reads `alertsQueryOptions` in `src/features/bank/api/alerts.queries.ts`.
The detail pages share the profile cards of `src/features/bank/components/` (`detail-*.tsx`, `entry-history-card.tsx`, `related-list-card.tsx`).

## Where the sample content is

`src/features/bank/` stands in for the database. Each sample file in `lib/` is one table:

| Sample module | Becomes the table |
|---|---|
| `sample-accounts.ts` | `accounts` (type, number ending, opening balance) |
| `sample-transactions.ts` | `transactions` (day, account, amount, party, memo, method, status, category, payee, card, linked entry) |
| `sample-cards.ts` | `cards` (holder, role, kind, number ending, monthly limit, status, issue day) |
| `sample-payees.ts` | `payees` (name, group, method, bank, account and routing endings) |

- An amount is a whole number of cents with a sign: positive comes in, negative goes out.
- A transfer is two entries, one per account. `linkedId` joins them. It is not money in and not money out.
- An entry has a day and no time. Each calendar day gives the same entries on each load (`seeded-random.ts`).
- Bills, payroll, and interest move off Saturday and Sunday. An entry posts after a count of bank days (`postDayOf`).
- The history keeps the last 250 days. A status follows the age and the method of the entry.
- A statement is not stored: `statements.ts` computes it from the entries of one account and one month.

## How the pages read the data

Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`.
Each `queryFn` calls a list function of `~/features/bank` and a pure build function in `lib/`.

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the method, status, and category values of the sample modules as `check` constraints. Keep amounts in cents.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
3. Totals, balances, card spend, and statements: write SQL read functions (`data.md`, section 3).
   The math to copy is in `overview.ts`, `card-spend.ts`, `payee-summary.ts`, `statements.ts`, and `alerts.queries.ts`.
4. More than 1,000 entries: use server paging (`tables-paging.md` of the skill).
5. When every query reads the database, delete the `sample-*.ts` files and `seeded-random.ts`.

## What does not exist yet

- No page writes data. No form exists: no transfer, no new payee, no card freeze. The exports are CSV files made in the browser.
- The notice band on the overview closes for the current visit only. The table filters, the account tab of the statements page, and the period select are page state: a reload resets them.
- Good first writes: freeze a card, change a card limit, add a payee. Use `api/<entity>.mutations.ts` and a dialog (`tables.md`).
- The currency is `BANK_CURRENCY` and the customer name is `CUSTOMER_NAME`, both in `sample-accounts.ts`.
