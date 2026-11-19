// The recent purchase orders card of the home: the orders created in the period, with a filter field,
// a sortable total, the status, a row menu, and pages of 8. It takes the place of the kit "recent orders" card.
// OverviewPage renders it. "Export" downloads the orders of the period as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	orderCsvColumns,
	type PurchaseOrder,
} from "~/features/purchase-orders";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	InitialsTile,
	moneyFormat,
	OrderStatusBadge,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// Eight rows keep the card as high as the low stock card beside it, as in the kit.
const PAGE_SIZE = 8;

type RecentOrdersCardProps = {
	/** The orders created in the period, newest first. */
	orders: PurchaseOrder[];
	/** The period in words, for example "30 days". */
	period: string;
	/** The grid span classes of the page. */
	className?: string;
};

/** The order number opens the order panel of the order list. */
export function RecentOrdersCard({
	orders,
	period,
	className,
}: RecentOrdersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const columns: RecordColumn<PurchaseOrder>[] = [
		{
			id: "number",
			header: t("purchaseOrders.order"),
			cell: (order) => (
				<Link
					to="/app/purchase-orders"
					search={{ po: order.id }}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					{order.number}
				</Link>
			),
		},
		{
			id: "supplier",
			header: t("purchaseOrders.supplier"),
			sortValue: (order) => order.supplierName,
			cell: (order) => (
				<span className="flex items-center gap-3">
					<InitialsTile
						name={order.supplierName}
						className="size-8 rounded-full"
					/>
					<span className="max-w-40 truncate" dir="auto">
						{order.supplierName}
					</span>
				</span>
			),
		},
		{
			id: "total",
			header: t("purchaseOrders.total"),
			align: "end",
			sortValue: (order) => order.total,
			cell: (order) => (
				<span className="font-medium">{money.format(order.total)}</span>
			),
		},
		{
			id: "status",
			header: t("purchaseOrders.status"),
			cell: (order) => (
				<OrderStatusBadge status={order.status} lateDays={order.lateDays} />
			),
		},
	];

	return (
		<Card className={cn("min-w-0", className)}>
			<CardHeader>
				<CardTitle>{t("overview.ordersTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.ordersDescription"), { period })}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"recent-purchase-orders.csv",
								toCsv(orders, orderCsvColumns(t, locale)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={orders}
					columns={columns}
					searchText={(order) => `${order.number} ${order.supplierName}`}
					searchPlaceholder={t("overview.filterOrders")}
					rowMenu={(order) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/purchase-orders" search={{ po: order.id }}>
									{t("purchaseOrders.openOrder")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(order.number, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("purchaseOrders.copyNumber")}
							</DropdownMenuItem>
						</>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("overview.noOrders")}
				/>
			</CardContent>
		</Card>
	);
}
