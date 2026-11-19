// The CSV columns of a listing export. The listings page uses them for "Export CSV" and "Export selected".
// The page passes them to toCsv of ~/features/agency in its click handlers.
import {
	AGENCY_CURRENCY,
	addressOf,
	type CsvColumn,
	type ListingRow,
} from "~/features/agency";
import type { TranslationKey } from "~/shared/i18n";

/**
 * The columns of a listing file. Prices stay plain numbers and dates stay ISO times in UTC,
 * so a spreadsheet can sum and sort them. `t` is the translate function of useT().
 */
export function listingCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<ListingRow>[] {
	return [
		{ header: t("listings.id"), value: (row) => row.id },
		{ header: t("listings.home"), value: (row) => addressOf(row) },
		{ header: t("listings.neighborhood"), value: (row) => row.neighborhood },
		{
			header: t("listings.type"),
			value: (row) => t(`agency.propertyTypes.${row.type}`),
		},
		{
			header: t("listings.status"),
			value: (row) => t(`agency.listingStatuses.${row.status}`),
		},
		{
			header: `${t("listings.price")} (${AGENCY_CURRENCY})`,
			value: (row) => String(row.askingPrice),
		},
		{
			header: t("listings.enquiries"),
			value: (row) => String(row.enquiryCount),
		},
		{ header: t("listings.views"), value: (row) => String(row.portalViews) },
		{ header: t("listings.agent"), value: (row) => row.agentName },
		{ header: t("listings.listed"), value: (row) => row.listedAt },
	];
}
