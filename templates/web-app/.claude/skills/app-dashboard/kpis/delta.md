# KPI form delta

Each figure shows its label and its value, with the change as a colored pill beside the value.

## Data

- The figures read `KpiItem[]` from `overviewKpisQueryOptions()` (data.md, sections 4 and 6).
  The home turns each `labelKey` into `label` with `t()` and keeps the first `KPI_COUNT` items.
- The home decides where the figures go and how many it shows. This file gives the parts of one figure.
- One component draws the figures of one slot. It takes `items` and the layout class of the home.
  Its skeleton takes `count` and the same class.
- The KPI function always returns one row. On a first visit, each value is a real 0 and each change is `null`.

## Anatomy

1. Label: `item.label`, in `label-text` (the small label style).
2. Value line: the value, then the delta as a pill at the end of the line.
   The value is `new Intl.NumberFormat(locale, item.format).format(item.value)`, with `font-numeric tabular-nums`.
3. No earlier data: no pill. The muted line "No earlier data" goes under the value.

- The pill is a `Badge`.
- The panel of a figure is a `Card`, unless the home slot says otherwise.
- The theme scale changes the gaps. The home slot gives the value size.
- The snippet shows the logic. Its `Badge` is the default pill.
- The skeleton keeps the label, the value, and a pill in their final sizes.

## Rules

- The pill makes good and bad news easy to scan across the figures.
- `change` is a ratio from `changeRatio` (data.md). A change of 0.123 shows "+12.3%" (`signDisplay: "exceptZero"`).
- The pill color shows good or bad news from `goodWhen`. With `goodWhen: "down"`, a fall is good news.
- Good news is `success`. Bad news is a tinted destructive pill. "0%" is `secondary`.
- The Badge `destructive` variant is solid red. Give it the tinted look of `success` with classes.
- A change under 0.05 % shows "0%" with no arrow.
- The arrow shows the direction: `TrendUpIcon` or `TrendDownIcon` (SKILL.md, Icons).
  Mirror it with `rtl:-scale-x-100`, never with `rtl:rotate-180`.
  A rotation turns a rise into a fall.
- The percent sits in `<bdi dir="ltr">`, so "+12%" keeps its order in Arabic.
- The pill holds a screen reader text that names the comparison.
- `change: null` shows no pill and the line "No earlier data". Never show "0%" for it.
- The home names the period once. No figure repeats it.

The pill, with its imports from `@phosphor-icons/react` (SKILL.md, Icons), `~/shared/i18n`, `~/shared/lib/utils`, and `~/shared/ui/badge`:

```tsx
// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

/** The delta pill of one figure. The figure shows no pill when `change` is null. */
function ChangePill({ change, goodWhen }: { change: number; goodWhen: KpiItem["goodWhen"] }) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 });
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<Badge
			variant={isFlat ? "secondary" : isGood ? "success" : "destructive"}
			// The destructive variant is solid red. This gives it the tinted look of success.
			className={cn(!isFlat && !isGood && "border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12")}
		>
			{isFlat ? null : <TrendIcon className="rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">{percent.format(change)}</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
```

## Fallback

None. This is the fallback of `kpis/meter.md`.

## Messages

Add a `kpi` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

- `kpi.noComparison`: "No earlier data"
- `kpi.vsPrevious`: "against the previous period". Screen readers read it after the percent.
