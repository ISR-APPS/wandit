# Home hero
One giant figure with its trend as a large sparkline, 3 or 4 supporting facts under it, then one list.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- The business lives by one flow with a daily event table: revenue, orders, visits, check-ins, deliveries.
  It answers "how are we doing" alone.
- A level (members, stock, open tickets) is not a sum of days. It goes in the facts, never in the hero.
- Examples: a gym (check-ins; active members, new members, renewals due; next classes). A shop
  (revenue; orders, average basket, returns; newest orders).
- Fallback: kpi-band. The business has no single leading flow: 3 or 4 figures matter the same.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Overview                       [Main action] Overview  [Action]
+---------------------------------------+    +-----------+
| Revenue, last 30 days       [7|30|90] |    | Revenue   |
|                                       |    | [7|30|90] |
| 48,250           ___/\__/\___/\/--*   |    | 48,250    |
| +12%         ___/                     |    | +12%      |
+---------------------------------------+    | ~~~~~~~~* |
Fact      | Fact      | Fact     | Fact      +-----------+
312       | 4.2%      | 18       | 7         Fact  | Fact
                                             312   | 4.2%
+---------------------------------------+    Fact  | Fact
| Next items                    See all |    18    | 7
| 11:30  Name ................ status   |    +-----------+
| 14:00  Name ................ status   |    | List      |
+---------------------------------------+    +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Hero figure | The sum of `current` of the daily series over the period. The delta compares it with the sum of `previous`. | The label and period, the value at the largest size of the style, and the delta of the kpi form. |
| Hero chart | `dailySeriesQueryOptions(days)`. | A large sparkline: the trend part of the chart file with no axes and no grid, h-28 to h-40. The last point is marked. A tooltip stays. |
| Facts | The first 3 or 4 `KpiItem` rows of `overviewKpisQueryOptions()`, without the one that repeats the hero. `KPI_COUNT` is 3 or 4. | The kpi form of the recipe, one size below its usual size, in one ruled row with no panels. |
| List | The next items (a time to come, soonest first), else the newest rows. 5 to 8 rows. | A list: the time or the relative time, the name cell, and the status Badge. |

## Behavior

- The hero figure follows the period of its chart. Compute it from the points, never from another query:

```ts
// The hero is a flow: the total of the period, against the same days one period earlier.
const total = points.reduce((sum, point) => sum + point.current, 0);
const previousTotal = points.reduce((sum, point) => sum + point.previous, 0);
const change = changeRatio(total, previousTotal); // null: "No earlier data", never "0%".
```

- chart=stacked: the hero still reads `DailyPoint[]`, because the figure needs `previous`. The chart draws one bar per day.
- Period: a control (7, 30, 90 days) in the hero panel header. It changes the hero figure, its delta, and the chart.
  The facts keep the periods of the KPI query.
- The page sets `DEFAULT_DAYS` to 30.
- chart=heat: draw the strip of heat.md at every period. The strip has the height of the hero chart.
  The strip fills the chart width. The calendar does not.
- Arabic: time runs from right to left. Keep `reversed` on the hidden time XAxis.
- Links: a list row opens `/app/<entity>/$id`. "See all" opens `/app/<entity>`.
- Loader: `dailySeriesQueryOptions(DEFAULT_DAYS)`, `overviewKpisQueryOptions()`, and the list query.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Hero: the value 0, "No earlier data", and a flat sparkline at 0 across the full width.
- Setup strip: under the hero panel, above the facts.
- Facts: each shows 0 and "No earlier data".
- List: the empty frame of the style, one muted sentence, and the add action.

## Rules

- Hero panel: from 56rem, `grid @4xl/main:grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-end gap-8`:
  the figure at the start, the chart fills the end. Under 56rem: one column, the chart under the figure.
- The hero value never truncates. At 375 px, it uses a smaller size: for example `text-5xl`, and `text-7xl` from 56rem.
- Facts: no panels. One ruled row, like the totals line of ledger: a `dl` with one `div` per fact.
  The `dl` has `-ms-[calc(var(--spacing)*6+1px)] flex flex-wrap gap-y-3`, inside a wrapper with `overflow-hidden`.
  Each fact has `basis-1/2 border-s ps-6 pe-6`, and `@4xl/main:flex-1` puts all facts on one line from 56rem.
  A fact at the start of a line, also after a wrap, shows no start rule: the wrapper clips it.
  The margin in the `calc` is the `ps-6` padding plus the rule width (1 px by default).
  Density scales `--spacing`, so the margin follows it.
- kpi=strip: each fact holds the parts of one cell of strip.md, with no panel.
  The rules and the clip above replace the strip grid.
- The style signature fits best on the hero panel. Spend the boldness there and keep the facts quiet.
- 375 px: the hero, the chart (h-28), facts 2 x 2, the list.
- The skeleton draws the hero panel at its full height, the facts row, and 5 list rows.
- This home differs: one figure dominates, and the only chart belongs to it. No panel grid.
