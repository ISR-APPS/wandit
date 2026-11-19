// The purchase order card of the item page: the newest orders that hold the item, with their status,
// expected day, and ordered units, in the anatomy of the kit transaction history card.
// A footer gives the units ordered over all orders. ItemDetailPage renders it under the latest movements.
// The Orders tab lists every order.
import { Link } from "@tanstack/react-router";
import { OrderStatusBadge } from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { ItemOrder } from "../api/items.queries";

// The card shows six rows, as the kit card does. The Orders tab has the rest.
const SHOWN_ORDERS = 6;

type ItemOrderLinesCardProps = {
	/** Every order line of the item, newest order first. */
	orders: ItemOrder[];
};

/** Each order number opens the order panel of the order list. The footer total counts every order, not only the shown rows. */
export function ItemOrderLinesCard({ orders }: ItemOrderLinesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const unitsOrdered = orders.reduce(
		(sum, order) => sum + order.quantityOrdered,
		0,
	);

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("itemDetail.ordersTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("itemDetail.noOrders")}
					</p>
				) : (
					<Table>
						<TableHeader className="bg-transparent">
							<TableRow>
								<TableHead>{t("purchaseOrders.order")}</TableHead>
								<TableHead>{t("purchaseOrders.status")}</TableHead>
								<TableHead>{t("purchaseOrders.expected")}</TableHead>
								<TableHead className="text-end">
									{t("itemDetail.ordered")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{orders.slice(0, SHOWN_ORDERS).map((order) => (
								<TableRow key={order.orderId}>
									<TableCell>
										<Link
											to="/app/purchase-orders"
											search={{ po: order.orderId }}
											className="tabular-nums hover:underline"
										>
											{order.number}
										</Link>
									</TableCell>
									<TableCell>
										<OrderStatusBadge
											status={order.status}
											lateDays={order.lateDays}
										/>
									</TableCell>
									<TableCell className="text-muted-foreground tabular-nums">
										{date.format(new Date(order.expectedOn))}
									</TableCell>
									<TableCell className="text-end font-medium tabular-nums">
										{number.format(order.quantityOrdered)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
			{orders.length === 0 ? null : (
				// mt-auto keeps the total at the bottom when the card beside it is taller.
				<CardFooter className="mt-auto justify-between border-t pt-4 text-sm">
					<span className="text-muted-foreground">
						{t("purchaseOrders.unitsOrdered")}
					</span>
					<span className="font-medium tabular-nums">
						{number.format(unitsOrdered)}
					</span>
				</CardFooter>
			)}
		</Card>
	);
}
