// The badge of a stock level: in stock, low, or out of stock.
// The item list, the item page, the home rail, and the supplier panel render it.
// The variant map of statuses.ts gives the color; the word gives the meaning.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { STOCK_STATUS_BADGE, type StockStatus } from "../lib/statuses";

type StockStatusBadgeProps = {
	/** The level from stockStatusOf(onHand, minimum). */
	status: StockStatus;
};

/** A word plus a color, never a color alone. */
export function StockStatusBadge({ status }: StockStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={STOCK_STATUS_BADGE[status]}>
			{t(`stockStatuses.${status}`)}
		</Badge>
	);
}
