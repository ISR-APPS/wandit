// The spending card of the home: the money out of the period by category, as a donut over a 2 x 2 grid of tiles.
// OverviewPage renders it in the middle grid with the summary of the chosen period. The donut file loads with React.lazy.
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { centsToUnits } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import type { SpendingSlice } from "../lib/overview";
import type { SpendingDonutSlice } from "./spending-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SpendingDonut = lazy(() =>
	import("./spending-donut").then((module) => ({
		default: module.SpendingDonut,
	})),
);

type SpendingCardProps = {
	/** The 3 largest categories, then "other", from the summary of the period. */
	spending: SpendingSlice[];
	/** The period line, for example "Last 30 days". */
	periodLabel: string;
};

/** Each tile names its category and its share, so the color is never the only mark. */
export function SpendingCard({ spending, periodLabel }: SpendingCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const totalCents = spending.reduce((sum, slice) => sum + slice.cents, 0);
	const title = t("overview.spending.title");
	const slices: SpendingDonutSlice[] = spending.map((slice, index) => ({
		key: slice.category,
		label: t(`categories.${slice.category}`),
		value: centsToUnits(slice.cents),
		color: `var(--chart-${index + 1})`,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{periodLabel}</CardDescription>
				<CardAction>
					<Button variant="outline" size="icon" className="size-8" asChild>
						<Link
							to="/app/transactions"
							aria-label={t("overview.spending.open")}
						>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid flex-1 content-between gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<SpendingDonut
						slices={slices}
						total={centsToUnits(totalCents)}
						title={title}
					/>
				</Suspense>
				{slices.length === 0 ? (
					<p className="text-center text-muted-foreground text-sm">
						{t("overview.spending.empty")}
					</p>
				) : (
					<ul className="grid @md/main:grid-cols-2 gap-2">
						{slices.map((slice) => (
							<li
								key={slice.key}
								className="flex items-center justify-between gap-2 rounded-md bg-muted p-4"
							>
								<span className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
									<span
										aria-hidden="true"
										className="size-3 shrink-0 rounded-full"
										style={{ backgroundColor: slice.color }}
									/>
									<span className="min-w-0 break-words">{slice.label}</span>
								</span>
								<span className="font-medium text-sm tabular-nums">
									{/* The slices exist only when the total is above 0, so the division is safe. */}
									{percent.format(slice.value / centsToUnits(totalCents))}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
