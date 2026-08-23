import type { AdminAnalyticsCollectedRevenuePoint } from "@wandit/contracts";
import { DatabaseIcon, WalletCardsIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
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
import { mapCollectedRevenueChartData } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewCompactNumber,
	formatOverviewRoundedUsdMinor,
} from "@/features/overview/lib/formatters";
import {
	formatAdminDateAxisTick,
	formatAdminDateTooltipLabel,
	getAdminDateAxis,
} from "@/lib/admin-date-range";

type CollectedRevenueCardProps = {
	points: AdminAnalyticsCollectedRevenuePoint[];
};

const collectedRevenueChartConfig = {
	subscriptionsMinor: {
		label: "Subscriptions",
		color: "var(--chart-1)",
	},
	ordersMinor: {
		label: "Orders",
		color: "var(--chart-2)",
	},
	topupsMinor: {
		label: "Top-ups",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

const collectedRevenueSeriesLabels: Record<string, string> = {
	ordersMinor: "Orders",
	subscriptionsMinor: "Subscriptions",
	topupsMinor: "Top-ups",
};

function formatRevenueAxis(value: number) {
	return `$${formatOverviewCompactNumber(value / 100)}`;
}

function CollectedRevenueCard({ points }: CollectedRevenueCardProps) {
	const chartData = mapCollectedRevenueChartData(points);
	const dateAxis = getAdminDateAxis(chartData.map((point) => point.date));
	const totalMinor = chartData.reduce(
		(total, point) => total + point.totalMinor,
		0,
	);
	const hasRevenue = totalMinor > 0;

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2 className="flex items-center gap-1">
							Collected revenue
							<MetricInfoTooltip
								label="Collected revenue"
								content="Money actually received. Subscription payments recorded since June 2026 (migration 0029); older payments are not included."
							/>
						</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Paid subscription invoices, completed orders and top-ups in USD
					</CardDescription>
				</div>
				<p className="mt-3 font-display font-semibold text-3xl tabular-nums tracking-tight">
					{formatOverviewRoundedUsdMinor(totalMinor)}
				</p>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{hasRevenue ? (
					<figure>
						<ChartContainer
							config={collectedRevenueChartConfig}
							className="aspect-auto h-[290px] w-full tabular-nums lg:h-[320px]"
							role="img"
							aria-label="Daily collected revenue split between subscriptions, orders and top-ups"
						>
							<AreaChart
								accessibilityLayer
								data={chartData}
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
									cursor={{
										stroke: "var(--border)",
										strokeDasharray: "3 3",
									}}
									content={
										<ChartTooltipContent
											indicator="line"
											labelFormatter={(value) =>
												formatAdminDateTooltipLabel(String(value))
											}
											formatter={(value, name) => (
												<div className="flex min-w-40 flex-1 items-center justify-between gap-5">
													<span className="text-muted-foreground">
														{collectedRevenueSeriesLabels[String(name)] ??
															String(name)}
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
									dataKey="subscriptionsMinor"
									type="monotone"
									stackId="revenue"
									fill="var(--color-subscriptionsMinor)"
									fillOpacity={0.16}
									stroke="var(--color-subscriptionsMinor)"
									strokeWidth={2}
									isAnimationActive={false}
								/>
								<Area
									dataKey="ordersMinor"
									type="monotone"
									stackId="revenue"
									fill="var(--color-ordersMinor)"
									fillOpacity={0.1}
									stroke="var(--color-ordersMinor)"
									strokeWidth={2}
									isAnimationActive={false}
								/>
								<Area
									dataKey="topupsMinor"
									type="monotone"
									stackId="revenue"
									fill="var(--color-topupsMinor)"
									fillOpacity={0.1}
									stroke="var(--color-topupsMinor)"
									strokeWidth={2}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The stacked area chart shows daily subscription collections,
							completed order revenue and top-up purchases.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[290px] flex-col items-center justify-center gap-2 px-4 text-center lg:h-[320px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<WalletCardsIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">
							No collected revenue in this range yet
						</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							Paid invoices, completed orders and top-ups will appear here.
						</p>
					</div>
				)}
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs tabular-nums leading-relaxed">
				<DatabaseIcon className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Subscription collections include paid invoice data recorded since June
					2026 (migration 0029). Earlier invoice amounts are unavailable.
				</p>
			</div>
		</Card>
	);
}

export type { CollectedRevenueCardProps };
export { CollectedRevenueCard };
