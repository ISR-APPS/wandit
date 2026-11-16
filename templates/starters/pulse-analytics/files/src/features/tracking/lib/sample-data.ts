// The sample tables of the analytics app: accounts, people, milestones, and the counters of their product use.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The tables stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// The file plays 180 days of product use, person by person, with a seeded generator. So every total agrees with its parts.
// LIMIT: every date is relative to the current day, so the history moves by one day at midnight. Upgrade: real tables (STARTER.md).
import { ACCOUNT_SEEDS, type AccountSeed } from "./account-seeds";
import {
	CHANNELS,
	type Channel,
	PLATFORMS,
	type Plan,
	type Platform,
	type Region,
	type Role,
} from "./dimensions";
import {
	EVENT_TYPES,
	eventIndexOf,
	FUNNEL_STEPS,
	PRODUCT_AREAS,
} from "./event-types";
import { MAX_NAMED_PEOPLE, personNameAt } from "./person-names";
import { PERIOD_DAYS, type PeriodTotals } from "./series";
import { MINUTE_MS, startOfDayAgo, startOfLocalDay } from "./time";

/** One customer account: a company that uses the product. The times are ISO texts. */
export type AccountRow = {
	/** The URL id, made from the name: "harborline-freight". */
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
	createdAt: string;
	/** The person that created the account. */
	ownerId: string;
};

/** One person of an account. */
export type PersonRow = {
	id: string;
	accountId: string;
	name: string;
	email: string;
	role: Role;
	/** Where the person uses the product most. */
	platform: Platform;
	/** How the person found the product. */
	channel: Channel;
	/** The sign-up time. */
	joinedAt: string;
};

/** The kinds of a milestone on the timeline of an account. */
export type MilestoneKind =
	| "created"
	| "upgraded"
	| "people_reached"
	| "integration_connected"
	| "automation_created";

/** One dated moment in the life of an account. */
export type MilestoneRow = {
	accountId: string;
	kind: MilestoneKind;
	at: string;
	/** The person that did it. null for a team size milestone. */
	personId: string | null;
	/** Only for "people_reached": the team size that the account reached. */
	peopleCount: number | null;
};

/**
 * The counters of the whole product. A SQL read function over an `events` table gives each one later.
 * A day table has one entry per day: the index is "days ago", 1 is yesterday, and 0 (today) stays empty.
 * A period list has one entry per choice of PERIOD_DAYS, in the same order.
 */
export type ProductUsage = {
	/** Day table: the people with one event or more on that day. */
	activePeople: number[];
	/** Per period: the people with one event or more in the period, and in the period before. */
	uniquePeople: PeriodTotals[];
	/** Per channel of CHANNELS, a day table of the new people. */
	signUps: number[][];
	/** Per event of EVENT_TYPES, a day table of the event count. */
	eventCounts: number[][];
	/** Per event, per period: the people that did the event. */
	eventPeople: number[][];
	/** Per event, per platform of PLATFORMS, per period: the event count. */
	eventPlatformCounts: number[][][];
	/** Per area of PRODUCT_AREAS, per period: the people that used the area. */
	areaPeople: number[][];
	/** Per platform, per period: the active people. */
	platformPeople: number[][];
	/** Per period: the new people of the period that reached each step of FUNNEL_STEPS, and of the period before. */
	funnel: { current: number[]; previous: number[] }[];
	/** Per sign-up week (0 is the last 7 complete days): the new people, and how many came back in each later week. */
	cohorts: { size: number; retained: number[] }[];
};

/** The counters of one account. `ProductUsage` explains the day tables and the period lists. */
export type AccountUsage = {
	/** The place of the first person of the account in `people`. Its people follow in one block. */
	firstPersonIndex: number;
	/** How many people the account has. */
	members: number;
	/** Day table: the active people of the account. */
	dailyPeople: number[];
	/** Day table: the events of the account. */
	dailyEvents: number[];
	/** Per period: the active people of the account, and of the period before. */
	uniquePeople: PeriodTotals[];
	/** Per area of PRODUCT_AREAS: the people that used the area in the last 30 days. */
	areaPeople: number[];
	/** Per event of EVENT_TYPES, per period: the event count of the account. */
	eventCounts: number[][];
	/** The last complete day with an event, in days ago. null when the history holds none. */
	lastActiveDaysAgo: number | null;
	/** The minute of that day (0 to 1439) of the last event. */
	lastActiveMinute: number;
};

/** The counters of one person. */
export type PersonUsage = {
	/** The events of the last 30 complete days. */
	events30: number;
	/** The last complete day with an event, in days ago. null when the history holds none. */
	lastActiveDaysAgo: number | null;
	/** The minute of the day (0 to 1439) when the person usually starts. */
	usualMinute: number;
};

/** One event of the stream of today and yesterday. The indexes point into the lists of SampleTables. */
export type RecentEvent = {
	/** Milliseconds since 1970. */
	at: number;
	personIndex: number;
	/** The place of the event in EVENT_TYPES. */
	eventIndex: number;
};

/** Every sample table. `accounts`, `accountUsage`, `people`, and `personUsage` share their indexes. */
export type SampleTables = {
	/** The local midnight of the day of the tables, in milliseconds since 1970. */
	todayStart: number;
	accounts: AccountRow[];
	accountUsage: AccountUsage[];
	people: PersonRow[];
	personUsage: PersonUsage[];
	milestones: MilestoneRow[];
	usage: ProductUsage;
	/** Each event of yesterday and of the whole of today, newest first. A read keeps only the events before now. */
	recentEvents: RecentEvent[];
};

/** The length of the history in complete days: two times the longest period. */
export const HISTORY_DAYS = 180;

/** The count of sign-up weeks of the retention table and of the sign-up chart. */
export const COHORT_WEEKS = 12;

// The team sizes that put a milestone on the timeline of an account.
const TEAM_SIZE_MILESTONES = [10, 25, 50, 100, 250];

// How busy each weekday is against a normal work day. Index 0 is Sunday.
// The busiest people come almost every work day, so a weekend load of 0.55 gives about 45 % of the people of a work day.
const WEEKDAY_LOAD = [0.55, 1, 1.04, 1.05, 1.02, 0.9, 0.5];

// The product grows: the chance to be active on a day rises by this share from 180 days ago to today.
const USE_GROWTH = 0.12;

// Each calendar day is a little busier or quieter than its weekday (releases, holidays): up to this share up or down.
const DAY_SWING = 0.08;

// 24 hours in milliseconds. It numbers the calendar days, so a date keeps its swing when the history moves.
const DAY_MS = 86_400_000;

// The hour of the viewer's day around which the people of a region start to work.
const REGION_START_HOUR = { emea: 10, americas: 16, apac: 3 } satisfies Record<
	Region,
	number
>;

// The chance that a new person does each later step of FUNNEL_STEPS, 180 days ago.
// The product gets better: the chance of the first two steps rises by ACTIVATION_GAIN until today.
const STEP_CHANCE = [0.66, 0.74, 0.5, 0.42];
const ACTIVATION_GAIN = 0.15;
// The most days between two steps, for each later step. A new person creates a project and completes
// a task in the first session, so a sign-up of yesterday counts in the activation rate like an older one.
const STEP_MAX_DELAY = [0, 0, 7, 12];

const SESSION_STARTED = eventIndexOf("session_started");
const SIGNED_UP = eventIndexOf("signed_up");
const PLAN_UPGRADED = eventIndexOf("plan_upgraded");
const AUTOMATION_RUN = eventIndexOf("automation_run");
const AUTOMATION_CREATED = eventIndexOf("automation_created");
const INTEGRATION_CONNECTED = eventIndexOf("integration_connected");
const FUNNEL_EVENT_INDEXES = FUNNEL_STEPS.map((key) => eventIndexOf(key));

/**
 * A small seeded generator (mulberry32). The same seed gives the same numbers from 0 to 1 on every device.
 * The tables never call Math.random, so two renders show the same rows.
 */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = state;
		mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function zeros(length: number): number[] {
	return Array.from({ length }, () => 0);
}

function grid(rows: number, columns: number): number[][] {
	return Array.from({ length: rows }, () => zeros(columns));
}

// A row that the code created a few lines before. A missing row is a bug in this file, so it throws.
function rowAt<Row>(table: Row[], index: number): Row {
	const value = table[index];
	if (value === undefined) {
		throw new Error(`sample-data: no row at index ${index}`);
	}
	return value;
}

function addAt(table: number[], index: number, amount: number): void {
	table[index] = (table[index] ?? 0) + amount;
}

// "Saffron & Slate" gives "saffron-slate": the URL id of an account.
function slugOf(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** The plan of one person for the whole history: who the person is and how the person behaves. */
type PersonPlan = {
	/** The sign-up day in days ago. It can be before the history. */
	joinedDaysAgo: number;
	/** The chance to be active on a normal work day, from 0 to 1. */
	dailyChance: number;
	/** How many events an active day gets, against a regular person (1). */
	intensity: number;
	/** The person stops for good after this many days in the product. null: the person stays. */
	lifeDays: number | null;
	/** The person of a fading or a gone account is inactive from this day until today. -1: the person stays. */
	stoppedDaysAgo: number;
	role: Role;
	platformIndex: number;
	channelIndex: number;
	usualMinute: number;
	/** Per step of FUNNEL_STEPS: the day of the step in days ago, or -1 when the person did not reach it. */
	stepDays: number[];
};

// Plans one person from a fixed count of draws, so the next person gets the same draws on every day.
function planPerson(
	seed: AccountSeed,
	memberIndex: number,
	random: () => number,
	isWeekend: (daysAgo: number) => boolean,
): PersonPlan {
	const tierDraw = random();
	const chanceDraw = random();
	const joinDraw = random();
	const weekendDraw = random();
	const dropDraw = random();
	const lifeDraw = random();
	const stopDraw = random();
	const stopDayDraw = random();
	const platformDraw = random();
	const channelDraw = random();
	const roleDraw = random();
	const hourSpread = random() + random() + random() - 1.5;
	const stepDraws = STEP_CHANCE.map(() => random());
	const delayDraws = STEP_CHANCE.map(() => random());

	// The people of an account that left stopped to join before its last active day.
	const newestJoin = seed.trend === "gone" ? seed.quietDays + 3 : 1;
	let joinedDaysAgo = seed.createdDaysAgo;
	if (memberIndex > 0) {
		// A high exponent puts most joins near the creation. A growing account still gets new people now.
		const exponent =
			seed.trend === "growing" ? 0.55 : seed.trend === "fading" ? 3 : 1.6;
		joinedDaysAgo -= Math.floor(
			(seed.createdDaysAgo - newestJoin) * joinDraw ** exponent,
		);
		// Three of four weekend sign-ups move to the nearest work day: teams invite people at work.
		if (isWeekend(joinedDaysAgo) && weekendDraw < 0.75) {
			const workDay = [1, -1, 2, -2]
				.map((shift) => joinedDaysAgo + shift)
				.find(
					(day) =>
						day >= newestJoin && day <= seed.createdDaysAgo && !isWeekend(day),
				);
			joinedDaysAgo = workDay ?? joinedDaysAgo;
		}
	}

	// The core of the team: the first 3 people, or the first 14 of a team of 30 or more. The core stays and is the most active.
	// Only the first 40 people can be power users, so the most active people of a large account
	// have different first names (person-names.ts).
	const isCore = memberIndex < (seed.members >= 30 ? 14 : 3);
	const isPower = isCore || (memberIndex < 40 && tierDraw < 0.2);
	const isRegular = !isPower && tierDraw < 0.62;
	const role: Role =
		memberIndex === 0 || roleDraw < 0.07
			? "admin"
			: roleDraw < 0.84 || isCore
				? "member"
				: "viewer";
	// Three people in five (not in the core) leave in the first two months, about half of them in the first week.
	// The retention table then falls from about 60 % in week 1 to about 40 % in week 8.
	const lifeDays =
		!isCore && dropDraw < 0.6 ? 1 + Math.floor(lifeDraw ** 3.5 * 60) : null;
	// In a gone account the owner leaves last. The others stop over the 4 weeks before, not on one day.
	const stoppedDaysAgo =
		seed.trend === "fading" && !isCore && stopDraw < 0.6
			? 18 + Math.floor(stopDayDraw * 42)
			: seed.trend === "gone" && memberIndex > 0
				? seed.quietDays + 1 + Math.floor(stopDayDraw * 28)
				: -1;

	const channelIndex =
		memberIndex === 0
			? // The founder of an account never comes from an invite.
				1 + Math.min(3, Math.floor(channelDraw ** 1.4 * 4))
			: channelDraw < 0.72
				? 0
				: 1 + Math.min(3, Math.floor(((channelDraw - 0.72) / 0.28) ** 1.3 * 4));
	const platformIndex =
		platformDraw < 0.56
			? 0
			: platformDraw < 0.8
				? 1
				: platformDraw < 0.92
					? 2
					: 3;
	const startMinute = (REGION_START_HOUR[seed.region] + hourSpread * 3.2) * 60;
	const usualMinute = Math.floor((startMinute + 1440) % 1440);

	// The funnel: each step needs the step before, and happens a few days after it.
	const stepDays = [joinedDaysAgo];
	const recency = 1 - Math.min(joinedDaysAgo, HISTORY_DAYS) / HISTORY_DAYS;
	let stepDay = joinedDaysAgo;
	let isReached = joinedDaysAgo <= HISTORY_DAYS;
	STEP_CHANCE.forEach((baseChance, step) => {
		const gain = step < 2 ? ACTIVATION_GAIN * recency : 0;
		const delayDraw = delayDraws[step] ?? 0;
		stepDay -= Math.floor(delayDraw ** 2 * ((STEP_MAX_DELAY[step] ?? 0) + 1));
		isReached =
			isReached &&
			(stepDraws[step] ?? 1) < baseChance + gain &&
			// The step is in the past, and the person was still in the product on that day.
			stepDay >= 1 &&
			stepDay > stoppedDaysAgo &&
			(seed.trend !== "gone" || stepDay > seed.quietDays) &&
			(lifeDays === null || joinedDaysAgo - stepDay <= lifeDays);
		stepDays.push(isReached ? stepDay : -1);
	});

	return {
		joinedDaysAgo,
		dailyChance: isPower
			? 0.8 + chanceDraw * 0.12
			: isRegular
				? 0.22 + chanceDraw * 0.22
				: 0.06 + chanceDraw * 0.14,
		intensity:
			(isCore ? 2.1 : isPower ? 1.6 : isRegular ? 1 : 0.55) *
			(role === "viewer" ? 0.6 : 1),
		lifeDays,
		stoppedDaysAgo,
		role,
		platformIndex,
		channelIndex,
		usualMinute,
		stepDays,
	};
}

// How much of its normal use an account has on a day, from 0 to 1.
function trendLoad(seed: AccountSeed, daysAgo: number): number {
	if (seed.trend === "fading") {
		// The use falls in a line over the last 75 days, down to 30 % today.
		return daysAgo >= 75 ? 1 : 0.3 + (0.7 * daysAgo) / 75;
	}
	if (seed.trend === "gone") {
		if (daysAgo <= seed.quietDays) {
			return 0;
		}
		// The use fell over the 40 days before the account left.
		const daysBeforeQuiet = daysAgo - seed.quietDays;
		return daysBeforeQuiet >= 40 ? 1 : 0.25 + (0.75 * daysBeforeQuiet) / 40;
	}
	return 1;
}

/**
 * The events that an active person can do by chance, for one account: the event indexes and their running weights.
 * Each account uses the areas in its own mix, so the feature panels of two accounts differ.
 */
function buildEventPicker(
	seed: AccountSeed,
	random: () => number,
): (draw: number) => number {
	const areaFactor = PRODUCT_AREAS.map((area) => {
		const draw = random();
		// A small team often has no automation and no integration.
		const isAdvanced = area === "automations" || area === "integrations";
		return isAdvanced && seed.members < 8 && draw < 0.6 ? 0 : 0.35 + draw * 1.4;
	});
	const indexes: number[] = [];
	const limits: number[] = [];
	let total = 0;
	EVENT_TYPES.forEach((type, eventIndex) => {
		const weight =
			type.weight * (areaFactor[PRODUCT_AREAS.indexOf(type.area)] ?? 1);
		if (weight > 0) {
			total += weight;
			indexes.push(eventIndex);
			limits.push(total);
		}
	});
	return (draw) => {
		const target = draw * total;
		const place = limits.findIndex((limit) => target < limit);
		return (
			indexes[place === -1 ? indexes.length - 1 : place] ?? SESSION_STARTED
		);
	};
}

// Plays the history of every account and person, and fills every table and counter.
function buildSampleTables(todayStart: number): SampleTables {
	const identity = createRandom(20_240_917);
	const periodCount = PERIOD_DAYS.length;
	const dayStarts = Array.from({ length: HISTORY_DAYS + 1 }, (_, daysAgo) =>
		startOfDayAgo(todayStart, daysAgo),
	);
	const weekdays = dayStarts.map((start) => new Date(start).getDay());
	const daySwings = dayStarts.map(
		(start) =>
			1 + DAY_SWING * (2 * createRandom(Math.round(start / DAY_MS))() - 1),
	);
	const isWeekend = (daysAgo: number) => {
		const weekday = weekdays[Math.min(Math.max(daysAgo, 0), HISTORY_DAYS)];
		return weekday === 0 || weekday === 6;
	};
	// An ISO time on a past day. A day before the history has no entry in dayStarts.
	const isoAt = (daysAgo: number, minute: number) =>
		new Date(
			(dayStarts[daysAgo] ?? startOfDayAgo(todayStart, daysAgo)) +
				minute * MINUTE_MS,
		).toISOString();

	const usage: ProductUsage = {
		activePeople: zeros(HISTORY_DAYS + 1),
		uniquePeople: PERIOD_DAYS.map(() => ({ current: 0, previous: 0 })),
		signUps: grid(CHANNELS.length, HISTORY_DAYS + 1),
		eventCounts: grid(EVENT_TYPES.length, HISTORY_DAYS + 1),
		eventPeople: grid(EVENT_TYPES.length, periodCount),
		eventPlatformCounts: EVENT_TYPES.map(() =>
			grid(PLATFORMS.length, periodCount),
		),
		areaPeople: grid(PRODUCT_AREAS.length, periodCount),
		platformPeople: grid(PLATFORMS.length, periodCount),
		funnel: PERIOD_DAYS.map(() => ({
			current: zeros(FUNNEL_STEPS.length),
			previous: zeros(FUNNEL_STEPS.length),
		})),
		cohorts: Array.from({ length: COHORT_WEEKS }, () => ({
			size: 0,
			retained: zeros(COHORT_WEEKS),
		})),
	};
	const accounts: AccountRow[] = [];
	const accountUsage: AccountUsage[] = [];
	const people: PersonRow[] = [];
	const personUsage: PersonUsage[] = [];
	const milestones: MilestoneRow[] = [];
	const recentEvents: RecentEvent[] = [];
	const eventAreaIndexes = EVENT_TYPES.map((type) =>
		PRODUCT_AREAS.indexOf(type.area),
	);

	for (const seed of ACCOUNT_SEEDS) {
		const accountId = slugOf(seed.name);
		const domain = `${seed.domain}.example`;
		const pickEvent = buildEventPicker(seed, identity);
		// A paid account moved to its plan on any day from its 6th day. A gone account did it before its quiet days,
		// and a fading account before its decline of 75 days (trendLoad): nobody upgrades while the use falls.
		// So about 8 of the 53 paid accounts upgrade in a 30-day period.
		const upgradeDraw = identity();
		const latestUpgrade =
			seed.trend === "gone"
				? seed.quietDays + 3
				: seed.trend === "fading"
					? 76
					: 1;
		const upgradeSpan = Math.max(0, seed.createdDaysAgo - 5 - latestUpgrade);
		const upgradeDaysAgo =
			seed.plan === "free"
				? -1
				: Math.max(
						latestUpgrade,
						seed.createdDaysAgo -
							5 -
							Math.floor(upgradeDraw * (upgradeSpan + 1)),
					);
		const account: AccountUsage = {
			firstPersonIndex: people.length,
			members: seed.members,
			dailyPeople: zeros(HISTORY_DAYS + 1),
			dailyEvents: zeros(HISTORY_DAYS + 1),
			uniquePeople: PERIOD_DAYS.map(() => ({ current: 0, previous: 0 })),
			areaPeople: zeros(PRODUCT_AREAS.length),
			eventCounts: grid(EVENT_TYPES.length, periodCount),
			lastActiveDaysAgo: null,
			lastActiveMinute: 0,
		};
		// The newest use of two events that the timeline shows: the day and the person.
		const latestUse = new Map<number, { daysAgo: number; personId: string }>();
		const joinDays: number[] = [];

		for (let memberIndex = 0; memberIndex < seed.members; memberIndex++) {
			const personIndex = people.length;
			if (personIndex >= MAX_NAMED_PEOPLE) {
				throw new Error("sample-data: more people than names");
			}
			const plan = planPerson(seed, memberIndex, identity, isWeekend);
			const name = personNameAt(personIndex);
			const personId = `person-${personIndex + 1}`;
			joinDays.push(plan.joinedDaysAgo);
			people.push({
				id: personId,
				accountId,
				name: `${name.first} ${name.last}`,
				email: `${name.first}.${name.last}@${domain}`.toLowerCase(),
				role: plan.role,
				platform: PLATFORMS[plan.platformIndex] ?? "web",
				channel: CHANNELS[plan.channelIndex] ?? "direct",
				joinedAt: isoAt(plan.joinedDaysAgo, plan.usualMinute),
			});

			// Each person has an own generator, so the days of one person do not move the days of the next.
			const activity = createRandom(77_003 + personIndex * 7919);
			const activeDays = zeros(HISTORY_DAYS + 1);
			// Per event: the newest complete day on which the person did it, in days ago. 0: never.
			const lastDone = zeros(EVENT_TYPES.length);
			let events30 = 0;
			// The time of the next stream event of the day, in milliseconds since 1970.
			let clock = 0;
			let day = 0;

			// Writes `count` events of one type on the current day of the person.
			const record = (eventIndex: number, count: number) => {
				if (day >= 1) {
					addAt(rowAt(usage.eventCounts, eventIndex), day, count);
					addAt(account.dailyEvents, day, count);
					lastDone[eventIndex] = day;
					const platformCounts = rowAt(
						rowAt(usage.eventPlatformCounts, eventIndex),
						plan.platformIndex,
					);
					const accountCounts = rowAt(account.eventCounts, eventIndex);
					PERIOD_DAYS.forEach((days, period) => {
						if (day <= days) {
							addAt(platformCounts, period, count);
							addAt(accountCounts, period, count);
						}
					});
					if (day <= 30) {
						events30 += count;
					}
					const isTimelineEvent =
						eventIndex === INTEGRATION_CONNECTED ||
						eventIndex === AUTOMATION_CREATED;
					const latest = latestUse.get(eventIndex);
					if (isTimelineEvent && (!latest || day < latest.daysAgo)) {
						latestUse.set(eventIndex, { daysAgo: day, personId });
					}
				}
				// The stream shows single events, so today and yesterday also get one row per event.
				if (day <= 1) {
					// One time in five the person takes a break of 30 minutes to 2.5 hours first.
					if (activity() < 0.2) {
						clock += (30 + activity() * 120) * MINUTE_MS;
					}
					for (let done = 0; done < count; done++) {
						// 20 seconds to 10 minutes pass between two events.
						clock += (20 + Math.floor(activity() * 580)) * 1000;
						recentEvents.push({ at: clock, personIndex, eventIndex });
					}
				}
			};

			for (day = Math.min(plan.joinedDaysAgo, HISTORY_DAYS); day >= 0; day--) {
				const tenureDays = plan.joinedDaysAgo - day;
				const isUpgradeDay = memberIndex === 0 && day === upgradeDaysAgo;
				// A sign-up, a funnel step, and a plan upgrade are events, so their day is an active day.
				const isCertain =
					tenureDays === 0 || isUpgradeDay || plan.stepDays.includes(day);
				let chance =
					plan.dailyChance *
					(WEEKDAY_LOAD[weekdays[day] ?? 1] ?? 1) *
					trendLoad(seed, day) *
					(daySwings[day] ?? 1) *
					(1 + (USE_GROWTH * (HISTORY_DAYS - day)) / HISTORY_DAYS);
				// A new person explores the product in the first week.
				if (tenureDays <= 6) {
					chance = Math.min(0.95, chance * 1.4 + 0.12);
				}
				if (
					(plan.lifeDays !== null && tenureDays > plan.lifeDays) ||
					day <= plan.stoppedDaysAgo ||
					(seed.trend === "gone" && day <= seed.quietDays)
				) {
					chance = 0;
				}
				const roll = activity();
				if (!isCertain && roll >= chance) {
					continue;
				}

				if (day >= 1) {
					activeDays[day] = 1;
					addAt(usage.activePeople, day, 1);
					addAt(account.dailyPeople, day, 1);
				}
				if (day <= 1) {
					// The first event of the day comes up to 75 minutes before or after the usual start.
					clock =
						rowAt(dayStarts, day) +
						(plan.usualMinute + activity() * 150 - 75) * MINUTE_MS;
				}
				record(SESSION_STARTED, activity() < 0.3 ? 2 : 1);
				if (tenureDays === 0 && day >= 1) {
					record(SIGNED_UP, 1);
					addAt(rowAt(usage.signUps, plan.channelIndex), day, 1);
				}
				if (isUpgradeDay) {
					record(PLAN_UPGRADED, 1);
				}
				plan.stepDays.forEach((stepDay, step) => {
					// Step 0 is the sign-up, written above.
					if (step > 0 && stepDay === day) {
						record(rowAt(FUNNEL_EVENT_INDEXES, step), 1);
					}
				});
				const picks = 1 + Math.floor(activity() * 3.2 * plan.intensity);
				for (let pick = 0; pick < picks; pick++) {
					const eventIndex = pickEvent(activity());
					const count = 1 + Math.floor(activity() * activity() * 9);
					// One automation run starts several runs: a rule fires for each matching task.
					record(eventIndex, eventIndex === AUTOMATION_RUN ? count * 3 : count);
				}
			}

			// The person is done. Add the person to each counter of people.
			const isActiveIn = PERIOD_DAYS.map(() => ({
				current: false,
				previous: false,
			}));
			let lastActiveDaysAgo: number | null = null;
			for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
				if (activeDays[daysAgo] !== 1) {
					continue;
				}
				lastActiveDaysAgo = daysAgo;
				PERIOD_DAYS.forEach((days, period) => {
					const flags = rowAt(isActiveIn, period);
					if (daysAgo <= days) {
						flags.current = true;
					} else if (daysAgo <= 2 * days) {
						flags.previous = true;
					}
				});
			}
			isActiveIn.forEach((flags, period) => {
				if (flags.current) {
					rowAt(usage.uniquePeople, period).current += 1;
					rowAt(account.uniquePeople, period).current += 1;
					addAt(rowAt(usage.platformPeople, plan.platformIndex), period, 1);
				}
				if (flags.previous) {
					rowAt(usage.uniquePeople, period).previous += 1;
					rowAt(account.uniquePeople, period).previous += 1;
				}
			});

			// Per area: the newest day on which the person used it. 0: never.
			const areaLastDone = zeros(PRODUCT_AREAS.length);
			lastDone.forEach((daysAgo, eventIndex) => {
				if (daysAgo === 0) {
					return;
				}
				PERIOD_DAYS.forEach((days, period) => {
					if (daysAgo <= days) {
						addAt(rowAt(usage.eventPeople, eventIndex), period, 1);
					}
				});
				const areaIndex = rowAt(eventAreaIndexes, eventIndex);
				const areaDay = areaLastDone[areaIndex] ?? 0;
				areaLastDone[areaIndex] =
					areaDay === 0 ? daysAgo : Math.min(areaDay, daysAgo);
			});
			areaLastDone.forEach((daysAgo, areaIndex) => {
				if (daysAgo === 0) {
					return;
				}
				PERIOD_DAYS.forEach((days, period) => {
					if (daysAgo <= days) {
						addAt(rowAt(usage.areaPeople, areaIndex), period, 1);
					}
				});
				if (daysAgo <= 30) {
					addAt(account.areaPeople, areaIndex, 1);
				}
			});

			// The funnel of each period counts the people that signed up in it.
			PERIOD_DAYS.forEach((days, period) => {
				const funnel = rowAt(usage.funnel, period);
				const steps =
					plan.joinedDaysAgo <= days
						? funnel.current
						: plan.joinedDaysAgo <= 2 * days
							? funnel.previous
							: null;
				plan.stepDays.forEach((stepDay, step) => {
					if (steps && stepDay >= 1) {
						addAt(steps, step, 1);
					}
				});
			});

			// The retention table: week 0 is the 7 days from the sign-up day, week 1 the 7 days after, and so on.
			if (plan.joinedDaysAgo <= COHORT_WEEKS * 7) {
				const cohort = rowAt(
					usage.cohorts,
					Math.floor((plan.joinedDaysAgo - 1) / 7),
				);
				cohort.size += 1;
				for (let week = 0; week < COHORT_WEEKS; week++) {
					const weekStart = plan.joinedDaysAgo - week * 7;
					if (weekStart < 1) {
						break;
					}
					const weekEnd = Math.max(1, weekStart - 6);
					if (activeDays.slice(weekEnd, weekStart + 1).includes(1)) {
						addAt(cohort.retained, week, 1);
					}
				}
			}

			personUsage.push({
				events30,
				lastActiveDaysAgo,
				usualMinute: plan.usualMinute,
			});
			// The last event of a day comes about two hours after the usual start, before midnight.
			const lastMinute = Math.min(1435, plan.usualMinute + 120);
			if (
				lastActiveDaysAgo !== null &&
				(account.lastActiveDaysAgo === null ||
					lastActiveDaysAgo < account.lastActiveDaysAgo)
			) {
				account.lastActiveDaysAgo = lastActiveDaysAgo;
				account.lastActiveMinute = lastMinute;
			} else if (lastActiveDaysAgo === account.lastActiveDaysAgo) {
				account.lastActiveMinute = Math.max(
					account.lastActiveMinute,
					lastMinute,
				);
			}
		}

		// The account rows and its timeline.
		const owner = rowAt(people, account.firstPersonIndex);
		const ownerMinute = rowAt(
			personUsage,
			account.firstPersonIndex,
		).usualMinute;
		accounts.push({
			id: accountId,
			name: seed.name,
			domain,
			industry: seed.industry,
			region: seed.region,
			plan: seed.plan,
			seats: seed.seats,
			createdAt: owner.joinedAt,
			ownerId: owner.id,
		});
		accountUsage.push(account);
		milestones.push({
			accountId,
			kind: "created",
			at: owner.joinedAt,
			personId: owner.id,
			peopleCount: null,
		});
		if (upgradeDaysAgo >= 1) {
			milestones.push({
				accountId,
				kind: "upgraded",
				at: isoAt(upgradeDaysAgo, Math.min(1435, ownerMinute + 45)),
				personId: owner.id,
				peopleCount: null,
			});
		}
		// The oldest join first: the team reached a size on the day its last needed person joined.
		const joinsOldestFirst = [...joinDays].sort(
			(first, second) => second - first,
		);
		for (const size of TEAM_SIZE_MILESTONES) {
			const reachedDaysAgo = joinsOldestFirst[size - 1];
			if (reachedDaysAgo !== undefined) {
				milestones.push({
					accountId,
					kind: "people_reached",
					// The end of the work day, so it comes after the joins of that day.
					at: isoAt(reachedDaysAgo, 1439),
					personId: null,
					peopleCount: size,
				});
			}
		}
		for (const [eventIndex, use] of latestUse) {
			milestones.push({
				accountId,
				kind:
					eventIndex === INTEGRATION_CONNECTED
						? "integration_connected"
						: "automation_created",
				at: isoAt(use.daysAgo, 14 * 60),
				personId: use.personId,
				peopleCount: null,
			});
		}
	}

	recentEvents.sort((first, second) => second.at - first.at);
	return {
		todayStart,
		accounts,
		accountUsage,
		people,
		personUsage,
		milestones,
		usage,
		recentEvents,
	};
}

let cachedTables: SampleTables | null = null;

/**
 * Every sample table. The tables are built one time per day: the rows, the ids, and the totals stay the same
 * until local midnight. Only the stream of today grows, because a read keeps the events before now.
 */
export function getSampleTables(): SampleTables {
	const todayStart = startOfLocalDay(Date.now());
	if (cachedTables?.todayStart !== todayStart) {
		cachedTables = buildSampleTables(todayStart);
	}
	return cachedTables;
}

/**
 * The newest `limit` events before `now` (milliseconds since 1970), newest first. No event is in the future.
 * Two rows in sequence never show two different people with the same first name: the list skips the second one.
 */
export function latestEventsBefore(
	tables: SampleTables,
	now: number,
	limit: number,
): RecentEvent[] {
	const firstNameOf = (personIndex: number) =>
		tables.people[personIndex]?.name.split(" ")[0] ?? "";
	const latest: RecentEvent[] = [];
	for (const event of tables.recentEvents) {
		if (event.at > now) {
			continue;
		}
		if (latest.length === limit) {
			break;
		}
		const previous = latest.at(-1);
		const isNameTwin =
			previous !== undefined &&
			previous.personIndex !== event.personIndex &&
			firstNameOf(previous.personIndex) === firstNameOf(event.personIndex);
		if (!isNameTwin) {
			latest.push(event);
		}
	}
	return latest;
}

/**
 * The time of the last event of today before `now`, per person index and per account index.
 * A person or an account with no entry was last seen on a complete day: read `lastActiveDaysAgo`.
 */
export function lastSeenToday(
	tables: SampleTables,
	now: number,
): { byPerson: Map<number, number>; byAccount: Map<number, number> } {
	const byPerson = new Map<number, number>();
	const byAccount = new Map<number, number>();
	const accountIndexById = new Map(
		tables.accounts.map((account, index) => [account.id, index]),
	);
	for (const event of tables.recentEvents) {
		// The list is newest first, so the events of yesterday end the loop.
		if (event.at < tables.todayStart) {
			break;
		}
		if (event.at > now || byPerson.has(event.personIndex)) {
			continue;
		}
		byPerson.set(event.personIndex, event.at);
		const accountId = tables.people[event.personIndex]?.accountId ?? "";
		const accountIndex = accountIndexById.get(accountId);
		if (accountIndex !== undefined && !byAccount.has(accountIndex)) {
			byAccount.set(accountIndex, event.at);
		}
	}
	return { byPerson, byAccount };
}

/** The ISO time of the last event of a complete day: `daysAgo` days before the day of the tables, at `minute`. */
export function pastDayTime(
	tables: SampleTables,
	daysAgo: number,
	minute: number,
): string {
	return new Date(
		startOfDayAgo(tables.todayStart, daysAgo) + minute * MINUTE_MS,
	).toISOString();
}
