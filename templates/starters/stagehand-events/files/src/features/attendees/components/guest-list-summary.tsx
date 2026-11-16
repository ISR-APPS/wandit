// The four figures of one guest list: tickets sold, checked in, still expected or no-shows, and refunded.
// AttendeesPage renders it above the table. Each figure gives tickets, and its order count under it,
// so the figures agree with the order counts of the status tabs.
// Before the doors open, the door figures show the opening time and the tickets left to sell.
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	type EventSummary,
	fillMessage,
	formatRelativeTime,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import type { GuestRow } from "../lib/guest-rows";

type GuestListSummaryProps = {
	event: EventSummary;
	rows: GuestRow[];
	/** The time of the load, in milliseconds since 1970. */
	now: number;
};

/** The third figure says "Expected" while the doors are open and "No-shows" after the end. */
export function GuestListSummary({ event, rows, now }: GuestListSummaryProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		hour: "numeric",
		minute: "2-digit",
	});
	const isOver = event.endsAt <= now;
	// Before the doors open nobody can check in, and every valid ticket is still expected.
	const isBeforeDoors =
		event.status === "on_sale" || event.status === "sold_out";
	const doorsTime = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	const totals = (status: GuestRow["status"] | "valid") => {
		const matching = rows.filter((row) =>
			status === "valid" ? row.status !== "refunded" : row.status === status,
		);
		return {
			tickets: matching.reduce((sum, row) => sum + row.quantity, 0),
			orders: matching.length,
		};
	};
	const valid = totals("valid");
	const checkedIn = totals("checked_in");
	const waiting = totals(isOver ? "no_show" : "expected");
	const refunded = totals("refunded");
	const ordersLine = (orders: number) =>
		countLabel(
			orders,
			t("attendees.orderOne"),
			t("attendees.orderOther"),
			locale,
		);

	const ticketFigure = (
		id: string,
		label: string,
		counts: { tickets: number; orders: number },
	) => ({
		id,
		label,
		value: number.format(counts.tickets),
		line: ordersLine(counts.orders),
	});
	const figures = [
		ticketFigure("sold", t("attendees.ticketsSold"), valid),
		isBeforeDoors
			? {
					id: "doors",
					label: t("attendees.doorsOpen"),
					value: formatRelativeTime(event.doorsAt, now, locale),
					line: doorsTime.format(event.doorsAt),
				}
			: ticketFigure(
					"checked-in",
					t("attendees.statuses.checked_in"),
					checkedIn,
				),
		isBeforeDoors
			? {
					id: "left",
					label: t("attendees.ticketsLeft"),
					value: number.format(Math.max(0, event.capacity - valid.tickets)),
					line: fillMessage(t("attendees.ofCapacity"), {
						capacity: number.format(event.capacity),
					}),
				}
			: ticketFigure(
					"waiting",
					t(isOver ? "attendees.noShows" : "attendees.expectedGuests"),
					waiting,
				),
		ticketFigure("refunded", t("attendees.statuses.refunded"), refunded),
	];

	return (
		<Card className="gap-5">
			<CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
				<div className="grid min-w-0 gap-0.5">
					<p className="truncate font-display font-semibold text-xl" dir="auto">
						{event.name}
					</p>
					<p className="text-muted-foreground text-sm">
						<bdi>{event.venue.name}</bdi>
						{" · "}
						{dateTime.format(event.startsAt)}
						{" · "}
						{formatRelativeTime(event.startsAt, now, locale)}
					</p>
				</div>
				<Button asChild variant="ghost" size="sm" className="-me-3">
					<Link to="/app/events/$eventId" params={{ eventId: event.id }}>
						{t("attendees.openEvent")}
						<CaretRightIcon className="rtl:rotate-180" />
					</Link>
				</Button>
			</CardContent>
			<CardContent>
				<dl className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-x-6 gap-y-5">
					{figures.map((figure) => (
						<div key={figure.id} className="grid content-start gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{figure.label}
							</dt>
							<dd className="font-numeric text-3xl tabular-nums">
								{figure.value}
							</dd>
							<dd className="text-muted-foreground text-xs tabular-nums">
								{figure.line}
							</dd>
							{figure.id === "checked-in" ? (
								<dd className="pt-1">
									<Progress
										value={checkedIn.tickets}
										max={valid.tickets}
										className="h-1.5"
										aria-label={figure.label}
									/>
								</dd>
							) : null}
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
