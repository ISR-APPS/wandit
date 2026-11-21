// The bars of the weekday card: one group per day of the week, this period beside the period before.
// WeekdaySalesCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.2 (grouped bars for two series) and the bars form of the app-dashboard skill.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = { none: 0, sm: 2, md: 2, lg: 4, xl: 4 } satisfies Record<
	AppThemeFile["selection"]["radius"],
	number
>;

/** One group of bars. */
export type WeekdayBar = {
	/** The short weekday name in the app language, for example "Fri". */
	label: string;
	current: number;
	previous: number;
};

type WeekdayBarsProps = {
	/** 7 groups in the order of the locale week. */
	bars: WeekdayBar[];
	/** The aria-label of the plot: the title and the busiest day. */
	label: string;
};

/** The Y axis has compact ticks, as on the main chart of the home. */
export function WeekdayBars({ bars, label }: WeekdayBarsProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	// The hook gives the radius of the live theme, so a radius change in the builder shows at once.
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const config = {
		previous: { label: t("overview.periodBefore"), color: "var(--chart-2)" },
		current: { label: t("overview.thisPeriod"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-56 w-full"
			role="img"
			aria-label={label}
		>
			<BarChart data={bars} margin={{ top: 8, left: 0, right: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="label"
					reversed={isRtl}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
				/>
				<YAxis
					orientation={isRtl ? "right" : "left"}
					tick={{ textAnchor: "end" }}
					width="auto"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickFormatter={(value: number) => compact.format(value)}
				/>
				<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
				<Bar
					dataKey="previous"
					fill="var(--color-previous)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="current"
					fill="var(--color-current)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
