// The sample audience of Fernhill Review: the age ranges, the cities, and the online hours of its followers.
// audience.queries.ts turns these shares into counts of the real follower total. A later turn reads them from a table.
// Every city is invented. Fernhill is the home city of the magazine. The shares are invented too.

/** The age ranges that the networks report, youngest first, with the share of followers in each. */
export const AGE_SHARES = [
	{ range: "13–17", share: 0.03 },
	{ range: "18–24", share: 0.21 },
	{ range: "25–34", share: 0.37 },
	{ range: "35–44", share: 0.22 },
	{ range: "45–54", share: 0.11 },
	{ range: "55+", share: 0.06 },
] as const;

/** The five largest cities of the audience. The rest of the followers is "other". */
export const CITY_SHARES = [
	{ city: "Fernhill", share: 0.34 },
	{ city: "Kingsmouth", share: 0.14 },
	{ city: "Ashby Cross", share: 0.1 },
	{ city: "Port Linnet", share: 0.06 },
	{ city: "Wrenmoor", share: 0.05 },
] as const;

/** The 8 blocks of 3 hours of a day, as the start hour of each block. */
export const HOUR_BLOCKS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

// How many followers are online in each block of a weekday, from 0 to 1. The evening is the peak.
const WEEKDAY_ONLINE = [0.1, 0.04, 0.26, 0.42, 0.55, 0.5, 0.93, 0.68] as const;

// The weekend: a late morning and a long evening.
const WEEKEND_ONLINE = [0.16, 0.06, 0.14, 0.58, 0.66, 0.6, 0.84, 0.74] as const;

// A small fixed change per weekday (Monday first), so no two days look the same.
const DAY_LIFT = [-0.04, 0, 0.02, 0.06, 0.03, 0, -0.02] as const;

/**
 * The online level of each block, Monday first: 7 rows of 8 values from 0 to 1, where 1 is the busiest block.
 * Friday evening runs late, Sunday morning starts late.
 */
export function onlineLevels(): number[][] {
	const rows = DAY_LIFT.map((lift, dayIndex) => {
		const isWeekend = dayIndex >= 5;
		const base = isWeekend ? WEEKEND_ONLINE : WEEKDAY_ONLINE;
		return base.map((level, blockIndex) => {
			// Friday night (21:00 block) is as busy as a weekend night.
			const fridayNight = dayIndex === 4 && blockIndex === 7 ? 0.1 : 0;
			return Math.max(0, level + lift + fridayNight);
		});
	});
	const peak = Math.max(...rows.flat());
	return rows.map((row) => row.map((level) => level / peak));
}

/** One message of the sample inbox thread. `minutesAgo` places it before the render time. */
export type SampleMessage = {
	id: string;
	/** "follower": the message of the follower. "brand": a reply of the social team. */
	from: "follower" | "brand";
	text: string;
	minutesAgo: number;
};

/** The follower of the sample inbox thread: an invented handle on the photo feed. */
export const INBOX_FOLLOWER = {
	handle: "@maren.walks",
	name: "Maren Holt",
} as const;

/** A short thread under the newest photo post: a question, an answer, a thanks. Invented text. */
export const INBOX_MESSAGES: readonly SampleMessage[] = [
	{
		id: "m-1",
		from: "follower",
		text: "Is the market in the city guide open on Sundays?",
		minutesAgo: 96,
	},
	{
		id: "m-2",
		from: "brand",
		text: "Yes, every Sunday from 9 to 14. The flower stalls close first.",
		minutesAgo: 81,
	},
	{
		id: "m-3",
		from: "follower",
		text: "Great, thanks! Can I share the guide in my club newsletter?",
		minutesAgo: 34,
	},
	{
		id: "m-4",
		from: "brand",
		text: "Of course. Please link back to the post.",
		minutesAgo: 20,
	},
];
