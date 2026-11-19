// The CSV columns of a time-off request: the export buttons of the home and of the time-off page use them.
// RequestTable exports the selected rows with them. The cells are text in the app language.
import type { CsvColumn } from "~/features/people";
import type { TranslationKey } from "~/shared/i18n";
import type { TimeOffRequest } from "../api/time-off.queries";

/** One column per request field. Days stay YYYY-MM-DD, so a spreadsheet reads them as dates. */
export function requestCsvColumns(
	t: (key: TranslationKey) => string,
	locale: string,
): CsvColumn<TimeOffRequest>[] {
	const number = new Intl.NumberFormat(locale);
	return [
		{ header: t("timeOff.requestId"), value: (row) => row.id },
		{ header: t("timeOff.employee"), value: (row) => row.employeeName },
		{
			header: t("timeOff.type"),
			value: (row) => t(`timeOffTypes.${row.type}`),
		},
		{ header: t("timeOff.firstDay"), value: (row) => row.startDate },
		{ header: t("timeOff.lastDay"), value: (row) => row.endDate },
		{ header: t("timeOff.days"), value: (row) => number.format(row.days) },
		{
			header: t("timeOff.status"),
			value: (row) => t(`timeOffStatuses.${row.status}`),
		},
	];
}
