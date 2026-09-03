import { ActivityIcon, HeartPulseIcon } from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
} from "recharts";

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
import type { EngagementDailyChartPoint } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewCompactNumber,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import {
	formatAdminDateAxisTick,
	formatAdminDateTooltipLabel,
	getAdminDateAxis,
} from "@/lib/admin-date-range";

type EngagementDailyCardProps = {
	points: EngagementDailyChartPoint[];
};

const activeUsersChartConfig = {
	activeUsers: {
		label: "Active users",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const healthyTrialsChartConfig = {
	healthyTrials: {
		label: "Healthy trials",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

function DailyActiveUsersCard({ points }: EngagementDailyCardProps) {
	const dateAxis = getAdminDateAxis(points.map((point) => point.date));
	const hasActivity = points.some((point) => point.activeUsers > 0);
	const totalActiveUserDays = points.reduce(
		(total, point) => total + point.activeUsers,
		0,
	);

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2 className="flex items-center gap-1">
							Activity by day
							<MetricInfoTooltip
								label="Activity by day"
								content="Distinct authenticated individual users active on each UTC calendar day. Days without activity are shown as zero."
							/>
						</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Daily authenticated users in the selected range
					</CardDescription>
				</div>
				<p className="mt-3 font-semibold text-2xl tabular-nums tracking-tight">
					{formatOverviewWholeNumber(totalActiveUserDays)}
					<span className="ml-2 font-normal text-muted-foreground text-xs">
						active user-days
					</span>
				</p>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{hasActivity ? (
					<figure>
						<ChartContainer
							config={activeUsersChartConfig}
							className="aspect-auto h-[280px] w-full tabular-nums lg:h-[310px]"
							role="img"
							aria-label="Distinct active users on each UTC day"
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
									allowDecimals={false}
									axisLine={false}
									tickLine={false}
									tickMargin={8}
									tickFormatter={(value) =>
										formatOverviewCompactNumber(Number(value))
									}
									width={42}
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
										/>
									}
								/>
								<Area
									dataKey="activeUsers"
									type="monotone"
									fill="var(--color-activeUsers)"
									fillOpacity={0.12}
									stroke="var(--color-activeUsers)"
									strokeWidth={2}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The area chart shows distinct authenticated users active on each
							UTC day, including zero-activity days.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[280px] flex-col items-center justify-center gap-2 px-4 text-center lg:h-[310px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<ActivityIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">No daily activity yet</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							Authenticated activity will appear here day by day.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function HealthyTrialsByDayCard({ points }: EngagementDailyCardProps) {
	const dateAxis = getAdminDateAxis(points.map((point) => point.date));
	const totalHealthyTrials = points.reduce(
		(total, point) => total + point.healthyTrials,
		0,
	);

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div>
					<CardTitle>
						<h2 className="flex items-center gap-1">
							Healthy trials by day
							<MetricInfoTooltip
								label="Healthy trials by day"
								content="Free users who used at least 3 credits and completed at least two generations in their first seven days. Each user is assigned to signup day plus seven."
							/>
						</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Trials reaching the healthy threshold
					</CardDescription>
				</div>
				<p className="mt-3 font-semibold text-2xl tabular-nums tracking-tight">
					{formatOverviewWholeNumber(totalHealthyTrials)}
					<span className="ml-2 font-normal text-muted-foreground text-xs">
						in range
					</span>
				</p>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{totalHealthyTrials > 0 ? (
					<figure>
						<ChartContainer
							config={healthyTrialsChartConfig}
							className="aspect-auto h-[280px] w-full tabular-nums lg:h-[310px]"
							role="img"
							aria-label="Healthy trial users by UTC evaluation day"
						>
							<BarChart
								accessibilityLayer
								data={points}
								margin={{ left: 0, right: 4, top: 8 }}
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
												formatAdminDateTooltipLabel(String(value))
											}
										/>
									}
								/>
								<Bar
									dataKey="healthyTrials"
									fill="var(--color-healthyTrials)"
									radius={[4, 4, 0, 0]}
									maxBarSize={28}
									isAnimationActive={false}
								/>
							</BarChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The bar chart shows healthy trial users by their UTC evaluation
							date, including zero-count days.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[280px] flex-col items-center justify-center gap-2 px-4 text-center lg:h-[310px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<HeartPulseIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">
							No healthy trials in this range
						</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							Users will appear after reaching both seven-day thresholds.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export type { EngagementDailyCardProps };
export { DailyActiveUsersCard, HealthyTrialsByDayCard };
