// The orders of one rep in the current quarter, in a searchable and sortable table.
// RepDetailPage renders it last, across the page. A click on an account opens OrderDialog.
import { useState } from "react";
import { OrderDialog } from "~/features/orders";
import {
	FIRST_COLUMN_WHEN_NARROW,
	fillMessage,
	moneyFormat,
	NARROW_ONLY,
	ORDER_STATUSES,
	type Order,
	OrderStatusBadge,
	pluralOf,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";

type RepOrdersCardProps = {
	/** Newest first. */
	orders: Order[];
};

/** The table pages by 20 rows. No order yet shows one sentence. */
export function RepOrdersCard({ orders }: RepOrdersCardProps) {
	const { t, locale } = useT();
	const [openOrder, setOpenOrder] = useState<Order | null>(null);
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const columns: DataTableColumn<Order>[] = [
		{
			id: "account",
			header: t("orders.account"),
			sortValue: (row) => row.accountName,
			cell: (row) => (
				<div className="flex items-start justify-between gap-3">
					<div className="grid min-w-0 justify-items-start">
						<button
							type="button"
							onClick={() => setOpenOrder(row)}
							className="text-start font-medium hover:underline"
							aria-label={fillMessage(t("orders.openOrder"), {
								number: row.number,
							})}
						>
							<bdi>{row.accountName}</bdi>
						</button>
						<span className="text-muted-foreground text-xs tabular-nums">
							{row.number}
							{/* On a narrow page the Booked column hides, so the date joins this line. */}
							<span className={NARROW_ONLY}>
								{` · ${date.format(new Date(row.bookedAt))}`}
							</span>
						</span>
					</div>
					<div
						className={cn("grid shrink-0 justify-items-end gap-1", NARROW_ONLY)}
					>
						<span className="font-medium tabular-nums">
							{money.format(row.amount)}
						</span>
						<OrderStatusBadge status={row.status} />
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: t("orders.status"),
			sortValue: (row) => ORDER_STATUSES.indexOf(row.status),
			cell: (row) => <OrderStatusBadge status={row.status} />,
		},
		{
			id: "booked",
			header: t("orders.booked"),
			sortValue: (row) => Date.parse(row.bookedAt),
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{date.format(new Date(row.bookedAt))}
				</span>
			),
		},
		{
			id: "amount",
			header: t("orders.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => (
				<span className="font-medium">{money.format(row.amount)}</span>
			),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.ordersTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(
						t(`reps.ordersCount.${pluralOf(locale, orders.length)}`),
						{
							count: number.format(orders.length),
							cancelled: number.format(
								orders.filter((order) => order.status === "cancelled").length,
							),
						},
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className={FIRST_COLUMN_WHEN_NARROW}>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reps.ordersEmpty")}
					</p>
				) : (
					<DataTable
						rows={orders}
						columns={columns}
						searchText={(row) => `${row.accountName} ${row.number}`}
						noResults={t("orders.noResults")}
					/>
				)}
			</CardContent>
			<OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} />
		</Card>
	);
}
