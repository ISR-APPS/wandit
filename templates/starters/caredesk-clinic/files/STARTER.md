# CareDesk: front desk of a medical practice

This project started from the starter template "CareDesk". It is an app: the pages are behind sign-in.
The practice has 6 practitioners and 360 patient files. All content is sample content. No table exists yet.

## Shell

- The sidebar groups the pages: Overview, Practice, and Account. It is inset, with a tinted ground and pill items.
- The header has a page search (Cmd/Ctrl+K opens it) and a bell.
- The bell lists the late patients and the no-shows of today (`src/features/clinic/api/alerts.queries.ts`).
  Each item opens its appointment on the calendar.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/` | Redirect to `/app` | `src/routes/index.tsx` |
| `/app` | Clinic overview: a period select (7, 30, 90 days), a CSV download, and the Overview and Reports tabs | `src/features/dashboard` |
| `/app` Overview | 4 KPI cells, visits by patient group (lines, department select), patients by department (pie), the first-visits calendar, the queue of today with a walk-in field, the top visit types, the upcoming appointments, and the last patients | `src/features/dashboard` |
| `/app` Reports | The visits of the period with their payment status, in one table | `src/features/dashboard` |
| `/app/appointments` | Calendar: a month view and a week view (`?view=month` or `?view=week`), a practitioner filter (`?practitioner=<id>`), and a CSV export of the visible days | `src/features/appointments` |
| `/app/appointments?appointment=<id>` | The side panel of one appointment | `src/features/appointments` |
| `/app/patients` | Patients: one table with status, coverage, and practitioner filters | `src/features/patients` |
| `/app/patients/$patientId` | One patient file: profile, attendance, health summary, visit history, payments, and care team. A Visits tab lists every appointment | `src/features/patients` |
| `/app/practitioners` | Practitioners: one table with specialty and status filters. A row opens the agenda of the practitioner | `src/features/practitioners` |
| `/app/profile` | Profile (from the base template) | `src/features/profile` |

The nav is in `src/features/app-shell/lib/nav-items.ts`. The texts are in `src/shared/i18n/messages.ts`.
A text with `{name}` places goes through `fillMessage` of `~/features/clinic`. Use it for each new text with a value inside.
`src/shared/ui/record-table.tsx` is the table of the app: a filter field, filter buttons, a Columns menu, sort,
row selection, a row menu, and pages. Every list page uses it.

- The walk-in field of the queue keeps the names in the state of the page only. A reload clears them.
- The fees and the payment status are sample rules in `src/features/clinic/lib/billing.ts`.
  A self-pay visit is paid. A plan pays after some days. A claim older than 30 days is overdue.
- Each CSV field that starts with `=`, `+`, `-`, `@`, a tab, or a return gets a `'` in front (`lib/csv.ts`).

## Where the sample content is

`src/features/clinic/` stands in for the database. Each `sample-*.ts` file in `lib/` is one table:

| Sample module | Becomes the table |
|---|---|
| `sample-practitioners.ts` | `practitioners` (name, specialty, room, slot length, shift of each weekday) |
| `sample-patients.ts` | `patients` (name, date of birth, phone, email, practitioner, coverage, allergies, conditions, note) |
| `sample-appointments.ts` | `appointments` (patient, practitioner, start, length, visit type, reason, status, time of each step) |

- Every date is "today plus N days". The book holds 90 days of history and 14 days ahead. The seed of a day is its date.
- A doctor sees a patient again after 14 days or more. A follow-up names a long-term condition of the file, when it has one.
- Only the status follows the clock, and no step shows before its time. A weekend clinic opens on Saturday and Sunday mornings, until 1 PM at the latest.
- `seeded-random.ts` gives the same rows on each load (no `Math.random()`). Ages and older files move on January 1.
- `appointment-rows.ts` joins an appointment with its patient and its practitioner, as a read with two embeds does.
- Each page reads through `queryOptions` in `src/features/<feature>/api/*.queries.ts`. Each `queryFn` calls a list function of `~/features/clinic` and a pure build function in `lib/`. `useNow()` gives the current minute.

## How to make each part real

1. Create the three tables with one migration. Follow `data.md` of the `app-dashboard` skill: `owner_id`, RLS, indexes.
   Keep the values of `APPOINTMENT_STATUSES` and `VISIT_TYPES` (`appointment-status.ts`) as `check` constraints.
2. Replace the body of each `queryFn` with a Supabase call. Parse the rows with a zod schema.
   Keep the row types (`Practitioner`, `Patient`, `Appointment`, `AppointmentRow`), or map the columns to them.
   The sample times are milliseconds. A `timestamptz` column gives text: convert it with `Date.parse`.
3. Figures and charts of the home: write SQL read functions (`data.md`, section 3) for `buildSummary` and
   `buildVisitSeries` of `src/features/dashboard/lib/summary.ts`. Do the same for the practitioners page.
   Replace `billing.ts` with a `payments` table, and the walk-in state with an insert in `appointments`.
4. The book has about 2,500 rows. With real data, page the list on the server (`tables-paging.md` of the skill).
5. When every query reads the database, delete `sample-*.ts` and `seeded-random.ts` of `src/features/clinic/lib/`.

## What does not exist yet

- No page writes data to the book. No form exists: no new appointment, no check-in button, no patient form.
- To add a write: a mutation in `api/<entity>.mutations.ts`, and a dialog as `tables.md` of the skill shows. The "add" buttons go in the `actions` of each `PageHeader`.
- Good first writes: book an appointment, check a patient in, end a consultation, record a no-show, add a patient.
- The status of an appointment follows the clock in the sample. With real data, the front desk sets it.
- The app name is `common.appName` in `messages.ts`. The practice itself has no name in the app.
- A patient file holds health data. Give access only to the staff of the practice, and check the RLS policies.
