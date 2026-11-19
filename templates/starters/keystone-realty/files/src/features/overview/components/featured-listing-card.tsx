// The featured listing card of the home: the home on the market with the most enquiries,
// its three stat tiles, and a large tile of its type in place of a photo (the sample homes have none).
// OverviewPage renders it under the performance card. The name opens the page of the home.
import { Link } from "@tanstack/react-router";
import { countLabel, type ListingRow, PropertyTile } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";

type FeaturedListingCardProps = {
	/** The home to show, or null when no home is on the market. */
	listing: ListingRow | null;
};

/** No home on the market: one sentence and a link to the listings. */
export function FeaturedListingCard({ listing }: FeaturedListingCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	if (listing === null) {
		return (
			<Card>
				<CardContent className="grid justify-items-start gap-3">
					<p className="text-muted-foreground text-sm">
						{t("overview.featured.empty")}
					</p>
					<Link
						to="/app/listings"
						className="text-sm underline underline-offset-4"
					>
						{t("overview.featured.allListings")}
					</Link>
				</CardContent>
			</Card>
		);
	}
	const tiles = [
		{
			id: "viewings",
			value: listing.viewingCount,
			label: t("overview.featured.viewings"),
		},
		{
			id: "views",
			value: listing.portalViews,
			label: t("overview.featured.views"),
		},
		{
			id: "days",
			value: listing.daysOnMarket,
			label: t("overview.featured.daysOnMarket"),
		},
	];

	return (
		<Card>
			<CardContent className="grid @3xl/main:grid-cols-2 gap-4">
				<div className="flex flex-col justify-between gap-4">
					<div className="grid gap-1">
						<Link
							to="/app/listings/$listingId"
							params={{ listingId: listing.id }}
							className="font-display @4xl/main:text-2xl text-xl hover:underline"
							dir="auto"
						>
							{listing.street}
						</Link>
						<p className="text-muted-foreground text-sm">
							{`${t(`agency.propertyTypes.${listing.type}`)} · ${listing.neighborhood}`}
						</p>
					</div>
					<div className="flex gap-2 text-center">
						{tiles.map((tile) => (
							<div key={tile.id} className="grow rounded-lg bg-muted px-2 py-3">
								<p className="font-numeric font-semibold text-xl tabular-nums">
									{number.format(tile.value)}
								</p>
								<p className="text-muted-foreground text-xs">{tile.label}</p>
							</div>
						))}
					</div>
				</div>
				<div className="relative @3xl/main:order-last order-first">
					<PropertyTile
						type={listing.type}
						className="aspect-video size-auto @3xl/main:h-44 w-full rounded-lg"
					/>
					<Badge variant="secondary" className="absolute start-2 top-2">
						{countLabel(
							listing.enquiryCount,
							t("overview.featured.enquiryOne"),
							t("overview.featured.enquiryOther"),
							locale,
						)}
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
}
