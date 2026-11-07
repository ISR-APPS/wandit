# KPI form icon

Each figure shows an icon of the thing that it counts, its label, its value, and the change.

## Data

- The figures read `KpiItem[]` from `overviewKpisQueryOptions()` (data.md, sections 4 and 6).
  The home turns each `labelKey` into `label` with `t()` and keeps the first `KPI_COUNT` items.
- The home decides where the figures go and how many it shows. This file gives the parts of one figure.
- One component draws the figures of one slot. It takes `items` and the layout class of the home.
  Its skeleton takes `count` and the same class.
- The KPI function always returns one row. On a first visit, each value is a real 0 and each change is `null`.
- Needs: a Phosphor icon that names the counted thing of most figures. A box for units, a clock for late items.

## Anatomy

1. Label line: `item.label`, in `label-text` (the small label style), at the start. The icon chip sits at the end.
2. Value: `new Intl.NumberFormat(locale, item.format).format(item.value)`, with `font-numeric tabular-nums`.
3. Delta: one line with the arrow, the percent, and a screen reader text. Or the muted line "No earlier data".

- The chip is `flex size-9 items-center justify-center rounded-control bg-accent text-accent-foreground`, with a `size-4` icon.
- The panel of a figure is a `Card`, unless the home slot says otherwise.
- The theme scale changes the gaps. The home slot gives the value size.
- The snippet shows the logic. Its text size, gap, and arrow size are the defaults.
- The skeleton keeps the label line, the chip, the value, and the delta in their final sizes.

## Rules

- `KPI_ICONS: Record<string, KitIcon>` maps each `KpiItem.id` to one icon. `KitIcon` comes from `~/shared/ui/icons`. A KPI with no entry gets no chip.
- Import each icon from `@phosphor-icons/react` (SKILL.md, Icons). For units made: `PackageIcon`.
- Never use a trend arrow as a KPI icon. In this form, an arrow always means the change.
- `change` is a ratio from `changeRatio` (data.md). A change of 0.123 shows "+12.3%".
- Format it with `Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 })`.
- A change under 0.05 % shows "0%" in muted text, with no arrow and no color.
- The arrow shows the direction: `TrendUpIcon` for a rise, `TrendDownIcon` for a fall. SKILL.md, Icons, gives their imports.
- The color shows good or bad news from `goodWhen`. With `goodWhen: "down"`, a fall is good news.
- Mirror the arrow with `rtl:-scale-x-100`, never with `rtl:rotate-180`. A rotation turns a rise into a fall.
- The percent sits in `<bdi dir="ltr">`, so "+12%" keeps its order in Arabic.
- `change: null` shows "No earlier data". Never show "0%" for it.
- The home names the period once. No figure repeats it.

The delta line, with its imports from `@phosphor-icons/react` (SKILL.md, Icons), `~/shared/i18n`, and `~/shared/lib/utils`:

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
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	// Defaults: text-sm, gap-1, and size-4. A home slot can change them.
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

No Phosphor icon names the counted things of the app: use `kpis/number.md`.

## Messages

Add a `kpi` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

- `kpi.noComparison`: "No earlier data"
- `kpi.vsPrevious`: "against the previous period". Screen readers read it after the percent.
