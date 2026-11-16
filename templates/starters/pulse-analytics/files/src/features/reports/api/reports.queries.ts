// Reads of the reports: retention by sign-up week, the activation funnel, sign-ups by channel, and active people by platform.
// The loader of the Reports route prefetches them. The cards of ReportsPage read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with one SQL read function (rpc).
import { queryOptions } from "@tanstack/react-query";
import {
	CHANNELS,
	type Channel,
	COHORT_WEEKS,
	dayKeyOf,
	FUNNEL_STEPS,
	type FunnelStepKey,
	getSampleTables,
	type PeriodDays,
	PLATFORMS,
	type Platform,
	periodIndexOf,
	startOfDayAgo,
} from "~/features/tracking";

/** How many later weeks the retention table shows after the sign-up week. */
export const RETENTION_WEEKS = 8;

/** The retention table skips the two newest sign-up weeks: they have no complete later week yet. */
const FIRST_RETENTION_COHORT = 2;

/** The periods of the funnel. 7 days hold too few new people for five steps. */
export const FUNNEL_PERIODS = [30, 90] as const satisfies readonly PeriodDays[];

/** One period choice of the funnel. */
export type FunnelDays = (typeof FUNNEL_PERIODS)[number];

/** The funnel period of the first load. The home shows the sign-ups and the activation rate of the same 30 days. */
export const DEFAULT_FUNNEL_DAYS: FunnelDays = 30;

/** The period of the platform panel, in complete days. */
export const PLATFORM_DAYS: PeriodDays = 30;

/** The people that signed up in one week, and how many of them came back in each later week. */
export type RetentionCohort = {
	/** The first day of the sign-up week, YYYY-MM-DD. Also the key of the row. */
	id: string;
	/** The last day of the sign-up week, YYYY-MM-DD. */
	lastDay: string;
	/** The people that signed up in the week. */
	size: number;
	/** Per later week (week 1 first): the people active in it. null while that week is not complete. */
	retained: (number | null)[];
};

/** One step of the activation funnel. */
export type FunnelStep = {
	/** The event that marks the step. */
	eventKey: FunnelStepKey;
	/** The new people of the period that reached the step. */
	people: number;
};

/** The sign-ups of one week, split by channel. */
export type SignUpWeek = {
	/** The first day of the week, YYYY-MM-DD. */
	day: string;
	/** The last day of the week, YYYY-MM-DD. */
	lastDay: string;
} & Record<Channel, number>;

/** The weeks of the retention table, the oldest first. Each has the sign-up week and up to RETENTION_WEEKS later weeks. */
export function retentionQueryOptions() {
	return queryOptions({
		queryKey: ["reports", "retention"],
		queryFn: async (): Promise<RetentionCohort[]> => {
			const tables = getSampleTables();
			const cohorts: RetentionCohort[] = [];
			// Week 0 is the last 7 complete days. Week `week` starts 7 x week + 7 days ago.
			for (
				let week = COHORT_WEEKS - 1;
				week >= FIRST_RETENTION_COHORT;
				week--
			) {
				const cohort = tables.usage.cohorts[week];
				if (!cohort) {
					continue;
				}
				cohorts.push({
					id: dayKeyOf(startOfDayAgo(tables.todayStart, week * 7 + 7)),
					lastDay: dayKeyOf(startOfDayAgo(tables.todayStart, week * 7 + 1)),
					size: cohort.size,
					retained: Array.from({ length: RETENTION_WEEKS }, (_, index) => {
						const laterWeek = index + 1;
						// The newest person of the week signed up 7 x week + 1 days ago.
						// Later week `laterWeek` is complete for that person after 7 x laterWeek + 6 more days.
						return laterWeek <= week - 1
							? (cohort.retained[laterWeek] ?? 0)
							: null;
					}),
				});
			}
			return cohorts;
		},
	});
}

/** The activation funnel of the people that signed up in the last `days` complete days. */
export function funnelQueryOptions(days: FunnelDays) {
	return queryOptions({
		queryKey: ["reports", "funnel", days],
		queryFn: async (): Promise<FunnelStep[]> => {
			const steps = getSampleTables().usage.funnel[periodIndexOf(days)];
			return FUNNEL_STEPS.map((eventKey, step) => ({
				eventKey,
				people: steps?.current[step] ?? 0,
			}));
		},
	});
}

/** The sign-ups of the last 12 weeks by channel, the oldest week first. The weeks are the weeks of the retention table. */
export function signUpsByChannelQueryOptions() {
	return queryOptions({
		queryKey: ["reports", "sign-ups-by-channel"],
		queryFn: async (): Promise<SignUpWeek[]> => {
			const tables = getSampleTables();
			const weeks: SignUpWeek[] = [];
			for (let week = COHORT_WEEKS - 1; week >= 0; week--) {
				const row: SignUpWeek = {
					day: dayKeyOf(startOfDayAgo(tables.todayStart, week * 7 + 7)),
					lastDay: dayKeyOf(startOfDayAgo(tables.todayStart, week * 7 + 1)),
					invite: 0,
					organic: 0,
					direct: 0,
					referral: 0,
					paid: 0,
				};
				CHANNELS.forEach((channel, channelIndex) => {
					const dayTable = tables.usage.signUps[channelIndex] ?? [];
					for (let daysAgo = week * 7 + 1; daysAgo <= week * 7 + 7; daysAgo++) {
						row[channel] += dayTable[daysAgo] ?? 0;
					}
				});
				weeks.push(row);
			}
			return weeks;
		},
	});
}

/** The active people of the last 30 complete days by platform, the largest first. Each person has one platform. */
export function platformPeopleQueryOptions() {
	return queryOptions({
		queryKey: ["reports", "platform-people"],
		queryFn: async (): Promise<{ platform: Platform; people: number }[]> => {
			const { usage } = getSampleTables();
			const period = periodIndexOf(PLATFORM_DAYS);
			return PLATFORMS.map((platform, platformIndex) => ({
				platform,
				people: usage.platformPeople[platformIndex]?.[period] ?? 0,
			})).sort((first, second) => second.people - first.people);
		},
	});
}
