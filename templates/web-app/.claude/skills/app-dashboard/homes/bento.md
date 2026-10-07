# Home bento
A 12-column mosaic: three kinds at three widths on top, then a tall trend beside small tiles.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- The main entity has a status column and a number to rank its rows: an amount or a quantity.
- An event table gives the daily series and the breakdown. Each tile shows a different kind of data.
- Examples: an agency (hours per day; hours by client; largest open projects; newest tasks; tasks per status).
  A stock app (movements per day; stock value by category; largest open orders; newest movements; orders per status).
- Fallback: split. The main entity has no status column, or no amount and no quantity to rank by.

## Silhouette

```text
lg (main 56rem or wider, 12 columns)         375 px
+----------------+------------+---------+    +-----------+
| Figure, large  | Breakdown  | Status  |    | Figure, L |
| 5              | 4          | 3       |    +-----------+
|                |            |         |    | Breakdown |
+----------------+---------+--+--+------+    +-----------+
| Trend 8, 2 rows high     |Fig 2|Fig 2 |    | Status    |
|                [7|30|90] +-----+------+    +-----------+
|                          | Ranked 4   |    | Trend     |
|                          | 1 Name  42 |    +-----+-----+
|                          | 2 Name  31 |    |Fig  |Fig  |
+--------------------------+------------+    +-----+-----+
| Activity 12, newest rows              |    | Ranked    |
+---------------------------------------+    | Activity  |
                                             +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Figure, large | The first `KpiItem` of `overviewKpisQueryOptions()`. `KPI_COUNT` is 3. | The kpi form of the recipe at its largest size. Its spark, meter, or icon part shows here. |
| Breakdown | `breakdownQueryOptions(DEFAULT_DAYS)`. The page translates the codes. | The breakdown part of the chart file. |
| Status | The count of rows per status, from the list query. | One line per status: the status word (Badge rule), the count, and a share bar. |
| Trend | `dailySeriesQueryOptions(days)`. | The trend part of the chart file, main height (h-64 to h-72). |
| Figure, small (2) | `KpiItem` 2 and 3. | Label, value, and delta only. kpi=strip: one panel with two cells, `col-span-2 @4xl/main:col-span-4`. |
| Ranked | The 5 largest open rows of the main entity by one number (an amount, a quantity). | A list: name, value, and a share bar against the largest row. |
| Activity | The 5 newest rows or events, with their time and status. | A compact list with relative times. |

## Behavior

- Period: a control (7, 30, 90 days) in the Trend tile header. It changes the trend query key only.
  The breakdown keeps `DEFAULT_DAYS` and names its period in its title.
- The page sets `DEFAULT_DAYS` to 30.
- Ranked and Status count the rows of the list query in the browser.
  Put the `LIMIT` comment of tables.md on that math: at most 1,000 rows.
- Links: a ranked row and an activity row open `/app/<entity>/$id`. A status line opens the list page.
  It adds `?status=` only when the list page reads that search param (tables-paging.md).
- Loader: `overviewKpisQueryOptions()`, `dailySeriesQueryOptions(DEFAULT_DAYS)`, `breakdownQueryOptions(DEFAULT_DAYS)`,
  and the list query.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: the first item of the grid, `col-span-full`, above the first row.
- Figures: each shows 0 and "No earlier data".
- Breakdown and Trend: the empty frames of the chart file at full size.
- Status: one line per status with 0 and an empty track. The status words teach the workflow.
- Ranked and Activity: the empty frame of the style, one muted sentence, and the add action.

## Rules

- The spans make the mosaic. The tiles keep this DOM order:

```ts
// 2 columns under 56rem, 12 from 56rem. Row 1 mixes three kinds at three widths.
const BENTO_GRID =
	"grid grid-cols-2 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-12";
const TILE_SPANS = {
	figureLarge: "col-span-2 @4xl/main:col-span-5",
	breakdown: "col-span-2 @4xl/main:col-span-4",
	status: "col-span-2 @4xl/main:col-span-3",
	trend: "col-span-2 @4xl/main:col-span-8 @4xl/main:row-span-2",
	figureSmall: "@4xl/main:col-span-2",
	ranked: "col-span-2 @4xl/main:col-span-4",
	activity: "col-span-2 @4xl/main:col-span-12",
} as const;
```

- The grid places the two small figures beside the top half of the trend, and Ranked under them.
- A tile with `row-span-2` stretches over two rows. The tiles of one grid row have equal heights.
- 8 tiles at most. Apart from the figures, never two tiles of the same kind.
- 375 px: 2 columns. The two small figures sit side by side. Every other tile spans 2.
- The skeleton draws this mosaic with the same spans.
- This home differs: no chart and no row of equal figures opens the page.
  Row 1 holds a figure, a breakdown, and the status counts at three widths. The trend comes second.
