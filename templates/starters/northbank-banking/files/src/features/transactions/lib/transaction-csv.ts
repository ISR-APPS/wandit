// The CSV columns of an entry export. The home and the transactions page export the same columns.
// The callers pass them to toCsv of ~/features/bank in their click handlers.
import {
	accountOf,
	BANK_CURRENCY,
	type CsvColumn,
	centsToUnits,
	type Transaction,
} from "~/features/bank";
import type { TranslationKey } from "~/shared/i18n";

/**
 * The columns of an entry file. The amount stays a plain number with a sign and the day stays `YYYY-MM-DD`,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function transactionCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Transaction>[] {
	return [
		{ header: t("entries.date"), value: (row) => row.day },
		{
			header: t("entries.account"),
			value: (row) =>
				`${t(`accounts.${row.accountId}`)} ••${accountOf(row.accountId).numberEnding}`,
		},
		{ header: t("entries.party"), value: (row) => row.counterparty },
		{ header: t("entries.memo"), value: (row) => row.memo },
		{
			header: t("entries.category"),
			value: (row) => t(`categories.${row.category}`),
		},
		{ header: t("entries.method"), value: (row) => t(`methods.${row.method}`) },
		{
			header: t("entries.status"),
			value: (row) => t(`statuses.${row.status}`),
		},
		{
			header: `${t("entries.amount")} (${BANK_CURRENCY})`,
			value: (row) => centsToUnits(row.amountCents).toFixed(2),
		},
		{ header: t("entries.reference"), value: (row) => row.reference },
	];
}
