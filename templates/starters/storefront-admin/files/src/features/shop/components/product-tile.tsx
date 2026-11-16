// A small square with the icon of a product category. It stands where a product photo goes later.
// The product table, the product dialog, the restock list, and the order lines render it.
import { cn } from "~/shared/lib/utils";
import { CATEGORY_ICONS, type ProductCategory } from "../lib/product-category";

type ProductTileProps = {
	/** The category of the product. It picks the icon. */
	category: ProductCategory;
	/** Size classes, for example "size-12". The default is size-9. */
	className?: string;
};

/** Decorative: the caller shows the product name next to it. */
export function ProductTile({ category, className }: ProductTileProps) {
	const CategoryIcon = CATEGORY_ICONS[category];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground",
				className,
			)}
		>
			<CategoryIcon className="size-1/2" />
		</span>
	);
}
