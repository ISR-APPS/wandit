// The bars of the team card: one bar per department, with the head count on top and a short team name under it.
// TeamHeadcountCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.8 (bar spark with labels on top), with a short axis label so each bar names its team.
import { Bar, BarChart, LabelList, XAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** One bar: a team and its head count. */
export type TeamBar = {
	/** The department code. */
	key: string;
	/** The full team name, for the tooltip and the aria-label. */
	label: string;
	/** A name of one short word, for the axis under the bar. */
	shortLabel: string;
	value: number;
};

type TeamBarsProps = {
	bars: TeamBar[];
};

/** The value labels need room above the highest bar, so the chart keeps a top margin. */
export function TeamBars({ bars }: TeamBarsProps) {
	const { t, locale, dir } = useT();
	const number = new Intl.NumberFormat(locale);
	// The builder can change the radius with no turn, so the bars read the live theme.
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	// The axis shows the short name. The tooltip shows the full name of the same bar.
	const fullNames = new Map(bars.map((bar) => [bar.shortLabel, bar.label]));
	const chartConfig = {
		value: { label: t("dashboard.people"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto h-56 w-full"
			role="img"
			aria-label={`${t("dashboard.teamsTitle")}: ${bars
				.map((bar) => `${bar.label} ${number.format(bar.value)}`)
				.join(", ")}`}
		>
			<BarChart data={bars} margin={{ top: 24, right: 0, bottom: 0, left: 0 }}>
				<XAxis
					dataKey="shortLabel"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					interval={0}
					reversed={dir === "rtl"}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(label) => fullNames.get(String(label)) ?? label}
						/>
					}
				/>
				<Bar
					dataKey="value"
					fill="var(--color-value)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				>
					<LabelList
						dataKey="value"
						position="top"
						offset={8}
						className="fill-foreground text-xs tabular-nums"
					/>
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
