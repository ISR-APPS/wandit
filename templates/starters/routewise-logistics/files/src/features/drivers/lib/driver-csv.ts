// The CSV columns of a driver export. The Export CSV button and the "Export selected" action of the drivers page use them.
// The callers pass them to toCsv of the logistics feature in their click handlers.
import type { CsvColumn } from "~/features/logistics";
import type { TranslationKey } from "~/shared/i18n";
import type { Driver } from "../api/drivers.queries";

/** The columns of a driver file. Counts stay plain numbers, so a spreadsheet can sum them. `t` is the translate function of useT(). */
export function driverCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Driver>[] {
	return [
		{ header: t("drivers.driver"), value: (row) => row.name },
		{ header: t("drivers.licence"), value: (row) => row.licenceClass },
		{ header: t("drivers.depot"), value: (row) => row.depotName },
		{ header: t("drivers.phone"), value: (row) => row.phone },
		{ header: t("drivers.vehicle"), value: (row) => row.vehicleUnit ?? "" },
		{
			header: t("drivers.status"),
			value: (row) => t(`driverStatus.${row.status}`),
		},
		{ header: t("drivers.stops"), value: (row) => String(row.stopCount) },
		{
			header: t("drivers.delivered"),
			value: (row) => String(row.deliveredCount),
		},
		{ header: t("drivers.late"), value: (row) => String(row.lateCount) },
	];
}
