// The recent activity card of the home: the newest check-ins, check-outs, bookings, and cancellations.
// FrontDeskPage renders it first in the second row of three. Each row opens its reservation.
// "View all" opens the reservations list. It follows the activity feed of the kit (recipe 3.5).
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, formatRelativeTime, initialsOf } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { DeskEvent } from "../lib/home-figures";

type DeskActivityCardProps = {
	/** The newest events, newest first, from the summary query. */
	events: DeskEvent[];
	/** The time of the summary read, in milliseconds since 1970. The relative times count from it. */
	now: number;
};

/** One row per event: the initials, the guest, the room with the event, and the time. */
export function DeskActivityCard({ events, now }: DeskActivityCardProps) {
	const { t, locale } = useT();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("frontDesk.activity.title")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-1">
				{events.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("frontDesk.activity.empty")}
					</p>
				) : (
					<ul className="grid gap-1">
						{events.map((event) => (
							<li key={event.id}>
								<Link
									to="/app/reservations/$reservationId"
									params={{ reservationId: event.reservationId }}
									className="-mx-2 flex items-center gap-3 rounded-md p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<Avatar className="size-9">
										<AvatarFallback className="bg-muted text-xs">
											{initialsOf(event.guestName)}
										</AvatarFallback>
									</Avatar>
									<span className="grid min-w-0 flex-1">
										<span className="truncate font-medium text-sm" dir="auto">
											{event.guestName}
										</span>
										<span className="truncate text-muted-foreground text-sm">
											{fillMessage(t(`frontDesk.activity.${event.kind}`), {
												room: event.roomNumber,
											})}
										</span>
									</span>
									<time
										dateTime={event.at}
										className="shrink-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums"
									>
										{formatRelativeTime(event.at, now, locale)}
									</time>
								</Link>
							</li>
						))}
					</ul>
				)}
				<Button asChild variant="outline" size="sm" className="mt-4 w-full">
					<Link to="/app/reservations" search={{ view: "list" }}>
						{t("frontDesk.activity.viewAll")}
						<CaretRightIcon className="rtl:rotate-180" />
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
