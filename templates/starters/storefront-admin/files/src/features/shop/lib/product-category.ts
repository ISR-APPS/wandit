// The product categories of the shop and the icon of each one.
// The sample catalog, the product table, the category chart, and the order lines read this file.
import {
	BowlFoodIcon,
	CookingPotIcon,
	FlameIcon,
	JarIcon,
	TowelIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";

/** Every category, in the order of the shop menu. The chart colors follow this order. */
export const PRODUCT_CATEGORIES = [
	"pantry",
	"tableware",
	"kitchen",
	"linen",
	"home",
] as const;

/** One category. Its label is the message key `products.categories.<category>`. */
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** The icon of each category. A product has no photo yet, so its tile shows this icon. */
export const CATEGORY_ICONS = {
	pantry: JarIcon,
	tableware: BowlFoodIcon,
	kitchen: CookingPotIcon,
	linen: TowelIcon,
	home: FlameIcon,
} satisfies Record<ProductCategory, KitIcon>;
