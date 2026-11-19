// The donut of the readiness card: the content of the next 14 days by stage, with the ready share in the center.
// ContentReadinessCard loads this file with React.lazy, so the chart library stays out of the first script.
// A ring of 62 % to 100 %, the percent and a caption in the hole.
import { Label, Pie, PieChart } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. `key` names its color variable in the chart config. */
export type ReadinessSlice = {
	key: string;
	label: string;
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type ReadinessDonutProps = {
	slices: ReadinessSlice[];
	/** The ready share as a ratio: 0.88 shows "88%". null when no item is planned. */
	readyShare: number | null;
};

/** No item draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function ReadinessDonut({ slices, readyShare }: ReadinessDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.key,
			{ label: slice.label, color: slice.color },
		]),
	) satisfies ChartConfig;
	const isEmpty = readyShare === null;
	const data = isEmpty
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
			aria-label={`${t("overview.readinessTitle")}: ${slices
				.map((slice) => `${slice.label} ${number.format(slice.value)}`)
				.join(", ")}`}
		>
			<PieChart>
				{isEmpty ? null : (
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
					strokeWidth={4}
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
										{isEmpty ? "–" : percent.format(readyShare)}
									</tspan>
									{/* 24 px under the percent, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t("overview.ready")}
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
