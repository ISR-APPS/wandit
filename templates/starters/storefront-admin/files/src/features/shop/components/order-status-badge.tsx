// The status badge of an order: a word and a color.
// The order table, the order page, the home list, and the customer panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { ORDER_STATUS_BADGE, type OrderStatus } from "../lib/order-status";

type OrderStatusBadgeProps = {
	/** The status of the order row. */
	status: OrderStatus;
};

/** The color comes from ORDER_STATUS_BADGE, so one status has one color on every page. */
export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={ORDER_STATUS_BADGE[status]}>
			{t(`orders.statuses.${status}`)}
		</Badge>
	);
}
