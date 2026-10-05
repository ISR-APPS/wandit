# KPI style: number

A plain KPI card: the label, a large value, and one line with the change.
It fits every app. The other KPI styles fall back to it.

## Data

- `KpiRow` takes `KpiItem[]` from `overviewKpisQueryOptions()`. The home turns `labelKey` into `label` (data.md, section 4).
- `className` gives the grid columns, for example `grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4`.
  Give `KpiRowSkeleton` the same `className` and the number of cards.
- No item: the home shows its setup card in place of the row (SKILL.md, States).

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

None.

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
// KPI row of the home, style "number": one card per KPI with its value and its change.
// The home renders it in the KPI slot with the items of buildOverviewKpis (data.md).
// It calls Card and Skeleton from the shared kit. Every number goes through Intl.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { TrendingDownIcon, TrendingUpIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type KpiRowProps = {
	/** The KPIs in display order. Each label is already translated. */
	items: KpiItem[];
	/** Grid columns from the home, for example "@xl/main:grid-cols-2 @5xl/main:grid-cols-4". */
	className?: string;
};

/** One card per KPI. A change of null (no earlier data) shows a muted line, never "0%". */
export function KpiRow({ items, className }: KpiRowProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	return (
		<div className={cn("grid gap-4", className)}>
			{items.map((item) => {
				const { change } = item;
				const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
				// The arrow shows the direction. The color shows good or bad, from goodWhen.
				const isGood =
					change !== null && change > 0 === (item.goodWhen === "up");
				const TrendIcon =
					change !== null && change < 0 ? TrendingDownIcon : TrendingUpIcon;
				return (
					<Card key={item.id} className="gap-3">
						<CardHeader>
							<CardDescription>{item.label}</CardDescription>
							<CardTitle className="font-display text-3xl tabular-nums">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</CardTitle>
						</CardHeader>
						<CardFooter className="gap-1 font-medium text-sm">
							{change === null ? (
								<span className="font-normal text-muted-foreground">
									{t("kpi.noComparison")}
								</span>
							) : (
								<span
									className={cn(
										"flex items-center gap-1",
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
								</span>
							)}
						</CardFooter>
					</Card>
				);
			})}
		</div>
	);
}

type KpiRowSkeletonProps = {
	/** Number of KPI cards that the loaded row shows. */
	count: number;
	/** The same grid columns as KpiRow. */
	className?: string;
};

/** Placeholder of KpiRow in its final size. The home pendingComponent renders it. */
export function KpiRowSkeleton({ count, className }: KpiRowSkeletonProps) {
	const slots = Array.from({ length: count }, (_, slot) => slot);
	return (
		<div className={cn("grid gap-4", className)}>
			{slots.map((slot) => (
				<Card key={slot} className="gap-3">
					<CardHeader className="gap-2.5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-28" />
					</CardHeader>
					<CardFooter>
						<Skeleton className="h-4 w-16" />
					</CardFooter>
				</Card>
			))}
		</div>
	);
}
```
