# Stagehand: back office of an event organiser

This project started from the starter template "Stagehand". It is an app: the pages are behind sign-in.
The organiser runs 42 events at 8 venues. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Box office: the revenue hero, today so far, the facts of 30 days, the next events | `src/features/overview` |
| `/app/events` | Events: the programme with status tabs, a kind filter, and a table | `src/features/events` |
| `/app/events/$eventId` | One event: sales pace, run of show, facts, door, ticket tiers, latest orders | `src/features/events` |
| `/app/attendees?event=evt-1025` | The guest list of one event. `&order=` opens the panel of one order | `src/features/attendees` |
| `/app/venues` | Venues: the cards, and the side panel with `?venue=v-foundry` | `src/features/venues` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`.
The home follows the `app-dashboard` skill: home `hero`, KPI form `spark`, chart form `area`.

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

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the status values of `box-office.ts` as `check` constraints or as a view.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Venue`, `EventSummary`, `Order`), or map the columns to them.
3. Revenue hero and KPIs: write SQL read functions for the daily sums (`data.md`, section 3).
   Keep the rule of `overview-math.ts`: full days only, and refunds taken out on the day of purchase.
   The "Refund requests" KPI counts only the refunds that buyers ask for, not the refunds of a cancelled event.
4. When every query reads the database, delete `src/features/organiser/lib/sample-*.ts` and `seeded-random.ts`.

## What does not exist yet

- No page writes data. No form exists: no new event, no ticket sale, no refund, no door scan.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: check in a guest, refund an order, add an event, edit a ticket tier.
- The currency is `BOX_OFFICE_CURRENCY` in `organiser/lib/format.ts` ("EUR"). Move it to a settings table.
- The organiser has no name in the app. The app name is `common.appName` in `messages.ts`.
