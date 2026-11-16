// The panel of one customer: the contact facts, four figures, and every order of the customer.
// CustomerSheet renders it in the side sheet of the customer page.
// The orders load after the click, so the list has its own loading and error states.
import { EnvelopeSimpleIcon, MapPinIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { customerOrdersQueryOptions, orderNumberOf } from "~/features/orders";
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
import { Button } from "~/shared/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "~/shared/ui/sheet";
import { Skeleton } from "~/shared/ui/skeleton";
import type { Customer } from "../api/customers.queries";
import { SegmentBadge } from "./segment-badge";

type CustomerPanelProps = {
	/** The row of the customer list. The panel adds the orders of this customer. */
	customer: Customer;
};

// Placeholder rows of the order list. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4"];

/** The count in the title of the order list is `customer.orderCount`: the same number as the table column. */
export function CustomerPanel({ customer }: CustomerPanelProps) {
	const { t, locale } = useT();
	const orders = useQuery(customerOrdersQueryOptions(customer.id));
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dateTime = dateTimeFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	// A customer whose every order was cancelled or refunded spent nothing, so the average is 0.
	const paidOrders = orders.data?.filter((order) =>
		countsAsRevenue(order.status),
	).length;

	const facts = [
		{ label: t("customers.orders"), value: number.format(customer.orderCount) },
		{ label: t("customers.spent"), value: money.format(customer.spent) },
		{
			label: t("customers.averageOrder"),
			// The orders load after the click. The error block below explains an empty value.
			value:
				paidOrders !== undefined ? (
					money.format(paidOrders === 0 ? 0 : customer.spent / paidOrders)
				) : orders.isError ? (
					""
				) : (
					<Skeleton className="h-5 w-12" />
				),
		},
		{
			label: t("customers.since"),
			value: date.format(new Date(customer.joinedAt)),
		},
	];

	return (
		<>
			<SheetHeader className="gap-4 p-6 pe-12">
				<div className="flex items-center gap-3">
					<CustomerAvatar name={customer.name} className="size-12 text-base" />
					<div className="grid min-w-0 justify-items-start gap-1">
						<SheetTitle dir="auto">{customer.name}</SheetTitle>
						<SegmentBadge segment={customer.segment} />
					</div>
				</div>
				<SheetDescription asChild>
					<div className="grid gap-1">
						<a
							href={`mailto:${customer.email}`}
							className="flex min-h-11 items-center gap-2 text-foreground hover:underline sm:min-h-0"
						>
							<EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate">{customer.email}</span>
						</a>
						<p className="flex items-start gap-2" dir="auto">
							<MapPinIcon className="mt-0.5 size-4 shrink-0" />
							{`${customer.street}, ${customer.city}, ${customer.region} ${customer.postalCode}`}
						</p>
					</div>
				</SheetDescription>
			</SheetHeader>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y px-6 py-5 text-sm">
				{facts.map((fact) => (
					<div key={fact.label} className="grid gap-0.5">
						<dt className="text-muted-foreground">{fact.label}</dt>
						<dd className="min-h-6 font-numeric font-semibold text-base">
							{fact.value}
						</dd>
					</div>
				))}
			</dl>
			<div className="grid gap-2 p-6">
				<p className="font-medium text-sm">
					{fillMessage(t("customers.orderList"), {
						count: number.format(customer.orderCount),
					})}
				</p>
				{orders.isError ? (
					<div className="grid justify-items-start gap-3">
						<p className="text-sm" role="alert">
							{t("customers.ordersError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => orders.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : orders.data === undefined ? (
					<div className="grid gap-2">
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-11 w-full" />
						))}
					</div>
				) : (
					<ul className="grid divide-y">
						{orders.data.map((order) => (
							<li
								key={order.id}
								className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"
							>
								<div className="grid justify-items-start">
									<Link
										to="/app/orders/$orderId"
										params={{ orderId: order.id }}
										className="relative font-medium tabular-nums hover:underline max-sm:before:absolute max-sm:before:-inset-3"
									>
										{orderNumberOf(order.id)}
									</Link>
									<span className="text-muted-foreground text-xs tabular-nums">
										{dateTime.format(new Date(order.placedAt))}
									</span>
								</div>
								<div className="flex items-center gap-3">
									<span
										className={cn(
											"tabular-nums",
											!countsAsRevenue(order.status) &&
												"text-muted-foreground line-through",
										)}
									>
										{money.format(order.total)}
									</span>
									<OrderStatusBadge status={order.status} />
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</>
	);
}
