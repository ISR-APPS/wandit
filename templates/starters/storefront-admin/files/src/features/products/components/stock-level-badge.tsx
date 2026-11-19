// The stock badge of a product: in stock, low stock, or out of stock.
// The product table and the product dialog render it.
import { STOCK_LEVEL_BADGE, type StockLevel } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";

type StockLevelBadgeProps = {
	/** The level of the product row, from stockLevelOf. */
	level: StockLevel;
};

/** A word plus a color, never a color alone. */
export function StockLevelBadge({ level }: StockLevelBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={STOCK_LEVEL_BADGE[level]}>
			{t(`products.levels.${level}`)}
		</Badge>
	);
}
