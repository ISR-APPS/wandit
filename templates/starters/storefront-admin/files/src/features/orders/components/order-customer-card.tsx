// The customer card of the order page: who ordered, how to write to them, and their other orders.
// OrderDetailPage renders it in the side column. The name opens the customer panel of the customer page.
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	CustomerAvatar,
	countsAsRevenue,
	dateTimeFormat,
	fillMessage,
	moneyFormat,
	OrderStatusBadge,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { OrderDetail } from "../api/orders.queries";
import { orderNumberOf } from "../lib/order-text";

type OrderCustomerCardProps = {
	/** The order of the page. The card reads its customer and the other orders of that customer. */
	order: OrderDetail;
};

/** The other orders link to their own pages, so the team can follow a customer from parcel to parcel. */
export function OrderCustomerCard({ order }: OrderCustomerCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dateTime = dateTimeFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.customer")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex items-center gap-3">
					<CustomerAvatar
						name={order.customerName}
						className="size-10 text-sm"
					/>
					<div className="grid min-w-0 justify-items-start">
						<Link
							to="/app/customers"
							search={{ customer: order.customerId }}
							className="relative font-medium hover:underline max-sm:before:absolute max-sm:before:-inset-3"
							dir="auto"
						>
							{order.customerName}
						</Link>
						<span className="text-muted-foreground text-xs">
							{fillMessage(
								t(
									order.customer.orderCount === 1
										? "orders.customerFirstOrder"
										: "orders.customerOrders",
								),
								{ count: number.format(order.customer.orderCount) },
							)}
						</span>
					</div>
				</div>
				<a
					href={`mailto:${order.customer.email}`}
					className="flex min-h-11 items-center gap-2 text-sm hover:underline sm:min-h-0"
				>
					<EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
					<span className="truncate">{order.customer.email}</span>
				</a>
				{order.otherOrders.length > 0 ? (
					<div className="grid gap-2 border-t pt-4">
						<p className="label-text text-muted-foreground text-xs">
							{t("orders.otherOrders")}
						</p>
						<ul className="grid">
							{order.otherOrders.map((other) => (
								<li
									key={other.id}
									className="flex min-h-11 items-center justify-between gap-2 text-sm"
								>
									<div className="grid justify-items-start">
										<Link
											to="/app/orders/$orderId"
											params={{ orderId: other.id }}
											className="relative font-medium tabular-nums hover:underline max-sm:before:absolute max-sm:before:-inset-3"
										>
											{orderNumberOf(other.id)}
										</Link>
										<span className="text-muted-foreground text-xs tabular-nums">
											{dateTime.format(new Date(other.placedAt))}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												"tabular-nums",
												!countsAsRevenue(other.status) &&
													"text-muted-foreground line-through",
											)}
										>
											{money.format(other.total)}
										</span>
										<OrderStatusBadge status={other.status} />
									</div>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
