// The "due next" list of the home rail: the next viewings, the soonest first.
// OverviewPage renders it with the rows of the viewings query. Each row opens the listing of the visit.
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatRelativeTime,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// main-rail.md: "due next" shows 5 rows at most, at every width. The rail stays shorter than a 900 px screen.
const MAX_ROWS = 5;

type NextViewingsCardProps = {
	/** The viewings to come that are not cancelled, the soonest first. */
	upcomingViewings: ViewingRow[];
	/** The time of the read, in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** A viewing that waits for a confirmation shows its badge. A confirmed one shows no badge. */
export function NextViewingsCard({
	upcomingViewings,
	now,
}: NextViewingsCardProps) {
	const { t, locale } = useT();
	const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const rows = upcomingViewings.slice(0, MAX_ROWS);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="row-span-2 self-center">
					{t("overview.nextViewingsTitle")}
				</CardTitle>
				<CardAction>
					<Button asChild variant="outline" size="sm" className="max-sm:h-11">
						<Link to="/app/viewings">{t("overview.nextViewingsAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.nextViewingsEmpty")}
					</p>
				) : (
					<ul className="-mx-1 grid">
						{rows.map((viewing) => (
							<li key={viewing.id}>
								{/* In the sticky rail from 56rem, a smaller row padding keeps the rail inside a 900 px screen. */}
								<Link
									to="/app/listings/$listingId"
									params={{ listingId: viewing.listingId }}
									className="flex items-center gap-3 rounded-md p-1 @4xl/main:py-0.5 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="grid w-18 shrink-0">
										<span className="font-numeric text-sm tabular-nums">
											{clock.format(new Date(viewing.startsAt))}
										</span>
										<span className="text-muted-foreground text-xs first-letter:capitalize">
											{formatRelativeTime(viewing.startsAt, now, locale)}
										</span>
									</span>
									<span className="grid min-w-0 flex-1">
										<span className="truncate font-medium text-sm">
											{viewing.listingStreet}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{fillMessage(t("overview.viewingWith"), {
												lead: viewing.leadName,
											})}
										</span>
									</span>
									{viewing.status === "requested" ? (
										<ViewingStatusBadge status={viewing.status} />
									) : null}
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
