# KPI style: delta

The label and a large value, with the change as a colored pill at the end of the header.
The pill makes good and bad news easy to scan across the row.

## Data

- `KpiRow` takes `KpiItem[]` from `overviewKpisQueryOptions()`. The home turns `labelKey` into `label` (data.md, section 4).
- `className` gives the grid columns, for example `grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4`.
  Give `KpiRowSkeleton` the same `className` and the number of cards.
- No item: the home shows its setup card in place of the row (SKILL.md, States).

## Delta wording

- Intl shows a `change` of 0.123 as "+12.3%" (`signDisplay: "exceptZero"`). `changeRatio` (data.md) gives the ratio.
- The arrow shows the direction. The pill color shows good or bad news from `goodWhen` (`"down"`: a fall is green).
  `success` is good news, a tinted destructive pill is bad news, and `secondary` is "0%".
  The Badge `destructive` variant is solid red, so the code gives it the tinted look of `success`.
- A change under 0.05 % shows "0%" with no arrow.
- `<bdi dir="ltr">` keeps "+12%" in this order in Arabic.
- A trend arrow is the exception to the `rtl:rotate-180` rule of SKILL.md. Mirror it with `rtl:-scale-x-100`.
  A rotation turns a rise into a fall.
- The pill holds a screen reader text that names the comparison.
  The home header names the period once, so no card shows a period caption.
- `change: null` shows no pill and the line "No earlier data". This is the empty state. Never show "0%" for it.

## Fallback

None. This is the fallback of `kpis/meter.md`.

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
// KPI row of the home, style "delta": the value, and the change as a pill at the header end.
// The home renders it in the KPI slot with the items of buildOverviewKpis (data.md).
// It calls Card, Badge, and Skeleton from the shared kit. Every number goes through Intl.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
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

/** One card per KPI with a change pill. A change of null (no earlier data) shows a muted line. */
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
							{change === null ? null : (
								<CardAction>
									<Badge
										variant={
											isFlat ? "secondary" : isGood ? "success" : "destructive"
										}
										// The destructive variant is solid red. This gives it the tinted look of success.
										className={cn(
											!isFlat &&
												!isGood &&
												"border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12",
										)}
									>
										{isFlat ? null : <TrendIcon className="rtl:-scale-x-100" />}
										{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
										<bdi dir="ltr" className="tabular-nums">
											{percent.format(change)}
										</bdi>
										<span className="sr-only">{t("kpi.vsPrevious")}</span>
									</Badge>
								</CardAction>
							)}
						</CardHeader>
						{change === null ? (
							<CardFooter className="text-muted-foreground text-sm">
								{t("kpi.noComparison")}
							</CardFooter>
						) : null}
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
						<CardAction>
							<Skeleton className="h-5 w-14 rounded-control" />
						</CardAction>
					</CardHeader>
				</Card>
			))}
		</div>
	);
}
```
