// The key facts of one event: the day, the doors and the times, the venue, the capacity, and the sale date.
// EventDetailPage renders it at the top of the rail. The venue opens its panel on the venues page.
import { Link } from "@tanstack/react-router";
import {
	type EventSummary,
	fillMessage,
	formatRelativeTime,
	timeFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type EventFactsCardProps = {
	event: EventSummary;
	/** The time of the load, in milliseconds since 1970. */
	now: number;
};

/** A definition list. Each fact has a muted term and a value. */
export function EventFactsCard({ event, now }: EventFactsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const time = timeFormat(locale);
	const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const shortDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.facts")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-4 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("events.date")}</dt>
						<dd>
							{longDate.format(event.startsAt)}
							<span className="text-muted-foreground">
								{` · ${formatRelativeTime(event.startsAt, now, locale)}`}
							</span>
						</dd>
					</div>
					<div className="grid grid-cols-3 gap-3">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("events.doors")}</dt>
							<dd className="tabular-nums">{time.format(event.doorsAt)}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("events.starts")}</dt>
							<dd className="tabular-nums">{time.format(event.startsAt)}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("events.ends")}</dt>
							<dd className="tabular-nums">{time.format(event.endsAt)}</dd>
						</div>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("events.venue")}</dt>
						<dd className="grid justify-items-start">
							<Link
								to="/app/venues"
								search={{ venue: event.venue.id }}
								className="font-medium hover:underline"
								dir="auto"
							>
								{event.venue.name}
							</Link>
							<span className="text-muted-foreground" dir="auto">
								{event.venue.area}
							</span>
						</dd>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("events.capacity")}</dt>
							<dd className="tabular-nums">
								{/* An event that uses every place of the venue says so, in place of "1,800 of 1,800". */}
								{fillMessage(
									t(
										event.capacity >= event.venue.capacity
											? "events.capacityFullVenue"
											: "events.capacityOfVenue",
									),
									{
										capacity: number.format(event.capacity),
										venueCapacity: number.format(event.venue.capacity),
									},
								)}
							</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">
								{t(
									event.onSaleAt > now ? "events.onSaleFrom" : "events.onSale",
								)}
							</dt>
							<dd>{shortDate.format(event.onSaleAt)}</dd>
						</div>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
