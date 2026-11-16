// The first panel of the listing detail page: the price, the key facts of the home, its text, and its selling points.
// ListingDetailPage renders it with the listing of the detail query.
import {
	BathtubIcon,
	BedIcon,
	CalendarBlankIcon,
	CarSimpleIcon,
	HouseLineIcon,
	RulerIcon,
	StairsIcon,
} from "@phosphor-icons/react";
import {
	fillMessage,
	type ListingRow,
	moneyFormat,
	PropertyTile,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";

type ListingFactsCardProps = {
	/** The listing of the page. */
	listing: ListingRow;
};

/** The agreed price shows beside the asking price from the day the seller accepts an offer. */
export function ListingFactsCard({ listing }: ListingFactsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const facts = [
		{
			id: "bedrooms",
			icon: BedIcon,
			label: t("listings.facts.bedrooms"),
			value:
				listing.bedrooms === 0
					? t("agency.propertyTypes.studio")
					: number.format(listing.bedrooms),
		},
		{
			id: "bathrooms",
			icon: BathtubIcon,
			label: t("listings.facts.bathrooms"),
			value: number.format(listing.bathrooms),
		},
		{
			id: "area",
			icon: RulerIcon,
			label: t("listings.facts.area"),
			value: `${number.format(listing.areaSqft)} ${t("agency.sqft")}`,
		},
		// A house has no floor, so its cell names the kind of home instead.
		listing.floor === null
			? {
					id: "type",
					icon: HouseLineIcon,
					label: t("listings.facts.type"),
					value: t(`agency.propertyTypes.${listing.type}`),
				}
			: {
					id: "floor",
					icon: StairsIcon,
					label: t("listings.facts.floor"),
					value: number.format(listing.floor),
				},
		{
			id: "parking",
			icon: CarSimpleIcon,
			label: t("listings.facts.parking"),
			value:
				listing.parkingSpaces === 0
					? t("listings.facts.noParking")
					: number.format(listing.parkingSpaces),
		},
		{
			id: "year",
			icon: CalendarBlankIcon,
			label: t("listings.facts.yearBuilt"),
			// A year has no group separator.
			value: String(listing.yearBuilt),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-6">
				<div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
					<div className="flex items-center gap-4">
						<PropertyTile type={listing.type} className="size-14" />
						<div className="grid gap-1">
							<p className="label-text text-muted-foreground text-sm">
								{t("listings.askingPrice")}
							</p>
							<p className="font-numeric text-4xl tabular-nums leading-none">
								{money.format(listing.askingPrice)}
							</p>
							<p className="text-muted-foreground text-sm">
								{fillMessage(t("listings.pricePerSqft"), {
									amount: money.format(
										Math.round(listing.askingPrice / listing.areaSqft),
									),
								})}
								{listing.priceReducedAt === null
									? null
									: ` · ${fillMessage(t("listings.reducedFrom"), {
											amount: money.format(listing.originalPrice),
										})}`}
							</p>
						</div>
					</div>
					{listing.agreedPrice === null ? null : (
						<div className="grid gap-1 sm:justify-items-end">
							<p className="label-text text-muted-foreground text-sm">
								{t("listings.agreedPrice")}
							</p>
							<p className="font-numeric text-2xl tabular-nums leading-none">
								{money.format(listing.agreedPrice)}
							</p>
							<p className="text-muted-foreground text-sm">
								{fillMessage(t("listings.shareOfAsking"), {
									share: percent.format(
										listing.agreedPrice / listing.askingPrice,
									),
								})}
							</p>
						</div>
					)}
				</div>
				<dl className="grid @2xl/main:grid-cols-3 grid-cols-2 gap-x-6 gap-y-4 border-t pt-6">
					{facts.map((fact) => (
						<div key={fact.id} className="flex items-center gap-3">
							<fact.icon className="size-5 shrink-0 text-muted-foreground" />
							<div className="grid">
								<dt className="text-muted-foreground text-xs">{fact.label}</dt>
								<dd className="font-medium text-sm tabular-nums">
									{fact.value}
								</dd>
							</div>
						</div>
					))}
				</dl>
				<div className="grid gap-3 border-t pt-6">
					<p className="text-sm">{listing.summary}</p>
					<ul className="flex flex-wrap gap-2">
						{listing.features.map((feature) => (
							<li
								key={feature}
								className="rounded-full bg-muted px-2.5 py-1 text-xs"
							>
								{t(`agency.features.${feature}`)}
							</li>
						))}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}
