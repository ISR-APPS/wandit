import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
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
	OverviewGrowthPoint,
	OverviewTotals,
} from "@/features/overview/api/overview.dto";
import {
	formatOverviewCompactNumber,
	formatOverviewPercent,
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import {
	formatAdminDateAxisTick,
	formatAdminDateTooltipLabel,
	getAdminDateAxis,
} from "@/lib/admin-date-range";
import { cn } from "@/lib/utils";

type GrowthTrendCardProps = {
	points: OverviewGrowthPoint[];
	totals: OverviewTotals;
	rangeLabel: string;
};

const growthChartConfig = {
	signups: {
		label: "New users",
		color: "var(--chart-1)",
	},
	websitesGenerated: {
		label: "Websites",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

function GrowthTrendCard({ points, totals, rangeLabel }: GrowthTrendCardProps) {
	const dateAxis = getAdminDateAxis(points.map((point) => point.date));

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Growth momentum</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							New users and generated websites · {rangeLabel.toLowerCase()}
						</CardDescription>
					</div>
					<Button
						asChild
						type="button"
						size="sm"
						variant="outline"
						className="shrink-0"
					>
						<Link to="/users">
							View users
							<ArrowUpRightIcon />
						</Link>
					</Button>
				</div>
			</CardHeader>

			<CardContent className="flex min-h-0 flex-1 flex-col pt-5 pb-6">
				<div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3">
					<div>
						<p className="text-muted-foreground text-xs">New signups</p>
						<div className="mt-1 flex items-baseline gap-2">
							<span className="font-semibold text-2xl tabular-nums tracking-tight">
								{formatOverviewWholeNumber(totals.signups)}
							</span>
							<span
								className={cn(
									"font-medium text-xs tabular-nums",
									totals.signupsChangePercent > 0 &&
										"text-emerald-700 dark:text-emerald-400",
									totals.signupsChangePercent < 0 && "text-destructive",
									totals.signupsChangePercent === 0 && "text-muted-foreground",
								)}
							>
								{formatOverviewPercent(totals.signupsChangePercent)}
							</span>
						</div>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Websites generated</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatOverviewWholeNumber(totals.websitesGenerated)}
						</p>
					</div>
					<div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs sm:ml-auto sm:w-auto">
						<span className="flex items-center gap-1.5">
							<span className="size-2 shrink-0 rounded-full bg-chart-1" />
							New users
						</span>
						<span className="flex items-center gap-1.5">
							<span className="size-2 shrink-0 rounded-full bg-chart-2" />
							Websites
						</span>
					</div>
				</div>

				{/* From lg the chart absorbs any extra height when the sibling
				    Generation health card makes this row taller; on stacked
				    layouts it keeps a fixed height. */}
				<figure className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
					<ChartContainer
						config={growthChartConfig}
						className="aspect-auto h-[250px] w-full lg:h-full lg:min-h-[290px] lg:flex-1"
						role="img"
						aria-label={`${rangeLabel} trend for user signups and generated websites`}
					>
						<AreaChart
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
								axisLine={false}
								tickLine={false}
								tickMargin={8}
								tickFormatter={(value) =>
									formatOverviewCompactNumber(Number(value))
								}
								width={38}
							/>
							<ChartTooltip
								cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
								content={
									<ChartTooltipContent
										indicator="dot"
										labelFormatter={(value) =>
											formatAdminDateTooltipLabel(String(value))
										}
									/>
								}
							/>
							<Area
								dataKey="signups"
								type="monotone"
								fill="var(--color-signups)"
								fillOpacity={0.12}
								stroke="var(--color-signups)"
								strokeWidth={2}
								isAnimationActive={false}
							/>
							<Area
								dataKey="websitesGenerated"
								type="monotone"
								fill="var(--color-websitesGenerated)"
								fillOpacity={0.08}
								stroke="var(--color-websitesGenerated)"
								strokeWidth={2}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ChartContainer>
					<figcaption className="sr-only">
						This chart compares new user signups with website generations
						throughout the selected reporting period.
					</figcaption>
				</figure>
			</CardContent>

			<div className="grid grid-cols-2 divide-x border-t bg-muted/20 sm:grid-cols-3">
				<div className="px-5 py-3.5">
					<p className="text-muted-foreground text-xs">All users</p>
					<p className="mt-1 font-medium tabular-nums">
						{formatOverviewWholeNumber(totals.totalUsers)}
					</p>
				</div>
				<div className="px-5 py-3.5">
					<p className="text-muted-foreground text-xs">Active in range</p>
					<p className="mt-1 font-medium tabular-nums">
						{formatOverviewWholeNumber(totals.activeUsers)}
					</p>
				</div>
				<div className="col-span-2 border-t px-5 py-3.5 sm:col-span-1 sm:border-t-0">
					<p className="text-muted-foreground text-xs">Activation</p>
					<p className="mt-1 font-medium tabular-nums">
						{formatOverviewPercentValue(totals.activationPercent)}
					</p>
				</div>
			</div>
		</Card>
	);
}

export type { GrowthTrendCardProps };
export { GrowthTrendCard };
