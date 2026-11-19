// The CSV columns of a lead export. The leads page uses them for "Export CSV" and "Export selected",
// and the detail page of a listing for "Export enquiries". They pass them to toCsv of ~/features/agency.
import {
	AGENCY_CURRENCY,
	type CsvColumn,
	type LeadRow,
} from "~/features/agency";
import type { TranslationKey } from "~/shared/i18n";
import { describeInterest } from "./lead-interest";

/**
 * The columns of a lead file. The budget stays a plain number and the time an ISO time in UTC,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function leadCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<LeadRow>[] {
	return [
		{ header: t("leads.lead"), value: (row) => row.fullName },
		{ header: t("leads.emailAddress"), value: (row) => row.email },
		{ header: t("leads.phone"), value: (row) => row.phone },
		{
			header: t("leads.status"),
			value: (row) => t(`agency.leadStatuses.${row.status}`),
		},
		{
			header: t("leads.source"),
			value: (row) => t(`agency.leadSources.${row.source}`),
		},
		{ header: t("leads.interest"), value: (row) => describeInterest(row, t) },
		{ header: t("leads.agent"), value: (row) => row.agentName },
		{
			header: `${t("leads.budget")} (${AGENCY_CURRENCY})`,
			value: (row) => (row.budget === null ? "" : String(row.budget)),
		},
		{ header: t("leads.received"), value: (row) => row.createdAt },
	];
}
