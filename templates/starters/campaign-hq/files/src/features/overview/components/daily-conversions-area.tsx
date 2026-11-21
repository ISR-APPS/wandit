// The area chart of the daily conversions card: one point per day of the period, from edge to edge of the card.
// DailyConversionsCard loads this file with React.lazy, so the chart library stays out of the first script.
// The fill is a gradient of chart-2 from 0.8 at the line to 0.1 at the base.
import { useId } from "react";
import { Area, AreaChart, XAxis } from "recharts";
import { dayToDate } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { DayTotals } from "../api/overview.queries";

type DailyConversionsAreaProps = {
	/** One row per day of the period, oldest first. */
	daily: DayTotals[];
};

/** The value above the chart gives the average, so the chart is a picture with a tooltip on each day. */
export function DailyConversionsArea({ daily }: DailyConversionsAreaProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const config = {
		conversions: { label: t("metrics.conversions"), color: "var(--chart-2)" },
	} satisfies ChartConfig;
	// dayToDate gives midnight UTC, so the day reads in UTC in every time zone.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-28 w-full"
			aria-hidden="true"
		>
			<AreaChart data={daily} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="5%"
							stopColor="var(--color-conversions)"
							stopOpacity={0.8}
						/>
						<stop
							offset="95%"
							stopColor="var(--color-conversions)"
							stopOpacity={0.1}
						/>
					</linearGradient>
				</defs>
				{/* Time runs from right to left in Arabic. */}
				<XAxis dataKey="day" hide reversed={dir === "rtl"} />
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="dot"
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Area
					dataKey="conversions"
					type="monotone"
					stroke="var(--color-conversions)"
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
