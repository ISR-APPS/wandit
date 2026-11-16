// The main trend panel of the home: the title, the period Select, the view tabs, and the plot.
// OverviewPage holds the period. This card reads its own query, so it has its own skeleton and error.
// BookingsPlot draws the bars and the target line.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	BAR_RADIUS_PX,
	PanelError,
	PERIOD_DAYS,
	type PeriodDays,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
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
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { useAppTheme } from "~/styles/theme";
import { dailyBookingsQueryOptions } from "../api/overview.queries";
import { BookingsPlot, type BookingsView } from "./bookings-plot";

type BookingsTrendCardProps = {
	/** The period of the plot, one of PERIOD_DAYS. */
	days: PeriodDays;
	onDaysChange: (days: PeriodDays) => void;
};

/** The trend panel. The period Select changes the query key; the view tabs change only the drawing. */
export function BookingsTrendCard({
	days,
	onDaysChange,
}: BookingsTrendCardProps) {
	const { t, locale } = useT();
	const [view, setView] = useState<BookingsView>("perDay");
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const query = useQuery({
		...dailyBookingsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.trendTitle")}</CardTitle>
				<CardDescription>{t("overview.trendDescription")}</CardDescription>
				<CardAction>
					<Select
						value={String(days)}
						onValueChange={(value) =>
							onDaysChange(
								PERIOD_DAYS.find((option) => String(option) === value) ?? days,
							)
						}
					>
						<SelectTrigger className="w-32" aria-label={t("chart.period")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{dayCount.format(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(value === "runningTotal" ? "runningTotal" : "perDay")
					}
				>
					<TabsList>
						<TabsTrigger value="perDay">{t("chart.perDay")}</TabsTrigger>
						<TabsTrigger value="runningTotal">
							{t("chart.runningTotal")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				{query.isError ? (
					<PanelError
						message={t("chart.loadError")}
						onRetry={() => query.refetch()}
						className="h-72"
					/>
				) : query.data ? (
					<BookingsPlot points={query.data} view={view} barRadius={barRadius} />
				) : (
					<Skeleton className="h-72 w-full" />
				)}
			</CardContent>
		</Card>
	);
}
