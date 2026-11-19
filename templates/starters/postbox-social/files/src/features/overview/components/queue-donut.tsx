// The donut of the queue card: scheduled posts, drafts, and failed posts, with the ready share in the hole.
// QueueCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.1 of the kit system: a ring of 62 % to 100 %, a big figure and a caption in the hole.
import { Label, Pie, PieChart } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. `key` names its color variable in the chart config. */
export type QueueSlice = {
	key: string;
	/** The translated name of the slice. */
	label: string;
	/** A count of posts. */
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type QueueDonutProps = {
	slices: QueueSlice[];
	/** The figure in the hole, already formatted, for example "81%". */
	centerValue: string;
	/** The caption under the figure, already translated. */
	centerLabel: string;
	/** The screen reader text of the whole chart, already translated. */
	ariaLabel: string;
};

/** An empty queue draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function QueueDonut({
	slices,
	centerValue,
	centerLabel,
	ariaLabel,
}: QueueDonutProps) {
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.key,
			{ label: slice.label, color: slice.color },
		]),
	) satisfies ChartConfig;
	const data =
		total === 0
			? [{ key: "none", value: 1, fill: "var(--muted)" }]
			: slices.map((slice) => ({
					key: slice.key,
					value: slice.value,
					fill: `var(--color-${slice.key})`,
				}));

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square h-60"
			role="img"
			aria-label={ariaLabel}
		>
			<PieChart>
				{total === 0 ? null : (
					<ChartTooltip
						cursor={false}
						content={<ChartTooltipContent hideLabel />}
					/>
				)}
				<Pie
					data={data}
					dataKey="value"
					nameKey="key"
					innerRadius="62%"
					outerRadius="100%"
					stroke="var(--card)"
					strokeWidth={2}
					isAnimationActive={false}
				>
					<Label
						content={({ viewBox }) =>
							viewBox && "cx" in viewBox && "cy" in viewBox ? (
								<text
									x={viewBox.cx}
									y={viewBox.cy}
									textAnchor="middle"
									dominantBaseline="middle"
								>
									<tspan
										x={viewBox.cx}
										y={viewBox.cy}
										className="fill-foreground font-numeric font-semibold text-3xl"
									>
										{centerValue}
									</tspan>
									{/* 24 px under the figure, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{centerLabel}
									</tspan>
								</text>
							) : null
						}
					/>
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
