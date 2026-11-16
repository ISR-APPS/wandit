// The facts of the day on the home: the sentence under the greeting and the progress of the timetable.
// TodayPage calls both functions on every render, so the sentence and the meter follow the clock.
// They read the session rows of today and the current time in milliseconds since 1970.
import { checkedInBy, type SessionRow } from "~/features/gym";

/** The sentence of the day: the class on the floor now, else the next class, else nothing left. */
export type DayBrief =
	| { kind: "live"; row: SessionRow }
	| { kind: "next"; row: SessionRow }
	| { kind: "done" };

/** The first rule that matches wins. A cancelled session never counts. */
export function buildDayBrief(
	rows: readonly SessionRow[],
	now: number,
): DayBrief {
	const held = rows.filter((row) => !row.isCancelled);
	const live = held.find((row) => row.startsAt <= now && row.endsAt > now);
	if (live) {
		return { kind: "live", row: live };
	}
	const next = held.find((row) => row.startsAt > now);
	return next ? { kind: "next", row: next } : { kind: "done" };
}

/** The progress of today's timetable. */
export type DayProgress = {
	/** Sessions of today that ended. */
	done: number;
	/** Sessions of today that the gym holds: cancelled ones do not count. */
	total: number;
	/** Booked members of today's classes who scanned in up to now. */
	checkedIn: number;
	/** Booked spots and spots of today's held sessions. */
	booked: number;
	capacity: number;
	/** Booked members who did not come to a class that ended. */
	noShows: number;
	/** Members who wait for a spot in a class that has not started. */
	waitlist: number;
};

/** Counts of today's held sessions at `now`. */
export function buildDayProgress(
	rows: readonly SessionRow[],
	now: number,
): DayProgress {
	const held = rows.filter((row) => !row.isCancelled);
	const ended = held.filter((row) => row.endsAt <= now);
	return {
		done: ended.length,
		total: held.length,
		checkedIn: held.reduce((sum, row) => sum + checkedInBy(row, now).length, 0),
		booked: held.reduce((sum, row) => sum + row.roster.length, 0),
		capacity: held.reduce((sum, row) => sum + row.capacity, 0),
		noShows: ended.reduce(
			(sum, row) =>
				sum + row.roster.filter((entry) => entry.checkInAt === null).length,
			0,
		),
		waitlist: held
			.filter((row) => row.startsAt > now)
			.reduce((sum, row) => sum + row.waitlistCount, 0),
	};
}
