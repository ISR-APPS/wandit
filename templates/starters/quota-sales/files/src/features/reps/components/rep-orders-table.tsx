// The Orders tab of the rep page: every order of the quarter in a table card with filter, sort, and pages.
// RepDetailPage renders it when the Orders tab is open. The order number opens the order dialog of the page.
import { itemCountOf } from "~/features/orders";
import {
	fillMessage,
	moneyFormat,
	ORDER_STATUSES,
	type Order,
	OrderStatusBadge,
	pluralOf,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// A list in a tab shows 10 rows, as the Orders and Reps pages.
const PAGE_SIZE = 10;

type RepOrdersTableProps = {
	/** The orders of the quarter, newest first, cancelled ones included. */
	orders: Order[];
	/** "Q4 2026". */
	quarterLabel: string;
	/** Opens the order dialog of the page. */
	onOpenOrder: (order: Order) => void;
};

/** The table card of the tab. */
export function RepOrdersTable({
	orders,
	quarterLabel,
	onOpenOrder,
}: RepOrdersTableProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const columns: RecordColumn<Order>[] = [
		{
			id: "number",
			header: t("orders.order"),
			cell: (order) => (
				<button
					type="button"
					onClick={() => onOpenOrder(order)}
					className="text-muted-foreground tabular-nums hover:text-primary hover:underline"
				>
					{order.number}
				</button>
			),
		},
		{
			id: "account",
			header: t("orders.account"),
			cell: (order) => <bdi className="font-medium">{order.accountName}</bdi>,
		},
		{
			id: "booked",
			header: t("orders.booked"),
			hideable: true,
			sortValue: (order) => order.bookedAt,
			cell: (order) => date.format(new Date(order.bookedAt)),
		},
		{
			id: "items",
			header: t("orders.items"),
			hideable: true,
			sortValue: (order) => itemCountOf(order),
			cell: (order) => {
				const count = itemCountOf(order);
				return fillMessage(t(`orders.itemCount.${pluralOf(locale, count)}`), {
					count: number.format(count),
				});
			},
		},
		{
			id: "amount",
			header: t("orders.amount"),
			align: "end",
			sortValue: (order) => order.amount,
			cell: (order) => money.format(order.amount),
		},
		{
			id: "status",
			header: t("orders.status"),
			sortValue: (order) => ORDER_STATUSES.indexOf(order.status),
			cell: (order) => <OrderStatusBadge status={order.status} />,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.ordersTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("reps.ordersDescription"), { quarter: quarterLabel })}
				</CardDescription>
			</CardHeader>
			<CardContent className="min-w-0">
				<RecordTable
					rows={orders}
					columns={columns}
					searchText={(order) => `${order.number} ${order.accountName}`}
					searchPlaceholder={t("orders.filter")}
					pageSize={PAGE_SIZE}
					noResults={t("orders.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
