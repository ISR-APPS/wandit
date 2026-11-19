// The "Sales by category" card of the home: a donut of the units sold per category, then a legend of dots.
// OverviewPage renders it in the middle of the third band. The donut file loads with React.lazy.
import { lazy, Suspense } from "react";
import {
	type BreakdownSlice,
	CATEGORY_COLORS,
	type ProductCategory,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

const CategoryDonut = lazy(() =>
	import("./category-donut").then((module) => ({
		default: module.CategoryDonut,
	})),
);

type CategorySalesCardProps = {
	/** Units sold per category in the period, in the order of PRODUCT_CATEGORIES. */
	slices: BreakdownSlice<ProductCategory>[];
	className?: string;
};

/** The legend names every category, so a slice is never told by its color alone. */
export function CategorySalesCard({
	slices,
	className,
}: CategorySalesCardProps) {
	const { t } = useT();
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.categories.title")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<CategoryDonut slices={slices} />
				</Suspense>
				<ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
					{slices.map((slice) => (
						<li key={slice.label} className="flex items-center gap-1.5 text-xs">
							<span
								aria-hidden="true"
								className="size-2 rounded-full"
								style={{ backgroundColor: CATEGORY_COLORS[slice.label] }}
							/>
							{t(`products.categories.${slice.label}`)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
