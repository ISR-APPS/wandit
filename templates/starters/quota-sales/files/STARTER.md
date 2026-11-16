# Quota: sales performance board

Quota is an internal tool for a sales team. The team sells point-of-sale systems to small shops.
It shows the bookings against the quarter target, by representative, by territory, and by month.
Only the team signs in. The route `/` sends each visitor to `/app`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: 4 figures, bookings per day, bookings by territory, newest orders | `src/features/overview` |
| `/app/reps` | Representatives: attainment and pace of each rep, with search and filters | `src/features/reps` |
| `/app/reps/$repId` | One rep: quarter facts, weekly bookings, attainment, product mix, accounts, history, orders | `src/features/reps` |
| `/app/orders` | Orders of the last 90 days, with status tabs and an order dialog | `src/features/orders` |
| `/app/targets` | Team target, territories, monthly plan, reps behind the pace | `src/features/targets` |
| `/app/profile` | The profile of the signed-in user (real Supabase data) | `src/features/profile` |

## Sample content

- All sample rows are in `src/features/sales/lib/sample-data.ts`: territories, reps, accounts, orders with lines, and quarter targets.
- A seeded generator makes the orders of each date. The rows stay the same during a day. The orders end yesterday.
- The names, the accounts, and the emails (`@example.com`) are fictional.
- The pages read the rows only through the `queryFn` of each `api/<entity>.queries.ts` file.
- The pure rules (pace, order status, series, calendar) are in `src/features/sales/lib/`.

## Make it real

1. Create the tables with one migration: `territories`, `reps`, `accounts`, `orders`, `order_lines`, `targets`.
   Give `orders` a `status` column. Then `orderStatusOf` in `order-status.ts` goes away.
2. Add RLS policies so that only the signed-in team reads the rows.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `overview.queries.ts`: a SQL function for the KPI figures, the bookings per day, and the bookings by territory.
   - `reps.queries.ts`, `orders.queries.ts`, `targets.queries.ts`: reads of the tables above.
4. Delete `sample-data.ts` when no query reads it.
5. Set the currency of the business in `CURRENCY` of `src/features/sales/lib/format.ts`.
6. Forms that do not exist yet: a new order, a new rep, and a target editor. Each one needs a table first.
   Put each form in its feature, with a mutation in `api/<entity>.mutations.ts`.

## Rules of the board

- Pace: a linear share of the quarter target is due by today. 5 % over it is "Ahead". Under 90 % of it is "Behind".
- A closed month or quarter has no pace: it met its target ("Ahead") or missed it ("Behind").
- The "Quarter attainment" figure compares in percentage points with the previous quarter after the same count of days.
- A cancelled order counts in no total.
- The monthly plan gives 31 %, 33 %, and 36 % of the quarter target to its three months.
