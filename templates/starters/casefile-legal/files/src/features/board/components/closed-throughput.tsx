// The closed figure of the board header: a mini bar chart of the matters closed per day, the total, and its change.
// BoardPage renders it in the actions slot of the page header.
// It follows the chart form "bars" at mini height and the value and delta parts of the KPI form "strip".
import { Bar, BarChart } from "recharts";
import {
	BAR_RADIUS_PX,
	ChangeLine,
	type DailyPoint,
	dayCountFormat,
	dayToDate,
	fillMessage,
	totalsOf,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { useAppTheme } from "~/styles/theme";

// 30 bars of 3 px fit the mini width with a gap of about 2 px.
const BAR_SIZE_PX = 3;

type ClosedThroughputProps = {
	/** Matters closed per day, oldest first, with the same days one period earlier. */
	points: DailyPoint[];
};

/** The change compares the total of the period with the total of the period before it. */
export function ClosedThroughput({ points }: ClosedThroughputProps) {
	const { t, locale } = useT();
	// The bars are thin: a corner above half the width turns the top into a point.
	const barRadius = Math.min(
		BAR_RADIUS_PX[useAppTheme().selection.radius],
		BAR_SIZE_PX / 2,
	);
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const totals = totalsOf(points);
	const period = dayCountFormat(locale).format(points.length);
	const chartConfig = {
		current: { label: t("board.closedTooltip"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<div className="flex items-end gap-4">
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-11 w-36 border-b"
				role="img"
				aria-label={fillMessage(t("board.closedChartLabel"), {
					period,
					count: number.format(totals.current),
				})}
			>
				<BarChart
					data={points}
					margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
				>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								labelFormatter={(day) =>
									dayFormat.format(dayToDate(String(day)))
								}
							/>
						}
					/>
					<Bar
						dataKey="current"
						fill="var(--color-current)"
						radius={[barRadius, barRadius, 0, 0]}
						barSize={BAR_SIZE_PX}
						isAnimationActive={false}
					/>
				</BarChart>
			</ChartContainer>
			<div className="grid gap-1">
				<p className="label-text text-muted-foreground text-xs">
					{fillMessage(t("board.closedLabel"), { period })}
				</p>
				<div className="flex items-baseline gap-2.5">
					<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
						{number.format(totals.current)}
					</span>
					<ChangeLine change={totals.change} goodWhen="up" />
				</div>
			</div>
		</div>
	);
}
