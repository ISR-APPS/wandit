// The badges of a purchase order: its status, and a red "late" badge when the expected day has passed.
// The order list, the order panel, the item page, and the home rail render it.
// The caller computes lateDays with lateDaysOf, so every page counts late days the same way.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	PURCHASE_ORDER_STATUS_BADGE,
	type PurchaseOrderStatus,
} from "../lib/statuses";

type OrderStatusBadgeProps = {
	status: PurchaseOrderStatus;
	/** Full days after the expected day for an open order. 0 for an order on time or closed. */
	lateDays: number;
};

/** The status badge, then the late badge with its count of days. */
export function OrderStatusBadge({ status, lateDays }: OrderStatusBadgeProps) {
	const { t, locale } = useT();
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
	});
	return (
		<span className="inline-flex flex-wrap items-center gap-1">
			<Badge variant={PURCHASE_ORDER_STATUS_BADGE[status]}>
				{t(`orderStatuses.${status}`)}
			</Badge>
			{lateDays > 0 ? (
				<Badge variant="destructive">
					{t("purchaseOrders.late")}
					<span className="tabular-nums">{days.format(lateDays)}</span>
				</Badge>
			) : null}
		</span>
	);
}
