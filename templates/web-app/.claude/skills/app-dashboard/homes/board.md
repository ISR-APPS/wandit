# Home board
Status columns of the main entity, with counts in the column heads, old items flagged, and a throughput mini chart.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- An entity with 3 to 6 status values that move in order: a pipeline. Leads to won, to do to done, new to served.
- The business expects at most a few hundred open rows. A column shows its first 20.
- Examples: a sales team (deals: lead, qualified, proposal, won; deals won per day). A print shop
  (jobs: received, in proof, printing, ready; jobs ready per day).
- Fallback: ledger. The status values do not move in order, or the main entity has fewer than 3 status values.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Deals                 ._|_.||_ 14 won [Add]  Deals      [Add]
+---------+---------+---------+---------+    ._|_.||_ 14 won
| Lead 12 | Qualif 5| Propo 3 | Won 8   |    +---------+---
+---------+---------+---------+---------+    | Lead 12 | Qu
| [slip]  | [slip]! | [slip]  | [slip]  |    +---------+---
| [slip]! | [slip]  | [slip]  | [slip]  |    | [slip]! | [s
| [slip]  |         |         |         |    | [slip]  | [s
| +9 more |         |         |         |    | +9 more |
+---------+---------+---------+---------+    +---------+---
Lost in the last 30 days: 4                  <- scroll ->
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Throughput | Rows that reach the closed status per day, last 30 days (`DEFAULT_DAYS`). | The chart form at mini height and w-32 to w-40, no axes, in the PageHeader actions. Beside it: the closed total of the period and its delta, the value and delta parts of the kpi form. |
| Column head | One per status of the pipeline, in the order of the work. | The status word with its dot (Badge rule) and the count of rows in that status. |
| Slip | One row: the name, the second line, its age in the status, and the owner or the amount. | A small panel. An old slip gets a flag: an icon and its age ("14 d"). |
| More | The rows of a column after the first 20. | A link "+9 more" to the list page. |
| End line | Rows that ended in a failed status (lost, cancelled) in the period. | One muted line under the board. A failed status gets no column. |

## Behavior

- Each column lists its slips oldest first, so the item that waits longest is on top.
- Age: now minus the time of the last status change (`status_changed_at`, or the newest `status_changes` row).
  The entity has neither: use `created_at`.
- Age text: `Intl.NumberFormat` with `style: "unit"`, `unit: "day"` or `"hour"`, and `unitDisplay: "narrow"`.
- Flag: the age passes the threshold of the domain (data.md, section 7, the attention line).
  The domain gives no threshold: flag only the oldest slip of each column. Never invent a threshold.
- The closed column (won, done) shows only the rows closed in the last 30 days. Else it grows forever.
- The columns group the rows of the list query in the browser. Put the `LIMIT` comment of tables.md there.
- Throughput: use `dailySeriesQueryOptions(DEFAULT_DAYS)` when the main series counts closed rows.
  Else write a read function of the same shape over the status change events (data.md, sections 2 and 3).
- Throughput total: the sum of `current`. The delta is `changeRatio(sum of current, sum of previous)`.
- chart=stacked: the mini chart reads a `CategoryPoint[]` series of the closed rows by type
  (`dailyOutputQueryOptions` in the example). The total and its delta read the `DailyPoint[]` series
  (`dailyProductionQueryOptions`), because they need `previous`.
- Period: no control. The mini chart always shows 30 days, and its `aria-label` names the period.
- The page sets `DEFAULT_DAYS` to 30.
- Links: a slip opens `/app/<entity>/$id`. "+9 more" opens `/app/<entity>`.
- No drag and drop, unless the user asks for it. The status changes on the detail page or in the row actions of tables.md.
- Loader: the throughput query and the list query. This home reads no KPI query.
  chart=stacked: load both throughput queries, the `DailyPoint[]` one and the `CategoryPoint[]` one.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: under the PageHeader, above the columns.
- Every column stays, with the count 0 and one empty slot in the empty frame of the style.
  The slot of the first column holds the add action.
- Throughput: a flat mini chart at 0, and "0 won" in the words of the app.
- End line: hidden while the count is 0.

## Rules

- The columns sit in one row at every width:

```tsx
// One column per pipeline status. Columns scroll sideways when they do not fit, and snap at 375 px.
<section
	aria-label={t("overview.boardLabel")}
	className="grid @4xl/main:snap-none snap-x snap-mandatory auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2"
>
	{columns.map((column) => (
		<div key={column.status} className="flex min-h-64 snap-start flex-col gap-2">
			{/* column head (an h2 with the count), slips, +more */}
		</div>
	))}
</section>
```

- Each slip is a `Link`, so Tab reaches every column and scrolls it into view. Do not add `tabIndex`:
  Biome refuses it on a non-interactive element. The scroll follows `dir` in Arabic with no extra code.
- The columns have equal heights. An empty column keeps its slot.
- 375 px: about 1.5 columns show, so the next column hints the scroll.
- The skeleton draws 4 columns with 3 slips each.
- This home differs: vertical status columns fill the page. The counts sit in the column heads. No figure panels.
