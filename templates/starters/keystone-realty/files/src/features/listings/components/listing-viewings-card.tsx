// The viewings of one listing, newest first, with the note of the agent after each visit.
// ListingDetailPage renders it with the viewings of the detail query.
import {
	fillMessage,
	InterestBadge,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type ListingViewingsCardProps = {
	/** The viewings of this listing, newest first. The cancelled ones are in the list too. */
	viewings: ViewingRow[];
	/** The id of the agent who holds the listing. A visit with another agent names that agent. */
	listingAgentId: string;
};

/**
 * A list, not a table: the note of the agent needs a full line under each visit.
 * The count leaves out the cancelled visits, like "Market activity", and names them apart.
 */
export function ListingViewingsCard({
	viewings,
	listingAgentId,
}: ListingViewingsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const cancelledCount = viewings.filter(
		(viewing) => viewing.status === "cancelled",
	).length;
	const dateTime = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	return (
		<Card>
			<CardHeader>
				{/* The count sits beside the title, like the counts of the home rail. */}
				<CardTitle className="flex items-baseline gap-2">
					{t("listings.viewings")}
					<span className="font-numeric text-primary text-xl tabular-nums leading-none">
						{number.format(viewings.length - cancelledCount)}
					</span>
				</CardTitle>
				{cancelledCount === 0 ? null : (
					<CardDescription className="tabular-nums">
						{fillMessage(t("listings.cancelledCount"), {
							count: number.format(cancelledCount),
						})}
					</CardDescription>
				)}
			</CardHeader>
			<CardContent>
				{viewings.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("listings.noViewings")}
					</p>
				) : (
					<ul className="grid">
						{viewings.map((viewing) => (
							<li
								key={viewing.id}
								className="grid gap-1.5 border-b py-3 first:pt-0 last:border-0 last:pb-0"
							>
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
									<span className="font-medium text-sm tabular-nums">
										{dateTime.format(new Date(viewing.startsAt))}
									</span>
									<ViewingStatusBadge status={viewing.status} />
									{viewing.interest === null ? null : (
										<InterestBadge interest={viewing.interest} />
									)}
								</div>
								<p className="text-sm">
									<span dir="auto">{viewing.leadName}</span>
									<span className="text-muted-foreground">
										{viewing.visitNumber > 1
											? ` · ${t("viewings.secondVisit")}`
											: null}
										{/* The People card names the listing agent, so only another agent shows here. */}
										{viewing.agentId === listingAgentId
											? null
											: ` · ${fillMessage(t("viewings.withAgent"), {
													agent: viewing.agentName,
												})}`}
									</span>
								</p>
								{viewing.feedback === null ? null : (
									<p className="text-muted-foreground text-sm">
										{viewing.feedback}
									</p>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
