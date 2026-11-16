// The rows that the agenda of the home page shows, and the sentence of the day line.
// AgendaCard and TodayPage call these functions with the appointments of today and the current time.
// Both are pure, so the now line and the sentence move when the minute changes.
import { type AppointmentRow, isComing, isLate } from "~/features/clinic";

/** The agenda shows at most this count of rows. More rows make the home longer than one screen. */
export const AGENDA_ROW_LIMIT = 10;
// Rows before the now line when the day is longer than the limit: the patients who are in the building.
const ROWS_BEFORE_NOW = 3;

/** The part of the day that the agenda shows. */
export type AgendaWindow = {
	/** At most AGENDA_ROW_LIMIT rows around the current time, by start time. */
	rows: AppointmentRow[];
	/** Index in `rows` of the first row that starts after now. The now line sits before it. Equal to the row count at the end of the day. */
	nowIndex: number;
};

/** Cuts the rows of today (by start time) to the rows around `now`: a few past rows, then the next ones. */
export function buildAgendaWindow(
	rows: readonly AppointmentRow[],
	now: number,
): AgendaWindow {
	const firstNext = rows.findIndex((row) => row.startsAt > now);
	const nextIndex = firstNext === -1 ? rows.length : firstNext;
	const first = Math.max(
		0,
		Math.min(nextIndex - ROWS_BEFORE_NOW, rows.length - AGENDA_ROW_LIMIT),
	);
	return {
		rows: rows.slice(first, first + AGENDA_ROW_LIMIT),
		nowIndex: nextIndex - first,
	};
}

/** What the day line says: the late patients first, else the next patient, else nothing. */
export type DayBrief =
	| { kind: "late"; count: number }
	| { kind: "next"; row: AppointmentRow }
	| { kind: "clear" };

/** The first rule that matches the rows of today. A cancelled or a closed row is never "next". */
export function buildDayBrief(
	rows: readonly AppointmentRow[],
	now: number,
): DayBrief {
	const lateCount = rows.filter((row) => isLate(row, now)).length;
	if (lateCount > 0) {
		return { kind: "late", count: lateCount };
	}
	const next = rows.find((row) => isComing(row, now));
	return next ? { kind: "next", row: next } : { kind: "clear" };
}
