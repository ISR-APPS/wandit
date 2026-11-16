// The market activity of one listing: the days on the market, then the path from a portal visit to an offer.
// ListingDetailPage renders it with the listing of the detail query. The counts equal the rows of the lists below.
import type { ListingRow } from "~/features/agency";
import { fillMessage } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type ListingActivityCardProps = {
	/** The listing of the page, with its counts of enquiries, viewings, viewers, and offers. */
	listing: ListingRow;
};

/**
 * Each step after the portal visits shows its share of the leads of the step before. A step before of 0 shows no share.
 */
export function ListingActivityCard({ listing }: ListingActivityCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const shareOf = (part: number, whole: number, of: string) =>
		whole === 0
			? null
			: fillMessage(t("listings.activity.shareOf"), {
					share: percent.format(part / whole),
					of,
				});
	const cells = [
		{
			id: "days",
			label: t("listings.daysOnMarket"),
			value: listing.daysOnMarket,
			note: null,
		},
		{
			id: "views",
			label: t("listings.activity.views"),
			value: listing.portalViews,
			note: null,
		},
		{
			id: "enquiries",
			label: t("listings.enquiries"),
			value: listing.enquiryCount,
			note: shareOf(
				listing.enquiryCount,
				listing.portalViews,
				t("listings.activity.ofViews"),
			),
		},
		{
			id: "viewings",
			label: t("listings.viewings"),
			value: listing.viewingCount,
			// The share counts leads, not visits: a lead with two visits counts once, so it never passes 100%.
			note: shareOf(
				listing.viewerCount,
				listing.enquiryCount,
				t("listings.activity.ofEnquiriesBooked"),
			),
		},
		{
			id: "offers",
			label: t("listings.activity.offers"),
			value: listing.offerCount,
			note: shareOf(
				listing.offerCount,
				listing.viewerCount,
				t("listings.activity.ofViewers"),
			),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.activity.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				{/* Each cell spans 3 rows of one subgrid: a label on two lines does not push its value below the others. */}
				<dl className="grid @2xl/main:grid-cols-5 grid-cols-2 gap-x-6 gap-y-5">
					{cells.map((cell) => (
						<div
							key={cell.id}
							className="row-span-3 grid grid-rows-subgrid gap-y-1"
						>
							<dt className="label-text self-end text-muted-foreground text-sm">
								{cell.label}
							</dt>
							<dd className="font-numeric text-2xl tabular-nums leading-none">
								{number.format(cell.value)}
							</dd>
							{cell.note === null ? null : (
								<dd className="text-muted-foreground text-xs">{cell.note}</dd>
							)}
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
