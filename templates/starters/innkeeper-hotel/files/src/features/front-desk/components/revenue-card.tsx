// The revenue card of the home: a period Select, the revenue of the period with its change, and stacked bars.
// FrontDeskPage renders it in the middle of the second row of three. The period goes into the query key.
// The bar file loads with React.lazy.
import {
	CalendarBlankIcon,
	TrendDownIcon,
	TrendUpIcon,
} from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { fillMessage, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { revenueQueryOptions } from "../api/front-desk.queries";
import {
	changeRatio,
	REVENUE_PERIODS,
	type RevenuePeriod,
} from "../lib/home-figures";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const RevenueBars = lazy(() =>
	import("./revenue-bars").then((module) => ({ default: module.RevenueBars })),
);

/** The loader prefetches the last 7 days. Another period keeps the last bars on screen while it loads. */
export function RevenueCard() {
	const { t, locale } = useT();
	const [period, setPeriod] = useState<RevenuePeriod>("week");
	const revenue = useQuery({
		...revenueQueryOptions(period),
		placeholderData: keepPreviousData,
	});
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
		signDisplay: "exceptZero",
	});
	const change = revenue.data
		? changeRatio(revenue.data.total, revenue.data.previousTotal)
		: null;
	const periodLabel = t(`frontDesk.revenue.periods.${period}`);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("frontDesk.revenue.title")}</CardTitle>
				<CardAction>
					<Select
						value={period}
						onValueChange={(value) =>
							setPeriod(
								REVENUE_PERIODS.find((option) => option === value) ?? "week",
							)
						}
					>
						<SelectTrigger aria-label={t("frontDesk.revenue.period")}>
							<CalendarBlankIcon />
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{REVENUE_PERIODS.map((option) => (
								<SelectItem key={option} value={option}>
									{t(`frontDesk.revenue.periods.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent>
				{revenue.isError ? (
					<p role="alert" className="text-muted-foreground text-sm">
						{t("frontDesk.loadError")}
					</p>
				) : revenue.data ? (
					<div className="grid gap-4">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<span className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
								{money.format(revenue.data.total)}
							</span>
							{change === null ? (
								<span className="text-muted-foreground text-sm">
									{t("frontDesk.kpi.noEarlierData")}
								</span>
							) : (
								<span className="flex items-center gap-1 text-sm">
									{change >= 0 ? (
										<TrendUpIcon className="size-4 text-success" />
									) : (
										<TrendDownIcon className="size-4 text-destructive" />
									)}
									{/* More revenue is good news. */}
									<bdi
										dir="ltr"
										className={cn(
											"font-medium",
											change >= 0 ? "text-success" : "text-destructive",
										)}
									>
										{percent.format(change)}
									</bdi>
									<span className="text-muted-foreground">
										{t("frontDesk.revenue.vsPrevious")}
									</span>
								</span>
							)}
						</div>
						<Suspense fallback={<Skeleton className="h-60" />}>
							<RevenueBars
								bars={revenue.data.bars}
								period={period}
								label={fillMessage(t("frontDesk.revenue.label"), {
									period: periodLabel,
									total: money.format(revenue.data.total),
								})}
							/>
						</Suspense>
					</div>
				) : (
					<Skeleton className="h-72" />
				)}
			</CardContent>
		</Card>
	);
}
