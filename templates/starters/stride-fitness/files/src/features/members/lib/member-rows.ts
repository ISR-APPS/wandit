// Pure functions that turn the members and their check-ins into the rows of the members pages.
// members.queries.ts calls them. They read only their arguments. Times are milliseconds since 1970.
// A real read does the same joins in SQL: last visit, visits of 30 days, and the visit history.
import {
	addDays,
	type CheckIn,
	type ClassSession,
	classTypeOf,
	coachOf,
	type Member,
	nextPaymentOn,
	type Plan,
	type PlanId,
	planOf,
	type SessionRow,
} from "~/features/gym";

/** The visits window of the list and of the attendance panel, in days. */
export const VISIT_WINDOW_DAYS = 30;
/** The weeks of the attendance chart. A quarter shows a habit and its changes. */
export const ATTENDANCE_WEEKS = 12;
// The newest visits that the member page lists.
const VISIT_HISTORY_COUNT = 12;
// The booked classes ahead that the member page lists.
const UPCOMING_COUNT = 5;

/** One row of the members list. */
export type MemberRow = {
	id: string;
	fullName: string;
	email: string;
	planId: PlanId;
	/** Name of the plan. Data, not a UI text. */
	planName: string;
	status: Member["status"];
	/** Local midnight of the join day. */
	joinedAt: number;
	/** Time of the newest check-in, or null when the member never came. */
	lastVisitAt: number | null;
	/** Check-ins in the last VISIT_WINDOW_DAYS days. */
	visitsInWindow: number;
};

/** The members, newest first, with their visits. `checkIns` holds only the check-ins up to now. */
export function buildMemberRows(
	members: readonly Member[],
	checkIns: readonly CheckIn[],
	todayStart: number,
): MemberRow[] {
	const windowStart = addDays(todayStart, -VISIT_WINDOW_DAYS + 1);
	const lastVisitOf = new Map<string, number>();
	const windowCountOf = new Map<string, number>();
	// The check-ins are oldest first, so the last write per member is the newest visit.
	for (const checkIn of checkIns) {
		lastVisitOf.set(checkIn.memberId, checkIn.at);
		if (checkIn.at >= windowStart) {
			windowCountOf.set(
				checkIn.memberId,
				(windowCountOf.get(checkIn.memberId) ?? 0) + 1,
			);
		}
	}
	return members
		.map((member) => ({
			id: member.id,
			fullName: member.fullName,
			email: member.email,
			planId: member.planId,
			planName: planOf(member.planId).name,
			status: member.status,
			joinedAt: member.joinedAt,
			lastVisitAt: lastVisitOf.get(member.id) ?? null,
			visitsInWindow: windowCountOf.get(member.id) ?? 0,
		}))
		.sort(
			(first, second) =>
				second.joinedAt - first.joinedAt ||
				first.fullName.localeCompare(second.fullName),
		);
}

/** One check-in of the member page. The class fields are null for an open gym visit. */
export type VisitRow = {
	id: string;
	at: number;
	className: string | null;
	studio: string | null;
	coachName: string | null;
};

/** The visits of one 7-day window of the attendance chart. */
export type AttendanceWeek = {
	/** Local midnight of the first day of the window. */
	weekStart: number;
	visits: number;
};

/** Everything that the member page shows about one member. */
export type MemberDetail = {
	member: Member;
	plan: Plan;
	/** The newest check-ins, newest first. */
	visits: VisitRow[];
	/** ATTENDANCE_WEEKS windows of 7 days, oldest first. The last one ends today. */
	attendance: AttendanceWeek[];
	/** Check-ins in the last VISIT_WINDOW_DAYS days. */
	visitsInWindow: number;
	/** Every check-in on file. The history holds HISTORY_DAYS (about 6 months), not the full membership. */
	totalVisits: number;
	/** Classes ahead that the member booked, the earliest first. */
	upcoming: SessionRow[];
	/** Local midnight of the next payment, or null for a lapsed member. */
	nextPaymentAt: number | null;
};

/** The page data of one member. `memberCheckIns` holds the member's check-ins up to now, oldest first. */
export function buildMemberDetail(
	member: Member,
	memberCheckIns: readonly CheckIn[],
	sessions: readonly ClassSession[],
	sessionsAhead: readonly SessionRow[],
	todayStart: number,
	now: number,
): MemberDetail {
	const sessionOf = new Map(sessions.map((session) => [session.id, session]));
	const visits = memberCheckIns
		.slice(-VISIT_HISTORY_COUNT)
		.reverse()
		.map((checkIn): VisitRow => {
			const session =
				checkIn.sessionId === null
					? undefined
					: sessionOf.get(checkIn.sessionId);
			const classType = session ? classTypeOf(session.classTypeId) : null;
			return {
				id: checkIn.id,
				at: checkIn.at,
				className: classType?.name ?? null,
				studio: classType?.studio ?? null,
				coachName: classType ? coachOf(classType.coachId).fullName : null,
			};
		});
	const attendance = Array.from({ length: ATTENDANCE_WEEKS }, (_, index) => {
		const weekStart = addDays(todayStart, -7 * (ATTENDANCE_WEEKS - index) + 1);
		const weekEnd = addDays(weekStart, 7);
		return {
			weekStart,
			visits: memberCheckIns.filter(
				(checkIn) => checkIn.at >= weekStart && checkIn.at < weekEnd,
			).length,
		};
	});
	const windowStart = addDays(todayStart, -VISIT_WINDOW_DAYS + 1);
	return {
		member,
		plan: planOf(member.planId),
		visits,
		attendance,
		visitsInWindow: memberCheckIns.filter(
			(checkIn) => checkIn.at >= windowStart,
		).length,
		totalVisits: memberCheckIns.length,
		upcoming: sessionsAhead
			.filter(
				(row) =>
					row.startsAt > now &&
					!row.isCancelled &&
					row.roster.some((entry) => entry.memberId === member.id),
			)
			.slice(0, UPCOMING_COUNT),
		nextPaymentAt: nextPaymentOn(member, todayStart),
	};
}
