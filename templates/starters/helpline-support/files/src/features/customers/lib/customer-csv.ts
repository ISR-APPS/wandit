// The CSV columns of a customer export. The header "Export CSV" and the "Export selected" bulk action use them.
// The callers pass them to toCsv of the helpdesk feature in their click handlers.
import { type CsvColumn, CURRENCY } from "~/features/helpdesk";
import type { TranslationKey } from "~/shared/i18n";
import type { CustomerListItem } from "../api/customers.queries";
import { customerHealth } from "./customer-health";

/**
 * The columns of a customer file. Amounts and shares stay plain numbers, so a spreadsheet can sum them.
 * `t` is the translate function of useT().
 */
export function customerCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<CustomerListItem>[] {
	return [
		{ header: t("customers.company"), value: (row) => row.name },
		{
			header: t("customers.plan"),
			value: (row) => t(`customers.plans.${row.plan}`),
		},
		{ header: t("customers.seats"), value: (row) => String(row.seats) },
		{
			header: `${t("customers.mrr")} (${CURRENCY})`,
			value: (row) => String(row.mrr),
		},
		{ header: t("customers.city"), value: (row) => row.city },
		{
			header: t("customers.mainContact"),
			value: (row) => row.contacts[0]?.name ?? "",
		},
		{
			header: t("customers.email"),
			value: (row) => row.contacts[0]?.email ?? "",
		},
		{
			header: t("customers.openTickets"),
			value: (row) => String(row.openTickets),
		},
		{
			header: t("customers.satisfaction"),
			value: (row) =>
				row.satisfaction === null ? "" : String(row.satisfaction),
		},
		{
			header: t("customers.healthLabel"),
			value: (row) => t(`customers.health.${customerHealth(row)}`),
		},
	];
}
