// The summary strip of the listings page: four figures about the homes on the market.
// ListingsPage renders it above the table, with the rows of the agent filter.
import {
	compactMoneyFormat,
	type ListingRow,
	medianOf,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";

type ListingsSummaryProps = {
	/** The listings of the page, after the agent filter. The tabs of the table count the same rows. */
	listings: ListingRow[];
};

/** One panel with four cells. The first two counts are equal to the tab counts of the table. */
export function ListingsSummary({ listings }: ListingsSummaryProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const active = listings.filter((listing) => listing.status === "active");
	const underOffer = listings.filter(
		(listing) => listing.status === "under_offer",
	);
	const medianDays = medianOf(active.map((listing) => listing.daysOnMarket));
	const cells = [
		{
			id: "active",
			label: t("listings.summary.active"),
			value: number.format(active.length),
			note: t("listings.summary.activeNote"),
		},
		{
			id: "under-offer",
			label: t("listings.summary.underOffer"),
			value: number.format(underOffer.length),
			note: t("listings.summary.underOfferNote"),
		},
		{
			id: "asking-value",
			label: t("listings.summary.askingValue"),
			value: compactMoneyFormat(locale).format(
				active.reduce((sum, listing) => sum + listing.askingPrice, 0),
			),
			note: t("listings.summary.askingValueNote"),
		},
		{
			id: "median-days",
			label: t("listings.summary.medianDays"),
			value: medianDays === null ? "–" : number.format(Math.round(medianDays)),
			note: t("listings.summary.medianDaysNote"),
		},
	];
	return (
		<Card>
			<CardContent>
				{/* Each cell uses the 3 rows of the list (subgrid). A label that wraps on a phone then moves the values of its whole row. */}
				<dl className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-x-6 gap-y-5">
					{cells.map((cell) => (
						<div
							key={cell.id}
							className="row-span-3 grid grid-rows-subgrid gap-y-1 @3xl/main:border-s @3xl/main:ps-6 @3xl/main:first:border-s-0 @3xl/main:first:ps-0"
						>
							<dt className="label-text self-end text-muted-foreground text-sm">
								{cell.label}
							</dt>
							<dd className="font-numeric text-3xl tabular-nums leading-none">
								{cell.value}
							</dd>
							<dd className="text-muted-foreground text-xs">{cell.note}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
