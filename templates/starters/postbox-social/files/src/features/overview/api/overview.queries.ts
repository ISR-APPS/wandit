// The read of the home: every figure of its nine cards for one period, in one object.
// The /app loader prefetches the default period. OverviewPage reads the chosen period with useQuery.
// The queryFn sums the sample history and the posts of the social feature. A later turn replaces it with SQL read functions.
import { queryOptions } from "@tanstack/react-query";
import {
	buildSocialData,
	type ChannelHistory,
	type ChannelId,
	changeRatio,
	type DailyPoint,
	type DayMetric,
	dailyPoints,
	dayKeyOf,
	type Post,
	type PostFormat,
	startOfDayAgo,
	startOfLocalDay,
	sumPeriod,
} from "~/features/social";
import type { TranslationKey } from "~/shared/i18n";

// The conversation card always shows six weeks, as the kit card shows six months.
const CONVERSATION_WEEKS = 6;

// Reels and long videos are moving pictures. Every other format is a still post.
const VIDEO_FORMATS: readonly PostFormat[] = ["reel", "video"];

/** One figure with its change against the period of the same length before it. */
export type OverviewFigure = {
	/** Stable id, also the React key and the icon key of the card. */
	id: string;
	labelKey: TranslationKey;
	value: number;
	/** Intl options of the value. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period: 0.12 is +12 %. null when the previous period has no value. */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen: "up" | "down";
};

/** One part of the engagements of the posts: likes, comments, or shares. */
export type EngagementPart = {
	id: "likes" | "comments" | "shares";
	value: number;
	/** Share of all engagements of the posts of the period, from 0 to 1. */
	share: number;
};

/** One week of the conversation card. */
export type ConversationWeek = {
	/** YYYY-MM-DD of the first day of the week. */
	start: string;
	likes: number;
	/** Comments, shares, and saves: the reactions that start a conversation. */
	conversations: number;
};

/** One complete day of all channels, for the CSV export of the home. */
export type OverviewDay = {
	/** YYYY-MM-DD. Also the row id of the export. */
	id: string;
	impressions: number;
	engagements: number;
	followerGain: number;
	posts: number;
};

/** Every figure of the home for one period that ends yesterday. */
export type OverviewData = {
	/** The four stat cards: followers, engagement rate, reach, posts published. */
	stats: OverviewFigure[];
	engagementReport: {
		/** Engagements of the posts published in the period. */
		total: number;
		change: number | null;
		/** Engagements of the posts published on each weekday, Monday first: 7 values. */
		byWeekday: number[];
		parts: EngagementPart[];
	};
	/** The queue now: posts with a future slot, drafts with no slot, posts that the network refused. */
	queue: { scheduled: number; drafts: number; failed: number };
	reachSummary: {
		/** Engagements over impressions of all channels in the period. */
		engagementRate: number;
		/** Six counts of the period, shown as badges. */
		items: { id: string; labelKey: TranslationKey; value: number }[];
	};
	dailyImpressions: {
		/** Mean impressions per day of the period. */
		average: number;
		change: number | null;
		points: DailyPoint[];
	};
	formatSplit: {
		/** Impressions of reels and long videos published in the period. */
		video: number;
		/** Impressions of every other format published in the period. */
		still: number;
		change: number | null;
	};
	/** Impressions of each channel in the period, largest first. */
	channels: {
		channelId: ChannelId;
		impressions: number;
		change: number | null;
	}[];
	conversation: {
		/** Conversations over all engagements of the six weeks, from 0 to 1. */
		share: number;
		change: number | null;
		weeks: ConversationWeek[];
		likesChange: number | null;
		conversationsChange: number | null;
	};
	/** Six figures with a change, for the period summary card. */
	summary: OverviewFigure[];
	/** The days of the period, oldest first. */
	days: OverviewDay[];
};

// Published posts whose publish time falls in the period. `offset` 1 is the period before.
function postsOfPeriod(
	posts: Post[],
	todayStart: number,
	days: number,
	offset: 0 | 1,
): Post[] {
	const end = startOfDayAgo(todayStart, days * offset);
	const start = startOfDayAgo(todayStart, days * (offset + 1));
	return posts.filter((post) => {
		if (post.status !== "published" || post.publishAt === null) {
			return false;
		}
		const time = Date.parse(post.publishAt);
		return time >= start && time < end;
	});
}

function sumOf(posts: Post[], pick: (post: Post) => number): number {
	return posts.reduce((total, post) => total + pick(post), 0);
}

function rateOf(engagements: number, impressions: number): number | null {
	return impressions === 0 ? null : engagements / impressions;
}

// A change of two ratios. No ratio on one side gives no change.
function ratioChange(current: number | null, previous: number | null) {
	return current === null || previous === null
		? null
		: changeRatio(current, previous);
}

function buildOverview(
	histories: ChannelHistory[],
	posts: Post[],
	days: number,
	now: number,
): OverviewData {
	const todayStart = startOfLocalDay(now);
	const total = (pick: DayMetric) => ({
		current: sumPeriod(histories, pick, days, 0),
		previous: sumPeriod(histories, pick, days, 1),
	});
	const impressions = total((stat) => stat.impressions);
	const engagements = total((stat) => stat.engagements);
	const gains = total((stat) => stat.followerGain);
	const published = total((stat) => stat.posts);
	const followers = histories.reduce((sum, row) => sum + row.followers, 0);
	const rate = rateOf(engagements.current, impressions.current);
	const previousRate = rateOf(engagements.previous, impressions.previous);

	const current = postsOfPeriod(posts, todayStart, days, 0);
	const previous = postsOfPeriod(posts, todayStart, days, 1);
	const postEngagements = sumOf(current, (post) => post.engagements);
	const byWeekday = new Array<number>(7).fill(0);
	for (const post of current) {
		// getDay() is 0 on Sunday. The chart starts on Monday.
		const weekday =
			(new Date(post.publishAt ?? post.createdAt).getDay() + 6) % 7;
		byWeekday[weekday] = (byWeekday[weekday] ?? 0) + post.engagements;
	}
	const part = (id: EngagementPart["id"]): EngagementPart => {
		const value = sumOf(current, (post) => post[id]);
		return {
			id,
			value,
			share: postEngagements === 0 ? 0 : value / postEngagements,
		};
	};

	const isVideo = (post: Post) => VIDEO_FORMATS.includes(post.format);
	const postImpressions = (rows: Post[]) =>
		sumOf(rows, (post) => post.impressions);

	// Six weeks that end yesterday, then the six weeks before them for the change.
	const weekPosts = (weekIndex: number) =>
		postsOfPeriod(posts, startOfDayAgo(todayStart, weekIndex * 7), 7, 0);
	const weeks: ConversationWeek[] = [];
	for (let index = CONVERSATION_WEEKS - 1; index >= 0; index -= 1) {
		const rows = weekPosts(index);
		weeks.push({
			start: dayKeyOf(startOfDayAgo(todayStart, (index + 1) * 7)),
			likes: sumOf(rows, (post) => post.likes),
			conversations: sumOf(
				rows,
				(post) => post.comments + post.shares + post.saves,
			),
		});
	}
	const sixWeeks = postsOfPeriod(posts, todayStart, CONVERSATION_WEEKS * 7, 0);
	const sixWeeksBefore = postsOfPeriod(
		posts,
		todayStart,
		CONVERSATION_WEEKS * 7,
		1,
	);
	const conversationsOf = (rows: Post[]) =>
		sumOf(rows, (post) => post.comments + post.shares + post.saves);
	const likesOf = (rows: Post[]) => sumOf(rows, (post) => post.likes);
	const shareOf = (rows: Post[]) =>
		rateOf(
			conversationsOf(rows),
			sumOf(rows, (post) => post.engagements),
		);

	const postCount = { current: current.length, previous: previous.length };
	const averagePerPost =
		postCount.current === 0 ? 0 : postImpressions(current) / postCount.current;

	const dayRows: OverviewDay[] = (histories[0]?.days.slice(-days) ?? []).map(
		(stat, index) => {
			const dayIndex = (histories[0]?.days.length ?? 0) - days + index;
			const sumDay = (pick: DayMetric) =>
				histories.reduce((sum, history) => {
					const row = history.days[dayIndex];
					return sum + (row ? pick(row) : 0);
				}, 0);
			return {
				id: stat.day,
				impressions: sumDay((row) => row.impressions),
				engagements: sumDay((row) => row.engagements),
				followerGain: sumDay((row) => row.followerGain),
				posts: sumDay((row) => row.posts),
			};
		},
	);

	return {
		stats: [
			{
				id: "followers",
				labelKey: "metrics.followers",
				value: followers,
				// The followers at the end of the previous period: today's count minus the gains of this period.
				change: changeRatio(followers, followers - gains.current),
				goodWhen: "up",
			},
			{
				id: "engagement-rate",
				labelKey: "metrics.engagementRate",
				value: rate ?? 0,
				format: {
					style: "percent",
					minimumFractionDigits: 1,
					maximumFractionDigits: 1,
				},
				change: ratioChange(rate, previousRate),
				goodWhen: "up",
			},
			{
				id: "reach",
				labelKey: "metrics.reach",
				value: impressions.current,
				format: { notation: "compact", maximumFractionDigits: 1 },
				change: changeRatio(impressions.current, impressions.previous),
				goodWhen: "up",
			},
			{
				id: "posts",
				labelKey: "metrics.postsPublished",
				value: published.current,
				change: changeRatio(published.current, published.previous),
				goodWhen: "up",
			},
		],
		engagementReport: {
			total: postEngagements,
			change: changeRatio(
				postEngagements,
				sumOf(previous, (post) => post.engagements),
			),
			byWeekday,
			parts: [part("likes"), part("comments"), part("shares")],
		},
		queue: {
			scheduled: posts.filter((post) => post.status === "scheduled").length,
			drafts: posts.filter((post) => post.status === "draft").length,
			failed: posts.filter((post) => post.status === "failed").length,
		},
		reachSummary: {
			engagementRate: rate ?? 0,
			items: [
				{
					id: "posts",
					labelKey: "overview.badges.posts",
					value: postCount.current,
				},
				{
					id: "per-post",
					labelKey: "overview.badges.perPost",
					value: Math.round(averagePerPost),
				},
				{
					id: "comments",
					labelKey: "overview.badges.comments",
					value: sumOf(current, (post) => post.comments),
				},
				{
					id: "shares",
					labelKey: "overview.badges.shares",
					value: sumOf(current, (post) => post.shares),
				},
				{
					id: "saves",
					labelKey: "overview.badges.saves",
					value: sumOf(current, (post) => post.saves),
				},
				{
					id: "clicks",
					labelKey: "overview.badges.clicks",
					value: sumOf(current, (post) => post.clicks),
				},
			],
		},
		dailyImpressions: {
			average: Math.round(impressions.current / days),
			change: changeRatio(impressions.current, impressions.previous),
			points: dailyPoints(histories, (stat) => stat.impressions, days),
		},
		formatSplit: {
			video: postImpressions(current.filter(isVideo)),
			still: postImpressions(current.filter((post) => !isVideo(post))),
			change: changeRatio(postImpressions(current), postImpressions(previous)),
		},
		channels: histories
			.map((history) => {
				const inPeriod = sumPeriod(
					[history],
					(stat) => stat.impressions,
					days,
					0,
				);
				const before = sumPeriod(
					[history],
					(stat) => stat.impressions,
					days,
					1,
				);
				return {
					channelId: history.id,
					impressions: inPeriod,
					change: changeRatio(inPeriod, before),
				};
			})
			.sort((first, second) => second.impressions - first.impressions),
		conversation: {
			share: shareOf(sixWeeks) ?? 0,
			change: ratioChange(shareOf(sixWeeks), shareOf(sixWeeksBefore)),
			weeks,
			likesChange: changeRatio(likesOf(sixWeeks), likesOf(sixWeeksBefore)),
			conversationsChange: changeRatio(
				conversationsOf(sixWeeks),
				conversationsOf(sixWeeksBefore),
			),
		},
		summary: [
			{
				id: "impressions",
				labelKey: "metrics.impressions",
				value: impressions.current,
				change: changeRatio(impressions.current, impressions.previous),
				goodWhen: "up",
			},
			{
				id: "engagements",
				labelKey: "metrics.engagements",
				value: engagements.current,
				change: changeRatio(engagements.current, engagements.previous),
				goodWhen: "up",
			},
			{
				id: "new-followers",
				labelKey: "metrics.newFollowers",
				value: gains.current,
				change: changeRatio(gains.current, gains.previous),
				goodWhen: "up",
			},
			{
				id: "likes",
				labelKey: "posts.reactions.likes",
				value: likesOf(current),
				change: changeRatio(likesOf(current), likesOf(previous)),
				goodWhen: "up",
			},
			{
				id: "comments",
				labelKey: "posts.reactions.comments",
				value: sumOf(current, (post) => post.comments),
				change: changeRatio(
					sumOf(current, (post) => post.comments),
					sumOf(previous, (post) => post.comments),
				),
				goodWhen: "up",
			},
			{
				id: "clicks",
				labelKey: "posts.reactions.clicks",
				value: sumOf(current, (post) => post.clicks),
				change: changeRatio(
					sumOf(current, (post) => post.clicks),
					sumOf(previous, (post) => post.clicks),
				),
				goodWhen: "up",
			},
		],
		days: dayRows,
	};
}

/** Every figure of the home for the `days` complete days that end yesterday, against the days before them. */
export function overviewQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", days],
		queryFn: async (): Promise<OverviewData> => {
			const now = Date.now();
			const { channels, posts } = buildSocialData(now);
			return buildOverview(channels, posts, days, now);
		},
	});
}
