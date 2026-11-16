// The sample history of Fernhill Review, a fictional culture magazine: its posts and the daily stats of its 5 channels.
// The queryFn of each page calls buildSocialData(). A later turn replaces those queryFn bodies with Supabase reads.
// A seeded generator plays 180 days of posting from the start of today, so the rows stay the same all day.
// Each daily stat sums the posts of that day, so every total of a page agrees with its rows.
import { writePost } from "./captions";
import {
	CHANNELS,
	type ChannelId,
	type ChannelProfile,
	type PostFormat,
} from "./channels";
import {
	type FailureReason,
	PILLARS,
	type Pillar,
	type PostStatus,
	TEAM,
} from "./post-vocabulary";
import {
	DAY_MS,
	dayKeyOf,
	HOUR_MS,
	startOfDayAgo,
	startOfLocalDay,
} from "./time";

// Days of history: two periods of 90 days, so the 90-day figures have a previous period.
const HISTORY_DAYS = 180;

/** Days of posts that the post list shows: today and the 90 days before it. */
export const LIST_DAYS = 90;

// Days ahead that the queue holds scheduled posts.
const QUEUE_DAYS = 13;

// A post earns its impressions over four calendar days: the share of each day, publish day first.
const DAY_SHARES = [0.55, 0.25, 0.12, 0.08] as const;

// The weight of each weekday (Sunday first) for the chance of a post. The weights average 1.
const POSTING_WEEKDAY = [0.75, 1.1, 1.15, 1.1, 1.15, 1, 0.75] as const;

// The weight of each weekday (Sunday first) for the baseline impressions. People scroll more at the weekend.
const ATTENTION_WEEKDAY = [1.18, 0.92, 0.95, 0.97, 0.98, 1.02, 1.12] as const;

// Reach and engagement of each format against the channel average.
const FORMAT_REACH = {
	image: 1,
	carousel: 1.2,
	reel: 1.35,
	video: 1,
	text: 0.8,
	link: 0.9,
} satisfies Record<PostFormat, number>;
const FORMAT_ENGAGEMENT = {
	image: 1,
	carousel: 1.3,
	reel: 1.1,
	video: 1,
	text: 0.9,
	link: 0.7,
} satisfies Record<PostFormat, number>;

// Reach of each pillar against the channel average. City guides travel the furthest.
const PILLAR_REACH = {
	interviews: 1.1,
	cityGuide: 1.3,
	reviews: 0.9,
	events: 1,
	studio: 0.8,
} satisfies Record<Pillar, number>;

// The fixed seed of the generator. Another seed gives another history with the same shape.
const SEED = 20_241_108;

// The minutes of a scheduled time. Teams schedule on the quarter hour.
const QUARTER_MINUTES = [0, 15, 30, 45] as const;

/** One post of the brand on one channel. Times are ISO texts. Counters are 0 until the post is published. */
export type Post = {
	/** Stable for the day, for example "p-0142". The detail route reads it from the URL. */
	id: string;
	channelId: ChannelId;
	pillar: Pillar;
	format: PostFormat;
	status: PostStatus;
	/** The headline that the team sees in lists. The network shows only the caption. */
	title: string;
	caption: string;
	hashtags: string[];
	/** The team member who wrote the post. */
	author: string;
	/** The team member who approved it. Empty for a draft. */
	approver: string;
	/** When the author created the draft. */
	createdAt: string;
	/** The publish time: past for a published or failed post, future for a scheduled one. null for a draft. */
	publishAt: string | null;
	/** Why the network refused the post. null unless the status is failed. */
	failureReason: FailureReason | null;
	/** Impressions per calendar day since publishing, publish day first. Up to 4 days; empty before publishing. */
	impressionsByDay: number[];
	impressions: number;
	/** Likes, comments, shares, and saves together. */
	engagements: number;
	likes: number;
	comments: number;
	shares: number;
	saves: number;
	/** Clicks on the link of the post or the bio. */
	clicks: number;
};

/** One complete day of one channel. */
export type DayStat = {
	/** YYYY-MM-DD in the browser time zone. */
	day: string;
	/** Views of posts, the profile, and search results on that day. */
	impressions: number;
	engagements: number;
	/** Followers gained minus followers lost on that day. Can be negative. */
	followerGain: number;
	/** Followers at the end of that day. */
	followers: number;
	/** Posts published on that day. */
	posts: number;
};

/** The daily stats of one channel, oldest first. The last day is yesterday. */
export type ChannelHistory = {
	id: ChannelId;
	/** Followers at the end of yesterday. */
	followers: number;
	/** 180 complete days: two periods of 90 days. */
	days: DayStat[];
};

/** Everything that the pages read: all posts, newest first, and the history of each channel. */
export type SocialData = {
	posts: Post[];
	channels: ChannelHistory[];
};

// A small seeded generator (mulberry32). The same seed gives the same numbers on every render.
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function pick<Item>(items: readonly Item[], random: () => number): Item {
	const item = items[Math.floor(random() * items.length)];
	if (item === undefined) {
		throw new Error("pick() needs a list with one item or more");
	}
	return item;
}

// A post before its counters: the generator decides the counters in a second pass.
type PostPlan = {
	channel: ChannelProfile;
	daysAgo: number;
	publishAt: number;
	format: PostFormat;
	pillar: Pillar;
	/** Impressions over four days if all goes well. */
	potential: number;
	/** Engagements over impressions of this post. */
	rate: number;
	author: string;
	approver: string;
	createdAt: number;
};

// Daily sums of one channel, indexed by days ago (1 is yesterday).
type DayTotals = {
	impressions: number[];
	postImpressions: number[];
	engagements: number[];
	posts: number[];
};

// The newer the day, the larger the audience: +25 % over the 180 days.
function growth(daysAgo: number): number {
	return 1 + (0.25 * (HISTORY_DAYS - daysAgo)) / HISTORY_DAYS;
}

// The six drafts of the queue: no time yet. Fixed facts, so the queue reads like a real plan.
const DRAFTS: readonly {
	channelId: ChannelId;
	format: PostFormat;
	pillar: Pillar;
	daysAgo: number;
	hour: number;
}[] = [
	{
		channelId: "photo",
		format: "carousel",
		pillar: "cityGuide",
		daysAgo: 1,
		hour: 15,
	},
	{
		channelId: "shorts",
		format: "reel",
		pillar: "interviews",
		daysAgo: 2,
		hour: 11,
	},
	{ channelId: "pro", format: "text", pillar: "studio", daysAgo: 3, hour: 9 },
	{
		channelId: "video",
		format: "video",
		pillar: "reviews",
		daysAgo: 4,
		hour: 14,
	},
	{
		channelId: "microblog",
		format: "link",
		pillar: "events",
		daysAgo: 6,
		hour: 16,
	},
	{
		channelId: "photo",
		format: "image",
		pillar: "reviews",
		daysAgo: 8,
		hour: 10,
	},
];

// The fixed slots from yesterday to the day after tomorrow. The random draw can leave today empty,
// and a social desk is never idle on the day the user opens it. One slot per channel and day.
// The failed posts are the newest Microblog post from 1 day ago and the newest Pro post from 2 days ago.
// So no slot sits on Microblog yesterday or on Pro 2 days ago: a fixed slot is never a failed post.
const PINNED_SLOTS: readonly {
	channelId: ChannelId;
	format: PostFormat;
	pillar: Pillar;
	/** 1 is yesterday, 0 is today, -1 is tomorrow. */
	daysAgo: number;
	hour: number;
	minute: number;
}[] = [
	{
		channelId: "photo",
		format: "carousel",
		pillar: "cityGuide",
		daysAgo: 1,
		hour: 18,
		minute: 0,
	},
	{
		channelId: "pro",
		format: "link",
		pillar: "interviews",
		daysAgo: 1,
		hour: 9,
		minute: 15,
	},
	{
		channelId: "microblog",
		format: "link",
		pillar: "events",
		daysAgo: 0,
		hour: 9,
		minute: 0,
	},
	{
		channelId: "video",
		format: "video",
		pillar: "reviews",
		daysAgo: 0,
		hour: 13,
		minute: 30,
	},
	{
		channelId: "photo",
		format: "reel",
		pillar: "studio",
		daysAgo: 0,
		hour: 19,
		minute: 0,
	},
	{
		channelId: "photo",
		format: "image",
		pillar: "interviews",
		daysAgo: -1,
		hour: 12,
		minute: 0,
	},
	{
		channelId: "shorts",
		format: "reel",
		pillar: "cityGuide",
		daysAgo: -1,
		hour: 19,
		minute: 15,
	},
	{
		channelId: "pro",
		format: "text",
		pillar: "studio",
		daysAgo: -2,
		hour: 8,
		minute: 45,
	},
];

/**
 * Plays the history of the brand up to `now`. Posts of today before `now` are published, the rest are scheduled.
 * The counts, ids, and totals depend only on the start of today, so they do not change during the day.
 */
export function buildSocialData(now: number): SocialData {
	const todayStart = startOfLocalDay(now);
	const random = seededRandom(SEED);
	const plans: PostPlan[] = [];

	// Oldest day first, so the copy counters and the issue numbers grow with time.
	// The 3 extra days give the first history days the tail of earlier posts.
	for (
		let daysAgo = HISTORY_DAYS + DAY_SHARES.length - 1;
		daysAgo >= -QUEUE_DAYS;
		daysAgo -= 1
	) {
		const dayStart = startOfDayAgo(todayStart, daysAgo);
		const weekday = new Date(dayStart).getDay();
		for (const channel of CHANNELS) {
			const pinned = PINNED_SLOTS.find(
				(slot) => slot.channelId === channel.id && slot.daysAgo === daysAgo,
			);
			// A pinned slot always posts. The other pairs draw their chance.
			if (!pinned) {
				// The queue thins out after one week: the team plans the second week later.
				const queueWeight = daysAgo < -6 ? 0.45 : 1;
				const chance =
					(channel.postsPerWeek / 7) *
					(POSTING_WEEKDAY[weekday] ?? 1) *
					queueWeight;
				if (random() >= chance) {
					continue;
				}
			}
			const publishAt = pinned
				? new Date(dayStart).setHours(pinned.hour, pinned.minute)
				: new Date(dayStart).setHours(
						pick(channel.postingHours, random),
						pick(QUARTER_MINUTES, random),
					);
			const format = pinned?.format ?? pick(channel.formats, random);
			const pillar = pinned?.pillar ?? pick(PILLARS, random);
			// A rough log-normal spread: most posts land near the average, a few go far.
			const spread = Math.exp((random() + random() + random() - 1.5) * 0.7);
			// About one post in twenty travels far beyond the followers.
			const viral = random() < 0.05 ? 2.8 : 1;
			const authorIndex = Math.floor(random() * TEAM.length);
			const leadDays = 1 + Math.floor(random() * 5);
			plans.push({
				channel,
				daysAgo,
				publishAt,
				format,
				pillar,
				potential: Math.round(
					channel.impressionsPerPost *
						FORMAT_REACH[format] *
						PILLAR_REACH[pillar] *
						spread *
						viral *
						growth(daysAgo),
				),
				rate:
					channel.engagementRate *
					FORMAT_ENGAGEMENT[format] *
					(0.75 + random() * 0.5),
				author: TEAM[authorIndex] ?? "",
				approver:
					TEAM[(authorIndex + 1 + Math.floor(random() * 3)) % TEAM.length] ??
					"",
				// A draft starts some days before its slot, and always before today.
				createdAt: Math.min(
					publishAt - leadDays * DAY_MS - Math.floor(random() * 8) * HOUR_MS,
					todayStart - (1 + Math.floor(random() * 3)) * DAY_MS,
				),
			});
		}
	}

	// Two posts that the network refused: the newest past post of the microblog and the pro network.
	// The team still has to fix them, so they stay in the queue as failed.
	const failed = new Map<PostPlan, FailureReason>();
	// The plans run oldest first, so the reversed copy finds the newest match first.
	const newestPast = (channelId: ChannelId, minDaysAgo: number) =>
		[...plans]
			.reverse()
			.find(
				(plan) => plan.channel.id === channelId && plan.daysAgo >= minDaysAgo,
			);
	const failedMicroblog = newestPast("microblog", 1);
	const failedPro = newestPast("pro", 2);
	if (failedMicroblog) {
		failed.set(failedMicroblog, "expiredLogin");
	}
	if (failedPro) {
		failed.set(failedPro, "mediaRejected");
	}

	const totals = new Map<ChannelId, DayTotals>(
		CHANNELS.map((channel) => [
			channel.id,
			{
				impressions: new Array<number>(HISTORY_DAYS + 1).fill(0),
				postImpressions: new Array<number>(HISTORY_DAYS + 1).fill(0),
				engagements: new Array<number>(HISTORY_DAYS + 1).fill(0),
				posts: new Array<number>(HISTORY_DAYS + 1).fill(0),
			},
		]),
	);
	const copyCounts = new Map<Pillar, number>();
	const nextCopy = (pillar: Pillar) => {
		const count = copyCounts.get(pillar) ?? 0;
		copyCounts.set(pillar, count + 1);
		return writePost(pillar, count);
	};

	const posts: Post[] = plans.map((plan, index) => {
		const failureReason = failed.get(plan) ?? null;
		const status: PostStatus = failureReason
			? "failed"
			: plan.publishAt <= now
				? "published"
				: "scheduled";
		const channelTotals = totals.get(plan.channel.id);
		const impressionsByDay: number[] = [];
		let engagements = 0;
		if (status === "published") {
			// A post of today has one day of impressions, a post of 3 days ago or older has all four.
			const shareCount = Math.min(plan.daysAgo, DAY_SHARES.length - 1) + 1;
			for (let dayIndex = 0; dayIndex < shareCount; dayIndex += 1) {
				const dayImpressions = Math.round(
					plan.potential * (DAY_SHARES[dayIndex] ?? 0),
				);
				const dayEngagements = Math.round(dayImpressions * plan.rate);
				impressionsByDay.push(dayImpressions);
				engagements += dayEngagements;
				// The history holds complete days only: today stays out of it.
				const statDaysAgo = plan.daysAgo - dayIndex;
				if (channelTotals && statDaysAgo >= 1 && statDaysAgo <= HISTORY_DAYS) {
					channelTotals.impressions[statDaysAgo] =
						(channelTotals.impressions[statDaysAgo] ?? 0) + dayImpressions;
					channelTotals.postImpressions[statDaysAgo] =
						(channelTotals.postImpressions[statDaysAgo] ?? 0) + dayImpressions;
					channelTotals.engagements[statDaysAgo] =
						(channelTotals.engagements[statDaysAgo] ?? 0) + dayEngagements;
				}
			}
			if (channelTotals && plan.daysAgo >= 1 && plan.daysAgo <= HISTORY_DAYS) {
				channelTotals.posts[plan.daysAgo] =
					(channelTotals.posts[plan.daysAgo] ?? 0) + 1;
			}
		}
		const impressions = impressionsByDay.reduce((sum, value) => sum + value, 0);
		// A carousel is a post that people keep: it gets twice the saves.
		const saves = Math.round(
			engagements * (plan.format === "carousel" ? 0.2 : 0.1),
		);
		const comments = Math.round(engagements * 0.07);
		const shares = Math.round(engagements * 0.09);
		const copy = nextCopy(plan.pillar);
		return {
			id: `p-${String(index + 1).padStart(4, "0")}`,
			channelId: plan.channel.id,
			pillar: plan.pillar,
			format: plan.format,
			status,
			title: copy.title,
			caption: copy.caption,
			hashtags: copy.hashtags,
			author: plan.author,
			approver: plan.approver,
			createdAt: new Date(plan.createdAt).toISOString(),
			publishAt: new Date(plan.publishAt).toISOString(),
			failureReason,
			impressionsByDay,
			impressions,
			engagements,
			likes: engagements - saves - comments - shares,
			comments,
			shares,
			saves,
			// A link post sends readers to the article. Other posts get clicks on the bio link only.
			clicks: Math.round(
				impressions * (plan.format === "link" ? 0.019 : 0.004),
			),
		};
	});

	DRAFTS.forEach((draft, index) => {
		const copy = nextCopy(draft.pillar);
		posts.push({
			id: `d-${String(index + 1).padStart(4, "0")}`,
			channelId: draft.channelId,
			pillar: draft.pillar,
			format: draft.format,
			status: "draft",
			title: copy.title,
			caption: copy.caption,
			hashtags: copy.hashtags,
			author: TEAM[index % TEAM.length] ?? "",
			approver: "",
			createdAt: new Date(
				startOfDayAgo(todayStart, draft.daysAgo) + draft.hour * HOUR_MS,
			).toISOString(),
			publishAt: null,
			failureReason: null,
			impressionsByDay: [],
			impressions: 0,
			engagements: 0,
			likes: 0,
			comments: 0,
			shares: 0,
			saves: 0,
			clicks: 0,
		});
	});

	const channels = CHANNELS.map((channel) =>
		buildHistory(channel, totals.get(channel.id), todayStart, random),
	);

	// Newest first: the queue at the top, then the published posts. A draft sorts by its creation time.
	posts.sort(
		(first, second) =>
			Date.parse(second.publishAt ?? second.createdAt) -
			Date.parse(first.publishAt ?? first.createdAt),
	);
	return { posts, channels };
}

// Adds the baseline impressions and the follower gains to the post sums of one channel.
function buildHistory(
	channel: ChannelProfile,
	channelTotals: DayTotals | undefined,
	todayStart: number,
	random: () => number,
): ChannelHistory {
	const gains: number[] = new Array<number>(HISTORY_DAYS + 1).fill(0);
	const days: Omit<DayStat, "followers">[] = [];
	for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
		const dayStart = startOfDayAgo(todayStart, daysAgo);
		const weekday = new Date(dayStart).getDay();
		const baseline = Math.round(
			channel.baselineImpressions *
				(ATTENTION_WEEKDAY[weekday] ?? 1) *
				growth(daysAgo) *
				(0.88 + random() * 0.24),
		);
		// Views of the profile and of older posts engage less than a new post.
		const baselineEngagements = Math.round(
			baseline * channel.engagementRate * 0.3,
		);
		const postImpressions = channelTotals?.postImpressions[daysAgo] ?? 0;
		// The followers grow every day, more on a day with a strong post. The microblog also loses some.
		const losses =
			channel.id === "microblog"
				? Math.round(channel.followers * 0.0006 * random())
				: 0;
		const gain =
			Math.round(
				channel.followers *
					channel.dailyGrowth *
					(0.55 + random() * 0.9) *
					growth(daysAgo),
			) +
			Math.round(postImpressions * 0.0012) -
			losses;
		gains[daysAgo] = gain;
		days.push({
			day: dayKeyOf(dayStart),
			impressions: (channelTotals?.impressions[daysAgo] ?? 0) + baseline,
			engagements:
				(channelTotals?.engagements[daysAgo] ?? 0) + baselineEngagements,
			followerGain: gain,
			posts: channelTotals?.posts[daysAgo] ?? 0,
		});
	}
	// The followers at the end of a day: today's count minus the gains of the days after it.
	let laterGains = 0;
	const followersAtEnd: number[] = new Array<number>(HISTORY_DAYS + 1).fill(0);
	for (let daysAgo = 1; daysAgo <= HISTORY_DAYS; daysAgo += 1) {
		followersAtEnd[daysAgo] = channel.followers - laterGains;
		laterGains += gains[daysAgo] ?? 0;
	}
	return {
		id: channel.id,
		followers: channel.followers,
		days: days.map((stat, index) => ({
			...stat,
			followers: followersAtEnd[HISTORY_DAYS - index] ?? channel.followers,
		})),
	};
}
