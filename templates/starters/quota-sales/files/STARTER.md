# Quota: sales performance board

Quota is an internal tool for a sales team. The team sells point-of-sale systems to small shops.
It shows the bookings, the orders, and the attainment of each representative against the quarter target.
Only the team signs in. The route `/` sends each visitor to `/app`.

## Pages

The sidebar has 3 groups: Overview, Sales (Orders, Representatives, Targets), and Account (Profile).

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Sales overview: daily bookings this year against last year, 4 stat cards, top reps, order status with a table | `src/features/overview` |
| `/app/orders` | Orders of the last 90 days: status tabs, filters, sort, row selection, CSV export, an order dialog | `src/features/orders` |
| `/app/reps` | Representatives: role, territory, email, attainment, and pace, with filters and CSV export | `src/features/reps` |
| `/app/reps/$repId` | One rep: profile, attainment, product mix, latest orders, largest orders, accounts; tabs for all orders and all accounts | `src/features/reps` |
| `/app/targets` | One quarter: team progress, target figures, product mix, reps behind the pace, territories, and the target of each rep | `src/features/targets` |
| `/app/profile` | The profile of the signed-in user (real Supabase data) | `src/features/profile` |

The bell in the header lists the reps behind the pace. The search box (Cmd/Ctrl+K) finds the pages of the sidebar.

## Sample content

- All sample rows are in `src/features/sales/lib/sample-data.ts`: territories, reps, accounts, orders with lines, and quarter targets.
- A seeded generator makes the orders of each date. The rows stay the same during a day. The orders end yesterday.
- The generator makes 5 quarters (`HISTORY_QUARTERS`). The 90-day chart then has the same days of last year.
- The names, the accounts, and the emails (`@example.com`) are fictional.
- The pages read the rows only through the `queryFn` of each `api/<entity>.queries.ts` file.
- The pure rules (pace, order status, series, calendar, CSV) are in `src/features/sales/lib/`.

## Make it real

1. Create the tables with one migration: `territories`, `reps`, `accounts`, `orders`, `order_lines`, `targets`.
   Give `orders` a `status` column. Then `orderStatusOf` in `order-status.ts` goes away.
2. Add RLS policies so that only the signed-in team reads the rows.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `overview.queries.ts`: a SQL function for the bookings per day of this year and last year, and the 4 stats.
   - `reps.queries.ts`, `alerts.queries.ts`, `orders.queries.ts`, `targets.queries.ts`: reads of the tables above.
4. Delete `sample-data.ts` when no query reads it.
5. Set the currency of the business in `CURRENCY` of `src/features/sales/lib/format.ts`.
6. Forms that do not exist yet: a new order, a new rep, and a target editor. Each one needs a table first.
   Put each form in its feature, with a mutation in `api/<entity>.mutations.ts`.

## Rules of the board

- Pace: a linear share of the quarter target is due by today. 5 % over it is "Ahead". Under 90 % of it is "Behind".
- A closed quarter has no pace: it met its target ("Ahead") or missed it ("Behind").
- The header alerts list the same reps as the "Behind" pace filter of the reps page.
- Severity on the targets page: under 75 % of the due amount is "Far behind", under 85 % is "Behind", the rest is "Close".
- The "Quota attainment" stat compares in percentage points with the previous quarter after the same count of days.
- A cancelled order counts in no total.
