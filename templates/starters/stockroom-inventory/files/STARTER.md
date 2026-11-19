# Stockroom starter

Stockroom is the stock control desk of one warehouse. It is an internal tool: only the team signs in.
The desk sees the items under their minimum, the stock movements, the purchase orders, and the suppliers.
The `/` route sends each visitor to `/app`. The `/app` layout sends a signed-out visitor to `/login`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: most picked item and 3 figures; stock in and out; picks against the period before; picks by family; value by family; delivery record; recent purchase orders; low stock items. A period select (7, 30, 90 days) and a stock CSV export. | `src/features/overview` |
| `/app/items` | Item list: 4 figures, then a table with search, Status, Family, and Supplier filters (in the URL), Columns, row selection, a CSV export, and pages | `src/features/items` |
| `/app/items/$itemId` | One item: Overview, Movements, and Orders tabs. Facts, shelf level, stock rules, latest activity, order lines, same-supplier items, a 90-day level chart, and the movement table | `src/features/items` |
| `/app/purchase-orders` | Order list: status tabs, Supplier and Delivery filters (`?supplier=`, `?late=`), a CSV export, and a side panel with lines and history (`?po=`) | `src/features/purchase-orders` |
| `/app/suppliers` | Supplier table: Status, Family, and Order day filters, on-time rate, lead time, a CSV export, and links to the items and orders of each supplier | `src/features/suppliers` |
| `/app/profile` | Profile of the signed-in user (base page) | `src/features/profile` |

`src/features/stock` holds the shared parts: the catalog, the status lists, the badges, the delta, the period select, the alerts query, the CSV and clipboard helpers, and the format helpers.
`src/shared/ui/record-table.tsx` is the list table of every page: search, filters, Columns, selection, row menu, and pages.
The nav has groups (Overview, Warehouse, Account). The groups and items are in `src/features/app-shell/lib/nav-items.ts`.
The header has a page search (Cmd+K or Ctrl+K) and a bell. The bell lists the items out of stock, the late orders, and the low items.

## Sample content

- All rows come from `src/features/stock/lib/sample-data.ts`. The items and suppliers are in `catalog.ts`. The rows are fictional.
- The file plays 180 days of the warehouse: deliveries, picks, damage, rolling counts, and a weekly order run per supplier.
- It gives 9 suppliers, 60 items, about 150 purchase orders, and about 7,800 movements.
- A fixed seed gives the same rows for a full day. The dates move with the current day.
- Every event is before the midnight that starts today. So no event is in the future.
- Email addresses use `.example` domains. Phone numbers use the range 555-01xx, which no real phone uses.
- Only the query files read the sample rows:
  - `src/features/items/api/items.queries.ts` (the list, the summary figures, and one item)
  - `src/features/purchase-orders/api/purchase-orders.queries.ts`
  - `src/features/suppliers/api/suppliers.queries.ts`
  - `src/features/overview/api/overview.queries.ts`
  - `src/features/stock/api/alerts.queries.ts`

## Make it real

1. Create the tables in one migration: `suppliers`, `stock_items`, `stock_movements`, `purchase_orders`, `purchase_order_lines`, `purchase_order_receipts`.
   Use the row types of `sample-data.ts` for the columns. Use `statuses.ts` for the check constraints.
2. Keep `stock_items.on_hand` equal to the sum of its movements. A database trigger on `stock_movements` does it in one place.
3. Add RLS policies so that only signed-in team members read and write the rows.
4. Replace the body of each `queryFn` with a Supabase call that returns the same type.
   The picks per day, the figures, the levels at a past day, and the late days become SQL read functions.
   `series.ts`, `levels.ts`, and `orders.ts` show the math.
5. The lists read every row. Above about 1,000 orders or items, move to server paging.
6. Then delete `sample-data.ts` and `getSampleTables` from the stock barrel.

## Add actions later

- No control saves data today. Each control changes only what the page shows, downloads a CSV file, or copies a text.
- Good first writes: receive a delivery against an order line, record a count, send a draft order, add an item.
- A receipt writes one `stock_movements` row per line and updates `quantity_received`. Do both in one transaction.
- Put each write in `api/<entity>.mutations.ts` of its feature. Invalidate the `items`, `purchase-orders`, `suppliers`, `alerts`, and `overview` keys after it.
- The order side panel is the place for the first "Receive" action.
