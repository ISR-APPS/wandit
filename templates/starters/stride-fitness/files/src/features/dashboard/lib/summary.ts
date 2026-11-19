// The figures of the home for one period: the 4 KPIs, the check-ins per day and per hour, the plan mix, and the sign-ups.
// dashboard.queries.ts calls buildDashboardSummary with the sample rows. The cards of the home take the types.
// A window is the last N times 24 hours, so today counts up to now. The previous window has the same length.
import {
	addDays,
	type CheckIn,
	type ClassSession,
	changeRatio,
	DAY_MS,
	isTrainingOn,
	type Member,
	monthlyValueOf,
	PLAN_IDS,
	type PlanId,
	planOf,
	startOfLocalDay,
	toDayKey,
} from "~/features/gym";

/** The hours of the hourly chart, from 06:00 to 21:00. The front desk opens at 06:00 and closes at 22:00. */
export const OPEN_HOURS = Array.from({ length: 16 }, (_, index) => index + 6);
/** The weekly bars of the sign-ups card. Eight weeks show a trend without crowding the labels. */
export const SIGN_UP_WEEKS = 8;
// The plans in the footer of the sign-ups card. The third cell sums the other plans.
const SIGN_UP_PLAN_COUNT = 2;

/** One KPI value with its change against the previous window. `change` is null when no earlier data exists. */
export type KpiValue = { value: number; change: number | null };

/** The 4 KPIs of the home. */
export type DashboardKpis = {
	/** Members who can train today: joined, not frozen, not lapsed. */
	activeMembers: KpiValue;
	/** Check-ins of today up to now. The change compares with the average day of the period at the same hour. */
	checkInsToday: KpiValue;
	/** Booked spots of the started classes, as a share of their spots: 0.72 is 72 %. null with no class. */
	fillRate: { value: number | null; change: number | null; sessions: number };
	/** Monthly value of the active members, in whole units of PLAN_CURRENCY. An annual plan counts one twelfth. */
	monthlyRevenue: KpiValue;
};

/** One point of the check-ins chart. `key` is a day `YYYY-MM-DD`, or an hour of OPEN_HOURS as text. */
export type CheckInPoint = {
	key: string;
	/** Count of the day, or the average count of the hour per day, in this period. */
	current: number;
	/** The same for the period before. */
	previous: number;
};

/** The active members of one plan. */
export type PlanSlice = { planId: PlanId; members: number };

/** The new members of one week of the sign-ups bars. */
export type SignUpWeek = {
	/** Time of the end of the week, in milliseconds since 1970. The last week ends now. */
	endsAt: number;
	count: number;
};

/** Everything that the home shows for one period. */
export type DashboardSummary = {
	kpis: DashboardKpis;
	/** One point per calendar day of the period, oldest first. Today is the count so far. */
	daily: CheckInPoint[];
	/** One point per hour of OPEN_HOURS. */
	hourly: CheckInPoint[];
	/** Active members per plan, the largest plan first. Every plan has a slice, also at 0. */
	planMix: PlanSlice[];
	signUps: {
		/** Members who joined in the period. */
		total: number;
		change: number | null;
		/** SIGN_UP_WEEKS weeks, oldest first. They do not follow the period. */
		weekly: SignUpWeek[];
		/** The sign-ups of the period on the 2 most chosen plans, the largest first. */
		byPlan: PlanSlice[];
	};
};

/**
 * The summary of the last `days` days at `now` (milliseconds since 1970).
 * `checkIns` holds only the check-ins up to now, oldest first. `sessions` holds every session.
 */
export function buildDashboardSummary(
	members: readonly Member[],
	sessions: readonly ClassSession[],
	checkIns: readonly CheckIn[],
	now: number,
	days: number,
): DashboardSummary {
	const todayStart = startOfLocalDay(now);
	const windowMs = days * DAY_MS;
	const isInWindow = (time: number, windowsBack: number) => {
		const end = now - windowsBack * windowMs;
		return time > end - windowMs && time <= end;
	};

	// Active members now, and on the first day of the period.
	const activeNow = members.filter((member) =>
		isTrainingOn(member, todayStart),
	);
	const activeBefore = members.filter((member) =>
		isTrainingOn(member, addDays(todayStart, -days)),
	);
	const revenueOf = (rows: Member[]) =>
		rows.reduce(
			(sum, member) => sum + monthlyValueOf(planOf(member.planId)),
			0,
		);

	// Today so far against the average day of the period, up to the same time of day.
	const sinceMidnight = now - todayStart;
	const checkInsToday = checkIns.filter((row) => row.at >= todayStart).length;
	let earlierTotal = 0;
	for (let offset = 1; offset <= days; offset += 1) {
		const dayStart = addDays(todayStart, -offset);
		earlierTotal += checkIns.filter(
			(row) => row.at >= dayStart && row.at <= dayStart + sinceMidnight,
		).length;
	}

	// A session counts once it starts. A cancelled session has no spot to fill.
	const startedIn = (windowsBack: number) =>
		sessions.filter(
			(row) =>
				!row.isCancelled &&
				row.startsAt <= now &&
				isInWindow(row.startsAt, windowsBack),
		);
	const fillOf = (rows: ClassSession[]) => {
		const capacity = rows.reduce((sum, row) => sum + row.capacity, 0);
		const booked = rows.reduce(
			(sum, row) => sum + row.bookedMemberIds.length,
			0,
		);
		return capacity === 0 ? null : booked / capacity;
	};
	const sessionsNow = startedIn(0);
	const fillNow = fillOf(sessionsNow);
	const fillBefore = fillOf(startedIn(1));

	const countOfDay = new Map<string, number>();
	for (const checkIn of checkIns) {
		const key = toDayKey(checkIn.at);
		countOfDay.set(key, (countOfDay.get(key) ?? 0) + 1);
	}
	const daily = Array.from({ length: days }, (_, index) => {
		const dayStart = addDays(todayStart, index - days + 1);
		return {
			key: toDayKey(dayStart),
			current: countOfDay.get(toDayKey(dayStart)) ?? 0,
			previous: countOfDay.get(toDayKey(addDays(dayStart, -days))) ?? 0,
		};
	});

	const hourCounts = (windowsBack: number) => {
		const counts = new Map<number, number>();
		for (const checkIn of checkIns) {
			if (isInWindow(checkIn.at, windowsBack)) {
				const hour = new Date(checkIn.at).getHours();
				counts.set(hour, (counts.get(hour) ?? 0) + 1);
			}
		}
		return counts;
	};
	const hoursNow = hourCounts(0);
	const hoursBefore = hourCounts(1);
	// A count per day: the total of the hour over the period, divided by the days of the period.
	const hourly = OPEN_HOURS.map((hour) => ({
		key: String(hour),
		current: (hoursNow.get(hour) ?? 0) / days,
		previous: (hoursBefore.get(hour) ?? 0) / days,
	}));

	// Every plan gets a slice, also at 0, so the legend and the footer can list it.
	const slicesOf = (rows: Member[]): PlanSlice[] =>
		PLAN_IDS.map((planId) => ({
			planId,
			members: rows.filter((member) => member.planId === planId).length,
		})).sort((first, second) => second.members - first.members);

	const joinedNow = members.filter((member) => isInWindow(member.joinedAt, 0));
	const joinedBefore = members.filter((member) =>
		isInWindow(member.joinedAt, 1),
	).length;
	const weekMs = 7 * DAY_MS;
	const weekly = Array.from({ length: SIGN_UP_WEEKS }, (_, index) => {
		const endsAt = now - (SIGN_UP_WEEKS - 1 - index) * weekMs;
		return {
			endsAt,
			count: members.filter(
				(member) =>
					member.joinedAt > endsAt - weekMs && member.joinedAt <= endsAt,
			).length,
		};
	});

	return {
		kpis: {
			activeMembers: {
				value: activeNow.length,
				change: changeRatio(activeNow.length, activeBefore.length),
			},
			checkInsToday: {
				value: checkInsToday,
				change: changeRatio(checkInsToday, earlierTotal / days),
			},
			fillRate: {
				value: fillNow,
				change:
					fillNow === null || fillBefore === null
						? null
						: changeRatio(fillNow, fillBefore),
				sessions: sessionsNow.length,
			},
			monthlyRevenue: {
				value: revenueOf(activeNow),
				change: changeRatio(revenueOf(activeNow), revenueOf(activeBefore)),
			},
		},
		daily,
		hourly,
		planMix: slicesOf(activeNow),
		signUps: {
			total: joinedNow.length,
			change: changeRatio(joinedNow.length, joinedBefore),
			weekly,
			byPlan: slicesOf(joinedNow).slice(0, SIGN_UP_PLAN_COUNT),
		},
	};
}
