// The CSV columns of an activity export. The "Export CSV" button of the Activities page and the bulk export use them.
// The callers pass them to toCsv of the crm feature in their click handlers.
import type { CsvColumn } from "~/features/crm";
import type { TranslationKey } from "~/shared/i18n";
import type { Activity } from "../api/activities.queries";

/** The columns of an activity file. Times stay ISO times in UTC, so a spreadsheet can sort them. `t` comes from useT(). */
export function activityCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Activity>[] {
	return [
		{ header: t("activities.when"), value: (row) => row.occurredAt },
		{
			header: t("activities.type"),
			value: (row) => t(`activityTypes.${row.type}`),
		},
		{ header: t("activities.activity"), value: (row) => row.subject },
		{ header: t("activities.note"), value: (row) => row.note },
		{ header: t("deals.deal"), value: (row) => row.deal?.name ?? "" },
		{ header: t("deals.contactName"), value: (row) => row.contactName },
		{ header: t("deals.company"), value: (row) => row.companyName },
		{ header: t("activities.rep"), value: (row) => row.repName },
	];
}
