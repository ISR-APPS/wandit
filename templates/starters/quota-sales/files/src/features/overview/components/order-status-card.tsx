// The order status card of the home: 4 fulfilment counts with a colored bar each, then the table of the orders.
// OverviewPage renders it in the second band, beside the top reps card. It reads the 90-day order list.
// "Export" downloads every order of the list as CSV. RecordTable filters, hides columns, and pages the rows.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { itemCountOf, ORDERS_DAYS, orderCsvColumns } from "~/features/orders";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type Order,
	type OrderStatus,
	OrderStatusBadge,
	percentFormat,
	pluralOf,
	toCsv,
} from "~/features/sales";
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
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// The 4 steps of the fulfilment. Cancelled orders show in the table with their own badge.
const SHOWN_STATUSES = ["booked", "shipped", "invoiced", "paid"] as const;

// One chart series per step. The track is a tint of the same series, so each bar reads as one color.
const STATUS_BAR = {
	booked: "bg-chart-1/20 [&>[data-slot=progress-indicator]]:bg-chart-1",
	shipped: "bg-chart-2/20 [&>[data-slot=progress-indicator]]:bg-chart-2",
	invoiced: "bg-chart-3/20 [&>[data-slot=progress-indicator]]:bg-chart-3",
	paid: "bg-success/20 [&>[data-slot=progress-indicator]]:bg-success",
} satisfies Record<(typeof SHOWN_STATUSES)[number], string>;

// 6 rows keep the card as tall as the top reps card beside it.
const HOME_PAGE_SIZE = 6;

type OrderStatusCardProps = {
	/** Every order of the last ORDERS_DAYS days, newest first, cancelled ones included. */
	orders: Order[];
};

/** Each count shows its share of all orders as a bar and a percent, so the color is never the only mark. */
export function OrderStatusCard({ orders }: OrderStatusCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = percentFormat(locale);
	const money = moneyFormat(locale);
	const counts = new Map<OrderStatus, number>();
	for (const order of orders) {
		counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
	}

	const columns: RecordColumn<Order>[] = [
		{
			id: "number",
			header: t("orders.order"),
			cell: (order) => (
				<span className="text-muted-foreground tabular-nums">
					{order.number}
				</span>
			),
		},
		{
			id: "account",
			header: t("orders.account"),
			cell: (order) => <bdi className="font-medium">{order.accountName}</bdi>,
		},
		{
			id: "items",
			header: t("orders.items"),
			hideable: true,
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
			hideable: true,
			cell: (order) => money.format(order.amount),
		},
		{
			id: "rep",
			header: t("orders.rep"),
			hideable: true,
			cell: (order) => order.repName,
		},
		{
			id: "status",
			header: t("orders.status"),
			cell: (order) => <OrderStatusBadge status={order.status} />,
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.status.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.status.description"), {
						period: dayCountFormat(locale).format(ORDERS_DAYS),
					})}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv("orders.csv", toCsv(orders, orderCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid min-w-0">
				<div className="mb-8 grid @4xl/main:grid-cols-4 grid-cols-2 gap-4">
					{SHOWN_STATUSES.map((status) => {
						const count = counts.get(status) ?? 0;
						const share = orders.length > 0 ? count / orders.length : 0;
						return (
							<div key={status} className="grid gap-2">
								<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
									{number.format(count)}
								</p>
								<p className="flex items-center gap-2 text-sm">
									<span className="text-muted-foreground">
										{t(`orderStatuses.${status}`)}
									</span>
									<span className="font-medium text-xs tabular-nums">
										{percent.format(share)}
									</span>
								</p>
								<Progress
									value={share * 100}
									aria-label={t(`orderStatuses.${status}`)}
									className={cn("h-2", STATUS_BAR[status])}
								/>
							</div>
						);
					})}
				</div>
				<RecordTable
					rows={orders}
					columns={columns}
					searchText={(order) =>
						`${order.number} ${order.accountName} ${order.repName}`
					}
					searchPlaceholder={t("orders.filter")}
					pageSize={HOME_PAGE_SIZE}
					noResults={t("orders.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
