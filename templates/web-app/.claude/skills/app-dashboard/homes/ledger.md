# Home ledger
Table first: a line of totals, a slim activity strip, then the full-width entity table with an inline bar.

## Needs

- Judge these needs on the tables and the user's words, never on rows. The first build has no rows.
- A main entity with an amount column or a quantity column: invoices, orders, payments, stock items.
- 3 to 5 totals of that entity.
- The team reads the rows like a book: it scans, sorts, and opens them.
- Examples: invoicing (outstanding, overdue, paid this month, invoices sent; invoices with their amount).
  A wholesaler (orders this month, value, average order, returns; orders with their value).
- Fallback: kpi-band. The main entity has no amount column and no quantity column.

## Silhouette

```text
lg (main 56rem or wider)                     375 px
Invoices                         [Add]       Invoices    [Add]
Outstanding | Overdue | Paid    | Sent       Outstanding 12,400
12,400 +4%  | 3,100   | 8,900   | 46         Overdue      3,100
-----------------------------------------    Paid         8,900
Last 30 days  ._.|_||.|_._||_|. [7|30|90]    Sent            46
+---------------------------------------+    ._.|_||.|_.|_
| Search                                |    +-----------+
| Ref     Client   Status   Amount      |    | Table     |
| INV-104 Name     Paid     ####  1,200 |    | (scrolls  |
| INV-103 Name     Overdue  ##      600 |    | sideways) |
| INV-102 Name     Sent     #       240 |    | 20 rows   |
| 20 rows per page            < 1 2 3 > |    | per page  |
+---------------------------------------+    +-----------+
```

## Slots

| Slot | Data kind | Form |
|---|---|---|
| Totals | The first 3 to 5 `KpiItem` rows of `overviewKpisQueryOptions()`. `KPI_COUNT` is 3 to 5. | One line of figures with no panels: the label over the value, and the delta after the value. The kpi form gives the value and delta parts only. Its spark, meter, and icon parts do not show here. |
| Activity strip | `dailySeriesQueryOptions(days)`: one value per day. | The chart form at mini height, no axes, no grid, a tooltip per day. chart=heat: the strip of heat.md. chart=bars or stacked: one bar per day (stacked splits it). chart=area or compare: a thin line with a low fill. |
| Table | Every row of the main entity list query (tables.md). | `DataTable`: the columns of the list page, a search, a sort, pages of 20. The amount cell holds a bar. |

## Behavior

- Columns: reuse the column list of the list page. Export it from the entity feature (a hook such as
  `use<Entity>Columns(rows)`) through its `index.ts`. Never write a second column list.
- The shared amount column draws the bar on both pages: the list page and this home. The hook has no option for it.
- The bar sits in the amount cell, before the number. It is a plain div. The hook finds the largest amount
  in the `rows` that it gets. The width is the amount over that largest amount, in percent.
  No bar when the amount or the largest amount is 0 or less. The bar is `aria-hidden`: the number is the text.
- More than 1,000 rows: the table uses server paging (tables-paging.md). The page then gives the hook its page rows.
- Period: a control (7, 30, 90 days) at the end of the strip line. It changes the strip only.
  The totals keep the periods of the KPI query. The strip names its period at the start.
- The page sets `DEFAULT_DAYS` to 30.
- Links: a name cell opens `/app/<entity>/$id`. The row actions menu of the list page stays.
  "Open the list" opens `/app/<entity>` with its status tabs and filters.
- Loader: `overviewKpisQueryOptions()`, `dailySeriesQueryOptions(DEFAULT_DAYS)`, and the list query.
- Selection: none. The search and the sort live in the table.

## Empty state

The list query returns no row: this is the first visit.

- Setup strip: under the PageHeader, above the totals line.
- Totals: each figure shows 0 and "No earlier data" in place of the delta.
- Activity strip: every day at the lowest step, or a flat zero baseline. The strip keeps its height.
- Table: the table head, then the empty frame of the style, one muted sentence, and the add action.
  Render them in place of DataTable. Its `noResults` text is for a search with no match.

## Rules

- Page: `flex flex-col gap-4 @3xl/main:gap-6`. The table panel is the largest block. Never put a chart beside it.
- Totals: a `dl` with one `div` per figure. Each figure has `border-s ps-6`, and from 36rem `pe-6`.
  The padding on both sides gives the same space before and after each rule.
  A figure at the start of a line, also after a wrap, has no start rule: the wrapper clips it.
  The `dl` moves to the start by the `ps-6` padding plus the 1 px rule. Density scales `--spacing`, so the margin follows it.
  Under 36rem: one figure per line, the label at the start, the value at the end.

```tsx
// The negative margin and overflow-hidden clip the start rule of the first figure on each line.
// The margin is ps-6 plus the 1 px rule. It reads --spacing, so it follows the density.
<div className="overflow-hidden">
	<dl className="-ms-[calc(var(--spacing)*6+1px)] flex flex-wrap gap-y-3">
		{totals.map((total) => (
			<div
				key={total.id}
				className="flex @xl/main:w-auto w-full @xl/main:flex-col items-baseline justify-between gap-x-3 gap-y-1 border-s ps-6 @xl/main:pe-6"
			>
				<dt className="text-muted-foreground text-sm">{total.label}</dt>
				<dd className="font-numeric tabular-nums">{/* value, delta */}</dd>
			</div>
		))}
	</dl>
</div>
```

- Strip: full width. Bars use `flex-1`, so 7, 30, or 90 days fill the same width.
- Numbers in the table and the totals are `tabular-nums` and end-aligned in the table.
- 375 px: the totals stack, the strip stays one line, and the table scrolls sideways inside its panel.
- The skeleton draws the totals line, the strip, and 8 table rows.
- This home differs: no chart panel and no figure panels. A line of totals and a strip lead into the table.
