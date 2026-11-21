// The CSV columns of a holdings export. The home "Export CSV" button and the Holdings page export the same columns.
// The callers pass them to toCsv of the ledger feature in their click handlers.
import { type CsvColumn, CURRENCY } from "~/features/ledger";
import type { TranslationKey } from "~/shared/i18n";
import type { Position } from "../api/positions.queries";

/**
 * The columns of a holdings file. Amounts and units stay plain numbers, so a spreadsheet can sum and sort them.
 * `t` is the translate function of useT().
 */
export function positionCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Position>[] {
	return [
		{ header: t("holdings.asset"), value: (row) => row.name },
		{ header: t("holdings.symbol"), value: (row) => row.symbol },
		{
			header: t("holdings.category"),
			value: (row) => t(`ledger.categories.${row.category}`),
		},
		{
			header: t("holdings.account"),
			value: (row) => t(`ledger.accounts.${row.account}`),
		},
		{ header: t("holdings.quantity"), value: (row) => String(row.quantity) },
		{
			header: `${t("holdings.price")} (${CURRENCY})`,
			value: (row) => String(row.price),
		},
		{
			header: `${t("holdings.value")} (${CURRENCY})`,
			value: (row) => row.value.toFixed(2),
		},
		{
			header: `${t("holdings.costBasis")} (${CURRENCY})`,
			value: (row) => row.costBasis.toFixed(2),
		},
		{
			header: `${t("holdings.profit")} (${CURRENCY})`,
			value: (row) => row.profit.toFixed(2),
		},
	];
}
