// Reads of the home: the KPI row and the figures of every card of one period.
// The loader of the home route prefetches the first period. OverviewPage reads it again when the period changes.
// The queryFn reads the sample tables. A later turn replaces its body with one SQL read function (rpc).
import { queryOptions } from "@tanstack/react-query";
import {
	ACTIVATION_STEP,
	CHANNELS,
	type Channel,
	type DailyPoint,
	dayKeyOf,
	EVENT_TYPES,
	FEATURE_AREAS,
	type FeatureArea,
	getSampleTables,
	type PeriodDays,
	type PeriodTotals,
	PLATFORMS,
	periodIndexOf,
	type SampleTables,
	startOfDayAgo,
	sumPeriod,
	toDailyPoints,
} from "~/features/tracking";

/** How many weeks the sign-up bars show. The totals compare them with the same count of weeks before. */
export const SIGN_UP_WEEKS = 6;

/** How many accounts the top accounts card lists. */
const TOP_ACCOUNT_COUNT = 6;

/** How many product areas the area card lists. */
const AREA_COUNT = 6;

/** A rate of the period and of the period before. null when a base is 0, so no delta shows. */
export type PeriodRates = { current: number | null; previous: number | null };

/** The events of one product area in the period, and in the period before. */
export type AreaEvents = PeriodTotals & { area: FeatureArea };

/** The events of one account in the period, and in the period before. */
export type AccountEvents = PeriodTotals & {
	/** The URL id of the account. */
	id: string;
	name: string;
};

/** The sign-ups of one week, split in two: teammate invites, and the other channels. */
export type SignUpWeek = {
	/** The first day of the week, YYYY-MM-DD. */
	day: string;
	invited: number;
	selfServe: number;
};

/** Every figure of the home for one period. Each total covers complete days: yesterday is the last day. */
export type Overview = {
	/** Accounts with one active user or more. */
	activeAccounts: PeriodTotals;
	/** The active users of an average day: user-days over the days of the period. */
	dailyActiveUsers: PeriodTotals;
	/** The users with one event or more in the period. */
	activeUsers: PeriodTotals;
	/** Every event of the product. */
	events: PeriodTotals;
	/** New users that completed a first task, over the new users. */
	activationRate: PeriodRates;
	/** All events per weekday, Monday first. Index 0 is Monday, 6 is Sunday. */
	weekdayEvents: number[];
	/** The AREA_COUNT busiest feature areas, the most events first. The first 3 fill the event volume card. */
	areas: AreaEvents[];
	/** The new users of the period: signed up, activated, and invited a teammate. */
	funnel: { signUps: number; activated: number; invited: number };
	/** The sign-ups per channel, in the order of CHANNELS. */
	channels: { channel: Channel; signUps: number }[];
	/** All events per day, oldest first. Feeds the small area chart. */
	dailyEvents: DailyPoint[];
	/** The active users per device kind: web and desktop app, or iOS and Android. */
	devices: { computer: number; phone: number };
	/** The accounts with the most events, the largest first. */
	topAccounts: AccountEvents[];
	/** The last SIGN_UP_WEEKS weeks, the oldest first. */
	signUpWeeks: SignUpWeek[];
	/** The invited and the other sign-ups of those weeks, and of the same count of weeks before. */
	signUpTotals: { invited: PeriodTotals; selfServe: PeriodTotals };
};

// A rate of two counts. No base gives no rate.
function rate(part: number, total: number): number | null {
	return total === 0 ? null : part / total;
}

// The sum of every row of a list of day tables: one day table of all of them.
function sumDayTables(dayTables: number[][]): number[] {
	return dayTables.reduce<number[]>(
		(total, dayTable) =>
			dayTable.map((count, daysAgo) => count + (total[daysAgo] ?? 0)),
		[],
	);
}

// The sum of a day table over the 7 days of week `week`. Week 0 is the last 7 complete days.
function weekSum(dayTable: number[], week: number): number {
	let sum = 0;
	for (let daysAgo = week * 7 + 1; daysAgo <= week * 7 + 7; daysAgo++) {
		sum += dayTable[daysAgo] ?? 0;
	}
	return sum;
}

// Builds every figure of the home for `days`. A SQL read function over the events table does this later.
function buildOverview(tables: SampleTables, days: PeriodDays): Overview {
	const { usage } = tables;
	const period = periodIndexOf(days);
	const allEvents = sumDayTables(usage.eventCounts);
	const personDays = sumPeriod(usage.activePeople, days);
	const funnel = usage.funnel[period];

	// getDay() gives 0 for Sunday. The card starts the week on Monday.
	const weekdayEvents = Array.from({ length: 7 }, () => 0);
	for (let daysAgo = 1; daysAgo <= days; daysAgo++) {
		const weekday = new Date(
			startOfDayAgo(tables.todayStart, daysAgo),
		).getDay();
		const index = (weekday + 6) % 7;
		weekdayEvents[index] =
			(weekdayEvents[index] ?? 0) + (allEvents[daysAgo] ?? 0);
	}

	const areas = FEATURE_AREAS.map((area): AreaEvents => {
		const areaTables = EVENT_TYPES.flatMap((type, eventIndex) =>
			type.area === area ? [usage.eventCounts[eventIndex] ?? []] : [],
		);
		return { area, ...sumPeriod(sumDayTables(areaTables), days) };
	})
		.sort((first, second) => second.current - first.current)
		.slice(0, AREA_COUNT);

	const platformPeople = PLATFORMS.map(
		(_, platformIndex) => usage.platformPeople[platformIndex]?.[period] ?? 0,
	);
	const isComputer = (platformIndex: number) =>
		PLATFORMS[platformIndex] === "web" ||
		PLATFORMS[platformIndex] === "desktop";

	const inviteIndex = CHANNELS.indexOf("invite");
	const invitedTable = usage.signUps[inviteIndex] ?? [];
	const selfServeTable = sumDayTables(
		usage.signUps.filter((_, channelIndex) => channelIndex !== inviteIndex),
	);
	const signUpWeeks: SignUpWeek[] = [];
	const invited = { current: 0, previous: 0 };
	const selfServe = { current: 0, previous: 0 };
	for (let week = 2 * SIGN_UP_WEEKS - 1; week >= 0; week--) {
		const invitedCount = weekSum(invitedTable, week);
		const selfServeCount = weekSum(selfServeTable, week);
		const totals = week < SIGN_UP_WEEKS ? "current" : "previous";
		invited[totals] += invitedCount;
		selfServe[totals] += selfServeCount;
		if (week < SIGN_UP_WEEKS) {
			signUpWeeks.push({
				day: dayKeyOf(startOfDayAgo(tables.todayStart, week * 7 + 7)),
				invited: invitedCount,
				selfServe: selfServeCount,
			});
		}
	}

	return {
		activeAccounts: tables.accountUsage.reduce(
			(totals, account) => {
				const people = account.uniquePeople[period];
				return {
					current: totals.current + ((people?.current ?? 0) > 0 ? 1 : 0),
					previous: totals.previous + ((people?.previous ?? 0) > 0 ? 1 : 0),
				};
			},
			{ current: 0, previous: 0 },
		),
		dailyActiveUsers: {
			current: personDays.current / days,
			previous: personDays.previous / days,
		},
		activeUsers: usage.uniquePeople[period] ?? { current: 0, previous: 0 },
		events: sumPeriod(allEvents, days),
		activationRate: {
			current: rate(
				funnel?.current[ACTIVATION_STEP] ?? 0,
				funnel?.current[0] ?? 0,
			),
			previous: rate(
				funnel?.previous[ACTIVATION_STEP] ?? 0,
				funnel?.previous[0] ?? 0,
			),
		},
		weekdayEvents,
		areas,
		funnel: {
			signUps: funnel?.current[0] ?? 0,
			activated: funnel?.current[ACTIVATION_STEP] ?? 0,
			// Step 3 of FUNNEL_STEPS is "invite_sent".
			invited: funnel?.current[3] ?? 0,
		},
		channels: CHANNELS.map((channel, channelIndex) => ({
			channel,
			signUps: sumPeriod(usage.signUps[channelIndex] ?? [], days).current,
		})),
		dailyEvents: toDailyPoints(allEvents, days, tables.todayStart),
		devices: {
			computer: platformPeople.reduce(
				(sum, people, platformIndex) =>
					sum + (isComputer(platformIndex) ? people : 0),
				0,
			),
			phone: platformPeople.reduce(
				(sum, people, platformIndex) =>
					sum + (isComputer(platformIndex) ? 0 : people),
				0,
			),
		},
		topAccounts: tables.accounts
			.map((account, accountIndex) => ({
				id: account.id,
				name: account.name,
				...sumPeriod(
					tables.accountUsage[accountIndex]?.dailyEvents ?? [],
					days,
				),
			}))
			.sort((first, second) => second.current - first.current)
			.slice(0, TOP_ACCOUNT_COUNT),
		signUpWeeks,
		signUpTotals: { invited, selfServe },
	};
}

/** Every figure of the home for the last `days` complete days, each with the `days` days before. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", days],
		queryFn: async (): Promise<Overview> =>
			buildOverview(getSampleTables(), days),
	});
}
