import { MousePointerClickIcon } from "lucide-react";
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
import { formatOverviewCompactNumber } from "@/features/overview/lib/formatters";
import type { StoryLinksResponse } from "@/features/story-links/api/story-links.dto";
import {
	formatAdminDateAxisTick,
	formatAdminDateTooltipLabel,
	getAdminDateAxis,
} from "@/lib/admin-date-range";

type StoryLinkClicksChartProps = {
	points: StoryLinksResponse["clicksByDay"];
	rangeLabel: string;
};

const clicksChartConfig = {
	clicks: {
		label: "Clicks",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function StoryLinkClicksChart({
	points,
	rangeLabel,
}: StoryLinkClicksChartProps) {
	const dateAxis = getAdminDateAxis(points.map((point) => point.date));

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2>Clicks per day</h2>
				</CardTitle>
				<CardDescription className="mt-1">
					All story-link visits · {rangeLabel.toLowerCase()}
				</CardDescription>
			</CardHeader>

			<CardContent className="px-2 pt-5 pb-6 sm:px-6">
				{points.length > 0 ? (
					<figure>
						<ChartContainer
							config={clicksChartConfig}
							className="aspect-auto h-[290px] w-full tabular-nums lg:h-[320px]"
							role="img"
							aria-label={`Daily story-link clicks for ${rangeLabel.toLowerCase()}`}
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
									dataKey="clicks"
									type="monotone"
									fill="var(--color-clicks)"
									fillOpacity={0.12}
									stroke="var(--color-clicks)"
									strokeWidth={2}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ChartContainer>
						<figcaption className="sr-only">
							The area chart shows combined clicks across all story links for
							each UTC calendar day in the selected range.
						</figcaption>
					</figure>
				) : (
					<div className="flex h-[290px] flex-col items-center justify-center gap-2 px-4 text-center lg:h-[320px]">
						<div className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<MousePointerClickIcon className="size-5" />
						</div>
						<p className="font-medium text-sm">No daily click data yet</p>
						<p className="max-w-72 text-muted-foreground text-xs">
							Share an active link to start seeing daily traffic.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export type { StoryLinkClicksChartProps };
export { StoryLinkClicksChart };
