// The largest orders card of the rep page: a plain table of the 6 largest orders of the quarter.
// The latest orders card above shows the newest orders, so this card ranks by amount instead.
// RepDetailPage renders it in the end column, beside the accounts card. The Orders tab holds the full list.
import { moneyFormat, type Order, OrderStatusBadge } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// 6 rows keep the card as tall as the top accounts card beside it.
const SHOWN_ORDERS = 6;

type RepLargestOrdersCardProps = {
	/** The orders of the quarter, newest first, cancelled ones included. */
	orders: Order[];
};

/** Cancelled orders are not bookings, so the ranking leaves them out. No order shows one sentence. */
export function RepLargestOrdersCard({ orders }: RepLargestOrdersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const largest = orders
		.filter((order) => order.status !== "cancelled")
		.sort((first, second) => second.amount - first.amount)
		.slice(0, SHOWN_ORDERS);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reps.largestTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="min-w-0">
				{largest.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reps.ordersEmpty")}
					</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("orders.account")}</TableHead>
									<TableHead>{t("orders.status")}</TableHead>
									<TableHead className="text-end">
										{t("orders.amount")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{largest.map((order) => (
									<TableRow key={order.id}>
										{/* A long account name wraps, so the full name stays readable. */}
										<TableCell className="whitespace-normal">
											<bdi>{order.accountName}</bdi>
										</TableCell>
										<TableCell>
											<OrderStatusBadge status={order.status} />
										</TableCell>
										<TableCell className="text-end font-medium tabular-nums">
											{money.format(order.amount)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
