// The CSV columns of a shipment export. The home, its tracker card, and the shipment list export the same columns.
// The callers pass them to toCsv of the logistics feature in their click handlers.
import type { CsvColumn } from "~/features/logistics";
import type { TranslationKey } from "~/shared/i18n";
import type { Shipment } from "../api/shipments.queries";

/**
 * The columns of a shipment file. Weights stay plain kilograms and dates stay ISO times in UTC,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function shipmentCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Shipment>[] {
	return [
		{ header: t("shipments.reference"), value: (row) => row.reference },
		{
			header: t("shipments.status"),
			value: (row) => t(`shipmentStatus.${row.status}`),
		},
		{
			header: t("shipments.service"),
			value: (row) => t(`serviceLevel.${row.service}`),
		},
		{ header: t("shipments.customer"), value: (row) => row.customerName },
		{ header: t("shipments.destination"), value: (row) => row.destination },
		{ header: t("shipments.depot"), value: (row) => row.depotName },
		{ header: t("shipments.pallets"), value: (row) => String(row.pallets) },
		{ header: t("shipments.weightKg"), value: (row) => String(row.weightKg) },
		{ header: t("shipments.due"), value: (row) => row.dueAt },
		{ header: t("shipments.closed"), value: (row) => row.closedAt ?? "" },
		{ header: t("shipments.driver"), value: (row) => row.driverName ?? "" },
		{ header: t("shipments.vehicle"), value: (row) => row.vehicleUnit ?? "" },
	];
}
