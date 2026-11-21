// Pure functions that turn the members and their check-ins into the rows of the members pages.
// members.queries.ts calls them. They read only their arguments. Times are milliseconds since 1970.
// A real read does the same joins in SQL: last visit, visits of 30 days, and the visit history.
import {
	addDays,
	type CheckIn,
	type ClassSession,
	type ClassTypeId,
	classTypeOf,
	coachOf,
	isAtRisk,
	lastVisitByMember,
	type Member,
	nextPaymentOn,
	type Plan,
	type PlanId,
	pastPaymentDays,
	planOf,
	type SessionRow,
} from "~/features/gym";

/** The visits window of the tables and of the member page, in days. */
export const VISIT_WINDOW_DAYS = 30;
// The booked classes ahead that the member page lists.
const UPCOMING_COUNT = 5;
// The past payments that the member page lists, under the next one.
const PAYMENT_HISTORY_COUNT = 5;

/** The values of the visits filter. "atRisk" counts the same members as the bell and the home feed. */
export const VISIT_FILTERS = ["atRisk", "regular"] as const;

/** One value of the visits filter. */
export type VisitFilter = (typeof VISIT_FILTERS)[number];

/** One row of the members tables. */
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
	/** The visits per week that the member usually makes, 1 to 5. */
	weeklyVisits: number;
	/** Active, and no visit for AT_RISK_DAYS days. The home feed and the "At risk" filter read it. */
	isAtRisk: boolean;
};

/** The members, newest first, with their visits. `checkIns` holds only the check-ins up to `now`. */
export function buildMemberRows(
	members: readonly Member[],
	checkIns: readonly CheckIn[],
	todayStart: number,
	now: number,
): MemberRow[] {
	const windowStart = addDays(todayStart, -VISIT_WINDOW_DAYS + 1);
	const lastVisitOf = lastVisitByMember(checkIns);
	const windowCountOf = new Map<string, number>();
	for (const checkIn of checkIns) {
		if (checkIn.at >= windowStart) {
			windowCountOf.set(
				checkIn.memberId,
				(windowCountOf.get(checkIn.memberId) ?? 0) + 1,
			);
		}
	}
	return members
		.map((member) => {
			const lastVisitAt = lastVisitOf.get(member.id) ?? null;
			return {
				id: member.id,
				fullName: member.fullName,
				email: member.email,
				planId: member.planId,
				planName: planOf(member.planId).name,
				status: member.status,
				joinedAt: member.joinedAt,
				lastVisitAt,
				visitsInWindow: windowCountOf.get(member.id) ?? 0,
				weeklyVisits: member.weeklyVisits,
				isAtRisk: isAtRisk(member, lastVisitAt, now),
			};
		})
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

/** The visits of one class type in the history of a member. */
export type ClassCount = {
	classTypeId: ClassTypeId;
	/** Name of the class type. Data, not a UI text. */
	className: string;
	visits: number;
};

/** One payment of the member page. Amounts are whole units of PLAN_CURRENCY. */
export type PaymentRow = {
	/** The payment day as `YYYY-MM-DD` of its local midnight, so the row id is stable. */
	id: string;
	/** Local midnight of the payment day. */
	day: number;
	amount: number;
	/** "paid": a past payment day. "due": the next payment day, today or later. */
	state: "paid" | "due";
};

/** Everything that the member page shows about one member. */
export type MemberDetail = {
	member: Member;
	plan: Plan;
	/** Every check-in on file, newest first. The history holds HISTORY_DAYS (about 6 months). */
	visits: VisitRow[];
	/** Check-ins in the last VISIT_WINDOW_DAYS days. */
	visitsInWindow: number;
	/** Check-ins in the last 7 days, today included. */
	visitsThisWeek: number;
	/** The class types of the history, the most visited first. Open gym visits do not count. */
	classCounts: ClassCount[];
	/** Classes ahead that the member booked, the earliest first. */
	upcoming: SessionRow[];
	/** The next payment ("due") first, then the past payments, newest first. */
	payments: PaymentRow[];
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
	const visits = [...memberCheckIns].reverse().map((checkIn): VisitRow => {
		const session =
			checkIn.sessionId === null ? undefined : sessionOf.get(checkIn.sessionId);
		const classType = session ? classTypeOf(session.classTypeId) : null;
		return {
			id: checkIn.id,
			at: checkIn.at,
			className: classType?.name ?? null,
			studio: classType?.studio ?? null,
			coachName: classType ? coachOf(classType.coachId).fullName : null,
		};
	});
	const countOf = new Map<ClassTypeId, number>();
	for (const checkIn of memberCheckIns) {
		const session =
			checkIn.sessionId === null ? undefined : sessionOf.get(checkIn.sessionId);
		if (session) {
			countOf.set(
				session.classTypeId,
				(countOf.get(session.classTypeId) ?? 0) + 1,
			);
		}
	}
	const plan = planOf(member.planId);
	const nextPaymentAt = nextPaymentOn(member, todayStart);
	const toPayment = (day: number, state: PaymentRow["state"]): PaymentRow => {
		const date = new Date(day);
		return {
			id: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
			day,
			amount: plan.price,
			state,
		};
	};
	const weekStart = addDays(todayStart, -6);
	const windowStart = addDays(todayStart, -VISIT_WINDOW_DAYS + 1);
	return {
		member,
		plan,
		visits,
		visitsInWindow: memberCheckIns.filter(
			(checkIn) => checkIn.at >= windowStart,
		).length,
		visitsThisWeek: memberCheckIns.filter((checkIn) => checkIn.at >= weekStart)
			.length,
		classCounts: [...countOf.entries()]
			.map(([classTypeId, count]) => ({
				classTypeId,
				className: classTypeOf(classTypeId).name,
				visits: count,
			}))
			.sort((first, second) => second.visits - first.visits),
		upcoming: sessionsAhead
			.filter(
				(row) =>
					row.startsAt > now &&
					!row.isCancelled &&
					row.roster.some((entry) => entry.memberId === member.id),
			)
			.slice(0, UPCOMING_COUNT),
		payments: [
			...(nextPaymentAt === null ? [] : [toPayment(nextPaymentAt, "due")]),
			...pastPaymentDays(member, todayStart, PAYMENT_HISTORY_COUNT).map((day) =>
				toPayment(day, "paid"),
			),
		],
		nextPaymentAt,
	};
}
