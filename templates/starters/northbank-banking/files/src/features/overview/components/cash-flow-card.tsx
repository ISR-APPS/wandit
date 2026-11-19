// The cash flow card of the home: money in or money out per calendar month, with In | Out tabs,
// and a foot that compares the last full month with the month before it.
// OverviewPage renders it in the middle grid. The bars file loads with React.lazy.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { changeRatio, dayToDate, fillMessage } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { cashFlowQueryOptions } from "../api/overview.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const CashFlowChart = lazy(() =>
	import("./cash-flow-chart").then((module) => ({
		default: module.CashFlowChart,
	})),
);

// One decimal shows 0.05 % and more. A smaller change reads as flat, so it gets no arrow.
const FLAT_CHANGE = 0.0005;

/** The tab value is local state: it changes the series, not the query. */
export function CashFlowCard() {
	const { t, locale } = useT();
	const [series, setSeries] = useState<"in" | "out">("in");
	const flows = useQuery(cashFlowQueryOptions());
	const label = t(series === "in" ? "overview.flow.in" : "overview.flow.out");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const longMonth = new Intl.DateTimeFormat(locale, {
		month: "long",
		timeZone: "UTC",
	});
	// The current month runs only to today, so the foot compares the two last full months.
	const lastFull = flows.data?.at(-2);
	const beforeFull = flows.data?.at(-3);
	const seriesCentsOf = (flow: { inCents: number; outCents: number }) =>
		series === "in" ? flow.inCents : flow.outCents;
	const change =
		lastFull && beforeFull
			? changeRatio(seriesCentsOf(lastFull), seriesCentsOf(beforeFull))
			: null;
	const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
	// More money in is good news; more money out is bad news.
	const isGood = change !== null && change > 0 === (series === "in");
	const TrendIcon = change !== null && change < 0 ? TrendDownIcon : TrendUpIcon;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.flow.title")}</CardTitle>
				<CardDescription>{t("overview.flow.description")}</CardDescription>
				<CardAction>
					<Tabs
						value={series}
						onValueChange={(value) => setSeries(value === "out" ? "out" : "in")}
					>
						<TabsList>
							<TabsTrigger value="in">{t("overview.flow.inTab")}</TabsTrigger>
							<TabsTrigger value="out">{t("overview.flow.outTab")}</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="flex-1">
				{flows.isError ? (
					<div className="grid h-56 place-content-center justify-items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm" role="alert">
							{t("overview.flow.error")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => flows.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : flows.data === undefined ? (
					<Skeleton className="@4xl/main:h-72 h-56 w-full" />
				) : (
					<Suspense
						fallback={<Skeleton className="@4xl/main:h-72 h-56 w-full" />}
					>
						<CashFlowChart flows={flows.data} series={series} label={label} />
					</Suspense>
				)}
			</CardContent>
			<CardFooter className="grid gap-2 text-sm">
				{lastFull && change !== null ? (
					<p className="flex flex-wrap items-center gap-2 font-medium leading-snug">
						{fillMessage(t("overview.flow.compare"), {
							month: longMonth.format(dayToDate(lastFull.month)),
							change: percent.format(change),
						})}
						{isFlat ? null : (
							<TrendIcon
								className={cn(
									"size-4 rtl:-scale-x-100",
									isGood ? "text-success" : "text-destructive",
								)}
							/>
						)}
					</p>
				) : (
					<p className="font-medium leading-snug">{t("kpi.noComparison")}</p>
				)}
				<p className="text-muted-foreground leading-snug">
					{t("overview.flow.foot")}
				</p>
			</CardFooter>
		</Card>
	);
}
