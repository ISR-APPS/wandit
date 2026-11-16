// The won figure of the pipeline header: a mini bar chart of the won amount per day, the total, and its change.
// PipelinePage renders it in the actions slot of the page header.
// It follows the chart form "bars" at mini height and the KPI form "number" of the app-dashboard skill.
import { Bar, BarChart } from "recharts";
import {
	ChangeLine,
	CURRENCY,
	type DailyPoint,
	dayCountFormat,
	dayToDate,
	fillMessage,
	moneyFormat,
	totalsOf,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";

/** Bar corner in px for each radius of the theme. The bars are thin, so the corner stays small. */
const BAR_RADIUS_PX = {
	none: 0,
	sm: 1,
	md: 1,
	lg: 2,
	xl: 2,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

type WonThroughputProps = {
	/** The won amount per day, oldest first, with the same days one period earlier. */
	points: DailyPoint[];
};

/** The change compares the total of the period with the total of the period before it. */
export function WonThroughput({ points }: WonThroughputProps) {
	const { t, locale } = useT();
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const compactMoney = moneyFormat(locale, "compact");
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const dayCount = dayCountFormat(locale);
	const totals = totalsOf(points);
	const period = dayCount.format(points.length);
	const chartConfig = {
		current: { label: t("pipeline.won"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	return (
		<div className="flex items-center gap-4">
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-12 w-40 border-b"
				role="img"
				aria-label={fillMessage(t("pipeline.wonChartLabel"), {
					period,
					amount: compactMoney.format(totals.current),
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
								valueFormat={{
									style: "currency",
									currency: CURRENCY,
									maximumFractionDigits: 0,
								}}
							/>
						}
					/>
					<Bar
						dataKey="current"
						fill="var(--color-current)"
						radius={[barRadius, barRadius, 0, 0]}
						// 30 bars of 4 px fit the mini width with a gap of about 1 px.
						barSize={4}
						isAnimationActive={false}
					/>
				</BarChart>
			</ChartContainer>
			<div className="grid gap-0.5">
				<p className="label-text text-muted-foreground text-xs">
					{fillMessage(t("pipeline.wonLabel"), { period })}
				</p>
				<div className="flex items-baseline gap-2.5">
					<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
						{compactMoney.format(totals.current)}
					</span>
					<ChangeLine change={totals.change} goodWhen="up" />
				</div>
			</div>
		</div>
	);
}
