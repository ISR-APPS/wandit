// The "Conversions per day" tile of the home: one stacked bar per day, split by channel, for 7, 30, or 90 days.
// OverviewPage renders it as the tall tile of the second bento row. It holds its own period.
// It follows the trend part of the chart form "stacked" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	CHANNELS,
	ChannelLegend,
	ChannelStackChart,
	dayCountFormat,
	PERIOD_DAYS,
	type PeriodDays,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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
import { conversionsByChannelQueryOptions } from "../api/overview.queries";

type ConversionsTrendCardProps = {
	/** The period of the first load, in days. The home loader prefetches it. */
	defaultDays: PeriodDays;
	/** The span classes of the bento slot. */
	className?: string;
};

/** The period control changes the query key of this tile only. The old bars stay while the new ones load. */
export function ConversionsTrendCard({
	defaultDays,
	className,
}: ConversionsTrendCardProps) {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(defaultDays);
	const points = useQuery({
		...conversionsByChannelQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const dayCount = dayCountFormat(locale);
	const title = t("overview.trendTitle");

	return (
		<Card className={cn("gap-4", className)}>
			<CardHeader className="gap-2">
				<CardTitle>{title}</CardTitle>
				{/* col-start-1 keeps the description under the title when the tabs leave the second column. */}
				<CardDescription className="col-start-1">
					{t("overview.trendHint")}
				</CardDescription>
				{/* On a narrow tile the tabs go under the description, so the title keeps one line. */}
				<CardAction className="@max-md/card-header:col-start-1 @max-md/card-header:row-span-1 @max-md/card-header:row-start-3 @max-md/card-header:justify-self-start">
					<Tabs
						value={String(days)}
						onValueChange={(value) => {
							const next = PERIOD_DAYS.find(
								(period) => String(period) === value,
							);
							if (next) {
								setDays(next);
							}
						}}
					>
						<TabsList aria-label={t("chart.period")}>
							{PERIOD_DAYS.map((period) => (
								<TabsTrigger
									key={period}
									value={String(period)}
									className="px-2.5 max-md:min-h-11"
								>
									{dayCount.format(period)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
				<ChannelLegend channels={CHANNELS} className="col-span-2 pt-1" />
			</CardHeader>
			{/* The plot fills the tile: the tile is two rows tall in the bento, and 18rem at least. */}
			<CardContent className="relative min-h-72 flex-1">
				<div className="absolute inset-0 px-6">
					{points.isError ? (
						<p className="text-destructive text-sm" role="alert">
							{t("overview.trendError")}
						</p>
					) : points.data ? (
						<ChannelStackChart
							points={points.data}
							channels={CHANNELS}
							title={title}
							className="h-full"
						/>
					) : (
						<Skeleton className="h-full w-full" />
					)}
				</div>
			</CardContent>
		</Card>
	);
}
