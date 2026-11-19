// The CSV columns of a vehicle export. The Export CSV button and the "Export selected" action of the fleet page use them.
// The callers pass them to toCsv of the logistics feature in their click handlers.
import type { CsvColumn } from "~/features/logistics";
import type { TranslationKey } from "~/shared/i18n";
import type { Vehicle } from "../api/vehicles.queries";

/** The columns of a vehicle file. Weights stay plain kilograms and the service day stays ISO. `t` is the translate function of useT(). */
export function vehicleCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Vehicle>[] {
	return [
		{ header: t("fleet.unit"), value: (row) => row.unit },
		{ header: t("fleet.kind"), value: (row) => t(`vehicleKind.${row.kind}`) },
		{ header: t("fleet.plate"), value: (row) => row.plate },
		{ header: t("fleet.depot"), value: (row) => row.depotName },
		{
			header: t("fleet.status"),
			value: (row) => t(`vehicleStatus.${row.status}`),
		},
		{ header: t("fleet.capacityKg"), value: (row) => String(row.capacityKg) },
		{ header: t("fleet.loadKg"), value: (row) => String(row.loadKg) },
		{ header: t("fleet.fuel"), value: (row) => String(row.fuelPercent) },
		{ header: t("fleet.nextService"), value: (row) => row.serviceDueAt },
		{ header: t("fleet.driverToday"), value: (row) => row.driverName ?? "" },
	];
}
