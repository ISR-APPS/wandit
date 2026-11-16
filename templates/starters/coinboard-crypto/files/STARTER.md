# Coinboard: starter notes

Coinboard is a crypto portfolio tracker for one investor. It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The look is the theme "Coinboard" in `src/styles/theme.json`.
The app language is English. Each text is in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Portfolio: the value, the allocation by category, the market mood, the value per day, the top holdings, the newest activity | `src/features/portfolio` |
| `/app/holdings` | Holdings: the totals, the value by account, and a table of each position with its cost and its profit | `src/features/holdings` |
| `/app/markets` | Markets: a table of 30 assets with direction tabs (`?move=`), a category filter, a search, and a sort | `src/features/markets` |
| `/app/markets/$assetId` | One asset: price chart, position, market stats, key moments, and the transactions of the user | `src/features/markets` |
| `/app/activity` | Activity: the totals, type tabs, a period filter, a table, and a side panel for one transaction (`?tx=`) | `src/features/activity` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/ledger` holds the parts that all pages use: the code lists, the formats, the position math, and the asset glyph.

## Sample content

The app has no business table. All rows come from one file: `src/features/ledger/lib/sample-data.ts`.
The file makes the same rows for the whole day. Each time counts back from the start of the current day, so the rows change at midnight.
It holds 30 assets, 400 days of prices (one price each 6 hours), and 119 transactions in 3 accounts.
The positions are not stored: `src/features/ledger/lib/positions.ts` computes them from the confirmed transactions.
The assets, their prices, and the reference codes are fictional. No asset is a real coin.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `AssetRow` to `assets`, the price lists to `asset_prices` (asset id, time, price), `TransactionRow` to `transactions`.
   Keep the values of `src/features/ledger/lib/ledger-codes.ts` as check constraints.
   `transactions` belongs to the signed-in user. `assets` and `asset_prices` are market data that every user reads.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/markets/api/assets.queries.ts`: the asset list, one asset, the price series of one asset.
   - `src/features/holdings/api/positions.queries.ts`: the positions, the position of one asset.
   - `src/features/activity/api/transactions.queries.ts`: the log, the log of one asset.
   - `src/features/portfolio/api/portfolio.queries.ts`: the figures of the home, the value per day.
   The positions, the value per day, and the key moments must come from SQL read functions.
   `positions.ts`, `portfolio-value.ts`, and `key-moments.ts` show the math.
3. Prices need a source. An Edge Function on a schedule can write `asset_prices` from a price service of your choice.
4. Delete `src/features/ledger/lib/sample-data.ts` and its exports when no `queryFn` reads it.
5. `CURRENCY` in `src/features/ledger/lib/format.ts` is `USD`. Set the currency of the user there.

## What is not built

The app has no form. A transaction cannot be added, changed, or deleted yet. Add these when the tables exist:

- "Add transaction": a dialog on the Activity page and on the asset page (type, asset, account, quantity, price, fee, time).
- "Edit" and "Delete" in the side panel of a transaction.
- The app does not trade and does not connect to an exchange or a wallet. It only records what the user enters.

## Rules of the pages

- Only a confirmed transaction changes a position. A pending or a failed one shows in Activity only.
- The cost basis uses the average cost method. A deposit and a reward enter at their market value.
- A price change under 0.5 % in 24 hours is "flat" (`priceMoveOf`). The home tile and the Markets tabs use the same rule.
- The large figure covers `SPARK_DAYS` (7) days. Its gain counts price moves only: the buys, sells, deposits, and withdrawals of the period do not count. The trend starts at `DEFAULT_DAYS` (30). The period controls offer 7, 30, and 90 days.
- The three tables show fewer columns under 80rem and on a phone under 40rem (`useScreenSize`). A phone keeps the name and the money column.
