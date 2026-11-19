// The CSV columns of an activity export. The download button of the Activity page uses them.
// The caller passes them to toCsv of the ledger feature in its click handler.
import { type CsvColumn, CURRENCY } from "~/features/ledger";
import type { TranslationKey } from "~/shared/i18n";
import type { Transaction } from "../api/transactions.queries";

/** The columns of an activity file. Times stay ISO times in UTC and amounts plain numbers, so a spreadsheet can sort and sum them. */
export function transactionCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Transaction>[] {
	return [
		{ header: t("activity.date"), value: (row) => row.occurredAt },
		{ header: t("activity.reference"), value: (row) => row.reference },
		{
			header: t("activity.type"),
			value: (row) => t(`ledger.types.${row.type}`),
		},
		{ header: t("activity.asset"), value: (row) => row.assetSymbol },
		{ header: t("activity.quantity"), value: (row) => String(row.quantity) },
		{
			header: `${t("activity.price")} (${CURRENCY})`,
			value: (row) => String(row.unitPrice),
		},
		{
			header: `${t("activity.amount")} (${CURRENCY})`,
			value: (row) => row.amount.toFixed(2),
		},
		{
			header: `${t("activity.fee")} (${CURRENCY})`,
			value: (row) => row.fee.toFixed(2),
		},
		{
			header: t("activity.account"),
			value: (row) => t(`ledger.accounts.${row.account}`),
		},
		{
			header: t("activity.status"),
			value: (row) => t(`ledger.statuses.${row.status}`),
		},
	];
}
