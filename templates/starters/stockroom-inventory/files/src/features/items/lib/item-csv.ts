// The columns of an item CSV file: the stock report of the home and the exports of the item list.
// The home header, the low stock card, and the item list call it in their click handlers.
import type { CsvColumn } from "~/features/stock";
import type { TranslationKey } from "~/shared/i18n";
import type { StockItem } from "../api/items.queries";

/** The `t` function of useT(). */
type Translate = (key: TranslationKey) => string;

/** One line per item. Amounts are plain numbers with a dot, so a spreadsheet reads them as numbers in any language. */
export function itemCsvColumns(
	t: Translate,
	locale: string,
): CsvColumn<StockItem>[] {
	return [
		{ header: t("items.sku"), value: (item) => item.sku },
		{ header: t("items.item"), value: (item) => item.name },
		{
			header: t("items.category"),
			value: (item) => t(`categories.${item.category}`),
		},
		{ header: t("items.supplier"), value: (item) => item.supplierName },
		{ header: t("items.onHand"), value: (item) => String(item.onHand) },
		{
			header: t("items.unit"),
			value: (item) => t(`units.${item.unit}.other`),
		},
		{ header: t("items.minimum"), value: (item) => String(item.minimum) },
		{ header: t("items.unitCost"), value: (item) => item.unitCost.toFixed(2) },
		{
			header: t("items.value"),
			value: (item) => item.stockValue.toFixed(2),
		},
		{
			header: t("items.status"),
			value: (item) => t(`stockStatuses.${item.status}`),
		},
		{
			header: t("items.lastMovement"),
			value: (item) =>
				item.lastMovementAt
					? new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(
							new Date(item.lastMovementAt),
						)
					: "",
		},
	];
}
