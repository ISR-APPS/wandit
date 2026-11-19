// The CSV columns of an order export: number, date, customer, email, items, delivery, status, and total.
// The home "Export CSV" button, the recent orders card, and the order list call it, so every export has one layout.
import type { CsvColumn } from "~/features/shop";
import type { TranslationKey } from "~/shared/i18n";
import type { Order } from "../api/orders.queries";

/** Columns of toCsv for orders. `t` and `locale` come from useT(). The total stays a plain number for spreadsheets. */
export function orderCsvColumns(
	t: (key: TranslationKey) => string,
	locale: string,
): CsvColumn<Order>[] {
	const date = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return [
		{ header: t("orders.order"), value: (order) => order.id },
		{
			header: t("orders.placed"),
			value: (order) => date.format(new Date(order.placedAt)),
		},
		{ header: t("orders.customer"), value: (order) => order.customerName },
		{ header: t("orders.email"), value: (order) => order.customerEmail },
		{ header: t("orders.units"), value: (order) => String(order.unitCount) },
		{
			header: t("orders.delivery"),
			value: (order) => t(`orders.shipping.${order.shippingMethod}`),
		},
		{
			header: t("orders.status"),
			value: (order) => t(`orders.statuses.${order.status}`),
		},
		{ header: t("orders.total"), value: (order) => String(order.total) },
	];
}
