// The chart color of each product category.
// The category donut of the home reads it for its slices and its legend, so a slice and its legend dot match.
import type { ProductCategory } from "./product-category";

/** One chart token per category, in the order of PRODUCT_CATEGORIES. */
export const CATEGORY_COLORS = {
	pantry: "var(--chart-1)",
	tableware: "var(--chart-2)",
	kitchen: "var(--chart-3)",
	linen: "var(--chart-4)",
	home: "var(--chart-5)",
} satisfies Record<ProductCategory, string>;
