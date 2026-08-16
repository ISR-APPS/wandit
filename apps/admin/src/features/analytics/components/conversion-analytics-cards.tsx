import type {
	AdminAnalyticsCheckoutFunnel,
	AdminAnalyticsDaysToConvertBucket,
	AdminAnalyticsDaysToConvertPoint,
	AdminAnalyticsNewPaidPoint,
} from "@wandit/contracts";
import {
	ArrowRightIcon,
	ChartNoAxesColumnIncreasingIcon,
	CreditCardIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { InlinePercentageBar } from "@/features/analytics/components/inline-percentage-bar";
import {
	getDaysToConvertBucketLabel,
	mapDaysToConvertChartData,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewCompactNumber,
	formatOverviewDateLabel,
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type DaysToConvertCardProps = {
	points: AdminAnalyticsDaysToConvertPoint[];
};

type CheckoutFunnelCardProps = {
	funnel: AdminAnalyticsCheckoutFunnel;
	newPaidByDay: AdminAnalyticsNewPaidPoint[];
};

const daysToConvertChartConfig = {
	count: {
		label: "Paid users",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const newPaidChartConfig = {
	count: {
		label: "New paid",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

function DaysToConvertCard({ points }: DaysToConvertCardProps) {
	const chartData = mapDaysToConvertChartData(points);
	const totalConversions = chartData.reduce(
		(total, point) => total + point.count,
		0,
	);

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2 className="flex items-center gap-1">
							Time to convert
							<MetricInfoTooltip
								label="Time to convert"
								content="How long it took users to go from signup to their first subscription. Only users who first subscribed during the selected range are counted."
							/>
						</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Days from account signup to the first subscription
					</CardDescription>
				</div>
				<p className="mt-3 font-semibold text-2xl tabular-nums tracking-tight">
					{formatOverviewWholeNumber(totalConversions)}
					<span className="ml-2 font-normal text-muted-foreground text-xs">
						converted users
					</span>
				</p>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{totalConversions > 0 ? (
					<figure>
						<ChartContainer
							config={daysToConvertChartConfig}
							className="aspect-auto h-[270px] w-full tabular-nums lg:h-[300px]"
							role="img"
							aria-label="Paid users grouped by days between signup and first subscription"
						>
							<BarChart
								accessibilityLayer
								data={chartData}
								margin={{ left: 0, right: 4, top: 8 }}
							>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis
									dataKey="bucket"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
								/>
								<YAxis
									allowDecimals={false}
									axisLine={false}
									tickLine={false}
									tickMargin={8}
									tickFormatter={(value) =>
										formatOverviewCompactNumber(Number(value))
									}
									width={34}
								/>
								<ChartTooltip
									cursor={{ fill: "var(--muted)", fillOpacity: 0.55 }}
									content={
										<ChartTooltipContent
											labelFormatter={(value) =>
												getDaysToConvertBucketLabel(
													String(value) as AdminAnalyticsDaysToConvertBucket,
												)
											}
										/>
									}
								/>
								<Bar
									dataKey="count"
									fill="var(--color-count)"
									radius={[4, 4, 0, 0]}
									maxBarSize={42}
									isAnimationActive={false}
								/>
							</BarChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The bar chart groups converted users by how many days elapsed
							between signup and their first subscription.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[270px] flex-col items-center justify-center gap-2 px-4 text-center lg:h-[300px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<ChartNoAxesColumnIncreasingIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">
							No paid conversions in this range yet
						</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							Signup-to-subscription timing will appear after a first
							conversion.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function CheckoutFunnelCard({ funnel, newPaidByDay }: CheckoutFunnelCardProps) {
	const sortedNewPaid = [...newPaidByDay].sort((left, right) =>
		left.date.localeCompare(right.date),
	);
	const hasNewPaid = sortedNewPaid.some((point) => point.count > 0);

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2>Checkout funnel</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Checkout attempts started and completed in this range
					</CardDescription>
				</div>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col pt-5 pb-6">
				{funnel.started > 0 ? (
					<>
						<div className="flex items-end justify-between gap-4">
							<div>
								<div className="flex items-center gap-1">
									<p className="text-muted-foreground text-xs">
										Completion rate
									</p>
									<MetricInfoTooltip
										label="Completion rate"
										content="Share of checkout attempts started in the selected range that were completed."
									/>
								</div>
								<p className="mt-1 font-semibold text-3xl tabular-nums tracking-tight">
									{formatOverviewPercentValue(funnel.completionPct)}
								</p>
							</div>
							<BadgeDollarSummary
								completed={funnel.completed}
								started={funnel.started}
							/>
						</div>

						<div className="mt-5">
							<InlinePercentageBar
								value={funnel.completionPct}
								label="Checkout completion rate"
							/>
						</div>

						<div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border bg-muted/20 p-4">
							<div>
								<div className="flex items-center gap-1">
									<p className="text-muted-foreground text-xs">Started</p>
									<MetricInfoTooltip
										label="Started"
										content="Checkout attempts that began during the selected range."
									/>
								</div>
								<p className="mt-1 font-semibold text-xl tabular-nums">
									{formatOverviewWholeNumber(funnel.started)}
								</p>
							</div>
							<ArrowRightIcon className="size-4 text-muted-foreground" />
							<div className="text-right">
								<div className="flex items-center justify-end gap-1">
									<p className="text-muted-foreground text-xs">Completed</p>
									<MetricInfoTooltip
										label="Completed"
										content="Those checkout attempts that were completed."
									/>
								</div>
								<p className="mt-1 font-semibold text-xl tabular-nums">
									{formatOverviewWholeNumber(funnel.completed)}
								</p>
							</div>
						</div>
					</>
				) : (
					<div className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<CreditCardIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">
							No checkout attempts in this range
						</p>
						<p className="max-w-64 text-muted-foreground text-xs">
							Started and completed checkouts will appear here.
						</p>
					</div>
				)}

				<div className="mt-6 border-t pt-5">
					<div className="mb-3 flex items-baseline justify-between gap-3">
						<div>
							<div className="flex items-center gap-1">
								<p className="font-medium text-sm">New paid momentum</p>
								<MetricInfoTooltip
									label="New paid momentum"
									content="Paying users whose first subscription started during the selected range, shown day by day."
								/>
							</div>
							<p className="mt-0.5 text-muted-foreground text-xs">
								First subscriptions by day
							</p>
						</div>
						<span className="text-muted-foreground text-xs tabular-nums">
							{formatOverviewWholeNumber(
								sortedNewPaid.reduce((total, point) => total + point.count, 0),
							)}{" "}
							total
						</span>
					</div>

					{hasNewPaid ? (
						<figure>
							<ChartContainer
								config={newPaidChartConfig}
								className="aspect-auto h-[120px] w-full tabular-nums"
								role="img"
								aria-label="New paid users by day"
							>
								<BarChart
									accessibilityLayer
									data={sortedNewPaid}
									margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
								>
									<XAxis dataKey="date" hide />
									<YAxis hide allowDecimals={false} />
									<ChartTooltip
										cursor={{ fill: "var(--muted)", fillOpacity: 0.55 }}
										content={
											<ChartTooltipContent
												labelFormatter={(value) =>
													formatOverviewDateLabel(String(value))
												}
											/>
										}
									/>
									<Bar
										dataKey="count"
										fill="var(--color-count)"
										radius={[3, 3, 0, 0]}
										maxBarSize={18}
										isAnimationActive={false}
									/>
								</BarChart>
							</ChartContainer>
							<figcaption className="sr-only">
								The compact bar chart shows first-time paid users on each day in
								the selected range.
							</figcaption>
						</figure>
					) : (
						<p className="flex h-[120px] items-center justify-center rounded-lg border border-dashed px-4 text-center text-muted-foreground text-xs">
							Daily first subscriptions will appear here after a user converts.
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function BadgeDollarSummary({
	completed,
	started,
}: {
	completed: number;
	started: number;
}) {
	return (
		<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
			<CreditCardIcon className="size-3.5 text-muted-foreground" />
			<span className="font-medium tabular-nums">
				{formatOverviewWholeNumber(completed)} /{" "}
				{formatOverviewWholeNumber(started)}
			</span>
		</div>
	);
}

export type { CheckoutFunnelCardProps, DaysToConvertCardProps };
export { CheckoutFunnelCard, DaysToConvertCard };
