// The active listings card of the home: a search field in the head and a table of the homes on the market,
// with their type, price, and open leads in four columns. OverviewPage renders it in the last band.
// The search is state of the card. A home name opens its page.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	compactMoneyFormat,
	type LeadRow,
	type ListingRow,
	PersonAvatar,
	PropertyTile,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// Nine rows keep the card as tall as the calendar card beside it. The listings page lists every home.
const SHOWN_ROWS = 9;
// The lead column shows two avatars, then the count of the others.
const SHOWN_AVATARS = 2;

type ActiveListingsCardProps = {
	/** The homes on the market or under offer, the most asked first. */
	listings: ListingRow[];
	/** The open leads of each listing id. */
	openLeads: Map<string, LeadRow[]>;
};

/** The search matches the street and the district of every home on the market, then shows the first nine. */
export function ActiveListingsCard({
	listings,
	openLeads,
}: ActiveListingsCardProps) {
	const { t, locale } = useT();
	const [query, setQuery] = useState("");
	const money = compactMoneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const needle = query.trim().toLocaleLowerCase(locale);
	const rows = (
		needle === ""
			? listings
			: listings.filter((listing) =>
					`${listing.street} ${listing.neighborhood}`
						.toLocaleLowerCase(locale)
						.includes(needle),
				)
	).slice(0, SHOWN_ROWS);

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("overview.activeListings.title")}</CardTitle>
				<CardAction>
					<div className="relative w-44">
						<MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("overview.activeListings.search")}
							aria-label={t("overview.activeListings.search")}
							className="ps-9"
						/>
					</div>
				</CardAction>
			</CardHeader>
			<CardContent className="min-w-0 overflow-x-auto">
				<Table className="w-max min-w-full">
					<TableHeader>
						<TableRow>
							<TableHead>{t("overview.activeListings.property")}</TableHead>
							<TableHead>{t("overview.activeListings.type")}</TableHead>
							<TableHead className="text-end">
								{t("overview.activeListings.price")}
							</TableHead>
							<TableHead>{t("overview.activeListings.leads")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="h-24 text-center text-muted-foreground"
								>
									{listings.length === 0
										? t("overview.activeListings.empty")
										: t("overview.activeListings.noResults")}
								</TableCell>
							</TableRow>
						) : (
							rows.map((listing) => {
								const leads = openLeads.get(listing.id) ?? [];
								return (
									<TableRow key={listing.id}>
										<TableCell>
											<div className="flex items-center gap-3">
												<PropertyTile type={listing.type} />
												<div className="grid gap-0.5">
													<Link
														to="/app/listings/$listingId"
														params={{ listingId: listing.id }}
														className="font-semibold hover:underline"
														dir="auto"
													>
														{listing.street}
													</Link>
													<span className="text-muted-foreground text-sm">
														{listing.neighborhood}
													</span>
												</div>
											</div>
										</TableCell>
										<TableCell>
											{t(`agency.propertyTypes.${listing.type}`)}
										</TableCell>
										<TableCell className="text-end tabular-nums">
											{money.format(listing.askingPrice)}
										</TableCell>
										<TableCell>
											{leads.length === 0 ? (
												<span className="text-muted-foreground text-xs">
													{t("overview.activeListings.noLeads")}
												</span>
											) : (
												<div className="flex items-center gap-1">
													{/* A 4 px overlap keeps both initials of each avatar readable. */}
													<div className="flex -space-x-1">
														{leads.slice(0, SHOWN_AVATARS).map((lead) => (
															<PersonAvatar
																key={lead.id}
																fullName={lead.fullName}
																className="size-7 ring-2 ring-card"
															/>
														))}
													</div>
													{leads.length > SHOWN_AVATARS ? (
														<span className="text-muted-foreground text-xs tabular-nums">
															{`+${number.format(leads.length - SHOWN_AVATARS)}`}
														</span>
													) : null}
												</div>
											)}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
