// The chart color of each product category.
// The donut and the list of the category breakdown card read it, so a slice and its list row have one color.
import type { ProductCategory } from "~/features/shop";

/** One chart token per category, in the order of PRODUCT_CATEGORIES. */
export const CATEGORY_COLORS = {
	pantry: "var(--chart-1)",
	tableware: "var(--chart-2)",
	kitchen: "var(--chart-3)",
	linen: "var(--chart-4)",
	home: "var(--chart-5)",
} satisfies Record<ProductCategory, string>;
