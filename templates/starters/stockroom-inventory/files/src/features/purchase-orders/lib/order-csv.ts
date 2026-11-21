// The columns of a purchase order CSV file: the exports of the order list and of the home order card.
// The order list and the home call it in their click handlers.
import type { CsvColumn } from "~/features/stock";
import type { TranslationKey } from "~/shared/i18n";
import type { PurchaseOrder } from "../api/purchase-orders.queries";

/** The `t` function of useT(). */
type Translate = (key: TranslationKey) => string;

/** One line per order. Amounts are plain numbers with a dot, so a spreadsheet reads them as numbers in any language. */
export function orderCsvColumns(
	t: Translate,
	locale: string,
): CsvColumn<PurchaseOrder>[] {
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
	return [
		{ header: t("purchaseOrders.order"), value: (order) => order.number },
		{
			header: t("purchaseOrders.supplier"),
			value: (order) => order.supplierName,
		},
		{
			header: t("purchaseOrders.status"),
			value: (order) => t(`orderStatuses.${order.status}`),
		},
		{
			header: t("purchaseOrders.created"),
			value: (order) => date.format(new Date(order.createdAt)),
		},
		{
			header: t("purchaseOrders.expected"),
			value: (order) => date.format(new Date(order.expectedOn)),
		},
		{
			header: t("purchaseOrders.lateDays"),
			value: (order) => String(order.lateDays),
		},
		{
			header: t("purchaseOrders.lines"),
			value: (order) => String(order.lines.length),
		},
		{
			header: t("purchaseOrders.unitsOrdered"),
			value: (order) => String(order.unitsOrdered),
		},
		{
			header: t("purchaseOrders.received"),
			value: (order) => String(order.unitsReceived),
		},
		{
			header: t("purchaseOrders.total"),
			value: (order) => order.total.toFixed(2),
		},
	];
}
