// The donut of the stock value card: the value per family, with the compact total in the hole.
// ValueCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Label, Pie, PieChart } from "recharts";
import { moneyFormat } from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. `key` names its color variable in the chart config. */
export type ValueSlice = {
	key: string;
	label: string;
	/** Stock value, in whole units of the stock currency. */
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type ValueDonutProps = {
	slices: ValueSlice[];
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function ValueDonut({ slices }: ValueDonutProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, true);
	const compactMoney = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: money.resolvedOptions().currency,
		notation: "compact",
	});
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
			className="mx-auto aspect-square h-56"
			role="img"
			aria-label={`${t("overview.valueTitle")}: ${slices
				.map((slice) => `${slice.label} ${money.format(slice.value)}`)
				.join(", ")}`}
		>
			<PieChart>
				{total === 0 ? null : (
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideLabel
								// Whole amounts in the stock currency, as the legend shows them.
								valueFormat={{
									style: "currency",
									currency: money.resolvedOptions().currency,
									maximumFractionDigits: 0,
								}}
							/>
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
									{/* 24 px under the total, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t("overview.onShelves")}
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
