// The viewings to come that still wait for the seller to confirm the time, the soonest first.
// ViewingsPage renders it with the "requested" rows of the viewings query. Each row opens its listing.
// A row has three lines: the home, its district, and the lead with the agent. The date and the time sit at the end.
import { Link } from "@tanstack/react-router";
import {
	addressOf,
	fillMessage,
	PropertyTile,
	type ViewingRow,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type ToConfirmCardProps = {
	/** The viewings to come with the status "requested", by start time. */
	requestedViewings: ViewingRow[];
};

/** The count in the header is the count that the page header names. An empty list is the healthy state. */
export function ToConfirmCard({ requestedViewings }: ToConfirmCardProps) {
	const { t, locale } = useT();
	const day = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("viewings.toConfirmTitle")}</CardTitle>
				<CardDescription>{t("viewings.toConfirmDescription")}</CardDescription>
				<CardAction>
					<span className="font-numeric text-3xl tabular-nums leading-none">
						{new Intl.NumberFormat(locale).format(requestedViewings.length)}
					</span>
				</CardAction>
			</CardHeader>
			<CardContent>
				{requestedViewings.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("viewings.toConfirmEmpty")}
					</p>
				) : (
					<ul className="-mx-2 grid">
						{requestedViewings.map((viewing) => (
							<li key={viewing.id} className="border-b py-1 last:border-0">
								<Link
									to="/app/listings/$listingId"
									params={{ listingId: viewing.listingId }}
									className="flex items-start gap-3 rounded-md p-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<PropertyTile type={viewing.listingType} />
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="truncate font-medium text-sm">
											{addressOf({
												street: viewing.listingStreet,
												unit: viewing.listingUnit,
											})}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{viewing.neighborhood}
										</span>
										<span className="truncate text-xs">
											{`${viewing.leadName} · ${fillMessage(
												t("viewings.withAgent"),
												{ agent: viewing.agentName },
											)}`}
										</span>
									</span>
									<span className="grid shrink-0 justify-items-end gap-0.5 self-start">
										<span className="text-sm tabular-nums">
											{day.format(new Date(viewing.startsAt))}
										</span>
										<span className="font-numeric text-base tabular-nums leading-none">
											{clock.format(new Date(viewing.startsAt))}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
