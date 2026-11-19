// Reads of the Reports page: the sign-up weeks, the week 1 retention of each cohort, the daily active users,
// the recent sign-ups, the email schedules, and the notes thread.
// The loader of the Reports route prefetches them. The cards of ReportsPage read them from the cache.
// The queryFns read the sample tables and lib/sample-reports.ts. A later turn replaces each body with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type Channel,
	calendarDaysAgo,
	type DailyPoint,
	dayKeyOf,
	getSampleTables,
	type PeriodDays,
	type PeriodTotals,
	startOfDayAgo,
	toDailyPoints,
} from "~/features/tracking";
import { listNotes, listSchedules } from "../lib/sample-reports";
import { type SignUpStatus, signUpStatusOf } from "../lib/sign-up-status";

/** How many weeks the sign-up bars show. The total compares them with the same count of weeks before. */
export const SIGN_UP_WEEKS = 8;

/** The retention line skips the two newest sign-up weeks: their week 1 is not complete for each user yet. */
const FIRST_COMPLETE_COHORT = 2;

/** How many cohorts the retention line shows, and how many the figure averages. */
const RETENTION_COHORTS = 10;
const AVERAGED_COHORTS = 4;

/** The sign-ups of one week. */
export type WeekCount = {
	/** The first day of the week, YYYY-MM-DD. */
	day: string;
	count: number;
};

/** The week 1 retention of one sign-up week: the share of its new users active in the week after. */
export type CohortRetention = {
	/** The first day of the sign-up week, YYYY-MM-DD. */
	day: string;
	/** From 0 to 1. null for a week with no new user. */
	rate: number | null;
};

/** One new user of the period. */
export type SignUp = {
	/** The person id. Also the key of the table row. */
	id: string;
	name: string;
	email: string;
	accountId: string;
	accountName: string;
	channel: Channel;
	status: SignUpStatus;
	/** ISO time of the sign-up. */
	joinedAt: string;
};

/** Every figure of the Reports page for one period. */
export type Reports = {
	/** The last SIGN_UP_WEEKS weeks, the oldest first. */
	signUpWeeks: WeekCount[];
	/** The sign-ups of those weeks, and of the same count of weeks before. */
	signUpTotals: PeriodTotals;
	/** The complete cohorts, the oldest first. */
	retention: CohortRetention[];
	/** The mean week 1 retention of the newest cohorts, and of the cohorts before them. null when no cohort has users. */
	retentionAverage: { current: number | null; previous: number | null };
	/** The active users per day of the period, with the same day one period earlier. */
	activeUsers: DailyPoint[];
	/** The new users of the period, the newest first. */
	signUps: SignUp[];
};

// The mean of the rates that exist. No rate gives null.
function meanRate(cohorts: CohortRetention[]): number | null {
	const rates = cohorts.flatMap((cohort) =>
		cohort.rate === null ? [] : cohort.rate,
	);
	return rates.length === 0
		? null
		: rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

/** Every figure of the Reports page for the last `days` complete days. */
export function reportsQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["reports", days],
		queryFn: async (): Promise<Reports> => {
			const tables = getSampleTables();
			const { usage } = tables;
			const now = Date.now();
			const weekStart = (week: number) =>
				dayKeyOf(startOfDayAgo(tables.todayStart, week * 7 + 7));
			// The sign-ups of all channels in week `week`. Week 0 is the last 7 complete days.
			const weekCount = (week: number) => {
				let count = 0;
				for (const dayTable of usage.signUps) {
					for (let daysAgo = week * 7 + 1; daysAgo <= week * 7 + 7; daysAgo++) {
						count += dayTable[daysAgo] ?? 0;
					}
				}
				return count;
			};

			const signUpWeeks: WeekCount[] = [];
			const signUpTotals = { current: 0, previous: 0 };
			for (let week = 2 * SIGN_UP_WEEKS - 1; week >= 0; week--) {
				const count = weekCount(week);
				if (week < SIGN_UP_WEEKS) {
					signUpTotals.current += count;
					signUpWeeks.push({ day: weekStart(week), count });
				} else {
					signUpTotals.previous += count;
				}
			}

			// Oldest first: cohort `week` signed up 7 x week + 7 to 7 x week + 1 days ago.
			const retention: CohortRetention[] = [];
			for (
				let week = FIRST_COMPLETE_COHORT + RETENTION_COHORTS - 1;
				week >= FIRST_COMPLETE_COHORT;
				week--
			) {
				const cohort = usage.cohorts[week];
				retention.push({
					day: weekStart(week),
					rate:
						cohort && cohort.size > 0
							? (cohort.retained[1] ?? 0) / cohort.size
							: null,
				});
			}

			const accountNames = new Map(
				tables.accounts.map((account) => [account.id, account.name]),
			);
			const signUps = tables.people
				.flatMap((person, personIndex): SignUp[] => {
					const age = calendarDaysAgo(person.joinedAt, now);
					if (age < 1 || age > days) {
						return [];
					}
					return [
						{
							id: person.id,
							name: person.name,
							email: person.email,
							accountId: person.accountId,
							accountName: accountNames.get(person.accountId) ?? "",
							channel: person.channel,
							status: signUpStatusOf(
								person.activatedAt !== null,
								tables.personUsage[personIndex]?.lastActiveDaysAgo ?? null,
							),
							joinedAt: person.joinedAt,
						},
					];
				})
				.sort((first, second) => second.joinedAt.localeCompare(first.joinedAt));

			return {
				signUpWeeks,
				signUpTotals,
				retention,
				retentionAverage: {
					current: meanRate(retention.slice(-AVERAGED_COHORTS)),
					previous: meanRate(
						retention.slice(-2 * AVERAGED_COHORTS, -AVERAGED_COHORTS),
					),
				},
				activeUsers: toDailyPoints(usage.activePeople, days, tables.todayStart),
				signUps,
			};
		},
	});
}

/** The email schedules: the samples, then the ones of this session. */
export function schedulesQueryOptions() {
	return queryOptions({
		queryKey: ["reports", "schedules"],
		queryFn: async () => listSchedules(),
	});
}

/** The notes thread of the team, the oldest first. */
export function notesQueryOptions() {
	return queryOptions({
		queryKey: ["reports", "notes"],
		queryFn: async () => listNotes(),
	});
}
