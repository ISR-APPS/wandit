// The monthly expenses card of the home: a bar per calendar month for the last 6 months, and the trend line.
// OverviewPage renders it in the middle band. It reads its own query: the months do not follow the period control.
// The chart file loads with React.lazy. "View report" opens the budgets page.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { changeRatio, dayToDate, fillMessage } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { monthlyExpensesQueryOptions } from "../api/overview.queries";
import { EXPENSE_MONTHS } from "../lib/overview-summary";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const MonthlyExpensesChart = lazy(() =>
	import("./monthly-expenses-chart").then((module) => ({
		default: module.MonthlyExpensesChart,
	})),
);

/** The trend compares the last full month with the month before, because the current month is not over. */
export function MonthlyExpensesCard() {
	const { t, locale } = useT();
	const months = useQuery(monthlyExpensesQueryOptions());
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "long",
		timeZone: "UTC",
	});
	// The last point is the current month, so the last full month is the one before it.
	const lastFull = months.data?.at(-2);
	const beforeLastFull = months.data?.at(-3);
	const change =
		lastFull && beforeLastFull
			? changeRatio(lastFull.expenseCents, beforeLastFull.expenseCents)
			: null;
	const Trend = change !== null && change < 0 ? TrendDownIcon : TrendUpIcon;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.monthlyTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.monthlyDescription"), {
						count: EXPENSE_MONTHS,
					})}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/budgets">{t("overview.viewReport")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="flex-1">
				{months.isError ? (
					<div className="grid @4xl/main:h-80 h-56 content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("overview.monthlyError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => months.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : months.data === undefined ? (
					<Skeleton className="@4xl/main:h-80 h-56 w-full" />
				) : (
					<Suspense
						fallback={<Skeleton className="@4xl/main:h-80 h-56 w-full" />}
					>
						<MonthlyExpensesChart months={months.data} />
					</Suspense>
				)}
			</CardContent>
			<CardFooter className="flex-col items-start gap-2 text-sm">
				{lastFull && beforeLastFull ? (
					<p className="flex items-center gap-2 font-medium leading-none">
						{change === null
							? t("kpi.noComparison")
							: fillMessage(
									t(
										change < 0
											? "overview.monthlyTrendDown"
											: "overview.monthlyTrendUp",
									),
									{
										share: percent.format(Math.abs(change)),
										month: monthName.format(dayToDate(lastFull.monthStart)),
										previous: monthName.format(
											dayToDate(beforeLastFull.monthStart),
										),
									},
								)}
						{change === null ? null : (
							<Trend
								aria-hidden="true"
								className={
									// Less spend is good news.
									change < 0
										? "size-4 text-success rtl:-scale-x-100"
										: "size-4 text-destructive rtl:-scale-x-100"
								}
							/>
						)}
					</p>
				) : null}
				<p className="text-muted-foreground leading-none">
					{fillMessage(t("overview.monthlyFootnote"), {
						count: EXPENSE_MONTHS,
					})}
				</p>
			</CardFooter>
		</Card>
	);
}
