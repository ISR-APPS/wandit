// The newest purchase orders that hold this item, with their status and the quantity of the line.
// The item page renders it in its rail. Each order number opens the order panel of the order list.
// The order link covers its whole row, for a 44 px touch target.
import { Link } from "@tanstack/react-router";
import {
	formatRelativeDay,
	isOpenOrderStatus,
	OrderStatusBadge,
	type StockUnit,
	unitWord,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { ItemOrder } from "../api/items.queries";

type ItemOrdersCardProps = {
	/** Newest first, at most 6. */
	orders: ItemOrder[];
	/** The unit of the item, for the quantity words. */
	unit: StockUnit;
};

/** One row per order: number and status, then the units and the expected day or the delivery date. */
export function ItemOrdersCard({ orders, unit }: ItemOrdersCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const receivedDay = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const formatEventDay = (timestamp: string) =>
		receivedDay.format(new Date(timestamp));
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("itemDetail.orders")}</CardTitle>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("itemDetail.noOrders")}
					</p>
				) : (
					<ul className="grid divide-y">
						{orders.map((order) => (
							<li
								key={order.orderId}
								className="relative grid gap-1 py-2.5 first:pt-0 last:pb-0"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<Link
										to="/app/purchase-orders"
										search={{ po: order.orderId }}
										className="font-medium font-numeric text-sm after:absolute after:inset-0 hover:underline"
									>
										{order.number}
									</Link>
									<OrderStatusBadge
										status={order.status}
										lateDays={order.lateDays}
									/>
								</div>
								<p className="text-muted-foreground text-xs tabular-nums">
									{`${number.format(order.quantityReceived)} / ${number.format(order.quantityOrdered)} ${unitWord(order.quantityOrdered, unit, t, locale)}`}
									{isOpenOrderStatus(order.status)
										? ` · ${t("itemDetail.expected")} ${formatRelativeDay(order.expectedOn, now, locale)}`
										: order.status === "received" && order.lastReceivedAt
											? ` · ${t("itemDetail.received")} ${formatEventDay(order.lastReceivedAt)}`
											: null}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
