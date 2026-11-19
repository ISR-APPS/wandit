# Ledger: money tracking for a small business

This project started from the starter template "Ledger". It is an app: the pages are behind sign-in.
The sample business is a design studio with four accounts. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Dashboard: period select (7, 30, 90 days) and CSV export; 4 KPI tiles (cash balance, net profit, expenses, card balance with daily bars); income sources, monthly expenses (6 months), spending donut; recent transactions, budget goal, account cards | `src/features/overview` |
| `/app/transactions` | Transactions: tabs Latest and Upcoming (fixed bills of the next 30 days), period select, CSV export, 12 rows per page. `?type=expense&category=software` | `src/features/transactions` |
| `/app/transactions/$transactionId` | One entry, profile form: entry card, category budget, labels, status timeline, payee history, entries of the same and nearest days. Tab "Payee history" holds a table. "Copy entry number" | `src/features/transactions` |
| `/app/accounts` | Accounts: one table with Type, Bank, and Status filters, columns, selection, "Export selected", row actions Open and Copy number. "Export CSV" | `src/features/accounts` |
| `/app/accounts/$accountId` | One account, profile form: account card, share of cash or credit used, top categories, activity timeline, history, other accounts. Tab "Entries" holds a table. "Export CSV" | `src/features/accounts` |
| `/app/budgets` | Budgets: month tabs, 4 KPI tiles, one progress row per category, spend against plan, largest expenses. `?month=previous`, `?category=software` | `src/features/budgets` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`, in three groups: Overview, Money, Account.
The header has a page search (Cmd/Ctrl+K) and a notification menu: pending entries and budgets over their limit.
The texts are in `src/shared/i18n/messages.ts`.
The pages follow the kit pages finance, pages/users, pages/profile, and payment/transactions. KPI form `tile`.
- The CSV exports and "Copy" actions run in the browser (`csv.ts`, `clipboard.ts` in `src/features/ledger/lib/`).

## Where the sample content is

`src/features/ledger/` stands in for the database. These files in `lib/` hold the sample rows, one file per table:

| Sample module | Becomes the table |
|---|---|
| `sample-accounts.ts` | `accounts` (name, bank, type, number ending, opening day, credit limit) |
| `sample-transactions.ts` | `transactions` (day, type, payee, note, category, account, amount, method, status, linked entry) |
| `categories.ts` | `categories` and `budgets` (monthly limit, fixed or variable costs) |

- An amount is a whole number of cents with a sign: positive comes in, negative goes out.
- A transfer is two entries, one per account. `linkedId` joins them. A transfer is not income and not an expense.
- An entry has a day and no time. Each calendar day gives the same entries on each load (`seeded-random.ts`).
- The ledger keeps the last 186 days (`HISTORY_DAYS`), so the dashboard can show 6 calendar months.
  A status follows the age of the entry: pending, cleared, reconciled.
- `listScheduledEntries` gives the fixed bills and pay days of the next days, for the Upcoming tab.
- A bank or cash account has a fixed balance today (`CLOSING_BALANCE_CENTS`). The daily series walks back from it.
  The card owes its unpaid purchases. See `listDailyBalances` in `sample-transactions.ts`.
  A real ledger computes a balance as the opening balance plus every entry.

## How the pages read the data

Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`.
Each `queryFn` calls a list function of `~/features/ledger` and a pure build function in `lib/`.

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the type, status, and method values of the sample modules as `check` constraints. Keep amounts in cents.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Account`, `Transaction`, `Budget`), or map the columns to them.
3. Totals, cash flow, balances, and the budget report: write SQL read functions (`data.md`, section 3).
   The math to copy is in `overview-summary.ts`, `account-summary.ts`, and `budget-report.ts`.
4. More than 1,000 transactions: use server paging (`tables-paging.md` of the skill).
5. When every query reads the database, delete `sample-*.ts`, `seeded-random.ts`, and the lists in `categories.ts`.

## What does not exist yet

- No page writes data. No form exists: no new transaction, no transfer, no budget change, no reconcile action.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: add a transaction, mark an entry as reconciled, change a budget limit, add an account.
- The currency is `LEDGER_CURRENCY` in `sample-accounts.ts` ("USD"). Move it to a settings table.
- The business has no name in the app. The app name is `common.appName` in `messages.ts`.
