// The sign-up card of the Reports page: the new people of each week as one bar, split by channel.
// ReportsPage renders it with the weeks of the sign-up query. It follows the chart form "stacked" of the app-dashboard skill.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	CHANNELS,
	dayToDate,
	fillMessage,
	shareFormat,
	wholeShares,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
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
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { SignUpWeek } from "../api/reports.queries";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

type SignUpsByChannelCardProps = {
	/** The last 12 weeks, the oldest first. */
	weeks: SignUpWeek[];
};

/** The legend sits in the header with the total of each channel, so it also is the breakdown of the 12 weeks. */
export function SignUpsByChannelCard({ weeks }: SignUpsByChannelCardProps) {
	const { t, locale, dir } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const share = shareFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string) => dayFormat.format(dayToDate(day));
	// The series use chart-1 to chart-5 in the order of CHANNELS. The first channel sits at the bottom of each bar.
	const chartConfig = Object.fromEntries(
		CHANNELS.map((channel, index) => [
			channel,
			{ label: t(`channels.${channel}`), color: `var(--chart-${index + 1})` },
		]),
	) satisfies ChartConfig;

	const totals = CHANNELS.map((channel) => ({
		channel,
		people: weeks.reduce((sum, week) => sum + week[channel], 0),
	}));
	const allPeople = totals.reduce((sum, total) => sum + total.people, 0);
	const channelShares = wholeShares(totals.map((total) => total.people));
	const lastWeek = weeks.at(-1);
	const isRtl = dir === "rtl";

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reports.signUps.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("reports.signUps.description"), {
						count: number.format(allPeople),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<dl className="grid @2xl/main:grid-cols-5 grid-cols-2 gap-x-6 gap-y-3">
					{totals.map((total, index) => (
						<div key={total.channel} className="grid gap-1">
							<dt className="flex items-center gap-2 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-badge"
									style={{ backgroundColor: `var(--chart-${index + 1})` }}
								/>
								<span className="truncate">
									{t(`channels.${total.channel}`)}
								</span>
							</dt>
							<dd className="flex items-baseline gap-2">
								<span className="font-numeric font-semibold text-lg tabular-nums leading-none">
									{number.format(total.people)}
								</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{share.format(channelShares[index] ?? 0)}
								</span>
							</dd>
						</div>
					))}
				</dl>
				{allPeople === 0 ? (
					<p className="grid h-64 content-center text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-64 w-full"
						role="img"
						aria-label={
							lastWeek
								? fillMessage(t("reports.signUps.label"), {
										day: formatDay(lastWeek.day),
										count: number.format(
											CHANNELS.reduce(
												(sum, channel) => sum + lastWeek[channel],
												0,
											),
										),
									})
								: t("reports.signUps.title")
						}
					>
						<BarChart
							data={weeks}
							// The margin on the axis side keeps the ticks off the edge of the plot.
							margin={{
								top: 8,
								bottom: 0,
								left: isRtl ? 0 : 4,
								right: isRtl ? 4 : 0,
							}}
						>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="day"
								reversed={isRtl}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={24}
								tickFormatter={formatDay}
							/>
							<YAxis
								orientation={isRtl ? "right" : "left"}
								tick={{ textAnchor: "end" }}
								width="auto"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								allowDecimals={false}
								tickFormatter={(value: number) => compact.format(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											fillMessage(t("reports.signUps.weekOf"), {
												day: formatDay(String(label)),
											})
										}
									/>
								}
							/>
							{CHANNELS.map((channel, index) => (
								<Bar
									key={channel}
									dataKey={channel}
									stackId="week"
									fill={`var(--color-${channel})`}
									// Only the top segment has round top corners.
									radius={
										index === CHANNELS.length - 1
											? [barRadius, barRadius, 0, 0]
											: 0
									}
									isAnimationActive={false}
								/>
							))}
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
