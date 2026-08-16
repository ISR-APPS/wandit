import type { AdminAnalyticsConsumptionBucketPoint } from "@wandit/contracts";
import { CoinsIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
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
import { mapConsumptionChartData } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewCompactNumber,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type CreditConsumptionCardProps = {
	buckets: AdminAnalyticsConsumptionBucketPoint[];
};

const consumptionChartConfig = {
	users: {
		label: "Free users",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function CreditConsumptionCard({ buckets }: CreditConsumptionCardProps) {
	const chartData = mapConsumptionChartData(buckets);
	const freeUsers = chartData.reduce((total, point) => total + point.users, 0);
	const hasConsumption = freeUsers > 0;

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Free-user consumption</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Users grouped by all-time credits consumed
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						All-time cohort
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				<div className="mb-4 flex items-end justify-between gap-4 px-2 sm:px-0">
					<div>
						<div className="flex items-center gap-1">
							<p className="text-muted-foreground text-xs">
								Free users represented
							</p>
							<MetricInfoTooltip
								label="Free users represented"
								content="Free users shown in this chart, grouped by all the credits they have used so far. The selected date range does not change this number."
							/>
						</div>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatOverviewWholeNumber(freeUsers)}
						</p>
					</div>
					<div className="flex items-center gap-1.5 pb-1 text-muted-foreground text-xs">
						<span className="size-2 rounded-sm bg-chart-1" />
						Free users
					</div>
				</div>

				{hasConsumption ? (
					<figure>
						<ChartContainer
							config={consumptionChartConfig}
							className="aspect-auto h-[250px] w-full tabular-nums"
							role="img"
							aria-label="Free users grouped by their all-time credit consumption"
						>
							<BarChart
								accessibilityLayer
								data={chartData}
								margin={{ left: 0, right: 4, top: 8 }}
							>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis
									dataKey="label"
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									interval={0}
									tickFormatter={(value) =>
										String(value).replace(" credits", "")
									}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									tickMargin={8}
									allowDecimals={false}
									width={38}
									tickFormatter={(value) =>
										formatOverviewCompactNumber(Number(value))
									}
								/>
								<ChartTooltip
									cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
									content={<ChartTooltipContent indicator="line" />}
								/>
								<Bar
									dataKey="users"
									fill="var(--color-users)"
									radius={[4, 4, 0, 0]}
									maxBarSize={56}
									isAnimationActive={false}
								/>
							</BarChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The histogram shows how many free users fall into each all-time
							credit-consumption bucket.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[250px] flex-col items-center justify-center px-6 text-center">
						<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<CoinsIcon className="size-5" />
						</span>
						<p className="mt-3 font-medium text-sm">
							No free-user consumption yet
						</p>
						<p className="mt-1 max-w-sm text-muted-foreground text-xs">
							Credit-consumption buckets will appear after free users spend
							their grant.
						</p>
					</div>
				)}
			</CardContent>

			<div className="border-t bg-muted/20 px-6 py-3 text-muted-foreground text-xs">
				This cohort is all time; the range selector applies to credit movement
				above.
			</div>
		</Card>
	);
}

export type { CreditConsumptionCardProps };
export { CreditConsumptionCard };
