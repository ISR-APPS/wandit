# Northbank: a business banking portal

This project started from the starter template "Northbank". It is an app: the pages are behind sign-in.
The sample customer is a joinery company with three accounts and seven cards. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Overview: four totals, the balance strip (7, 30, 90 days), the full entry table | `src/features/overview` |
| `/app/transactions` | Transactions: direction tabs, an account filter, search, sort | `src/features/transactions` |
| `/app/transactions/$transactionId` | One entry: amount, facts, status steps, other entries with the same party | `src/features/transactions` |
| `/app/cards` | Cards: status tabs, one tile per card with its monthly limit, spend by group | `src/features/cards` |
| `/app/cards/$cardId` | One card: running spend against the period before, payments, limit, top merchants | `src/features/cards` |
| `/app/payees` | Payees: group tabs, bank details, last payment, 90-day totals | `src/features/payees` |
| `/app/payees/$payeeId` | One payee: bank details, payments, totals per month | `src/features/payees` |
| `/app/statements` | Statements: one panel per account, one row per account and month | `src/features/statements` |
| `/app/statements/$statementId` | One statement: balance through the month, the sum, the lines with a running balance | `src/features/statements` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`. The home follows the `app-dashboard` skill: home `ledger`, KPI form `number`, chart form `compare`.

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
   The math to copy is in `overview-kpis.ts`, `card-spend.ts`, `payee-summary.ts`, and `statements.ts`.
4. More than 1,000 entries: use server paging (`tables-paging.md` of the skill).
5. When every query reads the database, delete the `sample-*.ts` files and `seeded-random.ts`.

## What does not exist yet

- No page writes data. No form exists: no transfer, no new payee, no card freeze, no statement download.
- Good first writes: freeze a card, change a card limit, add a payee. Use `api/<entity>.mutations.ts` and a dialog (`tables.md`).
- The currency is `BANK_CURRENCY` and the customer name is `CUSTOMER_NAME`, both in `sample-accounts.ts`.
