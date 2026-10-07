# Home main-rail
A wide main column, and a narrow sticky rail at the end side with the work that needs a person.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- The main entity has an attention rule: a due date, a blocked status, or a minimum quantity.
  The rail lists the open rows that break the rule: late, blocked, or under the minimum. The rail is the reason for this home.
- Examples: a repair shop (late or blocked jobs; jobs per day; newest jobs; next pickups). A stock app
  (items under minimum; movements per day; newest orders; next deliveries).
- Fallback: split. The main entity has no due date, no blocked status, and no minimum.

## Silhouette

```text
lg (main 64rem or wider)                     375 px
Title                          [Main action] Title  [Action]
+--------------------------+  +----------+   +-----------+
| Trend          [7|30|90] |  | Needs    |   | Needs     |
|                          |  | attention|   | attention |
|                          |  | 3 rows   |   +-----------+
+--------------------------+  +----------+   | Figures   |
| Newest rows              |  | Figures  |   +-----------+
| Name ............ status |  | Label  42|   | Due next  |
| Name ............ status |  | Label   3|   +-----------+
|                          |  +----------+   | Trend     |
|                          |  | Due next |   | Newest    |
+--------------------------+  +----------+   +-----------+
                              rail 20rem, sticky
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Needs attention | Open rows that are late, blocked, or under a threshold. Oldest due date first, at most 6. | A list: name, the reason ("late 2 d", "blocked"), and the status Badge. The count sits in the title. Days use `Intl.NumberFormat` with `style: "unit"`. |
| Figures | The first 3 `KpiItem` rows of `overviewKpisQueryOptions()`. `KPI_COUNT` is 3. | The kpi form as a stacked list: one line per figure, the label at the start, the value at the end. kpi=spark: the spark under its line. kpi=meter: the bar under its line. kpi=strip: the cells stack. |
| Due next | Open rows with a due date to come, soonest first, at most 5. | A list with relative times. |
| Trend | `dailySeriesQueryOptions(days)`. | The trend part of the chart file, main height (h-64 to h-72). |
| Newest rows | The first 8 rows of the main entity list query (tables.md). | A table: the name cell with two lines, the status Badge, and the relative time at the end. |
| Quick actions | Only when 2 or more real create forms exist. | One button per form, in the rail under the figures. Each button opens its form. |

## Behavior

- Period: a control (7, 30, 90 days) in the Trend panel header. It changes the trend query key only.
- The page sets `DEFAULT_DAYS` to 30.
- Needs attention and Due next filter the rows of the list query in the browser.
  Put this mark on that code: `// LIMIT: reads the newest 1,000 rows. Upgrade: a query of the open rows by due date.`
- A due date that can be null: sort those rows last, and never count them as late.
- Links: each row in the rail and in the table opens `/app/<entity>/$id`. "See all" opens `/app/<entity>`.
- Loader: `overviewKpisQueryOptions()`, `dailySeriesQueryOptions(DEFAULT_DAYS)`, and the list query.
- Selection: none.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: at the top of the main column, above the trend. The rail keeps its place.
- Needs attention: the count 0 and "Nothing needs attention." This is also the healthy state on later visits.
- Figures: each line shows 0 and "No earlier data".
- Due next: the empty frame of the style and one muted sentence.
- Trend: the empty frame of the chart file at full height.
- Newest rows: the table head, the empty frame of the style, one muted sentence, and the add action.

## Rules

- The rail comes first in the DOM, so the attention list opens the page at 375 px:

```tsx
// From 64rem: main column at the start, rail of 20rem at the end. Below: one column, rail first.
<div className="grid @5xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start @3xl/main:gap-6 gap-4">
	{/* top-16: under the 3rem sticky app header, with a gap. Match the header height of the shell. */}
	<div className="@5xl/main:sticky @5xl/main:top-16 @5xl/main:col-start-2 @5xl/main:row-start-1 flex flex-col gap-4">
		{/* Needs attention, figures, quick actions, due next */}
	</div>
	<div className="@5xl/main:col-start-1 @5xl/main:row-start-1 flex min-w-0 flex-col @3xl/main:gap-6 gap-4">
		{/* Trend, newest rows */}
	</div>
</div>
```

- Keep the rail shorter than one laptop screen: 6 + 3 + 5 lines. The rail never scrolls inside itself.
- 375 px: one column: attention, figures, due next, trend, newest rows. The trend keeps its main height.
- The skeleton draws this silhouette: the main column and the rail.
- This home differs: a narrow rail of work stays in view at the end side. The figures are a list inside it.
