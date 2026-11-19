# Stagehand: back office of an event organiser

This project started from the starter template "Stagehand". It is an app: the pages are behind sign-in.
The organiser runs 42 events at 8 venues. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Box office: period select and CSV export, 4 KPI cards, sales by ticket type, ticket sales chart, recent orders, sales by weekday, venue capacity, event calendar, upcoming events table | `src/features/overview` |
| `/app/events` | Events: time tabs (coming up, past, cancelled) and a grid of event cards | `src/features/events` |
| `/app/events/$eventId` | One event. Tab "Overview": profile, ticket tiers, facilities, ticket sales chart, run of show, latest orders, top buyers. Tab "Orders": every order in a table | `src/features/events` |
| `/app/attendees` | Every order of every event in one table. `?event=evt-1025` filters one event. `?order=` opens the panel of one order | `src/features/attendees` |
| `/app/venues` | Venues: 4 KPI cards and a table. `?venue=v-foundry` opens the side panel of one venue | `src/features/venues` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav has groups: "Overview", "Programme", and "Account". It is in `src/features/app-shell/lib/nav-items.ts`.
The header has a page search (Cmd/Ctrl+K) and a bell. The texts are in `src/shared/i18n/messages.ts`.

## Rules of the pages

- Home period: 7, 30, or 90 days. Sales figures use the last full days, up to yesterday. Today is still open.
  "Upcoming events" counts the events of the next N days against the events of the last N days.
- The check-in rate counts the events that ended in the period. A cancelled event has no door.
- The bell shows two alerts. "Slow sales": an on-sale event in the next 7 days with less than half of its seats sold.
  "Refund request": a buyer refund of the last 48 hours. The refunds of a cancelled event are not requests.
- The venue KPIs compare the next 30 days with the last 30 days.
- Every table filters, sorts, and pages in the browser. "Export CSV" and "Export selected" download a CSV file.

## Where the sample content is

`src/features/organiser/` stands in for the database. Each sample file in `lib/` is one table:

| Sample module | Becomes the table |
|---|---|
| `sample-venues.ts` | `venues` (name, kind, area, capacity, facilities, contact) |
| `sample-events.ts` | `events`, `ticket_tiers`, `run_of_show_items` |
| `sample-orders.ts` | `orders` (event, tier, quantity, buyer, placed, refunded, checked-in times) |

- Every date is "today plus N days". So the programme never looks old.
- A status follows the clock. An order exists only after its time. A check-in shows only after the doors open.
  So the counts of today grow during the day, as at a live box office. The full days do not change.
- `seeded-random.ts` gives the same rows on each load. No file calls `Math.random()`.
- `box-office.ts` joins the three modules into `EventSummary` rows: status, sold, gross, check-ins, refunds.

## How the pages read the data

Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`.
Each `queryFn` calls `loadBoxOffice` of `~/features/organiser` and a pure build function in `lib/`.
The bell reads `alertsQueryOptions` of `~/features/organiser`.

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the status values of `box-office.ts` as `check` constraints or as a view.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Venue`, `EventSummary`, `Order`), or map the columns to them.
3. Home figures: write SQL read functions for the period sums (`data.md`, section 3).
   Keep the rule of `overview-math.ts`: full days only, and refunds taken out on the day of purchase.
4. When every query reads the database, delete `src/features/organiser/lib/sample-*.ts` and `seeded-random.ts`.

## What does not exist yet

- No page writes data. No form exists: no new event, no ticket sale, no refund, no door scan.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: check in a guest, refund an order, add an event, edit a ticket tier.
- The currency is `BOX_OFFICE_CURRENCY` in `organiser/lib/format.ts` ("EUR"). Move it to a settings table.
- The organiser has no name in the app. The app name is `common.appName` in `messages.ts`.
