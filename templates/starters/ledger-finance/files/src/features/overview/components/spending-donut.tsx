// The donut of the spending card: the expenses of the period per category, with the total in the center.
// SpendingCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows recipe 3.1 of the kit system: a ring of 62 % to 100 %, the total in the hole.
import { Label, Pie, PieChart } from "recharts";
import {
	centsToUnits,
	compactMoneyFormat,
	LEDGER_CURRENCY,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

/** One slice of the donut. `key` names its color variable in the chart config. */
export type SpendingSlice = {
	key: string;
	/** The translated category name. */
	label: string;
	/** In cents and positive. */
	amountCents: number;
	/** A CSS color, for example "var(--chart-1)". */
	color: string;
};

type SpendingDonutProps = {
	slices: SpendingSlice[];
	/** The sum of the slices, in cents. */
	totalCents: number;
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function SpendingDonut({ slices, totalCents }: SpendingDonutProps) {
	const { t, locale } = useT();
	const compact = compactMoneyFormat(locale);
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.key,
			{ label: slice.label, color: slice.color },
		]),
	) satisfies ChartConfig;
	const data =
		totalCents === 0
			? [{ key: "none", value: 1, fill: "var(--muted)" }]
			: slices.map((slice) => ({
					key: slice.key,
					value: centsToUnits(slice.amountCents),
					fill: `var(--color-${slice.key})`,
				}));

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square h-60"
			role="img"
			aria-label={`${t("overview.spendingTitle")}: ${slices
				.map(
					(slice) =>
						`${slice.label} ${compact.format(centsToUnits(slice.amountCents))}`,
				)
				.join(", ")}`}
		>
			<PieChart>
				{totalCents === 0 ? null : (
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideLabel
								valueFormat={{
									style: "currency",
									currency: LEDGER_CURRENCY,
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
										{compact.format(centsToUnits(totalCents))}
									</tspan>
									{/* 24 px under the total, as in the kit. */}
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + 24}
										className="fill-muted-foreground text-sm"
									>
										{t("overview.spent")}
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
