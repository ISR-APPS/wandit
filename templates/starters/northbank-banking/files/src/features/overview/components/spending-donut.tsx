// The donut of the spending card: the money out of the period by category, with the total in the hole.
// SpendingCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
import { Label, Pie, PieChart } from "recharts";
import { BANK_CURRENCY, compactMoneyFormat } from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice, already translated. `key` names its color variable in the chart config. */
export type SpendingDonutSlice = {
	key: string;
	label: string;
	/** Currency units, not cents. */
	value: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type SpendingDonutProps = {
	slices: SpendingDonutSlice[];
	/** The sum of the slices, in currency units. */
	total: number;
	/** The title of the card, for the aria-label. */
	title: string;
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function SpendingDonut({ slices, total, title }: SpendingDonutProps) {
	const { locale } = useT();
	const compact = compactMoneyFormat(locale);
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
			aria-label={`${title}: ${slices
				.map((slice) => `${slice.label} ${compact.format(slice.value)}`)
				.join(", ")}`}
		>
			<PieChart>
				{total === 0 ? null : (
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideLabel
								valueFormat={{
									style: "currency",
									currency: BANK_CURRENCY,
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
									className="fill-foreground font-numeric font-semibold text-3xl"
								>
									{compact.format(total)}
								</text>
							) : null
						}
					/>
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
