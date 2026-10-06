# Home briefing
A morning briefing: a greeting and a sentence about the day, then a tall agenda timeline beside the day's progress.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- The main entity has a time of day: a start time or a due time. The day is the unit of work.
  Appointments, shifts, deliveries, classes, and jobs have one.
- Examples: a clinic (appointments today; visits this week, no-shows; visits per day). A delivery firm
  (deliveries today; on-time rate; deliveries per day).
- Fallback: digest. The main entity has no time of day: no start time and no due time.

## Silhouette

```text
lg (main 56rem or wider, 5 columns)          375 px
Hello, Sara                                  Hello, Sara
Tuesday 6 October. Next: L. Haddad, 11:30    Tue 6 Oct
+-----------------------+---------------+    Next: 11:30
| Agenda 3/5, 2 rows    | Today 2/5     |    +-----------+
| 09:00  Name   status  | 5 of 8 done   |    | Agenda    |
| 10:30  Name   status  | [=====---]    |    | 09:00 ... |
| ---- now 11:02 ------ | 1 late, 2 left|    | -- now -- |
| 11:30  Name   status  +---------------+    | 11:30 ... |
| 14:00  Name   status  | This week 2/5 |    +-----------+
| 16:00  Name   status  | Label .... 42 |    | Today     |
|                       | Label .. 3.1k |    +-----------+
|                       | Label ..... 7 |    | This week |
|                       | Label .... 18 |    | Label  42 |
+-----------------------+---------------+    | Label ... |
| Trend, short          [7|30|90]       |    +-----------+
+---------------------------------------+    | Trend     |
                                             +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Greeting | The first word of `fullName` from `profileQueryOptions(session.user.id)` of `~/features/profile`. | The PageHeader title: one neutral greeting ("Hello") and the first name. The greeting does not change with the hour. An empty name: the greeting alone. |
| Day line | Today's date and one sentence that the page computes from the rows. | The PageHeader description: the date (`Intl`, `dateStyle: "full"`), then the sentence. |
| Agenda | Today's rows by time, in the user time zone. At most 12. | A timeline: the time, the name cell with two lines, and the status. Done rows are muted. A now line sits between the past and the next row. |
| Today | The rows due today: done, late, and left. | A meter: done of all rows today, a part of a whole that the data has. Then the late and left counts. |
| This week | The first 4 `KpiItem` rows of `overviewKpisQueryOptions()`. `KPI_COUNT` is 4. | A ruled list in the kpi form of the recipe: one line per figure, with a rule between lines. The label sits at the start. The value and the delta sit at the end. kpi=spark: the spark under its line. kpi=meter: the bar under its line. kpi=strip: the 4 cells stack. The title names the period of the figures. |
| Trend | `dailySeriesQueryOptions(days)`. | The trend part of the chart file, side height, full width. |

## Behavior

- The sentence follows the first rule that matches. Never write a sentence that the data does not give.
  1. Late open rows exist: "Late now: 3" and a link to the list page.
  2. Else, the next open row of today: "Next:" with its name (a link to its detail page) and its time.
  3. Else: "Nothing else is planned today."
- `t()` has no placeholders. A message gives the words, and `Intl` gives the number or the time beside it.
- Now: the page reads `Date.now()` during render. A 60 s timer renders it again, so the now line and the sentence move.
- A due date that can be null: leave those rows out of today, and never count them as late.
- Today and the agenda filter the rows of the list query in the browser. Put the `LIMIT` comment of tables.md there.
- Period: a control (7, 30, 90 days) in the Trend panel header. It changes that query key only.
- The page sets `DEFAULT_DAYS` to 30.
- Links: an agenda row opens `/app/<entity>/$id`. "See all" in the agenda header opens `/app/<entity>`.
- Loader: `profileQueryOptions(context.session.user.id)` from `~/features/profile`, `overviewKpisQueryOptions()`,
  `dailySeriesQueryOptions(DEFAULT_DAYS)`, and the list query. `context.session` comes from the /app layout.
- Session: the route component reads `session` with `Route.useRouteContext()` and passes it to the page.
  `src/routes/app/profile.tsx` does the same: `<ProfilePage session={session} />`.
  The prop type is `Session` from `@supabase/supabase-js`. The page reads `session.user.id`.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- The greeting and the date stay. The sentence follows rule 3.
- Setup strip: under the PageHeader, above the agenda.
- Agenda: the timeline frame with the now line, the empty frame of the style, and one muted sentence.
- Today: "0 of 0 done" and an empty meter track.
- This week: each figure shows 0 and "No earlier data".
- Trend: the empty frame of the chart file.

## Rules

- Grid: `grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-5`.
  Agenda: `@4xl/main:col-span-3 @4xl/main:row-span-2`. Today and This week: `@4xl/main:col-span-2`.
  Trend: `@4xl/main:col-span-5`.
- Times use `Intl.DateTimeFormat` with `timeStyle: "short"` and the app locale.
- 375 px: agenda first, then today, this week, and the trend. This week stays a ruled list.
- The skeleton draws this silhouette: the greeting lines, the tall agenda, and the end column.
- This home differs: the header speaks, and a timeline of the day is the main block. No newest rows.
  The figures are a ruled list beside the agenda, never a block of figure panels.
