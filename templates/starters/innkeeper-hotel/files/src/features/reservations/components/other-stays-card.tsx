// The other stays card of the reservation page: the other reservations of the same guest, each with an "Open" button.
// ReservationDetailPage renders it at the end of the row under the latest activity card.
// It follows the connections card of the kit. The arrow in the head opens the guest panel of the guests page.
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { dayToDate, fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { ReservationRow } from "../api/reservations.queries";

// The card shows five stays, as the five rows of the kit card. The guest panel lists all of them.
const SHOWN_STAYS = 5;

type OtherStaysCardProps = {
	/** Id of the guest, for the link to the guest panel. */
	guestId: string;
	/** The other reservations of the guest, newest arrival first. */
	stays: ReservationRow[];
};

/** A guest with no other reservation gets one sentence. */
export function OtherStaysCard({ guestId, stays }: OtherStaysCardProps) {
	const { t, locale } = useT();
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reservations.otherStays")}</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={t("reservations.openGuest")}
					>
						<Link to="/app/guests" search={{ guest: guestId }}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{stays.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reservations.noOtherStays")}
					</p>
				) : (
					<ul className="grid gap-4">
						{stays.slice(0, SHOWN_STAYS).map((stay) => (
							<li key={stay.id} className="flex items-center gap-3">
								<span
									aria-hidden="true"
									className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-numeric text-sm tabular-nums"
								>
									{stay.roomNumber}
								</span>
								<span className="grid min-w-0 flex-1">
									<span className="truncate font-medium text-sm tabular-nums">
										{`${shortDate.format(dayToDate(stay.checkIn))} – ${shortDate.format(dayToDate(stay.checkOut))}`}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{`${fillMessage(t("reservations.roomNumber"), { number: stay.roomNumber })} · ${t(`reservationStatuses.${stay.status}`)}`}
									</span>
								</span>
								<Button asChild variant="outline" size="sm">
									<Link
										to="/app/reservations/$reservationId"
										params={{ reservationId: stay.id }}
									>
										{t("reservations.open")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
