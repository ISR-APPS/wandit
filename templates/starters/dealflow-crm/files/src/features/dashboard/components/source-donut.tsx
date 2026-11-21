// The donut of the source card: the new deals of the period per source, with the total in the center.
// SourceCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.1 of the kit system: a ring of 62 % to 100 %, the total and a caption in the hole.
import { Label, Pie, PieChart } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. `key` names its color variable in the chart config. */
export type SourceSlice = {
	key: string;
	label: string;
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type SourceDonutProps = {
	slices: SourceSlice[];
	/** The sum of the slices. */
	total: number;
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function SourceDonut({ slices, total }: SourceDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
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
			className="mx-auto aspect-square h-56"
			role="img"
			aria-label={`${t("dashboard.sourcesTitle")}: ${slices
				.map((slice) => `${slice.label} ${number.format(slice.value)}`)
				.join(", ")}`}
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
										{number.format(total)}
									</tspan>
									{/* 24 px under the total, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t("dashboard.newDeals")}
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
