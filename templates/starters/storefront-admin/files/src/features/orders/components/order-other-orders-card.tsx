// The "Other orders" card of the order page: the last 5 other orders of the same customer, each with an Open button.
// OrderDetailPage renders it beside the items card. The header button opens the customer panel with every order.
import { Link } from "@tanstack/react-router";
import {
	dateTimeFormat,
	moneyFormat,
	OrderStatusBadge,
	ProductTile,
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
import { CaretRightIcon } from "~/shared/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { OrderDetail } from "../api/orders.queries";
import { orderNumberOf } from "../lib/order-text";

type OrderOtherOrdersCardProps = {
	/** The order of the page. The card reads its customer id and its other orders. */
	order: OrderDetail;
};

/** A first order shows one line of text: the customer has no other order yet. */
export function OrderOtherOrdersCard({ order }: OrderOtherOrdersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = dateTimeFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.otherOrders")}</CardTitle>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button asChild variant="outline" size="icon">
								<Link
									to="/app/customers"
									search={{ customer: order.customerId }}
									aria-label={t("orders.viewCustomer")}
								>
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("orders.viewCustomer")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent>
				{order.otherOrders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("orders.noOtherOrders")}
					</p>
				) : (
					<ul className="grid gap-4">
						{order.otherOrders.map((other) => (
							<li
								key={other.id}
								className="flex items-center justify-between gap-3"
							>
								<div className="flex min-w-0 items-center gap-4">
									{other.categories[0] ? (
										<ProductTile
											category={other.categories[0]}
											className="size-10"
										/>
									) : null}
									<div className="grid min-w-0 gap-0.5">
										<span className="flex flex-wrap items-center gap-2 font-medium">
											{orderNumberOf(other.id)}
											<OrderStatusBadge status={other.status} />
										</span>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{`${dateTime.format(new Date(other.placedAt))} · ${money.format(other.total)}`}
										</span>
									</div>
								</div>
								<Button asChild variant="outline" size="sm">
									<Link
										to="/app/orders/$orderId"
										params={{ orderId: other.id }}
									>
										{t("orders.open")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
