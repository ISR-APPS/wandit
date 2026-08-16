import type {
	AdminAnalyticsArpuByPlan,
	AdminAnalyticsMrrByPlan,
} from "@wandit/contracts";
import { BadgeDollarSignIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

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
import { calculatePercentage } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewRoundedUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type MrrBreakdownCardProps = {
	arpuByPlan: AdminAnalyticsArpuByPlan[];
	items: AdminAnalyticsMrrByPlan[];
};

type MrrSegmentKey = "proMonth" | "proYear" | "businessMonth" | "businessYear";

type MrrChartSegment = {
	key: MrrSegmentKey;
	plan: AdminAnalyticsMrrByPlan["plan"];
	interval: AdminAnalyticsMrrByPlan["interval"];
	label: string;
	subscribers: number;
	mrrMinor: number;
	fill: string;
	legendColor: string;
};

const mrrSegmentDefinitions: Array<
	Pick<
		MrrChartSegment,
		"key" | "plan" | "interval" | "label" | "fill" | "legendColor"
	>
> = [
	{
		key: "proMonth",
		plan: "pro",
		interval: "month",
		label: "Pro · monthly",
		fill: "var(--color-proMonth)",
		legendColor: "var(--chart-1)",
	},
	{
		key: "proYear",
		plan: "pro",
		interval: "year",
		label: "Pro · annual",
		fill: "var(--color-proYear)",
		legendColor: "var(--chart-2)",
	},
	{
		key: "businessMonth",
		plan: "business",
		interval: "month",
		label: "Business · monthly",
		fill: "var(--color-businessMonth)",
		legendColor: "var(--chart-3)",
	},
	{
		key: "businessYear",
		plan: "business",
		interval: "year",
		label: "Business · annual",
		fill: "var(--color-businessYear)",
		legendColor: "var(--chart-4)",
	},
];

const mrrChartConfig = {
	proMonth: { label: "Pro · monthly", color: "var(--chart-1)" },
	proYear: { label: "Pro · annual", color: "var(--chart-2)" },
	businessMonth: { label: "Business · monthly", color: "var(--chart-3)" },
	businessYear: { label: "Business · annual", color: "var(--chart-4)" },
} satisfies ChartConfig;

function mapMrrSegments(items: AdminAnalyticsMrrByPlan[]): MrrChartSegment[] {
	return mrrSegmentDefinitions.map((definition) => {
		const matchingItems = items.filter(
			(item) =>
				item.plan === definition.plan && item.interval === definition.interval,
		);

		return {
			...definition,
			subscribers: matchingItems.reduce(
				(total, item) => total + item.subscribers,
				0,
			),
			mrrMinor: matchingItems.reduce((total, item) => total + item.mrrMinor, 0),
		};
	});
}

function MrrBreakdownCard({ arpuByPlan, items }: MrrBreakdownCardProps) {
	const segments = mapMrrSegments(items);
	const totalMrrMinor = segments.reduce(
		(total, segment) => total + segment.mrrMinor,
		0,
	);
	const totalSubscribers = segments.reduce(
		(total, segment) => total + segment.subscribers,
		0,
	);
	const proArpuCents =
		arpuByPlan.find((item) => item.plan === "pro")?.arpuCents ?? 0;
	const businessArpuCents =
		arpuByPlan.find((item) => item.plan === "business")?.arpuCents ?? 0;
	const hasMrr = totalMrrMinor > 0;

	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>MRR by plan</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Annual plans normalized to a monthly value
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0">
						List price
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col pt-5 pb-6">
				{hasMrr ? (
					<figure>
						<div className="relative mx-auto max-w-[260px]">
							<ChartContainer
								config={mrrChartConfig}
								className="aspect-auto h-[220px] w-full tabular-nums"
								role="img"
								aria-label="Monthly recurring revenue by plan and billing interval"
							>
								<PieChart accessibilityLayer>
									<ChartTooltip
										cursor={false}
										content={
											<ChartTooltipContent
												hideLabel
												formatter={(value, _name, item) => {
													const segment = item.payload as MrrChartSegment;

													return (
														<div className="flex min-w-44 items-center gap-2">
															<span
																className="size-2 rounded-[2px]"
																style={{ backgroundColor: segment.fill }}
															/>
															<span className="flex-1 text-muted-foreground">
																{segment.label}
															</span>
															<span className="font-medium font-mono tabular-nums">
																{formatOverviewRoundedUsdMinor(Number(value))}
															</span>
														</div>
													);
												}}
											/>
										}
									/>
									<Pie
										data={segments}
										dataKey="mrrMinor"
										nameKey="key"
										innerRadius={68}
										outerRadius={92}
										paddingAngle={2}
										strokeWidth={0}
										isAnimationActive={false}
									>
										{segments.map((segment) => (
											<Cell key={segment.key} fill={segment.fill} />
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
								<span className="font-semibold text-xl tabular-nums tracking-tight">
									{formatOverviewRoundedUsdMinor(totalMrrMinor)}
								</span>
								<span className="mt-0.5 text-[11px] text-muted-foreground">
									monthly
								</span>
							</div>
						</div>
						<figcaption className="sr-only">
							The donut chart splits list-price MRR across Pro and Business
							monthly and annual subscriptions.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<BadgeDollarSignIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">No live subscription MRR yet</p>
						<p className="max-w-64 text-muted-foreground text-xs">
							Plan and billing interval shares will appear here.
						</p>
					</div>
				)}

				<div className="mt-2 flex flex-col gap-3 border-t pt-5">
					{segments.map((segment) => (
						<div key={segment.key} className="flex items-center gap-2.5">
							<span
								className="size-2 shrink-0 rounded-[2px]"
								style={{ backgroundColor: segment.legendColor }}
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-3 text-xs">
									<span className="font-medium leading-4">{segment.label}</span>
									<span className="shrink-0 font-mono tabular-nums">
										{formatOverviewRoundedUsdMinor(segment.mrrMinor)}
									</span>
								</div>
								<div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
									<span className="tabular-nums">
										{formatOverviewWholeNumber(segment.subscribers)} subscribers
									</span>
									<span className="tabular-nums">
										{formatOverviewPercentValue(
											calculatePercentage(segment.mrrMinor, totalMrrMinor),
										)}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>

			<div className="overflow-hidden border-t bg-muted/20">
				<div className="-mr-px -mb-px grid grid-cols-2">
					<div className="border-r border-b px-5 py-3.5">
						<p className="flex items-center gap-1 text-muted-foreground text-xs">
							Active subscribers
							<MetricInfoTooltip
								label="Active subscribers"
								content="Subscriptions that are active now, across all paid plans."
							/>
						</p>
						<p className="mt-1 font-medium tabular-nums">
							{formatOverviewWholeNumber(totalSubscribers)}
						</p>
					</div>
					<div className="border-r border-b px-5 py-3.5">
						<p className="flex items-center gap-1 text-muted-foreground text-xs">
							List-price MRR
							<MetricInfoTooltip
								label="List-price MRR"
								content="Monthly recurring revenue at list price. Yearly plans are counted as their price divided by 12. Discounts are not subtracted."
							/>
						</p>
						<p className="mt-1 font-medium tabular-nums">
							{formatOverviewRoundedUsdMinor(totalMrrMinor)}
						</p>
					</div>
					<div className="border-r border-b px-5 py-3.5">
						<p className="flex items-center gap-1 text-muted-foreground text-xs">
							Pro ARPU
							<MetricInfoTooltip
								label="Pro ARPU"
								content="Pro list-price MRR divided by distinct billing owners on the Pro plan."
							/>
						</p>
						<p className="mt-1 font-medium tabular-nums">
							{formatOverviewRoundedUsdMinor(proArpuCents)}
						</p>
					</div>
					<div className="border-r border-b px-5 py-3.5">
						<p className="flex items-center gap-1 text-muted-foreground text-xs">
							Business ARPU
							<MetricInfoTooltip
								label="Business ARPU"
								content="Business list-price MRR divided by distinct billing owners on the Business plan."
							/>
						</p>
						<p className="mt-1 font-medium tabular-nums">
							{formatOverviewRoundedUsdMinor(businessArpuCents)}
						</p>
					</div>
				</div>
			</div>
		</Card>
	);
}

export type { MrrBreakdownCardProps };
export { MrrBreakdownCard };
