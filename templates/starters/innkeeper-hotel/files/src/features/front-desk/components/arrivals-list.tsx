// The arrivals of today that are still to come, next arrival first: the time, the guest, and the room.
// When every guest of today is in the house, it lists the arrivals of tomorrow.
// FrontDeskPage renders it under the alert list. A row opens the reservation of the guest.
import { Link } from "@tanstack/react-router";
import { countLabel, fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { RoomBoardEntry } from "../lib/room-board";

type ArrivalsListProps = {
	/** The rooms with an arrival of today that is not in the house, from pendingArrivals(). */
	arrivals: RoomBoardEntry[];
	/** The rooms with an arrival of tomorrow, from arrivalsTomorrow(). The card shows them only when `arrivals` is empty. */
	tomorrow: RoomBoardEntry[];
};

// The list shows the next 4 arrivals. A busy morning has up to 8, and the rail must not grow far past the panel beside it.
const MAX_ROWS = 4;

/** A Card with one row per arrival, at most 4. With no arrival today and tomorrow, it shows one sentence. */
export function ArrivalsList({ arrivals, tomorrow }: ArrivalsListProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	// An evening with every guest in the house looks ahead: the card must not stay empty until midnight.
	const showsTomorrow = arrivals.length === 0 && tomorrow.length > 0;
	const rows = (showsTomorrow ? tomorrow : arrivals).flatMap((entry) => {
		const stay = showsTomorrow ? entry.nextArrival : entry.arrivalToday;
		return stay ? [{ entry, stay }] : [];
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{t(showsTomorrow ? "arrivals.tomorrowTitle" : "arrivals.title")}
				</CardTitle>
				<CardDescription>
					{t(showsTomorrow ? "arrivals.none" : "arrivals.description")}
				</CardDescription>
				{rows.length > 0 ? (
					<CardAction>
						<Badge variant="secondary" className="tabular-nums">
							{new Intl.NumberFormat(locale).format(rows.length)}
						</Badge>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("arrivals.none")}</p>
				) : (
					<ul className="grid">
						{rows.slice(0, MAX_ROWS).map(({ entry, stay }) => (
							<li key={entry.room.id} className="border-b last:border-b-0">
								<Link
									to="/app/reservations/$reservationId"
									params={{ reservationId: stay.reservationId }}
									className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="w-18 shrink-0 font-numeric tabular-nums">
										{time.format(new Date(stay.expectedArrivalAt))}
									</span>
									<span className="grid min-w-0 flex-1">
										<span className="truncate font-medium text-sm" dir="auto">
											{stay.guestName}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{`${fillMessage(t("arrivals.room"), { number: entry.room.number })} · ${countLabel(stay.guests, t("units.guestOne"), t("units.guestOther"), locale)} · ${countLabel(stay.nights, t("units.nightOne"), t("units.nightOther"), locale)}`}
										</span>
									</span>
									{/* The room of an arrival of today is not ready: the guest of last night is in it, or housekeeping is. */}
									{!showsTomorrow &&
									(entry.status === "departing" ||
										entry.status === "cleaning") ? (
										<Badge variant="warning">
											{t(`roomStatuses.${entry.status}`)}
										</Badge>
									) : null}
								</Link>
							</li>
						))}
					</ul>
				)}
				{rows.length > MAX_ROWS ? (
					<p className="pt-3 text-muted-foreground text-xs">
						{countLabel(
							rows.length - MAX_ROWS,
							t("arrivals.moreOne"),
							t("arrivals.moreOther"),
							locale,
						)}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3"];

/** Placeholder of the arrivals list while the home loader runs. */
export function ArrivalsListSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-36" />
				<Skeleton className="h-4 w-48" />
			</CardHeader>
			<CardContent className="grid gap-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</CardContent>
		</Card>
	);
}
