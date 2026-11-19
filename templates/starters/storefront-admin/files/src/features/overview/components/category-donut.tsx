// The donut of the "Sales by category" card: one slice per product category, and the units sold in the center.
// CategorySalesCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the donut recipe of the kit system: a center label with the total and a caption under it.
import { Label, Pie, PieChart } from "recharts";
import {
	type BreakdownSlice,
	CATEGORY_COLORS,
	PRODUCT_CATEGORIES,
	type ProductCategory,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";

// The caption sits this many px under the center of the total.
const CAPTION_OFFSET_PX = 24;

type CategoryDonutProps = {
	/** Units sold per category. One slice for each category, also at 0. */
	slices: BreakdownSlice<ProductCategory>[];
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function CategoryDonut({ slices }: CategoryDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const config = Object.fromEntries(
		PRODUCT_CATEGORIES.map((category) => [
			category,
			{
				label: t(`products.categories.${category}`),
				color: CATEGORY_COLORS[category],
			},
		]),
	) satisfies ChartConfig;
	const data =
		total === 0
			? [{ label: "none", value: 1, fill: "var(--muted)" }]
			: slices.map((slice) => ({
					...slice,
					fill: `var(--color-${slice.label})`,
				}));

	return (
		<ChartContainer
			config={config}
			className="mx-auto aspect-square h-56"
			role="img"
			aria-label={`${t("overview.categories.title")}: ${slices
				.map(
					(slice) =>
						`${t(`products.categories.${slice.label}`)} ${number.format(slice.value)}`,
				)
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
					nameKey="label"
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
										className="fill-foreground font-numeric text-3xl"
									>
										{compact.format(total)}
									</tspan>
									<tspan
										x={viewBox.cx}
										y={(viewBox.cy ?? 0) + CAPTION_OFFSET_PX}
										className="fill-muted-foreground text-sm"
									>
										{t("overview.categories.units")}
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
