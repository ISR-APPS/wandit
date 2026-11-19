// The CSV columns of a rep export: name, role, territory, email, target, booked, attainment, and pace.
// The reps page and the rep targets card of the targets page call it for "Export CSV" and "Export selected".
// toCsv of the sales feature quotes each cell; this file only picks and formats the values.
import { type CsvColumn, CURRENCY } from "~/features/sales";
import type { useT } from "~/shared/i18n";
import type { RepSummary } from "../api/reps.queries";

/** The fields of a rep that the file reads. A rep of the reps board and a rep of the targets page both have them. */
export type RepCsvRow = Pick<
	RepSummary,
	| "id"
	| "name"
	| "role"
	| "territoryName"
	| "email"
	| "target"
	| "booked"
	| "attainment"
	| "status"
>;

/** The columns of the file. Amounts and the attainment stay plain numbers, so a spreadsheet can compute with them. */
export function repCsvColumns<Row extends RepCsvRow>(
	t: ReturnType<typeof useT>["t"],
): CsvColumn<Row>[] {
	return [
		{ header: t("reps.name"), value: (rep) => rep.name },
		{ header: t("reps.role"), value: (rep) => t(`roles.${rep.role}`) },
		{ header: t("reps.territory"), value: (rep) => rep.territoryName },
		{ header: t("reps.email"), value: (rep) => rep.email },
		{
			header: `${t("reps.target")} (${CURRENCY})`,
			value: (rep) => String(rep.target),
		},
		{
			header: `${t("reps.booked")} (${CURRENCY})`,
			value: (rep) => String(rep.booked),
		},
		// Two decimals of the ratio: 0.87 is 87 %.
		{ header: t("reps.attainment"), value: (rep) => rep.attainment.toFixed(2) },
		{ header: t("reps.status"), value: (rep) => t(`pace.${rep.status}`) },
	];
}
