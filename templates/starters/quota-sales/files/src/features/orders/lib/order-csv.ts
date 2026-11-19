// The CSV columns of an order export: number, booking date, account, rep, territory, items, amount, status.
// The orders page (Export and Export selected) and the order status card of the home call it.
// toCsv of the sales feature quotes each cell; this file only picks and formats the values.
import { type CsvColumn, CURRENCY, type Order } from "~/features/sales";
import type { useT } from "~/shared/i18n";

/** The quantity of every line of the order: "3 terminals + 4 licenses" counts as 7 items. */
export function itemCountOf(order: Order): number {
	return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** The columns of the file. The amount stays a plain number, so a spreadsheet can sum it. */
export function orderCsvColumns(
	t: ReturnType<typeof useT>["t"],
): CsvColumn<Order>[] {
	return [
		{ header: t("orders.order"), value: (order) => order.number },
		// en-CA writes YYYY-MM-DD in the local time zone. ISO dates sort the same in every spreadsheet language.
		{
			header: t("orders.booked"),
			value: (order) => new Date(order.bookedAt).toLocaleDateString("en-CA"),
		},
		{ header: t("orders.account"), value: (order) => order.accountName },
		{ header: t("orders.rep"), value: (order) => order.repName },
		{ header: t("reps.territory"), value: (order) => order.territoryName },
		{ header: t("orders.items"), value: (order) => String(itemCountOf(order)) },
		{
			header: `${t("orders.amount")} (${CURRENCY})`,
			value: (order) => String(order.amount),
		},
		{
			header: t("orders.status"),
			value: (order) => t(`orderStatuses.${order.status}`),
		},
	];
}
