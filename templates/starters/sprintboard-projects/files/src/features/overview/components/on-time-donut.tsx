// The donut of the on-time card: the done tasks of the period per delivery class, with the chosen class lifted.
// OnTimeCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// The chosen slice grows and gets an outer ring, and the hole shows its count and its name.
import { Label, Pie, PieChart, Sector } from "recharts";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { DELIVERY_CLASSES, type DeliveryClass } from "../lib/overview-data";

/** The color of each delivery class, from the chart tokens. The Select of the card shows the same swatch. */
export const DELIVERY_COLORS = {
	early: "var(--chart-1)",
	onTime: "var(--chart-2)",
	late: "var(--chart-3)",
	veryLate: "var(--chart-4)",
} satisfies Record<DeliveryClass, string>;

type OnTimeDonutProps = {
	/** Done tasks with a due day, per delivery class. */
	counts: Record<DeliveryClass, number>;
	/** The class that the Select of the card picked. */
	active: DeliveryClass;
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function OnTimeDonut({ counts, active }: OnTimeDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = DELIVERY_CLASSES.reduce((sum, key) => sum + counts[key], 0);
	const chartConfig = Object.fromEntries(
		DELIVERY_CLASSES.map((key) => [
			key,
			{ label: t(`overview.delivery.${key}`), color: DELIVERY_COLORS[key] },
		]),
	) satisfies ChartConfig;
	const data =
		total === 0
			? [{ key: "none", value: 1, fill: "var(--muted)" }]
			: DELIVERY_CLASSES.map((key) => ({
					key,
					value: counts[key],
					fill: `var(--color-${key})`,
				}));
	const activeIndex = total === 0 ? -1 : DELIVERY_CLASSES.indexOf(active);

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square w-full max-w-60"
			role="img"
			aria-label={`${t("overview.onTimeTitle")}: ${DELIVERY_CLASSES.map(
				(key) =>
					`${t(`overview.delivery.${key}`)} ${number.format(counts[key])}`,
			).join(", ")}`}
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
					innerRadius="48%"
					outerRadius="76%"
					stroke="var(--card)"
					strokeWidth={4}
					isAnimationActive={false}
					// The chosen slice: 5 px larger, plus a thin ring 12 to 20 px outside it, as in the kit.
					shape={(props, index) =>
						index === activeIndex ? (
							<g>
								<Sector {...props} outerRadius={(props.outerRadius ?? 0) + 5} />
								<Sector
									{...props}
									innerRadius={(props.outerRadius ?? 0) + 12}
									outerRadius={(props.outerRadius ?? 0) + 20}
								/>
							</g>
						) : (
							<Sector {...props} />
						)
					}
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
										{number.format(total === 0 ? 0 : counts[active])}
									</tspan>
									{/* 24 px under the count, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t(`overview.delivery.${active}`)}
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
