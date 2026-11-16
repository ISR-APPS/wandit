// The notes of the agents after the latest completed viewings, newest first.
// ViewingsPage renders it with the completed rows of the viewings query. Each home opens its listing.
import { Link } from "@tanstack/react-router";
import {
	formatRelativeTime,
	InterestBadge,
	type ViewingRow,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type FeedbackCardProps = {
	/** The completed viewings, newest first. */
	completedViewings: ViewingRow[];
	/** The time of the read, in milliseconds since 1970. The relative times count from it. */
	now: number;
	/** How many notes show. ViewingsPage sets it from the length of the list beside the card. */
	noteCount: number;
};

/** A completed viewing always has a note and an interest in the data. */
export function FeedbackCard({
	completedViewings,
	now,
	noteCount,
}: FeedbackCardProps) {
	const { t, locale } = useT();
	const rows = completedViewings.slice(0, noteCount);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("viewings.feedbackTitle")}</CardTitle>
				<CardDescription>{t("viewings.feedbackDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("viewings.feedbackEmpty")}
					</p>
				) : (
					<ul className="grid">
						{rows.map((viewing) => (
							<li
								key={viewing.id}
								className="grid gap-1.5 border-b py-3 first:pt-0 last:border-0 last:pb-0"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium text-sm" dir="auto">
										{viewing.leadName}
									</span>
									{viewing.interest === null ? null : (
										<InterestBadge interest={viewing.interest} />
									)}
									<span className="ms-auto text-muted-foreground text-xs">
										{formatRelativeTime(viewing.startsAt, now, locale)}
									</span>
								</div>
								<p className="text-sm">{viewing.feedback}</p>
								<Link
									to="/app/listings/$listingId"
									params={{ listingId: viewing.listingId }}
									className="justify-self-start text-muted-foreground text-xs hover:underline"
								>
									{`${viewing.listingStreet} · ${viewing.neighborhood}`}
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
