# Routewise starter

Routewise is the dispatch desk of a delivery company. It is an internal tool: only the team signs in.
The desk sees the shipments to dispatch, the fleet, the drivers, and the late deliveries.
The `/` route sends each visitor to `/app`. The `/app` layout sends a signed-out visitor to `/login`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Dispatch: shipment volume chart, four KPIs, drivers on duty, shipment tracker with status figures and a table | `src/features/dispatch` |
| `/app/shipments` | Shipment list: period, status tabs, search, Service and Depot filters, columns, sort, row selection, pages, CSV export | `src/features/shipments` |
| `/app/shipments/$shipmentId` | One shipment: profile card, delivery progress, handling marks, line timeline, other shipments, contacts | `src/features/shipments` |
| `/app/drivers` | Driver list: search, Status, Depot, and Licence filters, columns, row menu, CSV export, a side panel | `src/features/drivers` |
| `/app/fleet` | Fleet list: four figures, search, Status, Kind, and Depot filters, load bars, row menu, CSV export, a side panel | `src/features/fleet` |
| `/app/profile` | Profile of the signed-in user (base page) | `src/features/profile` |

`src/features/logistics` holds the shared parts: the status lists, the badges, the format helpers, the CSV export, the header alerts, and the sample rows.
The nav has three groups (Overview, Operations, Account). They are in `src/features/app-shell/lib/nav-items.ts`.
The header has a page search (Cmd/Ctrl+K) and a bell. The bell lists late shipments, unassigned shipments, and vehicles past their service day.
`src/shared/ui/record-table.tsx` is the table of every list: filter field, filter buttons, Columns menu, sort, checkboxes, row menu, pages.

## Sample content

- All rows come from `src/features/logistics/lib/sample-data.ts`. The rows are fictional.
- The file builds depots, customers, drivers, vehicles, and about 2,700 shipments over 180 days.
- A fixed seed gives the same rows for a full day. The dates move with the current day.
- Every event is before the midnight that starts today. So no event is in the future.
- The phone numbers use the range 555-01xx, which no real phone uses.
- Only the query files read the sample rows:
  - `src/features/shipments/api/shipments.queries.ts`
  - `src/features/shipments/api/deliveries.queries.ts`
  - `src/features/fleet/api/vehicles.queries.ts`
  - `src/features/drivers/api/drivers.queries.ts`
  - `src/features/logistics/api/alerts.queries.ts`

## Make it real

1. Create the tables in one migration: `depots`, `customers`, `drivers`, `vehicles`, `shipments`.
   Use the row types of `sample-data.ts` for the columns. Use `shipment-status.ts` and `fleet-status.ts` for the check constraints.
2. Add RLS policies so that only signed-in team members read and write the rows.
3. Replace the body of each `queryFn` with a Supabase call that returns the same type.
   The delivery figures and the daily series become SQL read functions (`delivery-stats.ts` shows the math).
4. The shipment list reads every row of the period. Above about 1,000 rows, move to server paging.
5. Then delete `sample-data.ts` and `getSampleTables` from the logistics barrel.

## Add actions later

- No control saves data today. Each control changes only what the page shows. Export CSV and Copy only read rows.
- Good first writes: assign a driver and a vehicle to an unassigned shipment, mark a pickup, record a delivery or a failure.
- Put each write in `api/<entity>.mutations.ts` of its feature. Invalidate the `shipments`, `deliveries`, `vehicles`, and `drivers` keys after it.
- The row menu of the shipment list is the place for the first assign action.
