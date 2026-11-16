// Builds the timeline of one reservation: the booking, the payments, the arrival, and the departure.
// reservations.queries.ts calls it for the detail page. A step in the future is not done yet.
import {
	addDays,
	HOUR_MS,
	isoDayToMs,
	type Payment,
	type Reservation,
} from "~/features/hotel";

/** One step of the timeline. Its label is the message key `timeline.<kind>`. */
export type TimelineStep = {
	id: string;
	kind:
		| "booked"
		| "deposit"
		| "prepayment"
		| "settlement"
		| "refund"
		| "depositDue"
		| "reminder"
		| "arrival"
		| "departure"
		| "cancelled"
		| "noShow";
	/** ISO time of the step. For a step that is not done, the planned time. */
	at: string;
	/** False for a step in the future. */
	isDone: boolean;
	/** The sum of a payment step, in whole units of the hotel currency. null for the other steps. */
	amount: number | null;
};

/** The steps of one reservation at `now` (milliseconds since 1970), oldest first. */
export function buildStayTimeline(
	reservation: Reservation,
	payments: Payment[],
	now: number,
): TimelineStep[] {
	const bookedAt = Date.parse(reservation.bookedAt);
	const steps: TimelineStep[] = [
		{
			id: "booked",
			kind: "booked",
			at: reservation.bookedAt,
			isDone: true,
			amount: null,
		},
		...payments.map(
			(payment): TimelineStep => ({
				id: payment.id,
				kind: payment.kind,
				at: payment.paidAt,
				isDone: true,
				amount: Math.abs(payment.amount),
			}),
		),
	];
	if (reservation.status === "pending") {
		steps.push({
			id: "deposit-due",
			kind: "depositDue",
			// The hotel keeps a new booking for 72 hours with no deposit.
			at: new Date(bookedAt + 72 * HOUR_MS).toISOString(),
			isDone: false,
			amount: reservation.nightlyRate,
		});
	}
	if (reservation.status === "cancelled" && reservation.cancelledAt) {
		steps.push({
			id: "cancelled",
			kind: "cancelled",
			at: reservation.cancelledAt,
			isDone: true,
			amount: null,
		});
	} else if (reservation.status === "no_show") {
		steps.push({
			id: "no-show",
			kind: "noShow",
			at: reservation.expectedArrivalAt,
			isDone: true,
			amount: null,
		});
	} else {
		// The desk writes to the guest at 10:00, two days before the arrival. A late booking gets no message.
		const reminderAt =
			addDays(isoDayToMs(reservation.checkIn), -2) + 10 * HOUR_MS;
		if (reminderAt > bookedAt) {
			steps.push({
				id: "reminder",
				kind: "reminder",
				at: new Date(reminderAt).toISOString(),
				isDone: reminderAt <= now,
				amount: null,
			});
		}
		steps.push(
			{
				id: "arrival",
				kind: "arrival",
				at: reservation.arrivedAt ?? reservation.expectedArrivalAt,
				isDone: reservation.arrivedAt !== null,
				amount: null,
			},
			{
				id: "departure",
				kind: "departure",
				at: reservation.departedAt ?? reservation.expectedDepartureAt,
				isDone: reservation.departedAt !== null,
				amount: null,
			},
		);
	}
	return steps.sort(
		(first, second) => Date.parse(first.at) - Date.parse(second.at),
	);
}
