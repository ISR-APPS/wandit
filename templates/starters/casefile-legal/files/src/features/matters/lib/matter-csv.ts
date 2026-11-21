// The CSV columns of a matter export. The Matters page and the active matters table of the dashboard
// export the same columns. The callers pass them to toCsv of the practice feature in their click handlers.
import { type CsvColumn, CURRENCY } from "~/features/practice";
import type { TranslationKey } from "~/shared/i18n";
import type { MatterSummary } from "./matter-joins";

/**
 * The columns of a matter file. Amounts stay plain numbers and dates stay ISO times in UTC,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function matterCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<MatterSummary>[] {
	return [
		{ header: t("matters.number"), value: (matter) => matter.number },
		{ header: t("matters.matter"), value: (matter) => matter.name },
		{ header: t("matters.client"), value: (matter) => matter.clientName },
		{ header: t("matters.area"), value: (matter) => t(`areas.${matter.area}`) },
		{
			header: t("matters.stage"),
			value: (matter) => t(`stages.${matter.stage}`),
		},
		{ header: t("matters.lead"), value: (matter) => matter.leadName },
		{ header: t("matters.opened"), value: (matter) => matter.openedAt },
		{
			header: t("matters.deadline"),
			value: (matter) => matter.nextDeadline?.dueAt ?? "",
		},
		{
			header: t("matters.hours"),
			value: (matter) => String(matter.ledger.hours),
		},
		{
			header: `${t("matters.unbilled")} (${CURRENCY})`,
			value: (matter) => String(matter.ledger.unbilled),
		},
		{
			header: `${t("matters.outstanding")} (${CURRENCY})`,
			value: (matter) => String(matter.ledger.outstanding),
		},
	];
}
