// The spending card of the home: the expenses of the period by category as a donut, then a 2 x 2 grid of tiles.
// OverviewPage renders it last in the middle band. The donut file loads with React.lazy.
// The arrow button opens the budgets page.
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { dayFormat, dayToDate } from "~/features/ledger";
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
import type { CategoryAmount } from "../lib/overview-summary";
import type { SpendingSlice } from "./spending-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SpendingDonut = lazy(() =>
	import("./spending-donut").then((module) => ({
		default: module.SpendingDonut,
	})),
);

// The donut shows the 4 largest categories and one "Other" slice. The tiles show the 4 largest, as in the kit.
const SHOWN_CATEGORIES = 4;

type SpendingCardProps = {
	/** Expenses by category, the largest first. */
	spending: CategoryAmount[];
	/** The first and the last day of the period, as `YYYY-MM-DD`. */
	periodStart: string;
	periodEnd: string;
};

/** Each tile names a slice and its share, so the color is never the only mark. */
export function SpendingCard({
	spending,
	periodStart,
	periodEnd,
}: SpendingCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const day = dayFormat(locale, "long");
	const totalCents = spending.reduce(
		(sum, category) => sum + category.amountCents,
		0,
	);
	const shown = spending.slice(0, SHOWN_CATEGORIES);
	const otherCents = spending
		.slice(SHOWN_CATEGORIES)
		.reduce((sum, category) => sum + category.amountCents, 0);
	const slices: SpendingSlice[] = [
		...shown.map((category, index) => ({
			key: category.categoryId,
			label: t(`categories.${category.categoryId}`),
			amountCents: category.amountCents,
			// The chart series 1 to 4 color the largest categories, series 5 colors "Other".
			color: `var(--chart-${index + 1})`,
		})),
		...(otherCents > 0
			? [
					{
						key: "other",
						label: t("overview.otherCategories"),
						amountCents: otherCents,
						color: `var(--chart-${SHOWN_CATEGORIES + 1})`,
					},
				]
			: []),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.spendingTitle")}</CardTitle>
				<CardDescription>
					{day.formatRange(dayToDate(periodStart), dayToDate(periodEnd))}
				</CardDescription>
				<CardAction>
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={t("overview.openBudgets")}
					>
						<Link to="/app/budgets">
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid flex-1 content-between gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-60 rounded-full" />}
				>
					<SpendingDonut slices={slices} totalCents={totalCents} />
				</Suspense>
				{shown.length === 0 ? (
					<p className="text-center text-muted-foreground text-sm">
						{t("overview.noSpending")}
					</p>
				) : (
					<ul className="grid grid-cols-2 gap-2">
						{slices.slice(0, SHOWN_CATEGORIES).map((slice) => (
							<li
								key={slice.key}
								className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-muted p-3"
							>
								{/* When the name and the share do not fit on one line, the share moves under the name. */}
								<span className="flex items-center gap-2">
									<span
										aria-hidden="true"
										className="size-3 shrink-0 rounded-full"
										style={{ backgroundColor: slice.color }}
									/>
									{/* A long name wraps onto a second line in a narrow tile, as in the kit. */}
									<span className="text-muted-foreground text-sm leading-tight">
										{slice.label}
									</span>
								</span>
								<span className="ms-auto shrink-0 font-medium text-sm tabular-nums">
									{percent.format(slice.amountCents / totalCents)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
