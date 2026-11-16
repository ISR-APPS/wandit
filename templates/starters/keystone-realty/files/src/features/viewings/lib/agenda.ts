// Groups the viewings by calendar day for the agenda of the viewings page.
// AgendaCard calls it with the rows of the viewings query and the first day of the week on screen.
import { dayNumberOf, type ViewingRow } from "~/features/agency";

/** The days that the agenda shows at one time. */
export const AGENDA_DAYS = 7;

/** One day of the agenda with its viewings. */
export type AgendaDay = {
	/** The day number of the calendar day (days since 1970, in the time zone of the browser). */
	dayNumber: number;
	/** The viewings of the day that are not cancelled, by start time. */
	viewings: ViewingRow[];
};

/** The 7 days from `firstDay`, each with its viewings. A cancelled viewing is not in the agenda. */
export function buildAgendaWeek(
	viewings: ViewingRow[],
	firstDay: number,
): AgendaDay[] {
	return Array.from({ length: AGENDA_DAYS }, (_, index) => {
		const dayNumber = firstDay + index;
		return {
			dayNumber,
			viewings: viewings.filter(
				(viewing) =>
					viewing.status !== "cancelled" &&
					dayNumberOf(Date.parse(viewing.startsAt)) === dayNumber,
			),
		};
	});
}
