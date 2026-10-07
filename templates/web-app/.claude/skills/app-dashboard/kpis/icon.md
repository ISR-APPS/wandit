# KPI form icon

Each figure shows an icon of the thing that it counts, its label, its value, and the change.

## Data

- The figures read `KpiItem[]` from `overviewKpisQueryOptions()` (data.md, sections 4 and 6).
  The home turns each `labelKey` into `label` with `t()` and keeps the first `KPI_COUNT` items.
- The home decides where the figures go and how many it shows. This file gives the parts of one figure.
- One component draws the figures of one slot. It takes `items` and the layout class of the home.
  Its skeleton takes `count` and the same class.
- The KPI function always returns one row. On a first visit, each value is a real 0 and each change is `null`.
- Needs: a `lucide-react` icon that names the counted thing of most figures. A box for units, a clock for late items.

## Anatomy

1. Label line: `item.label`, in the label look of the style (`label-text`), at the start. The icon chip sits at the end.
2. Value: `new Intl.NumberFormat(locale, item.format).format(item.value)`, with `font-numeric tabular-nums`.
3. Delta: one line with the arrow, the percent, and a screen reader text. Or the muted line "No earlier data".

- The style draws the chip: its surface, its shape, its size, and the icon color.
- The style gives the panel of a figure: a card, a ruled cell, a tile, a slip, or no box.
- The style gives the sizes, the weights, and the gaps.
- The snippet shows the logic. Its text size, gap, and arrow size are the no-style defaults.
- The skeleton keeps the label line, the chip, the value, and the delta in their final sizes.

## Rules

- `KPI_ICONS: Record<string, LucideIcon>` maps each `KpiItem.id` to one icon. A KPI with no entry gets no chip.
- Import each icon by name with the `Icon` suffix, for example `PackageCheckIcon` for units made.
- Never use a trend arrow as a KPI icon. In this form, an arrow always means the change.
- `change` is a ratio from `changeRatio` (data.md). A change of 0.123 shows "+12.3%".
- Format it with `Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 })`.
- A change under 0.05 % shows "0%" in muted text, with no arrow and no color.
- The arrow shows the direction: `TrendingUpIcon` for a rise, `TrendingDownIcon` for a fall.
- The color shows good or bad news from `goodWhen`. With `goodWhen: "down"`, a fall is good news.
- Mirror the arrow with `rtl:-scale-x-100`, never with `rtl:rotate-180`. A rotation turns a rise into a fall.
- The percent sits in `<bdi dir="ltr">`, so "+12%" keeps its order in Arabic.
- `change: null` shows "No earlier data". Never show "0%" for it.
- The home names the period once. No figure repeats it.

The delta line, with its imports from `lucide-react`, `~/shared/i18n`, and `~/shared/lib/utils`:

```tsx
// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

/** The delta line of one figure. A change of null (no earlier data) never shows "0%". */
function ChangeLine({ item }: { item: KpiItem }) {
	const { t, locale } = useT();
	const { change } = item;
	if (change === null) {
		return <p className="text-muted-foreground text-sm">{t("kpi.noComparison")}</p>;
	}
	const percent = new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 });
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (item.goodWhen === "up");
	const TrendIcon = change < 0 ? TrendingDownIcon : TrendingUpIcon;
	// No-style defaults: text-sm, gap-1, and size-4. The style Anatomy replaces them.
	return (
		<p className={cn("flex items-center gap-1 text-sm", isFlat ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive")}>
			{isFlat ? null : <TrendIcon className="size-4 rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">{percent.format(change)}</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</p>
	);
}
```

## Fallback

No `lucide-react` icon names the counted things of the app: use `kpis/number.md`.

## Messages

Add a `kpi` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

- `kpi.noComparison`: "No earlier data"
- `kpi.vsPrevious`: "against the previous period". Screen readers read it after the percent.
