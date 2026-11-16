// The size of one audience over the last 90 days as a small area chart with a tooltip.
// AudiencePanel renders it under the size figure. The Y axis gives the real range of the fitted scale.
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	dayKeyOf,
	dayToDate,
	fillMessage,
	shiftDays,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

type AudienceSizeChartProps = {
	/** People in the segment for each day, oldest first. The last value is today. */
	sizeByDay: number[];
};

/** The Y scale fits the values, so a growth of a few percent stays visible. Its axis shows that range. */
export function AudienceSizeChart({ sizeByDay }: AudienceSizeChartProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	// The day keys are midnight UTC, so the UTC time zone keeps the same calendar day.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const today = Date.now();
	const rows = sizeByDay.map((size, index) => ({
		day: dayKeyOf(shiftDays(today, index - sizeByDay.length + 1)),
		size,
	}));
	const config = {
		size: { label: t("audiences.size"), color: "var(--chart-4)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-44 w-full"
			role="img"
			aria-label={fillMessage(t("audiences.sizeChartLabel"), {
				first: compact.format(sizeByDay[0] ?? 0),
				last: compact.format(sizeByDay.at(-1) ?? 0),
			})}
		>
			<AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
				<defs>
					<linearGradient id={fillId}>
						<stop stopColor="var(--color-size)" stopOpacity={0.25} />
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={32}
					reversed={dir === "rtl"}
					tickFormatter={(day: string) => dayFormat.format(dayToDate(day))}
				/>
				{/* Arabic puts the axis on the right, with the tick text against the plot. */}
				<YAxis
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickCount={3}
					domain={["dataMin", "dataMax"]}
					orientation={dir === "rtl" ? "right" : "left"}
					tick={dir === "rtl" ? { textAnchor: "end" } : undefined}
					tickFormatter={(tick: number) => compact.format(tick)}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="line"
							labelFormatter={(day) => dayFormat.format(dayToDate(String(day)))}
						/>
					}
				/>
				<Area
					dataKey="size"
					type="monotone"
					stroke="var(--color-size)"
					fill={`url(#${fillId})`}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
