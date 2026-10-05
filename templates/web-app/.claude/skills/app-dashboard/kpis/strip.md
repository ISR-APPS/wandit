# KPI style: strip

One card for all KPIs: one cell per KPI, split by thin lines. No card per KPI.
The strip is calm and dense. It suits a home with a tall chart or a long table below it.

## Data

- `KpiRow` takes `KpiItem[]` from `overviewKpisQueryOptions()`. The home turns `labelKey` into `label` (data.md, section 4).
- Needs: 3 to 5 KPIs.
- `className` gives the columns of the cells, for example `grid-cols-2 @5xl/main:grid-cols-4`.
  At 375 px, 2 columns fit. Give `KpiRowSkeleton` the same `className` and the number of cells.
- No item: the home shows its setup card in place of the strip (SKILL.md, States).

## Strip rules

- Each cell draws its top line and its start line. The grid moves 1 px up and 1 px to the start, and the card clips it.
  So the lines at the card edge disappear at every wrap. Keep the `-ms-px -mt-px` pair.
- The values use `text-2xl`, one step below the card styles, so that 5 cells fit.

## Delta wording

- Intl shows a `change` of 0.123 as "+12.3%" (`signDisplay: "exceptZero"`). `changeRatio` (data.md) gives the ratio.
- The arrow shows the direction. The color shows good or bad news from `goodWhen` (`"down"`: a fall is green).
- A change under 0.05 % shows "0%" in muted text, with no arrow.
- `change: null` shows "No earlier data". This is the empty state. Never show "0%" for it.
- `<bdi dir="ltr">` keeps "+12%" in this order in Arabic.
- A trend arrow is the exception to the `rtl:rotate-180` rule of SKILL.md. Mirror it with `rtl:-scale-x-100`.
  A rotation turns a rise into a fall.
- The home header names the period once. No card repeats it.

## Fallback

More than 5 KPIs, or fewer than 3: use `kpis/number.md`.

## Messages

Add this group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

```ts
	kpi: {
		noComparison: "No earlier data",
		vsPrevious: "against the previous period",
	},
```

## File: src/features/overview/components/kpi-row.tsx

```tsx
// KPI row of the home, style "strip": one card with one cell per KPI, split by thin lines.
// The home renders it in the KPI slot with the items of buildOverviewKpis (data.md).
// It calls Card and Skeleton from the shared kit. Every number goes through Intl.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";
import { TrendingDownIcon, TrendingUpIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type KpiRowProps = {
	/** 3 to 5 KPIs in display order. Each label is already translated. */
	items: KpiItem[];
	/** Grid columns of the cells, from the home, for example "grid-cols-2 @5xl/main:grid-cols-4". */
	className?: string;
};

/** One card for all KPIs. A change of null (no earlier data) shows a muted line. */
export function KpiRow({ items, className }: KpiRowProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	return (
		<Card className="gap-0 overflow-hidden py-0">
			{/* Each cell draws its top and start line. The -1px offset and the card clip hide the lines at the card edge, at any wrap. */}
			<div className={cn("-ms-px -mt-px grid", className)}>
				{items.map((item) => {
					const { change } = item;
					const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
					// The arrow shows the direction. The color shows good or bad, from goodWhen.
					const isGood =
						change !== null && change > 0 === (item.goodWhen === "up");
					const TrendIcon =
						change !== null && change < 0 ? TrendingDownIcon : TrendingUpIcon;
					return (
						<div key={item.id} className="grid gap-1 border-s border-t p-5">
							<p className="text-muted-foreground text-sm">{item.label}</p>
							<p className="font-display font-semibold text-2xl tabular-nums">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</p>
							{change === null ? (
								<p className="text-muted-foreground text-sm">
									{t("kpi.noComparison")}
								</p>
							) : (
								<p
									className={cn(
										"flex items-center gap-1 font-medium text-sm",
										isFlat
											? "text-muted-foreground"
											: isGood
												? "text-success"
												: "text-destructive",
									)}
								>
									{isFlat ? null : (
										<TrendIcon className="size-4 rtl:-scale-x-100" />
									)}
									{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
									<bdi dir="ltr" className="tabular-nums">
										{percent.format(change)}
									</bdi>
									<span className="sr-only">{t("kpi.vsPrevious")}</span>
								</p>
							)}
						</div>
					);
				})}
			</div>
		</Card>
	);
}

type KpiRowSkeletonProps = {
	/** Number of KPI cells that the loaded strip shows. */
	count: number;
	/** The same grid columns as KpiRow. */
	className?: string;
};

/** Placeholder of KpiRow in its final size. The home pendingComponent renders it. */
export function KpiRowSkeleton({ count, className }: KpiRowSkeletonProps) {
	const slots = Array.from({ length: count }, (_, slot) => slot);
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<div className={cn("-ms-px -mt-px grid", className)}>
				{slots.map((slot) => (
					<div key={slot} className="grid gap-2 border-s border-t p-5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-7 w-24" />
						<Skeleton className="h-4 w-14" />
					</div>
				))}
			</div>
		</Card>
	);
}
```
