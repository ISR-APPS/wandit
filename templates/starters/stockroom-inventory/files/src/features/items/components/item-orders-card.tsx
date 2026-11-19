// The order table of the item page: every purchase order line of the item, with sort and pages.
// ItemDetailPage renders it in its Orders tab. Each number opens the order panel of the order list.
import { Link } from "@tanstack/react-router";
import { OrderStatusBadge } from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { ItemOrder } from "../api/items.queries";

// Ten rows per page, as the kit tables show.
const PAGE_SIZE = 10;

type ItemOrdersCardProps = {
	/** Every order line of the item, newest order first. */
	orders: ItemOrder[];
};

/** The row id is the order id: an order holds an item on one line only. */
export function ItemOrdersCard({ orders }: ItemOrdersCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const rows = orders.map((order) => ({ ...order, id: order.orderId }));
	const columns: RecordColumn<(typeof rows)[number]>[] = [
		{
			id: "number",
			header: t("purchaseOrders.order"),
			sortValue: (order) => order.number,
			cell: (order) => (
				<Link
					to="/app/purchase-orders"
					search={{ po: order.orderId }}
					className="font-medium tabular-nums hover:underline"
				>
					{order.number}
				</Link>
			),
		},
		{
			id: "status",
			header: t("purchaseOrders.status"),
			cell: (order) => (
				<OrderStatusBadge status={order.status} lateDays={order.lateDays} />
			),
		},
		{
			id: "expected",
			header: t("purchaseOrders.expected"),
			sortValue: (order) => order.expectedOn,
			cell: (order) => (
				<span className="whitespace-nowrap">
					{date.format(new Date(order.expectedOn))}
				</span>
			),
		},
		{
			id: "ordered",
			header: t("itemDetail.ordered"),
			align: "end",
			sortValue: (order) => order.quantityOrdered,
			cell: (order) => number.format(order.quantityOrdered),
		},
		{
			id: "received",
			header: t("purchaseOrders.received"),
			align: "end",
			sortValue: (order) => order.quantityReceived,
			cell: (order) => number.format(order.quantityReceived),
		},
	];

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("itemDetail.ordersTitle")}</CardTitle>
				<CardDescription>{t("itemDetail.ordersDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					rowMenu={(order) => (
						<DropdownMenuItem asChild>
							<Link to="/app/purchase-orders" search={{ po: order.orderId }}>
								{t("purchaseOrders.openOrder")}
							</Link>
						</DropdownMenuItem>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("itemDetail.noOrders")}
				/>
			</CardContent>
		</Card>
	);
}
