// The growth breakdown of the audience page: a donut of the net new followers of each channel in the period.
// AudiencePage renders it beside the growth trend. It reads the period of the page with useQuery.
// Its total in the hole equals the total of the growth card. It follows the breakdown part of the chart form "area".
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pie, PieChart } from "recharts";
import { CHANNEL_TONES } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { followerGainByChannelQueryOptions } from "../api/audience.queries";

type GainByChannelCardProps = {
	/** The period of the page, in days. */
	days: number;
};

/** The legend gives the signed gain of each channel. A channel that lost followers gets no slice. */
export function GainByChannelCard({ days }: GainByChannelCardProps) {
	const { t, locale } = useT();
	const query = useQuery({
		...followerGainByChannelQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const rows = query.data ?? [];
	const total = rows.reduce((sum, row) => sum + row.gain, 0);
	const slices = rows.map((row) => ({
		label: t(`channels.names.${row.channelId}`),
		// A pie cannot draw a negative part. The legend still shows the loss.
		value: Math.max(row.gain, 0),
		gain: row.gain,
		fill: CHANNEL_TONES[row.channelId].color,
		channelId: row.channelId,
	}));
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.channelId,
			{ label: slice.label, color: slice.fill },
		]),
	) satisfies ChartConfig;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("audience.byChannelTitle")}</CardTitle>
				<CardDescription>{t("audience.byChannelDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{query.isError ? (
					<p role="alert" className="text-sm">
						{t("audience.loadError")}
					</p>
				) : query.data ? (
					<>
						<div className="relative mx-auto aspect-square h-48">
							<ChartContainer
								config={chartConfig}
								className="aspect-square h-48"
								role="img"
								aria-label={`${t("audience.byChannelTitle")}. ${slices
									.map(
										(slice) => `${slice.label}: ${signed.format(slice.gain)}`,
									)
									.join(", ")}.`}
							>
								<PieChart>
									<ChartTooltip
										cursor={false}
										content={<ChartTooltipContent hideLabel />}
									/>
									<Pie
										data={slices}
										dataKey="value"
										nameKey="label"
										innerRadius="62%"
										outerRadius="100%"
										stroke="var(--card)"
										isAnimationActive={false}
									/>
								</PieChart>
							</ChartContainer>
							<div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
								<bdi dir="ltr" className="font-numeric text-2xl tabular-nums">
									{signed.format(total)}
								</bdi>
								<span className="text-muted-foreground text-xs">
									{t("audience.growthTotal")}
								</span>
							</div>
						</div>
						<ul className="grid @md/main:grid-cols-2 grid-cols-1 gap-x-4 gap-y-2 text-sm">
							{slices.map((slice) => (
								<li
									key={slice.channelId}
									className="flex items-center justify-between gap-2"
								>
									<span className="flex min-w-0 items-center gap-2">
										<span
											aria-hidden="true"
											className={cn(
												"size-2 shrink-0 rounded-full",
												CHANNEL_TONES[slice.channelId].solid,
											)}
										/>
										<span className="truncate">{slice.label}</span>
									</span>
									<bdi dir="ltr" className="text-muted-foreground tabular-nums">
										{signed.format(slice.gain)}
									</bdi>
								</li>
							))}
						</ul>
					</>
				) : (
					<>
						<Skeleton className="mx-auto size-48 rounded-full" />
						<Skeleton className="h-16" />
					</>
				)}
			</CardContent>
		</Card>
	);
}
