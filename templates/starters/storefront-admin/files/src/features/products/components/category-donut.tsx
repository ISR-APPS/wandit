// The donut of the category breakdown card: one slice for each product category.
// CategoryBreakdownCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// It follows the donut of the chart form "area" of the app-dashboard skill.
import { Pie, PieChart } from "recharts";
import {
	type BreakdownSlice,
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
import { CATEGORY_COLORS } from "../lib/category-colors";

type CategoryDonutProps = {
	/** Units sold per category. One slice for each category, also at 0. */
	slices: BreakdownSlice<ProductCategory>[];
};

/** A total of 0 draws one muted ring with no tooltip, because recharts draws no sector for a sum of 0. */
export function CategoryDonut({ slices }: CategoryDonutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const chartConfig = Object.fromEntries(
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
			config={chartConfig}
			className="aspect-square h-44"
			role="img"
			aria-label={`${t("products.byCategory")}: ${slices
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
				/>
			</PieChart>
		</ChartContainer>
	);
}
