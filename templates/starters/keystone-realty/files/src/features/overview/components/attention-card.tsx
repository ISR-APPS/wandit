// The attention list of the home rail: the leads that still wait for a first answer, the oldest first.
// OverviewPage renders it with the rows of the leads query. Each row opens the panel of its lead.
// An empty list is the healthy state: the card stays, with one muted sentence.
import { Link } from "@tanstack/react-router";
import {
	formatWaitingTime,
	LateBadge,
	type LeadRow,
	PersonAvatar,
} from "~/features/agency";
import { describeInterest } from "~/features/leads";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// The rail stays shorter than one laptop screen, so the list shows 5 rows at most.
const MAX_ROWS = 5;

type AttentionCardProps = {
	/** Every lead with the status "new", newest first, as the leads query returns them. */
	waitingLeads: LeadRow[];
	/** The time of the read, in milliseconds since 1970. The waiting times count from it. */
	now: number;
};

/** The count beside the title is the count of all waiting leads, also when the list shows only 5. */
export function AttentionCard({ waitingLeads, now }: AttentionCardProps) {
	const { t, locale } = useT();
	// The query gives newest first. The lead that waits longest comes first here.
	const rows = [...waitingLeads].reverse().slice(0, MAX_ROWS);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="row-span-2 flex items-baseline gap-2 self-center">
					{t("overview.attentionTitle")}
					<span className="font-numeric text-2xl text-primary tabular-nums leading-none">
						{new Intl.NumberFormat(locale).format(waitingLeads.length)}
					</span>
				</CardTitle>
				{waitingLeads.length > 0 ? (
					<CardAction>
						<Button asChild variant="outline" size="sm" className="max-sm:h-11">
							<Link to="/app/leads" search={{ status: "new" }}>
								{t("overview.attentionAll")}
							</Link>
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.attentionEmpty")}
					</p>
				) : (
					<ul className="-mx-1 grid">
						{rows.map((lead) => {
							// The narrow form ("8d") leaves room for the second line of the row in the 20rem rail.
							const waited = formatWaitingTime(
								lead.createdAt,
								now,
								locale,
								"narrow",
							);
							return (
								<li key={lead.id}>
									{/* In the sticky rail from 56rem, a smaller row padding keeps the rail inside a 900 px screen. */}
									<Link
										to="/app/leads"
										search={{ lead: lead.id }}
										className="flex items-center gap-3 rounded-md p-1 @4xl/main:py-0.5 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										<PersonAvatar fullName={lead.fullName} />
										<span className="grid min-w-0 flex-1">
											<span className="truncate font-medium text-sm" dir="auto">
												{lead.fullName}
											</span>
											<span className="truncate text-muted-foreground text-xs">
												{describeInterest(lead, t)}
											</span>
										</span>
										{/* A late lead shows its time in the badge. A lead in time shows the time alone. */}
										{lead.isLate ? (
											<LateBadge waited={waited} />
										) : (
											<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
												{waited}
											</span>
										)}
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
