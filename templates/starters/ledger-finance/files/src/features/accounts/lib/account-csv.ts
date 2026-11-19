// The CSV columns of an account export. The accounts page uses them for the full list and for the selected rows.
// The callers pass them to toCsv of the ledger feature in their click handlers.
import {
	type CsvColumn,
	centsToUnits,
	LEDGER_CURRENCY,
} from "~/features/ledger";
import type { TranslationKey } from "~/shared/i18n";
import type { AccountSummary } from "./account-summary";

/** Amounts stay plain numbers in currency units, so a spreadsheet can sum them. `t` is the translate function of useT(). */
export function accountCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<AccountSummary>[] {
	return [
		{ header: t("accounts.name"), value: (account) => account.name },
		{
			header: t("accounts.type"),
			value: (account) => t(`accountTypes.${account.type}`),
		},
		{
			header: t("accounts.institution"),
			value: (account) => account.institution ?? "",
		},
		{
			header: t("accounts.number"),
			value: (account) => account.numberEnding ?? "",
		},
		{
			header: `${t("accounts.balance")} (${LEDGER_CURRENCY})`,
			value: (account) => centsToUnits(account.balanceCents).toFixed(2),
		},
		{
			header: t("accounts.lastReconciled"),
			value: (account) => account.lastReconciledDay ?? "",
		},
	];
}
