// The tall trend of the home: impressions per day for all channels or for one, with the average and the best day.
// OverviewPage renders it first in the grid. The period comes from the page; the channel Select lives in this card.
// It follows the chart form "area" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	CHANNEL_IDS,
	CHANNEL_TONES,
	DailyAreaChart,
	dayToDate,
	STACKING_ACTION,
	STACKING_HEADER,
} from "~/features/social";
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
import {
	type ChannelFilter,
	dailyImpressionsQueryOptions,
} from "../api/overview.queries";
import { PanelError } from "./panel-error";

type ImpressionsTrendProps = {
	/** The period of the page, in days. */
	days: number;
};

/** The plot takes the color of the chosen channel, so the trend matches the ranking beside it. */
export function ImpressionsTrend({ days }: ImpressionsTrendProps) {
	const { t, locale } = useT();
	const [channel, setChannel] = useState<ChannelFilter>("all");
	const query = useQuery({
		...dailyImpressionsQueryOptions(days, channel),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

	if (query.isError) {
		return <PanelError message={t("overview.trendError")} />;
	}
	const points = query.data ?? [];
	const total = points.reduce((sum, point) => sum + point.current, 0);
	const bestDay = points.reduce<(typeof points)[number] | undefined>(
		(best, point) => (!best || point.current > best.current ? point : best),
		undefined,
	);

	return (
		<Card>
			<CardHeader className={STACKING_HEADER}>
				<CardTitle>{t("overview.trendTitle")}</CardTitle>
				<CardDescription>{t("overview.trendDescription")}</CardDescription>
				<CardAction className={STACKING_ACTION}>
					<Select
						value={channel}
						onValueChange={(value) =>
							setChannel(CHANNEL_IDS.find((id) => id === value) ?? "all")
						}
					>
						<SelectTrigger
							className="w-40"
							aria-label={t("overview.channelFilter")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="all">{t("posts.allChannels")}</SelectItem>
							{CHANNEL_IDS.map((id) => (
								<SelectItem key={id} value={id}>
									{t(`channels.names.${id}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="grid flex-1 grid-rows-[auto_1fr] gap-5">
				{query.isPending ? (
					<>
						<div className="flex gap-8">
							<Skeleton className="h-11 w-24" />
							<Skeleton className="h-11 w-36" />
						</div>
						<Skeleton className="h-60 min-h-full" />
					</>
				) : (
					<>
						<dl className="flex flex-wrap gap-x-8 gap-y-3">
							<div className="grid gap-0.5">
								<dt className="text-muted-foreground text-xs">
									{t("overview.averageDay")}
								</dt>
								<dd className="font-numeric text-xl tabular-nums">
									{number.format(
										Math.round(total / Math.max(points.length, 1)),
									)}
								</dd>
							</div>
							{bestDay ? (
								<div className="grid gap-0.5">
									<dt className="text-muted-foreground text-xs">
										{t("overview.bestDay")}
									</dt>
									<dd className="flex items-baseline gap-2">
										<span className="font-numeric text-xl tabular-nums">
											{number.format(bestDay.current)}
										</span>
										<span className="text-muted-foreground text-xs">
											{dayFormat.format(dayToDate(bestDay.day))}
										</span>
									</dd>
								</div>
							) : null}
						</dl>
						<DailyAreaChart
							points={points}
							seriesLabel={t("metrics.impressions")}
							color={
								channel === "all" ? undefined : CHANNEL_TONES[channel].color
							}
							className="h-60 min-h-full"
						/>
					</>
				)}
			</CardContent>
		</Card>
	);
}
