# Home focus-queue
The next item to handle, large, beside the queue of open rows with one tab per status. The work done per day sits below.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- An entity with a status column and a due date column. The team works through it every day: tickets, jobs, orders to ship.
- Examples: a support desk (open tickets by status; tickets closed per day; tickets by channel).
  A workshop (open work orders by status; orders done per day; downtime by reason).
- Fallback: board. The main entity has a status column but no due date column.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Title   12 open, 3 late        [Main action] Title  [Action]
+-------------+-------------------------+    12 open, 3 late
| Next up 1/3 | Queue 2/3               |    +-----------+
| REF-104     | [All 9][Planned 4][...] |    | Next up   |
| Second line | Name ...... due  status |    | REF-104   |
| due in 2 h  | Name ...... due  status |    | [Open]    |
| Fact  Fact  | Name ...... due  status |    +-----------+
| [Open]      | (at most 10)    See all |    | Queue     |
+-------------+-------------------------+    | (tabs     |
| Done per day 1/2  | Breakdown 1/2     |    |  scroll)  |
+-------------------+-------------------+    | Done/day  |
                                             | Breakdown |
                                             +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Header counts | Open rows and late rows, from the list query. | The PageHeader description: "12 open, 3 late". |
| Next up | The open row to handle first: the oldest late row, else the soonest due date. | A large panel: the name as an h2, the second line, the due time, and the status. Then 2 or 3 key facts in a `dl`, and Open. |
| Queue | Open rows, soonest due date first. At most 10. | A table under status tabs. Each tab shows its count. "All" comes first. |
| Done per day | `dailySeriesQueryOptions(days)`: the work done per day (rows closed, units made). | The trend part of the chart file, side height. Its header holds the total of the period and its delta: the value and delta parts of the kpi form. |
| Breakdown | `breakdownQueryOptions(DEFAULT_DAYS)`: the open rows or the period total by type, owner, or reason. | The breakdown part of the chart file. |

## Behavior

- Open rows: every status except the end statuses of the entity (for example done, cancelled, delivered, paid).
  The header counts, Next up, the queue, and the status tabs use this rule.
- Done total: the sum of `current` over the period. The delta is `changeRatio(sum of current, sum of previous)`.
- chart=stacked: the chart reads the `CategoryPoint[]` series (`dailyOutputQueryOptions` in the example).
  The total and its delta read the `DailyPoint[]` series (`dailyProductionQueryOptions`), because they need `previous`.
- Status tabs: a tab shows only for a status with open rows. The tab is local state.
  An edit can empty the active tab: the queue then shows All.
- The queue still lists the Next up row first, with a "next" mark.
- A due date that can be null: sort those rows last, and never count them as late.
- The counts and the queue filter the rows of the list query in the browser. Put the `LIMIT` comment of tables.md there.
- Period: a control (7, 30, 90 days) in the Done per day header. It changes the query keys of that panel only.
- The page sets `DEFAULT_DAYS` to 30.
- Links: Open and each queue row open `/app/<entity>/$id`. "See all" opens `/app/<entity>`.
  Add a status action in Next up only when tables.md gives the mutation for it.
- Loader: `dailySeriesQueryOptions(DEFAULT_DAYS)`, `breakdownQueryOptions(DEFAULT_DAYS)`, and the list query.
  chart=stacked: load both daily queries, the `DailyPoint[]` one and the `CategoryPoint[]` one. This home reads no KPI query.
- Selection: the status tab.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: under the PageHeader. The header line says "0 open".
- Next up: the panel keeps its size, with the empty frame of the style and one muted sentence.
- Queue: the tab "All 0", the table head, and the empty frame of the style.
- Done per day: the empty frame of the chart file. The total shows 0 and "No earlier data".
- Breakdown: the empty frame of the chart file.
- Rows exist but none is open: Next up says that nothing is open. This is real data, not the first visit.

## Rules

- Top row: `grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-3`. The queue spans 2 (`@4xl/main:col-span-2`).
- Bottom row: `grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-2`.
- The Next up panel and the queue have equal heights. Next up puts Open at the bottom (`mt-auto`).
- 375 px: Next up shows the name, the due time, and Open. The tabs scroll sideways (`overflow-x-auto`) and never wrap.
  The table scrolls inside its panel.
- The skeleton draws this silhouette with the same spans and heights.
- This home differs: one item, large, opens the page beside the queue. The counts live in the header
  and in the tabs. No figure panels.
