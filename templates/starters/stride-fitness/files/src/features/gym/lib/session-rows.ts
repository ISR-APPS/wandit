// Joins a class session with its class type, its coach, and its roster, as a read with embeds does.
// The classes query and the member query call it. The home, the timetable, and the roster panel read the rows.
// A roster entry keeps its check-in time, also when it is later today. The pages hide it until that time.
import type { CheckIn, ClassSession } from "./sample-activity";
import { type ClassTypeId, classTypeOf, coachOf } from "./sample-classes";
import type { Member } from "./sample-members";

/** One booked member of a session. */
export type RosterEntry = {
	memberId: string;
	fullName: string;
	/** Time of the front desk scan for this class, in milliseconds since 1970. null when the member did not come. */
	checkInAt: number | null;
};

/** One session with the names that the pages show. Times are milliseconds since 1970. */
export type SessionRow = {
	/** `YYYY-MM-DD-HHMM` of the start. The `session` search param of the classes page. */
	id: string;
	classTypeId: ClassTypeId;
	/** Name of the class type, for example "Spin 45". Data, not a UI text. */
	className: string;
	coachName: string;
	/** The room of the class. Data, not a UI text. */
	studio: string;
	startsAt: number;
	endsAt: number;
	/** Spots of the session. The roster never holds more entries. */
	capacity: number;
	/** The gym cancelled it. A cancelled session has an empty roster. */
	isCancelled: boolean;
	/** Members who wait for a spot. Only sessions of today and later keep a waitlist. */
	waitlistCount: number;
	/** The booked members, in booking order. */
	roster: RosterEntry[];
};

/** Joins each session with its names and its roster. `checkIns` can hold every check-in of the sample. */
export function toSessionRows(
	sessions: readonly ClassSession[],
	checkIns: readonly CheckIn[],
	members: readonly Member[],
): SessionRow[] {
	const nameOf = new Map(members.map((member) => [member.id, member.fullName]));
	// The id of a class check-in is `<session id>-<member id>`, so one lookup finds it.
	const checkInAtOf = new Map(
		checkIns.map((checkIn) => [checkIn.id, checkIn.at]),
	);
	return sessions.map((session) => {
		const classType = classTypeOf(session.classTypeId);
		return {
			id: session.id,
			classTypeId: session.classTypeId,
			className: classType.name,
			coachName: coachOf(classType.coachId).fullName,
			studio: classType.studio,
			startsAt: session.startsAt,
			endsAt: session.endsAt,
			capacity: session.capacity,
			isCancelled: session.isCancelled,
			waitlistCount: session.waitlistCount,
			roster: session.bookedMemberIds.map((memberId) => ({
				memberId,
				fullName: nameOf.get(memberId) ?? memberId,
				checkInAt: checkInAtOf.get(`${session.id}-${memberId}`) ?? null,
			})),
		};
	});
}

/** The roster entries that checked in at `now` or earlier. A scan of later today does not exist yet. */
export function checkedInBy(row: SessionRow, now: number): RosterEntry[] {
	return row.roster.filter(
		(entry) => entry.checkInAt !== null && entry.checkInAt <= now,
	);
}
