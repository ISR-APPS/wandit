// The stacked bars of the transfer card: new files at the bottom, new versions on top, one bar per day, week, or month.
// TransferCard loads this file with React.lazy, so the chart library stays out of the first script.
// The legend under the plot names both series, so color is never the only mark.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import type { TransferBar, TransferPeriod } from "../lib/series";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
const BAR_RADIUS_PX = { none: 0, sm: 2, md: 4, lg: 5, xl: 6 } satisfies Record<
	AppThemeFile["selection"]["radius"],
	number
>;

type TransferChartProps = {
	bars: TransferBar[];
	period: TransferPeriod;
	/** The card title. The chart names it in its aria-label. */
	title: string;
};

/** h-72 plot. The Y axis uses compact numbers; it hides when every bar is 0. */
export function TransferChart({ bars, period, title }: TransferChartProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const labelFormat = new Intl.DateTimeFormat(
		locale,
		period === "months"
			? { month: "short" }
			: { day: "numeric", month: "short" },
	);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const number = new Intl.NumberFormat(locale);
	const config = {
		newFiles: { label: t("overview.newFiles"), color: "var(--chart-1)" },
		newVersions: { label: t("overview.newVersions"), color: "var(--chart-3)" },
	} satisfies ChartConfig;
	const total = bars.reduce(
		(sum, bar) => sum + bar.newFiles + bar.newVersions,
		0,
	);
	const last = bars[bars.length - 1];
	const formatStart = (startMs: number | string) =>
		labelFormat.format(new Date(Number(startMs)));

	return (
		<ChartContainer
			config={config}
			className="aspect-auto h-72 w-full"
			role="img"
			aria-label={
				last
					? `${title}. ${formatStart(last.startMs)}: ${config.newFiles.label} ${number.format(last.newFiles)}, ${config.newVersions.label} ${number.format(last.newVersions)}`
					: title
			}
		>
			<BarChart data={bars} margin={{ left: 0, right: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="startMs"
					tickLine={false}
					axisLine={false}
					tickMargin={10}
					minTickGap={16}
					reversed={isRtl}
					tickFormatter={formatStart}
				/>
				{total > 0 ? (
					<YAxis
						width="auto"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						allowDecimals={false}
						orientation={isRtl ? "right" : "left"}
						tickFormatter={(value: number) => compact.format(value)}
					/>
				) : null}
				<ChartTooltip
					cursor={false}
					content={<ChartTooltipContent labelFormatter={formatStart} />}
				/>
				<ChartLegend content={<ChartLegendContent />} />
				<Bar
					dataKey="newFiles"
					stackId="uploads"
					fill="var(--color-newFiles)"
					radius={[0, 0, barRadius, barRadius]}
					isAnimationActive={false}
				/>
				<Bar
					dataKey="newVersions"
					stackId="uploads"
					fill="var(--color-newVersions)"
					radius={[barRadius, barRadius, 0, 0]}
					isAnimationActive={false}
				/>
			</BarChart>
		</ChartContainer>
	);
}
