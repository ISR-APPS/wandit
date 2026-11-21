// The CSV columns of a market export. The "Export CSV" button and the "Export selected" action of Markets use them.
// The callers pass them to toCsv of the ledger feature in their click handlers.
import { type CsvColumn, CURRENCY } from "~/features/ledger";
import type { TranslationKey } from "~/shared/i18n";
import type { Asset } from "../api/assets.queries";

/** The columns of a market file. Prices and changes stay plain numbers; a change is a ratio (0.0241 is +2.41 %). */
export function assetCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Asset>[] {
	return [
		{ header: t("markets.rank"), value: (row) => String(row.rank) },
		{ header: t("markets.asset"), value: (row) => row.name },
		{ header: t("markets.symbol"), value: (row) => row.symbol },
		{
			header: t("markets.category"),
			value: (row) => t(`ledger.categories.${row.category}`),
		},
		{
			header: `${t("markets.price")} (${CURRENCY})`,
			value: (row) => String(row.price),
		},
		{ header: t("markets.change24h"), value: (row) => String(row.change24h) },
		{ header: t("markets.change7d"), value: (row) => String(row.change7d) },
		{
			header: `${t("markets.marketSize")} (${CURRENCY})`,
			value: (row) => String(Math.round(row.marketSize)),
		},
		{
			header: `${t("markets.volume")} (${CURRENCY})`,
			value: (row) => String(row.volume24h),
		},
	];
}
