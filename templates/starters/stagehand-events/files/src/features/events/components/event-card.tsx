// One card of the events list: the name, the kind, the date, the share of seats sold, the newest buyers, and the status.
// EventsPage renders one per event in a grid. The whole card opens the event page.
// It follows the kit "project list" card: title, muted kind, date, a labeled progress bar, then avatars and a badge.
import { Link } from "@tanstack/react-router";
import {
	EventStatusBadge,
	fillMessage,
	formatRelativeTime,
	initialsOf,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { EventListRow } from "../api/events.queries";

type EventCardProps = {
	event: EventListRow;
	/** The time of the page render, in milliseconds since 1970. */
	now: number;
};

/** A cancelled event shows the share sold before the cancellation, as its page does. */
export function EventCard({ event, now }: EventCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const date = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
	const sold =
		event.status === "cancelled"
			? event.sold + event.refundedTickets
			: event.sold;
	const share = sold / event.capacity;

	return (
		<Link
			to="/app/events/$eventId"
			params={{ eventId: event.id }}
			className="grid rounded-surface focus-visible:outline-2 focus-visible:outline-ring"
		>
			<Card className="h-full transition-colors hover:bg-accent/40">
				<CardHeader>
					<CardTitle className="line-clamp-2 leading-snug">
						{event.name}
					</CardTitle>
					<p className="text-muted-foreground text-sm">
						{t(`events.kinds.${event.kind}`)}
					</p>
				</CardHeader>
				<CardContent className="grid flex-1 content-end gap-4">
					<p className="text-sm tabular-nums">
						{date.format(event.startsAt)}
						<span className="text-muted-foreground">
							{` · ${formatRelativeTime(event.startsAt, now, locale)}`}
						</span>
					</p>
					<div className="grid gap-2">
						<div className="flex items-center justify-between text-sm">
							<span>{t("events.sold")}</span>
							<span className="font-semibold tabular-nums">
								{percent.format(share)}
							</span>
						</div>
						<Progress
							value={share * 100}
							className="h-2"
							aria-label={fillMessage(t("events.soldOf"), {
								sold,
								capacity: event.capacity,
							})}
						/>
					</div>
					<div className="flex items-center justify-between gap-2">
						<div className="flex -space-x-1.5 rtl:space-x-reverse">
							{event.recentBuyers.map((name) => (
								<Avatar key={name} className="size-8 ring-2 ring-card">
									<AvatarFallback className="bg-primary/25 font-medium text-primary text-xs">
										{initialsOf(name)}
									</AvatarFallback>
								</Avatar>
							))}
						</div>
						<EventStatusBadge status={event.status} />
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
