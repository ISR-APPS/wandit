// The "Recent orders" table card of the home: the orders of the period, the newest first, 8 per page.
// OverviewPage renders it at the start of the last band. RecordTable filters, sorts, and pages the rows.
// Export downloads every row of the period as CSV. The row menu opens the order or its customer.
import { ExportIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	itemsSummaryOf,
	type Order,
	orderCsvColumns,
	orderNumberOf,
} from "~/features/orders";
import {
	CustomerAvatar,
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	OrderStatusBadge,
	toCsv,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

type RecentOrdersCardProps = {
	/** The orders placed in the period, the newest first. */
	orders: Order[];
	className?: string;
};

/** The ID cell links to the order page. */
export function RecentOrdersCard({ orders, className }: RecentOrdersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);

	const columns: RecordColumn<Order>[] = [
		{
			id: "id",
			header: t("orders.id"),
			cell: (order) => (
				<Link
					to="/app/orders/$orderId"
					params={{ orderId: order.id }}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					{orderNumberOf(order.id)}
				</Link>
			),
		},
		{
			id: "customer",
			header: t("orders.customer"),
			cell: (order) => (
				<div className="flex items-center gap-3">
					<CustomerAvatar name={order.customerName} />
					<span className="whitespace-nowrap" dir="auto">
						{order.customerName}
					</span>
				</div>
			),
		},
		{
			id: "product",
			header: t("orders.product"),
			// A narrow product cell keeps the row menu inside the card at a 1440 px page width. A long name wraps.
			cell: (order) => (
				<span className="block min-w-28 max-w-36 whitespace-normal">
					{itemsSummaryOf(order, t("orders.itemsMore"), number)}
				</span>
			),
		},
		{
			id: "amount",
			header: t("orders.amount"),
			sortValue: (order) => order.total,
			cell: (order) => (
				<span className="font-medium tabular-nums">
					{money.format(order.total)}
				</span>
			),
		},
		{
			id: "status",
			header: t("orders.status"),
			cell: (order) => <OrderStatusBadge status={order.status} />,
		},
	];

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.recent.title")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						disabled={orders.length === 0}
						onClick={() =>
							downloadCsv(
								"recent-orders.csv",
								toCsv(orders, orderCsvColumns(t, locale)),
							)
						}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={orders}
					columns={columns}
					searchText={(order) =>
						`${order.id} ${order.customerName} ${order.firstProductName}`
					}
					searchPlaceholder={t("overview.recent.filter")}
					pageSize={8}
					noResults={t("orders.noResults")}
					rowMenu={(order) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/orders/$orderId" params={{ orderId: order.id }}>
									{t("orders.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link
									to="/app/customers"
									search={{ customer: order.customerId }}
								>
									{t("orders.viewCustomer")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(orderNumberOf(order.id), {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("orders.copyNumber")}
							</DropdownMenuItem>
						</>
					)}
				/>
			</CardContent>
		</Card>
	);
}
