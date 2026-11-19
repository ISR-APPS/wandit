// The profile card of a listing detail page: a large type tile, the address with the status,
// a strip of three counts, and the facts of the home with an icon each.
// ListingDetailPage renders it at the top of the start column.
import {
	BedIcon,
	CalendarBlankIcon,
	CurrencyCircleDollarIcon,
	RulerIcon,
	SignatureIcon,
	UserIcon,
} from "@phosphor-icons/react";
import {
	fillMessage,
	type ListingRow,
	ListingStatusBadge,
	moneyFormat,
	PropertyTile,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";

type ListingProfileCardProps = {
	listing: ListingRow;
};

/** The facts list holds only what the listing row knows: no invented phone or email. */
export function ListingProfileCard({ listing }: ListingProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const stats = [
		{
			id: "enquiries",
			value: listing.enquiryCount,
			label: t("listings.enquiries"),
		},
		{
			id: "viewings",
			value: listing.viewingCount,
			label: t("listings.viewings"),
		},
		{ id: "offers", value: listing.offerCount, label: t("listings.offers") },
	];
	const facts = [
		{
			id: "price",
			icon: CurrencyCircleDollarIcon,
			text: money.format(listing.askingPrice),
		},
		{
			id: "rooms",
			icon: BedIcon,
			text: fillMessage(t("listings.rooms"), {
				bedrooms: number.format(listing.bedrooms),
				bathrooms: number.format(listing.bathrooms),
			}),
		},
		{
			id: "area",
			icon: RulerIcon,
			text: `${number.format(listing.areaSqft)} ${t("agency.sqft")}`,
		},
		{
			id: "agent",
			icon: UserIcon,
			text: fillMessage(t("listings.agentLine"), { name: listing.agentName }),
		},
		{
			id: "seller",
			icon: SignatureIcon,
			text: fillMessage(t("listings.sellerLine"), { name: listing.sellerName }),
		},
		{
			id: "listed",
			icon: CalendarBlankIcon,
			text: fillMessage(t("listings.listedOn"), {
				date: date.format(new Date(listing.listedAt)),
			}),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-10">
				<div className="grid justify-items-center gap-4">
					<PropertyTile type={listing.type} className="size-20 rounded-full" />
					<div className="grid justify-items-center gap-1 text-center">
						<h2
							className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl"
							dir="auto"
						>
							{listing.street}
							<ListingStatusBadge status={listing.status} />
						</h2>
						<p className="text-muted-foreground text-sm">
							{`${t(`agency.propertyTypes.${listing.type}`)} · ${listing.neighborhood}`}
						</p>
					</div>
				</div>
				<div className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{stats.map((stat) => (
						<div key={stat.id} className="grid gap-0.5 py-3">
							<p className="font-numeric font-semibold text-lg tabular-nums">
								{number.format(stat.value)}
							</p>
							<p className="text-muted-foreground text-sm">{stat.label}</p>
						</div>
					))}
				</div>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li key={fact.id} className="flex items-center gap-3 text-sm">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							<span dir="auto">{fact.text}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
