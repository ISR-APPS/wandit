// Reads of accounts: the list, one account with its people, features, and timeline, and its daily activity.
// The route loaders prefetch them. The account list, the account page, and the home read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	calendarDaysAgo,
	changeRatio,
	FEATURE_AREAS,
	getSampleTables,
	lastSeenToday,
	type MilestoneKind,
	type PeriodDays,
	type Plan,
	PRODUCT_AREAS,
	type ProductArea,
	pastDayTime,
	periodIndexOf,
	type Region,
	type Role,
	type SampleTables,
	shareOf,
	sumPeriod,
	toDailyPoints,
} from "~/features/tracking";
import { type AccountStatus, accountStatusOf } from "../lib/account-status";

/** The period of every figure of the account list, in complete days. */
export const ACCOUNT_LIST_DAYS: PeriodDays = 30;

/** How many people the account page lists. */
const TOP_PEOPLE_COUNT = 10;

/** One account with the figures of the last 30 complete days. The times are ISO texts. */
export type Account = {
	/** The URL id, for example "harborline-freight". */
	id: string;
	name: string;
	/** The mail domain of the company. */
	domain: string;
	/** Free text, for example "Logistics". */
	industry: string;
	region: Region;
	plan: Plan;
	/** How many seats the plan holds. */
	seats: number;
	/** How many people the account has. */
	members: number;
	createdAt: string;
	status: AccountStatus;
	/** The people with one event or more in the last 30 days. */
	activePeople: number;
	/** Ratio of `activePeople` against the 30 days before. null when that period had no active person. */
	change: number | null;
	/** The events of the last 30 days. */
	events: number;
	/** The time of the last event. null when the history holds none. */
	lastSeenAt: string | null;
};

/** One person of an account, with the use of the last 30 days. */
export type AccountPerson = {
	id: string;
	name: string;
	email: string;
	role: Role;
	/** The events of the last 30 complete days. */
	events: number;
	/** The time of the last event. null when the history holds none. */
	lastSeenAt: string | null;
};

/** One feature of the product in one account. */
export type AccountFeature = {
	area: ProductArea;
	/** The people of the account that used the feature in the last 30 days. */
	people: number;
	/** `people` over the active people of the account, from 0 to 1. */
	share: number;
};

/** One dated moment of an account, for its timeline. */
export type AccountMilestone = {
	/** Stable key of the row. */
	id: string;
	kind: MilestoneKind;
	at: string;
	/** The person that did it. null for a team size milestone. */
	personName: string | null;
	/** Only for "people_reached": the team size that the account reached. */
	peopleCount: number | null;
};

/** One account with the records that only its own page shows. */
export type AccountDetail = Account & {
	/** The person that created the account. */
	owner: { name: string; email: string };
	/** The most active people of the last 30 days, the most events first. */
	people: AccountPerson[];
	/** Every feature, the most used first. */
	features: AccountFeature[];
	/** The milestones, newest first. */
	timeline: AccountMilestone[];
};

// The time of the last event: today when the stream has one before now, else the last complete day.
function lastSeenOf(
	tables: SampleTables,
	seenToday: number | undefined,
	lastActiveDaysAgo: number | null,
	minute: number,
): string | null {
	if (seenToday !== undefined) {
		return new Date(seenToday).toISOString();
	}
	return lastActiveDaysAgo === null
		? null
		: pastDayTime(tables, lastActiveDaysAgo, minute);
}

// Builds the list row of the account at `index`. A SQL view over accounts and events does this later.
function toAccount(
	tables: SampleTables,
	index: number,
	seenToday: Map<number, number>,
	now: number,
): Account | null {
	const row = tables.accounts[index];
	const usage = tables.accountUsage[index];
	const people = usage?.uniquePeople[periodIndexOf(ACCOUNT_LIST_DAYS)];
	if (!row || !usage || !people) {
		return null;
	}
	const lastSeenAt = lastSeenOf(
		tables,
		seenToday.get(index),
		usage.lastActiveDaysAgo,
		usage.lastActiveMinute,
	);
	return {
		id: row.id,
		name: row.name,
		domain: row.domain,
		industry: row.industry,
		region: row.region,
		plan: row.plan,
		seats: row.seats,
		members: usage.members,
		createdAt: row.createdAt,
		status: accountStatusOf({
			createdDaysAgo: calendarDaysAgo(row.createdAt, now),
			lastSeenDaysAgo:
				lastSeenAt === null ? null : calendarDaysAgo(lastSeenAt, now),
			activePeople: people.current,
			previousActivePeople: people.previous,
		}),
		activePeople: people.current,
		change: changeRatio(people.current, people.previous),
		events: sumPeriod(usage.dailyEvents, ACCOUNT_LIST_DAYS).current,
		lastSeenAt,
	};
}

/** Every account, the newest first. The list page filters, sorts, and pages them; the home shows the first rows. */
export function accountsQueryOptions() {
	return queryOptions({
		queryKey: ["accounts", "list"],
		queryFn: async () => {
			const tables = getSampleTables();
			const now = Date.now();
			const seenToday = lastSeenToday(tables, now).byAccount;
			// LIMIT: every account in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			return tables.accounts
				.flatMap((_, index) => toAccount(tables, index, seenToday, now) ?? [])
				.sort((first, second) =>
					second.createdAt.localeCompare(first.createdAt),
				);
		},
	});
}

/** One account with its owner, people, features, and timeline. null when the id does not exist. */
export function accountQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["accounts", "detail", id],
		queryFn: async (): Promise<AccountDetail | null> => {
			const tables = getSampleTables();
			const now = Date.now();
			const seen = lastSeenToday(tables, now);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const index = tables.accounts.findIndex((row) => row.id === id);
			const account = toAccount(tables, index, seen.byAccount, now);
			const row = tables.accounts[index];
			const usage = tables.accountUsage[index];
			const owner = tables.people.find((person) => person.id === row?.ownerId);
			if (!account || !usage || !owner) {
				return null;
			}

			const people: AccountPerson[] = [];
			for (let offset = 0; offset < usage.members; offset++) {
				const personIndex = usage.firstPersonIndex + offset;
				const person = tables.people[personIndex];
				const personUsage = tables.personUsage[personIndex];
				if (person && personUsage) {
					people.push({
						id: person.id,
						name: person.name,
						email: person.email,
						role: person.role,
						events: personUsage.events30,
						lastSeenAt: lastSeenOf(
							tables,
							seen.byPerson.get(personIndex),
							personUsage.lastActiveDaysAgo,
							// The last event of a day comes about two hours after the usual start.
							Math.min(1435, personUsage.usualMinute + 120),
						),
					});
				}
			}
			people.sort(
				(first, second) =>
					second.events - first.events ||
					(second.lastSeenAt ?? "").localeCompare(first.lastSeenAt ?? ""),
			);

			const peopleNames = new Map(
				tables.people.map((person) => [person.id, person.name]),
			);
			return {
				...account,
				owner: { name: owner.name, email: owner.email },
				people: people.slice(0, TOP_PEOPLE_COUNT),
				features: FEATURE_AREAS.map((area) => {
					const count = usage.areaPeople[PRODUCT_AREAS.indexOf(area)] ?? 0;
					return {
						area,
						people: count,
						share: shareOf(count, account.activePeople),
					};
				}).sort((first, second) => second.people - first.people),
				timeline: tables.milestones
					.filter((milestone) => milestone.accountId === id)
					.sort((first, second) => second.at.localeCompare(first.at))
					.map((milestone) => ({
						id: `${milestone.kind}-${milestone.peopleCount ?? 0}`,
						kind: milestone.kind,
						at: milestone.at,
						personName: milestone.personId
							? (peopleNames.get(milestone.personId) ?? null)
							: null,
						peopleCount: milestone.peopleCount,
					})),
			};
		},
	});
}

/** The active people of one account per day for the last `days` complete days. Feeds the chart of the account page. */
export function accountActivityQueryOptions(id: string, days: PeriodDays) {
	return queryOptions({
		queryKey: ["accounts", "activity", id, days],
		queryFn: async () => {
			const tables = getSampleTables();
			const index = tables.accounts.findIndex((row) => row.id === id);
			const usage = tables.accountUsage[index];
			const people = usage?.uniquePeople[periodIndexOf(days)];
			if (!usage || !people) {
				return null;
			}
			return {
				points: toDailyPoints(usage.dailyPeople, days, tables.todayStart),
				/** The people with one event or more in the period, and in the period before. */
				people,
				/** The events of the period, and of the period before. */
				events: sumPeriod(usage.dailyEvents, days),
			};
		},
	});
}
