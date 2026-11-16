// The side panel of one supplier: contact, order terms, delivery record, its items, and its newest orders.
// The supplier page opens it from the `supplier` search param. It reads the item and order lists from the cache.
import { EnvelopeSimpleIcon, PhoneIcon, UserIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { itemsQueryOptions } from "~/features/items";
import { purchaseOrdersQueryOptions } from "~/features/purchase-orders";
import {
	moneyFormat,
	OrderStatusBadge,
	pluralForm,
	StockStatusBadge,
	unitWord,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { Supplier } from "../api/suppliers.queries";

// The panel lists the newest orders of the supplier: enough for the last weeks.
const RECENT_ORDER_COUNT = 5;
// 7 January 2024 is a Sunday. Adding the weekday number gives a date with that weekday, for its name.
const SUNDAY_REFERENCE = new Date(2024, 0, 7);

type SupplierSheetProps = {
	/** The supplier to show. null keeps the panel closed. */
	supplier: Supplier | null;
	/** Closing removes `supplier` from the URL. */
	onClose: () => void;
};

/** A controlled Sheet at the end side. It scrolls inside itself. */
export function SupplierSheet({ supplier, onClose }: SupplierSheetProps) {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(itemsQueryOptions());
	const { data: orders } = useSuspenseQuery(purchaseOrdersQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const money = moneyFormat(locale, true);
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });

	const ownItems = supplier
		? items.filter((item) => item.supplierId === supplier.id)
		: [];
	const recentOrders = supplier
		? orders
				.filter((order) => order.supplierId === supplier.id)
				.slice(0, RECENT_ORDER_COUNT)
		: [];
	const terms = supplier
		? [
				{
					label: t("suppliers.leadTime"),
					value: days.format(supplier.leadTimeDays),
				},
				{
					label: t("suppliers.orderDay"),
					value: weekday.format(
						new Date(
							SUNDAY_REFERENCE.getFullYear(),
							SUNDAY_REFERENCE.getMonth(),
							SUNDAY_REFERENCE.getDate() + supplier.orderWeekday,
						),
					),
				},
				{
					label: t("suppliers.onTimeRecord"),
					value:
						supplier.onTimeRate === null
							? t("items.none")
							: `${percent.format(supplier.onTimeRate)} · ${number.format(supplier.deliveredOrders)} ${t(`suppliers.deliveries.${pluralForm(supplier.deliveredOrders, locale)}`)}`,
				},
				{
					label: t("suppliers.averageDelay"),
					value:
						supplier.averageDelayDays === null
							? t("items.none")
							: `${decimal.format(supplier.averageDelayDays)} ${t(`suppliers.daysLate.${pluralForm(supplier.averageDelayDays, locale)}`)}`,
				},
			]
		: [];

	return (
		<Sheet
			open={supplier !== null}
			onOpenChange={(open) => (open ? null : onClose())}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
				{supplier ? (
					<>
						<SheetHeader className="gap-1.5 border-b p-6 pe-12">
							<SheetTitle className="font-display text-xl">
								{supplier.name}
							</SheetTitle>
							<SheetDescription>{supplier.city}</SheetDescription>
						</SheetHeader>
						<div className="grid gap-8 p-6">
							{/* No gap: the mail and phone links have a 44 px touch area, which already spaces the lines. */}
							<section className="grid text-sm">
								<h2 className="pb-2 font-semibold">{t("suppliers.contact")}</h2>
								<p className="flex min-h-11 items-center gap-2">
									<UserIcon className="size-4 shrink-0 text-muted-foreground" />
									{supplier.contactName}
								</p>
								{/* The icons and the underline show that the mail and the phone lines are links. */}
								<a
									href={`mailto:${supplier.email}`}
									className="inline-flex min-h-11 items-center gap-2 justify-self-start underline decoration-border underline-offset-4 hover:decoration-foreground"
								>
									<EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
									{supplier.email}
								</a>
								<a
									href={`tel:${supplier.phone.replace(/[^+\d]/g, "")}`}
									className="inline-flex min-h-11 items-center gap-2 justify-self-start tabular-nums underline decoration-border underline-offset-4 hover:decoration-foreground"
								>
									<PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
									{supplier.phone}
								</a>
							</section>
							<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
								{terms.map((term) => (
									<div key={term.label} className="grid gap-0.5">
										<dt className="text-muted-foreground">{term.label}</dt>
										<dd className="font-medium tabular-nums">{term.value}</dd>
									</div>
								))}
							</dl>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">
									{`${t("suppliers.itemsTitle")} · ${number.format(ownItems.length)}`}
								</h2>
								<ul className="grid divide-y rounded-surface border">
									{ownItems.map((item) => (
										<li
											key={item.id}
											className="relative flex items-center justify-between gap-3 px-3 py-2.5"
										>
											<div className="grid min-w-0 justify-items-start">
												<Link
													to="/app/items/$itemId"
													params={{ itemId: item.id }}
													className="max-w-full truncate font-medium text-sm after:absolute after:inset-0 hover:underline"
													dir="auto"
												>
													{item.name}
												</Link>
												<span className="text-muted-foreground text-xs tabular-nums">
													{`${number.format(item.onHand)} ${unitWord(item.onHand, item.unit, t, locale)} · ${t("items.minimum")} ${number.format(item.minimum)}`}
												</span>
											</div>
											<StockStatusBadge status={item.status} />
										</li>
									))}
								</ul>
							</section>
							<section className="grid gap-3">
								<div className="flex items-center justify-between gap-3">
									<h2 className="font-semibold text-sm">
										{t("suppliers.recentOrders")}
									</h2>
									<Link
										to="/app/purchase-orders"
										search={{ supplier: supplier.id }}
										className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
									>
										{t("suppliers.allOrders")}
									</Link>
								</div>
								{recentOrders.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{t("suppliers.noOrders")}
									</p>
								) : (
									<ul className="grid divide-y rounded-surface border">
										{recentOrders.map((order) => (
											<li
												key={order.id}
												className="relative flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
											>
												<Link
													to="/app/purchase-orders"
													search={{ po: order.id }}
													className="font-medium font-numeric text-sm after:absolute after:inset-0 hover:underline"
												>
													{order.number}
												</Link>
												<span className="flex items-center gap-3">
													<OrderStatusBadge
														status={order.status}
														lateDays={order.lateDays}
													/>
													<span className="text-sm tabular-nums">
														{money.format(order.total)}
													</span>
												</span>
											</li>
										))}
									</ul>
								)}
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
