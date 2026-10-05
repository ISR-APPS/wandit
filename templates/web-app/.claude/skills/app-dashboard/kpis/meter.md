# KPI style: meter

The value against its target ("9 / 12"), a bar, and the share ("75% of target").
The change shows as a pill at the end of the header, like `kpis/delta.md`.

## Data

- `KpiRow` takes `KpiItem[]` from `overviewKpisQueryOptions()`. The home turns `labelKey` into `label` (data.md, section 4).
- `className` gives the grid columns, for example `grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-4`.
  Give `KpiRowSkeleton` the same `className` and the number of cards.
- No item: the home shows its setup card in place of the row (SKILL.md, States).
- Needs: a real `target` above 0 on at least one KPI. Examples: machines running of all machines,
  or units of a daily target that the user gave. Never invent a target.
- A KPI with no target, or a target of 0, shows the value and the pill only.

## Meter rules

- `Progress` clamps the value, so a value above the target shows a full bar.
  The share text keeps the real number ("120% of target").
- The share has one decimal. Under the target it stops at 99.9 %, so "100%" never shows too early.
- The share sits in `<bdi dir="ltr">`, so "75%" keeps its order in Arabic.

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
- `change: null` shows no pill. A card with no target then shows "No earlier data". Never show "0%" for it.

## Fallback

No KPI has a real target: use `kpis/delta.md`.

## Messages

Add this group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.

```ts
	kpi: {
		noComparison: "No earlier data",
		vsPrevious: "against the previous period",
		ofTarget: "of target",
	},
```

## File: src/features/overview/components/kpi-row.tsx

```tsx
// KPI row of the home, style "meter": the value against its target, a bar, and the share.
// The home renders it in the KPI slot with the items of buildOverviewKpis (data.md).
// It calls Card, Badge, Progress, and Skeleton from the shared kit. Every number goes through Intl.

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

// One decimal rounds 0.9996 up to "100%". A value under its target stops at 99.9 %.
const MAX_SHARE_UNDER_TARGET = 0.999;

type KpiRowProps = {
	/** The KPIs in display order. Each label is already translated. */
	items: KpiItem[];
	/** Grid columns from the home, for example "@xl/main:grid-cols-2 @5xl/main:grid-cols-4". */
	className?: string;
};

/** One card per KPI. A KPI with a target above 0 gets the bar; the others keep the change pill only. */
export function KpiRow({ items, className }: KpiRowProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	return (
		<div className={cn("grid gap-4", className)}>
			{items.map((item) => {
				const { change, target } = item;
				const number = new Intl.NumberFormat(locale, item.format);
				const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
				// The arrow shows the direction. The color shows good or bad, from goodWhen.
				const isGood =
					change !== null && change > 0 === (item.goodWhen === "up");
				const TrendIcon =
					change !== null && change < 0 ? TrendingDownIcon : TrendingUpIcon;
				return (
					<Card key={item.id} className="gap-4">
						<CardHeader>
							<CardDescription>{item.label}</CardDescription>
							<CardTitle className="font-display text-3xl tabular-nums">
								{number.format(item.value)}
								{target !== undefined && target > 0 ? (
									<span className="font-normal font-sans text-base text-muted-foreground">
										{" / "}
										{number.format(target)}
									</span>
								) : null}
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
						{target !== undefined && target > 0 ? (
							<CardContent className="grid gap-2">
								<Progress value={item.value} max={target} />
								<p className="text-muted-foreground text-sm">
									<bdi dir="ltr" className="tabular-nums">
										{share.format(
											item.value < target
												? Math.min(item.value / target, MAX_SHARE_UNDER_TARGET)
												: item.value / target,
										)}
									</bdi>{" "}
									{t("kpi.ofTarget")}
								</p>
							</CardContent>
						) : change === null ? (
							<CardContent className="text-muted-foreground text-sm">
								{t("kpi.noComparison")}
							</CardContent>
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
				<Card key={slot} className="gap-4">
					<CardHeader className="gap-2.5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-32" />
					</CardHeader>
					<CardContent className="grid gap-2">
						<Skeleton className="h-2 w-full" />
						<Skeleton className="h-4 w-20" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
```
