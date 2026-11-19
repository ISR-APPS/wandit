// The CSV columns of a list of checks: number, table, server, covers, items, total, status, and opening time.
// The "Export" button of the home status card and the exports of the orders list call it, so both files match.
import type { TranslationKey } from "~/shared/i18n";
import type { CsvColumn } from "./csv";
import { formatClock } from "./format";
import { orderItemCount, orderSubtotalCents } from "./order-math";
import type { Order } from "./sample-orders";

/** The CSV columns of a check. `t` is the translate function of useT(); amounts stay in euros with 2 decimals. */
export function orderCsvColumns(
	t: (key: TranslationKey) => string,
	locale: string,
): CsvColumn<Order>[] {
	return [
		{ header: t("orders.check"), value: (order) => String(order.number) },
		{ header: t("orders.table"), value: (order) => order.tableName },
		{ header: t("orders.server"), value: (order) => order.serverName },
		{ header: t("orders.covers"), value: (order) => String(order.covers) },
		{
			header: t("orders.items"),
			value: (order) => String(orderItemCount(order)),
		},
		// A plain number with a dot, so every spreadsheet reads it as a number. Cents become euros here.
		{
			header: t("orders.total"),
			value: (order) => (orderSubtotalCents(order) / 100).toFixed(2),
		},
		{
			header: t("orders.status"),
			value: (order) => t(`orderStatuses.${order.status}`),
		},
		{
			header: t("orders.opened"),
			value: (order) => formatClock(order.openedAt, locale),
		},
	];
}
