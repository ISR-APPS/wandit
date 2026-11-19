// The check-ins card of the home: the front desk scans of the period as an area chart, by day or by hour.
// DashboardPage renders it in the middle grid, 2 of 3 columns wide. The tabs switch the series of the chart.
// It follows recipe 3.2 of the kit system: tabs in the card head, a totals box, and the chart in the body.
import { lazy, Suspense, useState } from "react";
import { dayCountFormat, fillMessage, type PeriodDays } from "~/features/gym";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { CheckInPoint } from "../lib/summary";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const CheckInsChart = lazy(() =>
	import("./check-ins-chart").then((module) => ({
		default: module.CheckInsChart,
	})),
);

type CheckInsCardProps = {
	/** One point per day of the period, oldest first. */
	daily: CheckInPoint[];
	/** One point per open hour: the average scans of that hour per day. */
	hourly: CheckInPoint[];
	/** The period of the page, in days. */
	days: PeriodDays;
};

/** The totals box gives the two sums, so the chart is never the only way to read them. */
export function CheckInsCard({ daily, hourly, days }: CheckInsCardProps) {
	const { t, locale } = useT();
	const [mode, setMode] = useState<"daily" | "hourly">("daily");
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);
	const currentTotal = daily.reduce((sum, point) => sum + point.current, 0);
	const previousTotal = daily.reduce((sum, point) => sum + point.previous, 0);
	const totals = [
		{ id: "current", label: t("dashboard.thisPeriod"), value: currentTotal },
		{
			id: "previous",
			label: t("dashboard.previousPeriod"),
			value: previousTotal,
		},
	];

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("dashboard.checkInsTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(
						t(
							mode === "daily"
								? "dashboard.checkInsDaily"
								: "dashboard.checkInsHourly",
						),
						{ period: dayCount.format(days) },
					)}
				</CardDescription>
				<CardAction>
					<Tabs
						value={mode}
						onValueChange={(value) =>
							setMode(value === "hourly" ? "hourly" : "daily")
						}
					>
						<TabsList>
							<TabsTrigger value="daily">{t("dashboard.daily")}</TabsTrigger>
							<TabsTrigger value="hourly">{t("dashboard.hourly")}</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<dl className="grid w-fit grid-cols-2 divide-x rounded-md border rtl:divide-x-reverse">
					{totals.map((total) => (
						<div key={total.id} className="grid gap-0.5 px-4 py-2">
							<dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 rounded-full"
									style={{
										backgroundColor:
											total.id === "current"
												? "var(--chart-1)"
												: "var(--chart-2)",
									}}
								/>
								{total.label}
							</dt>
							<dd className="font-numeric font-semibold text-2xl tabular-nums">
								{number.format(total.value)}
							</dd>
						</div>
					))}
				</dl>
				<Suspense fallback={<Skeleton className="h-72 w-full" />}>
					<CheckInsChart
						points={mode === "daily" ? daily : hourly}
						mode={mode}
						label={fillMessage(t("dashboard.checkInsLabel"), {
							current: number.format(currentTotal),
							previous: number.format(previousTotal),
						})}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
