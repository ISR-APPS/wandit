// The profile card of one event: an initials tile, the name and kind, a box of three counts, and a list of facts.
// EventDetailPage renders it at the top of the start column. The venue fact opens the venue panel.
// It follows the kit "profile card": avatar, name with a badge, a 3-cell stat box, then icon rows.
import {
	CalendarBlankIcon,
	ClockIcon,
	EnvelopeSimpleIcon,
	MapPinIcon,
	TicketIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	type EventSummary,
	formatRelativeTime,
	initialsOf,
	timeFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";

type EventProfileCardProps = {
	event: EventSummary;
	/** The time of the load, in milliseconds since 1970. */
	now: number;
};

/** A cancelled event counts the tickets sold before the cancellation, as its sales chart does. */
export function EventProfileCard({ event, now }: EventProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const time = timeFormat(locale);
	const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const shortDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const sold =
		event.status === "cancelled"
			? event.sold + event.refundedTickets
			: event.sold;
	const stats = [
		{ id: "sold", label: t("events.sold"), value: number.format(sold) },
		{
			id: "capacity",
			label: t("events.capacity"),
			value: number.format(event.capacity),
		},
		{
			id: "checked-in",
			label: t("events.checkedIn"),
			value: number.format(event.checkedIn),
		},
	];
	const facts: { id: string; icon: ReactNode; content: ReactNode }[] = [
		{
			id: "date",
			icon: <CalendarBlankIcon />,
			content: (
				<>
					{longDate.format(event.startsAt)}
					<span className="text-muted-foreground">
						{` · ${formatRelativeTime(event.startsAt, now, locale)}`}
					</span>
				</>
			),
		},
		{
			id: "time",
			icon: <ClockIcon />,
			content: (
				<span className="tabular-nums">
					{`${t("events.doors")} ${time.format(event.doorsAt)} · ${t("events.starts")} ${time.format(event.startsAt)} · ${t("events.ends")} ${time.format(event.endsAt)}`}
				</span>
			),
		},
		{
			id: "venue",
			icon: <MapPinIcon />,
			content: (
				<Link
					to="/app/venues"
					search={{ venue: event.venue.id }}
					className="hover:underline"
				>
					{`${event.venue.name} · ${event.venue.area}`}
				</Link>
			),
		},
		{
			id: "contact",
			icon: <EnvelopeSimpleIcon />,
			content: (
				<a
					href={`mailto:${event.venue.contactEmail}`}
					className="hover:underline"
				>
					{event.venue.contactEmail}
				</a>
			),
		},
		{
			id: "on-sale",
			icon: <TicketIcon />,
			content: `${t(event.onSaleAt > now ? "events.onSaleFrom" : "events.onSale")} ${shortDate.format(event.onSaleAt)}`,
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-6">
				<div className="grid justify-items-center gap-3 text-center">
					<span className="flex size-20 items-center justify-center rounded-full bg-muted font-display font-semibold text-2xl">
						{initialsOf(event.name)}
					</span>
					<div className="grid justify-items-center gap-1">
						<div className="flex flex-wrap items-center justify-center gap-2">
							<h2 className="font-semibold text-lg">{event.name}</h2>
							<Badge variant="outline">{t(`events.kinds.${event.kind}`)}</Badge>
						</div>
						<p className="text-muted-foreground text-sm" dir="auto">
							{event.note}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted/40 rtl:divide-x-reverse">
					{stats.map((stat) => (
						// The term comes first in the markup, as a list needs. The reversed column shows the count on top.
						<div
							key={stat.id}
							className="flex flex-col-reverse gap-1 px-2 py-3 text-center"
						>
							<dt className="text-muted-foreground text-sm">{stat.label}</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{stat.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-3 text-sm">
					{facts.map((fact) => (
						<li
							key={fact.id}
							className="flex items-start gap-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"
						>
							{fact.icon}
							<span className="min-w-0 break-words">{fact.content}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
