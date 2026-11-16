// The "newest rows" table of the home: the 8 newest listings with their status, price, and first market day.
// OverviewPage renders it with the rows of the listings query. Each row opens the detail page of its listing.
import { Link } from "@tanstack/react-router";
import {
	addressOf,
	formatRelativeTime,
	type ListingRow,
	ListingStatusBadge,
	moneyFormat,
	PropertyTile,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// The home spec shows the 8 newest rows. The listings page shows all rows.
const MAX_ROWS = 8;

type NewestListingsCardProps = {
	/** Every listing, newest first, as the listings query returns them. */
	listings: ListingRow[];
	/** The time of the read, in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** A "coming soon" listing shows its planned first market day, for example "in 4 days". */
export function NewestListingsCard({ listings, now }: NewestListingsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const rows = listings.slice(0, MAX_ROWS);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.newestTitle")}</CardTitle>
				<CardDescription>{t("overview.newestDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/listings">{t("overview.newestAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("listings.empty")}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("listings.home")}</TableHead>
								{/* On a phone the status moves into the price cell, and the date goes. */}
								<TableHead className="@xl/main:table-cell hidden">
									{t("listings.status")}
								</TableHead>
								<TableHead className="text-end">
									{t("listings.price")}
								</TableHead>
								<TableHead className="@xl/main:table-cell hidden text-end">
									{t("listings.listed")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((listing) => (
								<TableRow key={listing.id}>
									<TableCell className="whitespace-normal">
										<div className="flex items-center gap-3">
											<PropertyTile type={listing.type} />
											<div className="grid justify-items-start">
												<Link
													to="/app/listings/$listingId"
													params={{ listingId: listing.id }}
													className="font-medium hover:underline"
												>
													{addressOf(listing)}
												</Link>
												<span className="text-muted-foreground text-xs">
													{`${listing.neighborhood} · ${t(`agency.propertyTypes.${listing.type}`)}`}
												</span>
											</div>
										</div>
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden">
										<ListingStatusBadge status={listing.status} />
									</TableCell>
									<TableCell className="text-end tabular-nums">
										<div className="grid justify-items-end gap-1">
											{money.format(listing.askingPrice)}
											<span className="@xl/main:hidden">
												<ListingStatusBadge status={listing.status} />
											</span>
										</div>
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden text-end text-muted-foreground">
										{formatRelativeTime(listing.listedAt, now, locale)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
