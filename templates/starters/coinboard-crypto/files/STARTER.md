# Coinboard: starter notes

Coinboard is a crypto portfolio tracker for one investor. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Coinboard" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

The sidebar has 3 groups: Portfolio (Portfolio, Holdings), Trading (Markets, Activity), and Account (Profile).
The groups are in `src/features/app-shell/lib/nav-items.ts`. The header has a search, the alerts bell, and the user menu.

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Portfolio. Band 1: the overview card (value, 24h change, confirmed transactions, accounts), the 3 top holdings, and the trade card. Band 2: the newest activity, and the balance of each account with a line chart over about 7 months | `src/features/portfolio` |
| `/app/holdings` | Holdings: 4 figure cards (value, unrealized profit, staking rewards and fees of 30 days), then a table of the positions with filters, row selection, CSV export, and pages | `src/features/holdings` |
| `/app/markets` | Markets: direction tabs (`?move=`), then a table of 30 assets with market cap, 24h change, a 7-day spark, filters, and CSV export | `src/features/markets` |
| `/app/markets/$assetId` | One asset. Overview tab: the price chart, then the profile card, portfolio share, and about text beside the key moments, the user transactions, and similar assets. Transactions tab: every transaction of the asset | `src/features/markets` |
| `/app/activity` | Activity: a period select, a CSV download, Latest and Pending tabs, a list of 20 rows per page, and a side panel for one transaction (`?tx=`) | `src/features/activity` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/ledger` holds the parts that all pages use: the code lists, the formats, the position math, the CSV export, the asset glyph, and the alerts of the bell.

## Sample content

The app has no business table. All rows come from one file: `src/features/ledger/lib/sample-data.ts`.
The file makes the same rows for the whole day. Each time counts back from the start of the current day, so the rows change at midnight.
It holds 30 assets, 400 days of prices (one price each 6 hours), and about 120 transactions in 3 accounts.
The positions are not stored: `src/features/ledger/lib/positions.ts` computes them from the confirmed transactions.
The assets, their prices, and the reference codes are fictional. No asset is a real coin.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

The trade card records a pending transaction with `useRecordTradeMutation` (`src/features/activity/api/transactions.mutations.ts`).
The sample write `addSampleTransaction` keeps the row in memory only. A reload of the page removes it.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `AssetRow` to `assets`, the price lists to `asset_prices` (asset id, time, price), `TransactionRow` to `transactions`.
   Keep the values of `src/features/ledger/lib/ledger-codes.ts` as check constraints.
   `transactions` belongs to the signed-in user. `assets` and `asset_prices` are market data that every user reads.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/markets/api/assets.queries.ts`: the asset list, one asset, the price series of one asset.
   - `src/features/holdings/api/positions.queries.ts`: the positions, the position of one asset.
   - `src/features/activity/api/transactions.queries.ts`: the log, the log of one asset.
   - `src/features/portfolio/api/portfolio.queries.ts`: the figures of the home, the balance of each account.
   - `src/features/ledger/api/alerts.queries.ts`: the alerts of the bell.
   The positions, the account balances, and the key moments must come from SQL read functions.
   `positions.ts`, `portfolio-value.ts`, and `key-moments.ts` show the math.
3. Replace `addSampleTransaction` in `transactions.mutations.ts` with an insert into `transactions`. Keep the status `pending`.
4. Prices need a source. An Edge Function on a schedule can write `asset_prices` from a price service of your choice.
5. Delete `src/features/ledger/lib/sample-data.ts` and its exports when no `queryFn` reads it.
6. `CURRENCY` in `src/features/ledger/lib/format.ts` is `USD`. Set the currency of the user there.

## What is not built

- The trade card records a buy or a sell only. A deposit, a withdrawal, or a reward cannot be added yet.
- "Edit" and "Delete" in the side panel of a transaction.
- The app does not trade and does not connect to an exchange or a wallet. It only records what the user enters.

## Rules of the pages

- Only a confirmed transaction changes a position. A pending or a failed one changes no total. Activity and the home list show it with its status badge.
- A sell cannot be larger than the units held minus the pending sells (`parseTradeQuantity` in `src/features/portfolio/lib/trade-form.ts`).
- The cost basis uses the average cost method. A deposit and a reward enter at their market value.
- A price change under 0.5 % in 24 hours is "flat" (`FLAT_MOVE_RATIO`). The Markets tabs and the trend badges use the same rule.
- A held asset that moves 5 % or more in 24 hours gives an alert in the bell. A pending or a failed transaction of the last 30 days also gives one.
- The period controls offer 7, 30, and 90 days (`PERIOD_DAYS`). The default is 30 days.
