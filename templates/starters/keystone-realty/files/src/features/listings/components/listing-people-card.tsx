// The people of one listing: the agent who holds it, the seller, and the buyer after an accepted offer.
// ListingDetailPage renders it in the rail with the listing, the agent, and the buyer of the detail query.
import { Link } from "@tanstack/react-router";
import {
	type Agent,
	fillMessage,
	type LeadRow,
	type ListingRow,
	PersonAvatar,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type ListingPeopleCardProps = {
	/** The listing of the page. It gives the name of the seller and the date of the signature. */
	listing: ListingRow;
	/** The agent who holds the listing. */
	agent: Agent;
	/** The lead whose offer the seller accepted, or null. Its name opens the panel of the lead. */
	buyer: LeadRow | null;
};

/** Rows with the same shape: the avatar, the name, and one muted line. */
export function ListingPeopleCard({
	listing,
	agent,
	buyer,
}: ListingPeopleCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const people = [
		{
			id: "agent",
			leadId: null,
			fullName: agent.fullName,
			// The role "Agent" would repeat the word of the line, so only a higher role shows.
			line:
				agent.role === "agent"
					? t("listings.people.agent")
					: `${t("listings.people.agent")} · ${t(`agency.roles.${agent.role}`)}`,
		},
		{
			id: "seller",
			leadId: null,
			fullName: listing.sellerName,
			line: `${t("listings.people.seller")} · ${fillMessage(
				t("listings.people.signedOn"),
				{ date: date.format(new Date(listing.instructedAt)) },
			)}`,
		},
		...(buyer === null || listing.offerAcceptedAt === null
			? []
			: [
					{
						id: "buyer",
						leadId: buyer.id,
						fullName: buyer.fullName,
						line: `${t("listings.people.buyer")} · ${fillMessage(
							t("listings.people.offerOn"),
							{ date: date.format(new Date(listing.offerAcceptedAt)) },
						)}`,
					},
				]),
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.people.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{people.map((person) => (
						<li key={person.id} className="flex items-center gap-3">
							<PersonAvatar fullName={person.fullName} className="size-10" />
							<div className="grid min-w-0">
								{person.leadId === null ? (
									<span className="truncate font-medium text-sm" dir="auto">
										{person.fullName}
									</span>
								) : (
									<Link
										to="/app/leads"
										search={{ lead: person.leadId }}
										className="truncate font-medium text-sm hover:underline"
										dir="auto"
									>
										{person.fullName}
									</Link>
								)}
								<span className="text-muted-foreground text-xs">
									{person.line}
								</span>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
