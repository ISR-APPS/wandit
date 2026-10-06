# Home split
Two equal columns: a tall trend beside a block of 4 figures, then the ranked parts beside the newest rows.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- One event table gives the daily series that the business lives by: orders, revenue, or visits.
- The tables give 4 figures around it, and a category column for one breakdown.
- Examples: a shop back office (orders per day; revenue, average basket, returns, open orders; sales by category;
  newest orders). A delivery firm (deliveries per day; on time, late, failed, active drivers; deliveries by zone;
  newest deliveries).
- Fallback: kpi-band. The tables give no main flow, fewer than 4 figures, or no category for the breakdown.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Title             [7|30|90]  [Main action]   Title
+-------------------+---------+---------+    [7|30|90] [Action]
| Trend, tall       | Figure  | Figure  |    +-----------+
|                   |         |         |    | Trend     |
|                   +---------+---------+    +-----------+
|                   | Figure  | Figure  |    | Figure    |
|                   |         |         |    | Figure    |
+-------------------+---------+---------+    | Figure    |
| Ranked parts      | Newest rows       |    | Figure    |
| 1 Name ....... 42 | Name ..... status |    | Ranked    |
| 2 Name ....... 31 | Name ..... status |    | Newest    |
+-------------------+-------------------+    +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Trend | `dailySeriesQueryOptions(days)`: the one series that the business lives by. | The trend part of the chart file, tall: it fills the height of the figure block (h-72 to h-96). |
| Figures | The first 4 `KpiItem` rows of `overviewKpisQueryOptions()`. `KPI_COUNT` is 4. | The kpi form of the recipe in a 2 x 2 block. kpi=strip: one panel with 4 cells in 2 x 2. |
| Ranked parts | `breakdownQueryOptions(days)`: `BreakdownSlice[]`, largest first, `other` last. | A ranked list, not the breakdown part of the chart file: rank, name, value, and a share bar. Rank the parts (at most 5). Other has no rank, is muted, and sits last. |
| Newest rows | The first 6 rows of the main entity list query (tables.md). | A compact list: the name cell with two lines, the status Badge, and the relative time. |

## Behavior

- Period: the control (7, 30, 90 days, `PERIOD_DAYS`) sits in the PageHeader actions.
  It drives two panels: the trend and the ranked parts. Both query keys hold `days`.
- The page sets `DEFAULT_DAYS` to 30.
- chart=heat: the trend panel follows heat.md. 7 days give the strip. 30 or 90 days give the calendar.
- The trend and the ranked parts read with `useQuery` and `placeholderData: keepPreviousData`.
  Each one has its own skeleton and its own error.
- The share bar is a plain div. Its width is the value over the largest value, in percent.
  It grows from the start side in Arabic too. The value stays as text, so the bar is `aria-hidden`.
- Links: a newest row opens `/app/<entity>/$id`. "See all" opens `/app/<entity>`.
  A ranked part has no link: the list page has no filter for it.
- Loader: `overviewKpisQueryOptions()`, `dailySeriesQueryOptions(DEFAULT_DAYS)`, `breakdownQueryOptions(DEFAULT_DAYS)`,
  and the list query.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: under the PageHeader, across both columns. One sentence and 2 to 4 real first actions.
- Trend: the empty frame of the chart file at its full tall height.
- Figures: each figure shows 0 and "No earlier data".
- Ranked parts: the rank numbers 1 to 3 with empty share tracks, and one muted sentence.
- Newest rows: the empty frame of the style, one muted sentence, and the add action.

## Rules

- One grid with four children in this order: trend, figure block, ranked parts, newest rows.
  `grid grid-cols-1 gap-4 @3xl/main:gap-6 @4xl/main:grid-cols-2`. The grid rows keep the halves aligned.
- Figure block: `grid grid-cols-1 gap-4 @xl/main:grid-cols-2`. The trend panel grows to the height of this block.
- Ranked parts: at most 6 lines (5 parts and Other). Newest rows: 6 lines. So the second row has equal halves.
- 375 px: one column: trend, 4 figures, ranked parts, newest rows. The trend stays h-60 or taller.
- The skeleton draws this silhouette with the same spans and heights.
- This home differs: a chart opens the page, with the figures beside it. The period lives in the page header.
