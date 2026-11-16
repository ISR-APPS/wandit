// The breakdown card of the product page: the units sold per category as a donut, with the total in its hole.
// ProductsPage renders it with the sums of the product list, so its total equals the sum of the "Sold" column.
// CategoryDonut draws the donut. The card follows the breakdown part of the chart form "area" of the app-dashboard skill.
import { lazy, Suspense } from "react";
import {
	type BreakdownSlice,
	dayCountFormat,
	fillMessage,
	type ProductCategory,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { SALES_DAYS } from "../api/products.queries";
import { CATEGORY_COLORS } from "../lib/category-colors";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const CategoryDonut = lazy(() =>
	import("./category-donut").then((module) => ({
		default: module.CategoryDonut,
	})),
);

type CategoryBreakdownCardProps = {
	/** Units sold per category in the last SALES_DAYS days. One slice for each category, also at 0. */
	slices: BreakdownSlice<ProductCategory>[];
};

/** The total in the hole is the sum of the slices. The list under the donut gives each value as text. */
export function CategoryBreakdownCard({ slices }: CategoryBreakdownCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("products.byCategory")}</CardTitle>
				<CardDescription>
					{fillMessage(t("products.lastDays"), {
						days: dayCountFormat(locale).format(SALES_DAYS),
					})}
				</CardDescription>
			</CardHeader>
			{/* A wide card puts the list beside the donut. A narrow card puts it under the donut. */}
			<CardContent className="@container/breakdown flex-1">
				<div className="grid @md/breakdown:grid-cols-[auto_minmax(0,1fr)] grid-cols-1 items-center @md/breakdown:gap-10 gap-5">
					<div className="relative mx-auto h-44 w-44">
						{/* The chart script loads after the page. The placeholder has the size of the donut. */}
						<Suspense fallback={<Skeleton className="size-44 rounded-full" />}>
							<CategoryDonut slices={slices} />
						</Suspense>
						<div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
							<span className="font-numeric font-semibold text-3xl">
								{number.format(total)}
							</span>
							<span className="text-muted-foreground text-xs">
								{t("products.unitsSold")}
							</span>
						</div>
					</div>
					<ul className="grid @md/breakdown:grid-cols-1 grid-cols-2 gap-x-6 @md/breakdown:gap-y-3 gap-y-2 text-sm">
						{slices.map((slice) => (
							<li key={slice.label} className="flex items-center gap-2">
								<span
									aria-hidden="true"
									className="size-2.5 shrink-0 rounded-badge"
									style={{ backgroundColor: CATEGORY_COLORS[slice.label] }}
								/>
								<span className="truncate text-muted-foreground">
									{t(`products.categories.${slice.label}`)}
								</span>
								<span className="ms-auto font-medium tabular-nums">
									{number.format(slice.value)}
								</span>
							</li>
						))}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}
