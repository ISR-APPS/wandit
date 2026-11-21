// The CSV columns of the two exports of the Contacts page: people and companies.
// The "Export CSV" button of the page and the bulk exports of the two tables use them.
import { type CsvColumn, CURRENCY } from "~/features/crm";
import type { TranslationKey } from "~/shared/i18n";
import type { Company } from "../api/companies.queries";
import type { Contact } from "../api/contacts.queries";

/** The columns of a people file. `t` is the translate function of useT(). */
export function contactCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Contact>[] {
	return [
		{ header: t("contacts.name"), value: (row) => row.name },
		{ header: t("contacts.jobTitle"), value: (row) => row.title },
		{ header: t("contacts.company"), value: (row) => row.companyName },
		{ header: t("contacts.city"), value: (row) => row.city },
		{ header: t("contacts.email"), value: (row) => row.email },
		{ header: t("contacts.phone"), value: (row) => row.phone },
		{
			header: t("contacts.openDeals"),
			value: (row) => String(row.openDealCount),
		},
		{
			header: t("contacts.lastContacted"),
			value: (row) => row.lastContactedAt ?? "",
		},
	];
}

/** The columns of a company file. Amounts stay plain numbers in the app currency. */
export function companyCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Company>[] {
	return [
		{ header: t("contacts.company"), value: (row) => row.name },
		{ header: t("contacts.industry"), value: (row) => row.industry },
		{ header: t("contacts.city"), value: (row) => row.city },
		{ header: t("contacts.employees"), value: (row) => String(row.employees) },
		{ header: t("contacts.people"), value: (row) => String(row.contactCount) },
		{
			header: t("contacts.openDeals"),
			value: (row) => String(row.openDealCount),
		},
		{
			header: `${t("contacts.openPipeline")} (${CURRENCY})`,
			value: (row) => String(row.openAmount),
		},
		{
			header: `${t("contacts.won")} (${CURRENCY})`,
			value: (row) => String(row.wonAmount),
		},
	];
}
