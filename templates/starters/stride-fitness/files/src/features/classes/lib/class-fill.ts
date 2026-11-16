// Pure functions of the classes page: the days of the timetable and the fill of each class type.
// classes.queries.ts calls buildClassFill; the classes page calls timetableDays.
// They read rows that the caller passes. Times are milliseconds since 1970.
import {
	AHEAD_DAYS,
	addDays,
	CLASS_TYPES,
	type ClassTypeId,
	coachOf,
	type SessionRow,
	toDayKey,
} from "~/features/gym";

/** The fill of one class type over a period. Only sessions that ended and were not cancelled count. */
export type ClassFill = {
	classTypeId: ClassTypeId;
	/** Name of the class type. Data, not a UI text. */
	className: string;
	coachName: string;
	/** Count of sessions in the period. */
	sessions: number;
	/** Spots booked in those sessions. */
	booked: number;
	/** Spots of those sessions. */
	capacity: number;
	/** Booked members who checked in. */
	attended: number;
};

/** One class type per row, the fullest first. A class type with no session in the period is left out. */
export function buildClassFill(rows: readonly SessionRow[]): ClassFill[] {
	return CLASS_TYPES.map((classType) => {
		const ofType = rows.filter((row) => row.classTypeId === classType.id);
		return {
			classTypeId: classType.id,
			className: classType.name,
			coachName: coachOf(classType.coachId).fullName,
			sessions: ofType.length,
			booked: ofType.reduce((sum, row) => sum + row.roster.length, 0),
			capacity: ofType.reduce((sum, row) => sum + row.capacity, 0),
			attended: ofType.reduce(
				(sum, row) =>
					sum + row.roster.filter((entry) => entry.checkInAt !== null).length,
				0,
			),
		};
	})
		.filter((fill) => fill.sessions > 0)
		.sort(
			(first, second) =>
				second.booked / second.capacity - first.booked / first.capacity,
		);
}

/** One tab of the timetable: a day key and the local midnight of that day. */
export type TimetableDay = { key: string; start: number };

/** Today and the next AHEAD_DAYS days, the days that the timetable shows. */
export function timetableDays(todayStart: number): TimetableDay[] {
	return Array.from({ length: AHEAD_DAYS + 1 }, (_, offset) => {
		const start = addDays(todayStart, offset);
		return { key: toDayKey(start), start };
	});
}
