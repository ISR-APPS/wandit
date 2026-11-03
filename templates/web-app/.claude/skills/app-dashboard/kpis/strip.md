# KPI form strip

One panel holds all the figures: one cell per figure, split by rules. No panel per figure.

## Data

- The figures read `KpiItem[]` from `overviewKpisQueryOptions()` (data.md, sections 4 and 6).
  The home turns each `labelKey` into `label` with `t()` and keeps the first `KPI_COUNT` items.
- The home decides where the strip goes. This file gives the strip and the parts of one cell.
- One component draws the strip. It takes `items` and the column class of the home,
  for example `grid-cols-2 @5xl/main:grid-cols-4`. Its skeleton takes `count` and the same class.
- The KPI function always returns one row. On a first visit, each value is a real 0 and each change is `null`.
- Needs: 3 to 5 figures.

## Anatomy

1. Strip: one `Card`, with `gap-0 overflow-hidden py-0`.
2. Cells: one per figure, in a grid. A rule splits the cells.
3. In each cell: the label, the value, then the delta line or "No earlier data".
   The label is `item.label`, in `label-text` (the small label style).
   The value is `new Intl.NumberFormat(locale, item.format).format(item.value)`, with `font-numeric tabular-nums`.

- The strip is calm and dense. It suits a home with a tall chart or a long table under it.
- The theme draws the panel. The rule between the cells is 1 px in `border` with every theme.
- The snippet shows the logic. Its padding, gap, and label size and color are the defaults.
- The value is one size step below the figures of the other forms, so 5 cells fit.
- The skeleton keeps the strip and its cells in their final sizes.

## Rules

- At 375 px, 2 columns fit. Wider grids use `@container/main` queries.
- Each cell draws its top rule and its start rule. The grid moves up and to the start by the rule width.
  The panel clips it, so the rules at the panel edge disappear at every wrap.
- The kit `Card` has `py-6 gap-6`. On the strip, `py-0 gap-0` replace them, so the grid touches the panel edges.
  With the kit padding, the top rule of row 1 shows, and an empty band sits above and below the cells.
- Use `-ms-px -mt-px` with the 1 px rule (`border-s border-t`).
  Write the shift in px, not on the spacing scale: the theme scale changes it, and a rule then shows at the panel edge.
- `change` is a ratio from `changeRatio` (data.md). A change of 0.123 shows "+12.3%".
- Format it with `Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 })`.
- A change under 0.05 % shows "0%" in muted text, with no arrow and no color.
- The arrow shows the direction: `TrendUpIcon` for a rise, `TrendDownIcon` for a fall. SKILL.md, Icons, gives their imports.
- The color shows good or bad news from `goodWhen`. With `goodWhen: "down"`, a fall is good news.
- Mirror the arrow with `rtl:-scale-x-100`, never with `rtl:rotate-180`. A rotation turns a rise into a fall.
- The percent sits in `<bdi dir="ltr">`, so "+12%" keeps its order in Arabic.
  A screen reader text after it names the comparison.
- `change: null` shows "No earlier data". Never show "0%" for it.
- The home names the period once. No cell repeats it.

The strip `Card` and the grid of its cells:

```tsx
{/* py-0 and gap-0 replace the py-6 and gap-6 of the kit Card, so the grid touches the panel edges. */}
<Card className="gap-0 overflow-hidden py-0">
	{/* Each cell draws its top and start rule. The 1 px shift and the panel clip hide the rules at the panel edge, at any wrap. */}
	<div className={cn("-ms-px -mt-px grid", className)}>
		{items.map((item) => (
			// Defaults: gap-1, p-4, and a small muted label. A home slot can change them.
			<div key={item.id} className="grid gap-1 border-s border-t p-4">
				<p className="label-text text-muted-foreground text-sm">{item.label}</p>
				<p className="font-numeric tabular-nums">{new Intl.NumberFormat(locale, item.format).format(item.value)}</p>
				{/* The delta line or "No earlier data", with the Rules above. */}
			</div>
		))}
	</div>
</Card>
```

## Fallback

Fewer than 3 figures, or more than 5: use `kpis/number.md`.

## Messages

Add a `kpi` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

- `kpi.noComparison`: "No earlier data"
- `kpi.vsPrevious`: "against the previous period". Screen readers read it after the percent.
