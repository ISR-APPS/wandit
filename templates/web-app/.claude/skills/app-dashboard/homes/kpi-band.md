# Home kpi-band
A full-width band of 3 or 4 figures, then the main trend beside one breakdown, then the newest rows.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- 3 or 4 strong figures and one daily series. Almost every app has them.
- This is the only home that opens with a full-width row of figures. Take it when the recipe ranks it first.
- Examples: a factory (units today, machines running, late orders, scrap rate; units per day; downtime by reason;
  newest work orders). A clinic (visits today, no-shows, open slots, revenue; visits per day; visits by type;
  next appointments).
- Fallback: none. Every fallback chain ends here. The band has one column per strong figure, 2 to 4.
  Never fill a slot with a weak number.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Title, scope line              [Main action] Title  [Action]
+---------+---------+---------+---------+    +-----------+
| Figure  | Figure  | Figure  | Figure  |    | Figure    |
+---------+---------+---------+---------+    | Figure    |
| Trend 2/3         [7|30|90] | Break-  |    | Figure    |
|                             | down 1/3|    | Figure    |
+-----------------------------+---------+    | Trend     |
| Newest rows (full width)     See all  |    | Breakdown |
+---------------------------------------+    | Newest    |
                                             +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Band | The first 3 or 4 `KpiItem` rows of `overviewKpisQueryOptions()`. `KPI_COUNT` is 3 or 4. | The kpi form of the recipe, one panel per figure. kpi=strip: one panel with one cell per figure. |
| Trend | `dailySeriesQueryOptions(days)`: `DailyPoint[]`, or `CategoryPoint[]` with chart=stacked. | The trend part of the chart file, main height (h-64 to h-72). |
| Breakdown | `breakdownQueryOptions(DEFAULT_DAYS)`: `BreakdownSlice[]`. The page translates the codes. | The breakdown part of the chart file. |
| Newest rows | The first 6 rows of the main entity list query (tables.md). | A table: the name cell with two lines, the status Badge, and the relative time at the end. |

## Behavior

- Period: a control (7, 30, 90 days, `PERIOD_DAYS`) in the Trend panel header. It changes the trend query key only.
  The breakdown keeps `DEFAULT_DAYS` and names its period in its title.
- The page sets `DEFAULT_DAYS` to 30.
- The trend reads with `useQuery` and `placeholderData: keepPreviousData`. It has its own skeleton and its own error.
- Links: a name cell opens `/app/<entity>/$id`. "See all" in the Newest rows header opens `/app/<entity>`.
  The PageHeader holds the main action of the app.
- Loader: `overviewKpisQueryOptions()`, `dailySeriesQueryOptions(DEFAULT_DAYS)`, `breakdownQueryOptions(DEFAULT_DAYS)`,
  and the list query. The other panels read the cache with `useSuspenseQuery`.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: under the PageHeader, above the band. One sentence and 2 to 4 real first actions.
- Band: each figure shows its real value (0) and "No earlier data" in place of the delta. Never "0%".
- Trend: the empty frame of the chart file at full height. Every day is a real 0.
- Breakdown: the empty frame of the chart file and one muted sentence with the page that records the events.
- Newest rows: the table head, the empty frame of the style, one muted sentence, and the add action.

## Rules

- Page: `flex flex-col gap-4 @3xl/main:gap-6`.
- Band: `grid grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4`. With 3 figures: `@5xl/main:grid-cols-3`.
  kpi=strip: `grid-cols-2` from 375 px.
- Charts row: `grid grid-cols-1 @4xl/main:grid-cols-3`. The trend spans 2 (`@4xl/main:col-span-2`).
- The panels of one row have equal heights.
- 375 px: one column in the order of the drawing. The trend keeps its main height. The table scrolls inside its panel.
- The skeleton draws this silhouette with the same spans and heights.
- This home differs by its band: one row of equal figure panels opens the page. Never add a second row of figures.
