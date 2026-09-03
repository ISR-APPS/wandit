import { WalletCardsIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type {
	OverviewRevenuePoint,
	OverviewRevenueSummary,
} from "@/features/overview/api/overview.dto";
import {
	formatOverviewCompactNumber,
	formatOverviewPercent,
	formatOverviewRoundedUsdMinor,
} from "@/features/overview/lib/formatters";
import {
	formatAdminDateAxisTick,
	formatAdminDateTooltipLabel,
	getAdminDateAxis,
} from "@/lib/admin-date-range";
import { cn } from "@/lib/utils";

type RevenuePerformanceCardProps = {
	revenue: OverviewRevenueSummary;
	points: OverviewRevenuePoint[];
	rangeLabel: string;
};

const revenueChartConfig = {
	totalUsdMinor: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function formatRevenueAxis(value: number) {
	return `$${formatOverviewCompactNumber(value / 100)}`;
}

function RevenuePerformanceCard({
	revenue,
	points,
	rangeLabel,
}: RevenuePerformanceCardProps) {
	const hasRevenueInRange =
		revenue.totalUsdMinor > 0 ||
		points.some((point) => point.totalUsdMinor > 0);
	const dateAxis = getAdminDateAxis(points.map((point) => point.date));

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2>Revenue performance</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Collected revenue in USD · {rangeLabel.toLowerCase()}
					</CardDescription>
				</div>
				<div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
					<span className="font-display font-semibold text-3xl tabular-nums tracking-tight">
						{formatOverviewRoundedUsdMinor(revenue.totalUsdMinor)}
					</span>
					<span
						className={cn(
							"pb-1 font-medium text-sm tabular-nums",
							revenue.changePercent > 0 &&
								"text-emerald-700 dark:text-emerald-400",
							revenue.changePercent < 0 && "text-destructive",
							revenue.changePercent === 0 && "text-muted-foreground",
						)}
					>
						{formatOverviewPercent(revenue.changePercent)}
					</span>
					<span className="pb-1 text-muted-foreground text-xs">
						vs previous period
					</span>
				</div>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{hasRevenueInRange ? (
					<figure>
						<ChartContainer
							config={revenueChartConfig}
							className="aspect-auto h-[260px] w-full lg:h-[310px]"
							role="img"
							aria-label={`${rangeLabel} collected revenue trend in USD`}
						>
							<AreaChart
								accessibilityLayer
								data={points}
								margin={{ left: 4, right: 4, top: 8 }}
							>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis
									dataKey="date"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									minTickGap={28}
									ticks={dateAxis.ticks}
									interval={dateAxis.ticks ? 0 : "preserveStartEnd"}
									tickFormatter={(value) =>
										formatAdminDateAxisTick(String(value), dateAxis)
									}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									tickMargin={8}
									tickFormatter={(value) => formatRevenueAxis(Number(value))}
									width={54}
								/>
								<ChartTooltip
									cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
									content={
										<ChartTooltipContent
											indicator="line"
											labelFormatter={(value) =>
												formatAdminDateTooltipLabel(String(value))
											}
											formatter={(value, name) => (
												<div className="flex min-w-40 flex-1 items-center justify-between gap-5">
													<span className="text-muted-foreground">
														{name === "totalUsdMinor" ? "Revenue" : name}
													</span>
													<span className="font-medium font-mono tabular-nums">
														{formatOverviewRoundedUsdMinor(Number(value))}
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									dataKey="totalUsdMinor"
									type="monotone"
									fill="var(--color-totalUsdMinor)"
									fillOpacity={0.16}
									stroke="var(--color-totalUsdMinor)"
									strokeWidth={2}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The chart shows collected USD revenue across the selected range.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[260px] w-full flex-col items-center justify-center gap-2 px-4 text-center lg:h-[310px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<WalletCardsIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">
							No revenue collected in this range
						</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							USD payments appear here as soon as a charge is recorded.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export type { RevenuePerformanceCardProps };
export { RevenuePerformanceCard };
