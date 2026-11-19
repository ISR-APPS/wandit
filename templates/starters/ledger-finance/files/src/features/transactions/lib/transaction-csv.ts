// The CSV columns of a transaction export. The home, the transactions page, and the account page export the same columns.
// The callers pass them to toCsv of the ledger feature in their click handlers.
import {
	type CsvColumn,
	centsToUnits,
	LEDGER_CURRENCY,
} from "~/features/ledger";
import type { TranslationKey } from "~/shared/i18n";
import type { TransactionRow } from "../api/transactions.queries";

/**
 * The columns of a transaction file. Amounts stay plain numbers in currency units and days stay `YYYY-MM-DD`,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function transactionCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<TransactionRow>[] {
	return [
		{ header: t("transactions.entryNumber"), value: (row) => row.id },
		{ header: t("transactions.date"), value: (row) => row.day },
		{ header: t("transactions.payee"), value: (row) => row.payee },
		{ header: t("transactions.memo"), value: (row) => row.memo },
		{
			header: t("transactions.type"),
			value: (row) => t(`transactionTypes.${row.type}`),
		},
		{
			header: t("transactions.category"),
			value: (row) => t(`categories.${row.categoryId}`),
		},
		{ header: t("transactions.account"), value: (row) => row.accountName },
		{
			header: t("transactions.status"),
			value: (row) => t(`transactionStatuses.${row.status}`),
		},
		{
			header: `${t("transactions.amount")} (${LEDGER_CURRENCY})`,
			value: (row) => centsToUnits(row.amountCents).toFixed(2),
		},
	];
}
