// The large figure of the home: the portfolio value, its gain from price moves over the last 7 days, and a spark of those days.
// PortfolioPage renders it first in the mosaic. It follows the KPI form "spark" of the app-dashboard skill.
import { useId } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import {
	ChangeLine,
	dayCountFormat,
	fillMessage,
	moneyFormat,
	signedMoneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { type ChartConfig, ChartContainer } from "~/shared/ui/chart";
import { type PortfolioSummary, SPARK_DAYS } from "../api/portfolio.queries";

const SPARK_CONFIG = {
	value: { color: "var(--chart-1)" },
} satisfies ChartConfig;

type PortfolioValueTileProps = {
	/** The figures of the whole portfolio, from portfolioSummaryQueryOptions(). */
	summary: PortfolioSummary;
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

/** The spark needs 2 values or more. With fewer, the tile keeps its text. */
export function PortfolioValueTile({
	summary,
	className,
}: PortfolioValueTileProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const period = dayCountFormat(locale).format(SPARK_DAYS);
	const sparkData = summary.sparkValues.map((value, step) => ({ step, value }));
	// The spark shows the moves of the period, not the size of the value. So its scale starts just under the lowest day.
	const low = Math.min(...summary.sparkValues);
	const high = Math.max(...summary.sparkValues);
	const padding = (high - low) * 0.15;
	// The three facts under the spark are short: $168K, not $168,327.74. The Holdings page has the exact cost.
	const compactMoney = moneyFormat(locale, "compact");

	return (
		<Card className={cn("gap-4", className)}>
			<CardContent className="flex flex-1 flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<p className="label-text text-muted-foreground text-sm">
						{t("portfolio.valueLabel")}
					</p>
					<p className="text-muted-foreground text-xs">{period}</p>
				</div>
				<p className="font-numeric font-semibold @4xl/main:text-5xl text-4xl tabular-nums">
					{moneyFormat(locale).format(summary.value)}
				</p>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<ChangeLine
						change={summary.sparkChange}
						comparison={fillMessage(t("portfolio.valueComparison"), {
							days: period,
						})}
					/>
					{summary.sparkChange === null ? null : (
						<p className="text-muted-foreground text-sm">
							<bdi dir="ltr" className="tabular-nums">
								{signedMoneyFormat(locale).format(summary.sparkGain)}
							</bdi>{" "}
							{t("portfolio.valueGainNote")}
						</p>
					)}
				</div>
				{sparkData.length < 2 ? null : (
					// The text above gives the value and the change, so screen readers skip the spark.
					<ChartContainer
						aria-hidden="true"
						config={SPARK_CONFIG}
						className="aspect-auto min-h-16 w-full flex-1 pt-2"
					>
						{/* The 4 px top margin keeps the stroke of the highest value inside the chart. */}
						<AreaChart
							data={sparkData}
							margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-value)"
										stopOpacity={0.45}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-value)"
										stopOpacity={0.02}
									/>
								</linearGradient>
							</defs>
							{/* Time runs from right to left in Arabic. */}
							<XAxis dataKey="step" hide reversed={dir === "rtl"} />
							<YAxis hide domain={[low - padding, high + padding]} />
							<Area
								dataKey="value"
								type="monotone"
								stroke="var(--color-value)"
								fill={`url(#${fillId})`}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ChartContainer>
				)}
				<dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("portfolio.costBasis")}
						</dt>
						<dd className="font-medium tabular-nums">
							{compactMoney.format(summary.costBasis)}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("portfolio.periodLow")}
						</dt>
						<dd className="font-medium tabular-nums">
							{compactMoney.format(low)}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("portfolio.periodHigh")}
						</dt>
						<dd className="font-medium tabular-nums">
							{compactMoney.format(high)}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
