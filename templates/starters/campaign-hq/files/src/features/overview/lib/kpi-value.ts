// The text of one home figure: a count, an amount with cents, or a multiple such as "3.2×".
// KpiFigureCard calls it for the large and the small figures.
import { formatMultiple, moneyFormat } from "~/features/marketing";
import type { OverviewKpi } from "../api/overview.queries";

/** A null value (no divisor) gives "–", never a false 0. */
export function formatKpiValue(kpi: OverviewKpi, locale: string): string {
	if (kpi.value === null) {
		return "–";
	}
	if (kpi.display === "money") {
		return moneyFormat(locale, "cents").format(kpi.value);
	}
	if (kpi.display === "multiple") {
		return formatMultiple(kpi.value, locale);
	}
	return new Intl.NumberFormat(locale).format(kpi.value);
}
