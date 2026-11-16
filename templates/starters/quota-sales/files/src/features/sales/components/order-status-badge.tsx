// The badge of an order status: Booked, Shipped, Invoiced, Paid, or Cancelled.
// The order tables of the home, the orders page, the rep page, and the order dialog show it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { ORDER_STATUS_BADGE, type OrderStatus } from "../lib/order-status";

type OrderStatusBadgeProps = {
	status: OrderStatus;
};

/** A word plus a color, never a color alone. */
export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge
			variant={ORDER_STATUS_BADGE[status]}
			// The destructive variant is solid red. This gives it the tinted look of the other statuses.
			className={cn(
				status === "cancelled" &&
					"border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12",
			)}
		>
			{t(`orderStatuses.${status}`)}
		</Badge>
	);
}
