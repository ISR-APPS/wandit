// The donut of the service card: billable hours by service, with an outer arc on the chosen service.
// ServiceHoursCard loads this file with React.lazy. The center shows the hours of the chosen service.
import { Label, Pie, PieChart } from "recharts";
import type { Service } from "~/features/studio";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. */
export type ServiceDonutSlice = {
	service: Service;
	/** The translated service name. */
	label: string;
	/** Billable hours of the period. */
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type ServiceDonutProps = {
	slices: ServiceDonutSlice[];
	/** The service of the outer arc and of the center value. */
	active: Service;
	/** The formatted hours of the active service, for the center. */
	centerValue: string;
	/** The caption under the center value, for example "Hours". */
	centerCaption: string;
	/** The text of the aria-label, with every slice and its hours. */
	label: string;
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function ServiceDonut({
	slices,
	active,
	centerValue,
	centerCaption,
	label,
}: ServiceDonutProps) {
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.service,
			{ label: slice.label, color: slice.color },
		]),
	) satisfies ChartConfig;
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const data =
		total === 0
			? [{ service: "none", value: 1, fill: "var(--muted)" }]
			: slices.map((slice) => ({
					service: slice.service,
					value: slice.value,
					fill: `var(--color-${slice.service})`,
				}));
	// The arc pie has the same total as the donut, so its one visible part lines up with the active slice.
	const activeIndex = slices.findIndex((slice) => slice.service === active);
	const before = slices
		.slice(0, Math.max(activeIndex, 0))
		.reduce((sum, slice) => sum + slice.value, 0);
	const activeValue = slices[activeIndex]?.value ?? 0;
	const arc = [
		{ service: "before", value: before, fill: "transparent" },
		{ service: active, value: activeValue, fill: `var(--color-${active})` },
		{
			service: "after",
			value: total - before - activeValue,
			fill: "transparent",
		},
	];

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square w-full max-w-56"
			role="img"
			aria-label={label}
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
					nameKey="service"
					innerRadius="52%"
					outerRadius="84%"
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
									{/* 24 px under the value, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{centerCaption}
									</tspan>
								</text>
							) : null
						}
					/>
				</Pie>
				{total === 0 || activeValue === 0 ? null : (
					<Pie
						data={arc}
						dataKey="value"
						nameKey="service"
						innerRadius="90%"
						outerRadius="100%"
						stroke="none"
						isAnimationActive={false}
						tooltipType="none"
					/>
				)}
			</PieChart>
		</ChartContainer>
	);
}
