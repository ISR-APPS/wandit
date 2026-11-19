// The customer card of the order page, in the anatomy of the kit profile card: a large avatar, the name and a badge,
// a strip of three figures, then a list of contact and delivery facts with icons.
// OrderDetailPage renders it at the top of the side column. The name opens the customer panel of the customer page.
import {
	BarcodeIcon,
	CreditCardIcon,
	EnvelopeSimpleIcon,
	MapPinIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { CustomerAvatar, moneyFormat } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { OrderDetail } from "../api/orders.queries";

type OrderCustomerCardProps = {
	/** The order of the page. The card reads its customer, its address, its payment, and its delivery. */
	order: OrderDetail;
};

/** Before the parcel leaves, the tracking row shows "No tracking number". */
export function OrderCustomerCard({ order }: OrderCustomerCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale, "whole");
	const { customer } = order;
	const isFirstOrder = customer.orderCount === 1;
	// A customer whose every order was cancelled or refunded spent nothing, so the average is 0.
	const figures = [
		{
			id: "orders",
			label: t("orders.figures.orders"),
			value: number.format(customer.orderCount),
		},
		{
			id: "spent",
			label: t("orders.figures.spent"),
			value: money.format(customer.spent),
		},
		{
			id: "average",
			label: t("orders.figures.average"),
			value: money.format(
				customer.orderCount === 0 ? 0 : customer.spent / customer.orderCount,
			),
		},
	];
	const facts: { id: string; icon: KitIcon; text: string; href?: string }[] = [
		{
			id: "email",
			icon: EnvelopeSimpleIcon,
			text: customer.email,
			href: `mailto:${customer.email}`,
		},
		{
			id: "address",
			icon: MapPinIcon,
			text: `${customer.street}, ${order.customerPlace} ${customer.postalCode}`,
		},
		{
			id: "payment",
			icon: CreditCardIcon,
			text: t(`orders.payment.${order.paymentMethod}`),
		},
		{
			id: "delivery",
			icon: TruckIcon,
			text: t(`orders.shippingLong.${order.shippingMethod}`),
		},
		{
			id: "tracking",
			icon: BarcodeIcon,
			text: order.trackingNumber ?? t("orders.noTracking"),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="flex flex-col items-center gap-4">
					<CustomerAvatar
						name={order.customerName}
						className="size-20 text-2xl"
					/>
					<div className="grid justify-items-center gap-1 text-center">
						<p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							<Link
								to="/app/customers"
								search={{ customer: order.customerId }}
								className="hover:underline"
								dir="auto"
							>
								{order.customerName}
							</Link>
							<Badge variant={isFirstOrder ? "info" : "outline"}>
								{t(isFirstOrder ? "orders.firstOrder" : "orders.returning")}
							</Badge>
						</p>
						<p className="text-muted-foreground text-sm">
							{t("orders.customerRole")}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.id} className="grid gap-0.5 py-3">
							{/* The label comes first in the markup for screen readers, and second on the screen. */}
							<dt className="order-2 text-muted-foreground text-sm">
								{figure.label}
							</dt>
							<dd className="order-1 font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li key={fact.id} className="flex items-center gap-3 text-sm">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							{fact.href ? (
								<a href={fact.href} className="truncate hover:underline">
									{fact.text}
								</a>
							) : (
								<span className="min-w-0 break-words tabular-nums">
									{fact.text}
								</span>
							)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
