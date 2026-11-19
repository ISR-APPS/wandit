// The CSV columns of a deal export. The Deals page and the home table export the same columns.
// The callers pass them to toCsv of the crm feature in their click handlers.
import { type CsvColumn, CURRENCY } from "~/features/crm";
import type { TranslationKey } from "~/shared/i18n";
import type { Deal } from "../api/deals.queries";
import { daysInStage } from "./deal-attention";

/**
 * The columns of a deal file. Amounts stay plain numbers and dates stay ISO times in UTC,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function dealCsvColumns(
	t: (key: TranslationKey) => string,
	now: number,
): CsvColumn<Deal>[] {
	return [
		{ header: t("deals.deal"), value: (deal) => deal.name },
		{ header: t("deals.company"), value: (deal) => deal.companyName },
		{ header: t("deals.contactName"), value: (deal) => deal.contactName },
		{ header: t("deals.stage"), value: (deal) => t(`stages.${deal.stage}`) },
		{ header: t("deals.owner"), value: (deal) => deal.ownerName },
		{
			header: `${t("deals.amount")} (${CURRENCY})`,
			value: (deal) => String(deal.amount),
		},
		{
			header: t("deals.closeDate"),
			value: (deal) => deal.closedAt ?? deal.expectedCloseAt,
		},
		{
			header: t("deals.daysInStage"),
			value: (deal) => String(daysInStage(deal, now)),
		},
	];
}
