// The leads that asked about one listing, newest first.
// ListingDetailPage renders it with the enquiries of the detail query. Each name opens the panel of the lead.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	fillMessage,
	formatRelativeTime,
	type LeadRow,
	LeadStatusBadge,
	PersonAvatar,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// A listing can have 20 enquiries. The panel shows 6 first, and the rest after a click.
const FIRST_ROWS = 6;

type ListingEnquiriesCardProps = {
	/** The leads of this listing, newest first. */
	enquiries: LeadRow[];
	/** The time of the read, in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** The count in the header is the count of all enquiries, also when the table shows only 6. */
export function ListingEnquiriesCard({
	enquiries,
	now,
}: ListingEnquiriesCardProps) {
	const { t, locale } = useT();
	const [showsAll, setShowsAll] = useState(false);
	const rows = showsAll ? enquiries : enquiries.slice(0, FIRST_ROWS);
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				{/* The count sits beside the title, like the counts of the home rail. */}
				<CardTitle className="flex items-baseline gap-2">
					{t("listings.enquiries")}
					<span className="font-numeric text-primary text-xl tabular-nums leading-none">
						{number.format(enquiries.length)}
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				{enquiries.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("listings.noEnquiries")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("leads.lead")}</TableHead>
								<TableHead>{t("leads.status")}</TableHead>
								{/* A phone has no room for the source: the lead panel shows it. */}
								<TableHead className="@xl/main:table-cell hidden">
									{t("leads.source")}
								</TableHead>
								<TableHead className="text-end">
									{t("leads.received")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((lead) => (
								<TableRow key={lead.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<PersonAvatar
												fullName={lead.fullName}
												className="size-7"
											/>
											<Link
												to="/app/leads"
												search={{ lead: lead.id }}
												className="font-medium hover:underline"
												dir="auto"
											>
												{lead.fullName}
											</Link>
										</div>
									</TableCell>
									<TableCell>
										<LeadStatusBadge status={lead.status} />
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden">
										{t(`agency.leadSources.${lead.source}`)}
									</TableCell>
									<TableCell className="text-end text-muted-foreground">
										{formatRelativeTime(lead.createdAt, now, locale)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{enquiries.length > FIRST_ROWS ? (
					<Button
						type="button"
						variant="ghost"
						className="justify-self-start max-sm:h-11"
						aria-expanded={showsAll}
						onClick={() => setShowsAll(!showsAll)}
					>
						{showsAll
							? t("listings.showFewer")
							: fillMessage(t("listings.showAll"), {
									count: number.format(enquiries.length),
								})}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
