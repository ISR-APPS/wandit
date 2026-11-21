// The area chart of a campaign page: spend per day, one stacked area per channel of the media plan.
// CampaignSpendCard loads this file with React.lazy, so the chart library stays out of the first script.
// Each area fills with a gradient of its channel color from 0.3 at the line to 0 at the base.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type Channel,
	type ChannelPoint,
	CURRENCY,
	channelColor,
	dayToDate,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One day of the chart: the day key, then the spend of each channel. The channel codes are CSS-safe keys. */
type SpendRow = { day: string } & Partial<Record<Channel, number>>;

type CampaignSpendAreaProps = {
	/** One point per day and channel, oldest first. */
	points: ChannelPoint[];
	/** The channels of the plan, the bottom area first. */
	channels: readonly Channel[];
};

/** The aria-label names the spend of the last day per channel. The tooltip gives each day. */
export function CampaignSpendArea({
	points,
	channels,
}: CampaignSpendAreaProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const moneyOptions = {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
	} satisfies Intl.NumberFormatOptions;
	const money = new Intl.NumberFormat(locale, moneyOptions);
	const compact = new Intl.NumberFormat(locale, {
		...moneyOptions,
		notation: "compact",
	});
	// The day keys are midnight UTC, so the UTC time zone keeps the same calendar day.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const config = Object.fromEntries(
		channels.map((channel) => [
			channel,
			{ label: t(`channels.${channel}`), color: channelColor(channel) },
		]),
	) satisfies ChartConfig;

	const rowsByDay = new Map<string, SpendRow>();
	for (const point of points) {
		const row = rowsByDay.get(point.day) ?? { day: point.day };
		row[point.channel] = (row[point.channel] ?? 0) + point.value;
		rowsByDay.set(point.day, row);
	}
	const rows = [...rowsByDay.values()];
	const lastRow = rows.at(-1);

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-64 w-full"
			role="img"
			aria-label={`${t("campaigns.spendPerDay")}${
				lastRow
					? `, ${dayFormat.format(dayToDate(lastRow.day))}: ${channels
							.map(
								(channel) =>
									`${t(`channels.${channel}`)} ${money.format(lastRow[channel] ?? 0)}`,
							)
							.join(", ")}`
					: ""
			}`}
		>
			<AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
				<defs>
					{channels.map((channel) => (
						<linearGradient
							key={channel}
							id={`${gradientId}-${channel}`}
							x1="0"
							y1="0"
							x2="0"
							y2="1"
						>
							<stop
								offset="5%"
								stopColor={`var(--color-${channel})`}
								stopOpacity={0.3}
							/>
							<stop
								offset="95%"
								stopColor={`var(--color-${channel})`}
								stopOpacity={0}
							/>
						</linearGradient>
					))}
				</defs>
				<CartesianGrid vertical={false} />
				{/* Time runs from right to left in Arabic. */}
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
				/>
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					orientation={dir === "rtl" ? "right" : "left"}
					tickFormatter={(tick: number) => compact.format(tick)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							valueFormat={moneyOptions}
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				{channels.map((channel) => (
					<Area
						key={channel}
						dataKey={channel}
						type="monotone"
						stackId="spend"
						stroke={`var(--color-${channel})`}
						fill={`url(#${gradientId}-${channel})`}
						isAnimationActive={false}
					/>
				))}
			</AreaChart>
		</ChartContainer>
	);
}
