// The donut of the product mix card: the booked amount of the quarter per product line, the total in the center.
// ProductMixCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Label, Pie, PieChart } from "recharts";
import { MONEY_OPTIONS, moneyFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. `key` names its color variable in the chart config. */
export type ProductSlice = {
	key: string;
	label: string;
	/** Booked amount in whole units of CURRENCY. */
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type ProductDonutProps = {
	slices: ProductSlice[];
	/** The sum of the slices. */
	total: number;
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function ProductDonut({ slices, total }: ProductDonutProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const compactMoney = moneyFormat(locale, { compact: true });
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
			aria-label={`${t("targets.mix.title")}: ${slices
				.map((slice) => `${slice.label} ${money.format(slice.value)}`)
				.join(", ")}`}
		>
			<PieChart>
				{total === 0 ? null : (
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent hideLabel valueFormat={MONEY_OPTIONS} />
						}
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
										{compactMoney.format(total)}
									</tspan>
									{/* 24 px under the total, so the label clears the 3xl figure. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t("targets.mix.booked")}
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
