import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, UsersRoundIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
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
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

function GrowthTrendCard({ points, totals, rangeLabel }: GrowthTrendCardProps) {
	return (
		<Card className="h-full shadow-none">
			<CardHeader className="border-b">
				<div>
					<CardTitle>
						<h2>Growth momentum</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						New users and generated websites · {rangeLabel.toLowerCase()}
					</CardDescription>
				</div>
				<CardAction>
					<Button asChild type="button" size="sm" variant="outline">
						<Link to="/users">
							View users
							<ArrowUpRightIcon />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent className="pt-5">
				<div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3">
					<div>
						<p className="text-muted-foreground text-xs">New signups</p>
						<div className="mt-1 flex items-baseline gap-2">
							<span className="font-semibold text-2xl tabular-nums tracking-tight">
								{formatOverviewWholeNumber(totals.signups)}
							</span>
							<span className="font-medium text-emerald-700 text-xs tabular-nums dark:text-emerald-400">
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
					<div className="ml-auto flex items-center gap-4 text-muted-foreground text-xs">
						<span className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-chart-1" />
							New users
						</span>
						<span className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-chart-3" />
							Websites
						</span>
					</div>
				</div>

				<figure>
					<ChartContainer
						config={growthChartConfig}
						className="aspect-auto h-[250px] w-full lg:h-[290px]"
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
								dataKey="label"
								axisLine={false}
								tickLine={false}
								tickMargin={10}
								minTickGap={28}
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
								content={<ChartTooltipContent indicator="dot" />}
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
				<div className="col-span-2 flex items-center gap-2 border-t px-5 py-3.5 sm:col-span-1 sm:border-t-0">
					<div className="flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground">
						<UsersRoundIcon className="size-3.5" />
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Activation</p>
						<p className="mt-0.5 font-medium text-sm tabular-nums">
							{formatOverviewPercentValue(
								totals.totalUsers > 0
									? (totals.activeUsers / totals.totalUsers) * 100
									: 0,
							)}
						</p>
					</div>
				</div>
			</div>
		</Card>
	);
}

export type { GrowthTrendCardProps };
export { GrowthTrendCard };
