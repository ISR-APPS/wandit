# Tablekeeper starter

Tablekeeper is a point of sale for one restaurant. The team signs in and works the service in it.
It is an internal tool: `/` sends every visitor to `/app`, and `/app` asks for sign-in.

## Pages

The sidebar has 3 groups: Service (Sales, Orders with "All orders" and "New order", Menu), Reports (Day report), and Account (Profile).
The header has a page search (Cmd/Ctrl+K) and a bell with the tables that need attention.

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Sales: daily bars of 7, 30, or 90 days with a sales/covers switch, 4 stat cards against the same day last week, the best sellers, and the checks of the day by service step. | `src/features/dashboard` |
| `/app/order` | New order: a table select, covers, a menu search, category tiles, dish cards, and the ticket. `?table=<id>` picks the table. | `src/features/order-entry` |
| `/app/orders` | Orders: status tabs, a server and a zone filter, search, sort, row selection with CSV export, and a row menu. | `src/features/orders` |
| `/app/orders/$orderId` | One check: overview (check card, service progress, allergens, timeline, line summary, other checks at the table), lines, and timeline tabs. | `src/features/orders` |
| `/app/menu` | Menu: 4 figure cards, then every dish with status, category, and station filters. A dish opens a dialog. | `src/features/menu` |
| `/app/report` | Day report: the busiest hour, 3 figure cards, sales and covers by hour, sales by category, payments, serve times, recent checks, and best sellers. | `src/features/report` |
| `/app/profile` | Profile of the signed-in user. It is real and uses Supabase. | `src/features/profile` |

## Sample content

All sample rows live in `src/features/restaurant/lib/`. No page reads them directly.
The pages read them through the queries in `src/features/restaurant/api/`, `src/features/dashboard/api/`, and `src/features/report/api/`.

- `sample-menu.ts`: 34 menu items in 5 categories with price in cents, VAT rate, station, and allergens.
  Two dishes sell out at a fixed time of the day, so the menu and the order screen show "Sold out".
- `sample-floor.ts`: the 20 tables, their 3 zones and seats, and the 4 servers.
- `sample-orders.ts`: one plan of a full business day on the clock, from 6:30 to 1:30 after midnight.
  The current time decides which checks exist and their status. So the pages are live at each visit.
  Before the first check of the morning, the pages show the day before.
- `sample-history.ts`: the totals of the 90 days before today, for the sales chart and the deltas.
- All names, places, and amounts are fictional. The currency is EUR, set in `sample-menu.ts`.

## Make it real

1. Create the tables with one migration: `menu_items`, `dining_tables`, `servers`, `orders`, `order_lines`,
   `seatings`, and `reservations`. Use the types in the sample modules as the columns.
2. Replace the body of each `queryFn` with a Supabase select. Keep the query keys and the return types.
   - `menuQueryOptions` reads `menu_items`.
   - `ordersQueryOptions` and `orderQueryOptions` read `orders` with `order_lines`.
   - `floorQueryOptions` and `alertsQueryOptions` read tables, open orders, seatings, and reservations. `buildFloorBoard` stays.
   - `dayTotalsQueryOptions`, `salesByDayQueryOptions`, and `dayReportQueryOptions` read SQL functions
     that group `orders` by day. A day with no check returns 0.
3. The order screen keeps one ticket per table in React state. "Preview ticket" sends nothing.
   To send an order, add a mutation in `src/features/order-entry/api/orders.mutations.ts`.
   It inserts the order and its lines, then invalidates the `orders`, `floor`, and `alerts` queries.
4. Delete the sample modules when no query imports them.

## Rules that stay

- Amounts are whole cents. Menu prices include VAT. `order-math.ts` holds the money math.
- Every money total of the report adds up to the gross sales. Keep that when you change a query.
- A void stays in the list but never counts in sales, covers, or checks.
- Every delta compares with the same weekday last week at this time (`day-totals.ts`).
