# Innkeeper: front desk of a boutique hotel

This project started from the starter template "Innkeeper". It is an app: the pages are behind sign-in.
The hotel has 18 rooms on 3 floors. All content is sample content. No table exists yet.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Rooms: the live room board, the check-ins panel, the alerts, the arrivals to come | `src/features/front-desk` |
| `/app?room=204` | The side panel of one room | `src/features/front-desk` |
| `/app/reservations` | Reservations: the list, or the calendar with `?view=calendar` | `src/features/reservations` |
| `/app/reservations/$reservationId` | One reservation: stay, folio, balance, timeline, guest | `src/features/reservations` |
| `/app/guests` | Guests: the list, and the side panel with `?guest=guest-012` | `src/features/guests` |
| `/app/housekeeping` | Housekeeping: the progress of the day and the task board | `src/features/housekeeping` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`.
The home follows the `app-dashboard` skill: home `status-board`, KPI form `meter`, chart form `heat`.

## Where the sample content is

`src/features/hotel/` stands in for the database. Each file in `lib/` is one table:

| Sample module | Becomes the table |
|---|---|
| `sample-rooms.ts` | `rooms` (number, floor, type, bed, view, capacity, rate, out-of-order time) |
| `sample-guests.ts` | `guests` (name, email, phone, city, country, preference) |
| `sample-reservations.ts` | `reservations`, `folio_charges`, `payments` |
| `sample-housekeeping.ts` | `housekeeping_tasks`, `attendants` |

- Every date is "today plus N days". So the hotel never looks old.
- A status follows the clock. A guest arrives at the planned time, and the room tile changes.
- `seeded-random.ts` gives the same rows on each load. No file calls `Math.random()`.
- The check-ins chart reads the sample book for the last 14 days. Older days come from a seeded series
  in `src/features/front-desk/lib/series.ts`.

## How the pages read the data

Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`.
Each `queryFn` calls a list function of `~/features/hotel` and a pure build function in `lib/`.

## How to make each part real

1. Create the tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the status values of the sample modules as `check` constraints.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Room`, `Guest`, `Reservation`, `HousekeepingTask`), or map the columns to them.
3. Room board: keep `buildRoomBoard` in `src/features/front-desk/lib/room-board.ts`, or move its rules to a view.
4. Check-ins chart and KPIs: write SQL read functions (`data.md`, section 3). Then delete the seeded series.
5. When every query reads the database, delete `src/features/hotel/lib/sample-*.ts` and `seeded-random.ts`.

## What does not exist yet

- No page writes data. No form exists: no new reservation, no check-in button, no task update.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows.
- Good first writes: check in and check out a guest, add a reservation, set a task to done, close a room.
- The currency is `HOTEL_CURRENCY` in `sample-rooms.ts` ("EUR"). Move it to a settings table.
- The hotel has no name in the app. The app name is `common.appName` in `messages.ts`.
