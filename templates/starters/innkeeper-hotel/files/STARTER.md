# Innkeeper: front desk of a boutique hotel

This project started from the starter template "Innkeeper". It is an internal tool: `/` sends each visitor to `/app`.
All pages are behind sign-in. The hotel has 18 rooms on 3 floors. All content is sample content. No table exists yet.
The look is the theme in `src/styles/theme.json`. Each text is in `src/shared/i18n/messages.ts`.

## Shell

- The sidebar groups the pages: Overview, Hotel, and Account (`src/features/app-shell/lib/nav-items.ts`).
- The header has a page search (Cmd/Ctrl+K opens it), the language switch, and a bell.
- The bell lists the reservations that wait for a deposit and the rooms that are out of order
  (`src/features/hotel/api/alerts.queries.ts`). Each item opens its reservation or the housekeeping page.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Front desk: 4 KPI cards (arrivals, departures, in house, revenue of the month), reservations by status (donut), occupancy by week (line chart), the latest desk activity, revenue (bars), bookings by channel, and a table of the arrivals and departures of today and tomorrow | `src/features/front-desk` |
| `/app/reservations` | Reservations: the room schedule of one week (one column per room, a week navigator), or the list with `?view=list` | `src/features/reservations` |
| `/app/reservations/$reservationId` | One reservation: the Overview, Folio, and Timeline tabs. Overview shows the guest, the payment, the stay facts, the latest steps, the folio lines, and the other stays of the guest | `src/features/reservations` |
| `/app/guests` | Guests: the table with status, guest type, and country filters, and the side panel with `?guest=guest-012` | `src/features/guests` |
| `/app/housekeeping` | Housekeeping: a Board view with the columns Dirty, Cleaning, Inspection, Ready, and a Table view. A search, an attendant filter, and a floor filter | `src/features/housekeeping` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

`src/shared/ui/record-table.tsx` is the table of the app: a filter field, filter buttons, a Columns menu, sort,
row selection, a row menu, and pages. Every table of the app uses it.

A task is in "Inspection" for 20 minutes after its clean ends (`INSPECTION_MINUTES` in
`src/features/housekeeping/lib/task-board.ts`). After that, it is "Ready". Replace this rule with a real inspection status.

## Exports

Each page has an "Export CSV" button in its header: the movements of today and tomorrow (`/app`),
the reservations (`/app/reservations`), the folio of one stay, the guests, and the housekeeping tasks.
Each table also exports the selected rows. A field that starts with `=`, `+`, `-`, `@`, a tab, or a return
gets a `'` in front, so a spreadsheet does not run it as a formula.

## Where the sample content is

`src/features/hotel/` stands in for the database. Each file in `lib/` is one table:

| Sample module | Becomes the table |
|---|---|
| `sample-rooms.ts` | `rooms` (number, floor, type, bed, view, capacity, rate, out-of-order time) |
| `sample-guests.ts` | `guests` (name, email, phone, city, country, preference) |
| `sample-reservations.ts` | `reservations`, `folio_charges`, `payments` |
| `sample-housekeeping.ts` | `housekeeping_tasks`, `attendants` |

- Every date is "today plus N days". So the hotel never looks old.
- The book holds the stays of the last 62 days and of the weeks to come. 62 days give this month and the same days of last month.
- A status follows the clock. A guest arrives at the planned time, and the status changes.
- `seeded-random.ts` gives the same rows on each load. No file calls `Math.random()`.

## How the pages read the data

Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`.
Each `queryFn` calls a list function of `~/features/hotel` and a pure build function in `lib/`.
The home figures are in `src/features/front-desk/lib/home-figures.ts`.

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the status values of the sample modules as `check` constraints.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Room`, `Guest`, `Reservation`, `HousekeepingTask`), or map the columns to them.
3. Home KPIs and charts: write SQL read functions (`data.md`, section 3) that return the shapes of `home-figures.ts`.
4. Room schedule: keep `buildSchedule` in `src/features/reservations/lib/room-schedule.ts`, and read one week of stays.
5. When every query reads the database, delete `src/features/hotel/lib/sample-*.ts` and `seeded-random.ts`.

## What does not exist yet

- No page writes data. No form exists: no new reservation, no check-in button, no task update.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: check in and check out a guest, add a reservation, move a task on the board, close a room.
- The currency is `HOTEL_CURRENCY` in `sample-rooms.ts` ("EUR"). Move it to a settings table.
- The hotel has no name in the app. The app name is `common.appName` in `messages.ts`.
