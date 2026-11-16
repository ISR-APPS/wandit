// Reads of channels: the five cards of the list, and the figures, trend, formats, and top posts of one channel.
// The list and detail routes prefetch them. The channel page reads the period figures with useQuery after a change.
// Each queryFn sums the sample history of the social feature. A later turn replaces the body with a Supabase read.
import { queryOptions } from "@tanstack/react-query";
import {
	buildSocialData,
	CHANNEL_IDS,
	type ChannelHistory,
	type ChannelId,
	type ChannelProfile,
	changeRatio,
	channelProfile,
	type DailyPoint,
	type DayMetric,
	dailyPoints,
	type Post,
	type PostFormat,
	startOfDayAgo,
	startOfLocalDay,
	sumPeriod,
} from "~/features/social";

// The cards of the list page cover this many complete days.
const CARD_DAYS = 30;

// The format ranking of a channel covers the whole list window.
const FORMAT_DAYS = 90;

// The top posts list of a channel shows this many rows.
const TOP_POST_COUNT = 5;

/** The figures of one channel for one period that ends yesterday, each with its previous period. */
export type ChannelFigures = {
	followers: number;
	netGrowth: number;
	netGrowthChange: number | null;
	impressions: number;
	impressionsChange: number | null;
	engagementRate: number;
	engagementRateChange: number | null;
	posts: number;
	postsChange: number | null;
	/** Mean impressions of the posts published in the period. 0 when the channel did not post. */
	averageImpressions: number;
};

/** One card of the list page: the profile, the 30-day figures, and the followers of each day. */
export type ChannelSummary = {
	profile: ChannelProfile;
	figures: ChannelFigures;
	/** Followers at the end of each of the last 30 days, oldest first. */
	followerPoints: DailyPoint[];
};

/** The engagement of one format on one channel in the last 90 days. */
export type FormatScore = {
	format: PostFormat;
	posts: number;
	/** Engagements over impressions of the posts of this format. */
	engagementRate: number;
};

// The published posts of one channel in the period that ends yesterday.
function postsInPeriod(
	posts: Post[],
	channelId: ChannelId,
	days: number,
	now: number,
): Post[] {
	const todayStart = startOfLocalDay(now);
	const periodStart = startOfDayAgo(todayStart, days);
	return posts.filter(
		(post) =>
			post.channelId === channelId &&
			post.status === "published" &&
			post.publishAt !== null &&
			Date.parse(post.publishAt) >= periodStart &&
			Date.parse(post.publishAt) < todayStart,
	);
}

function rateOf(history: ChannelHistory, days: number, offset: 0 | 1) {
	const impressions = sumPeriod(
		[history],
		(stat) => stat.impressions,
		days,
		offset,
	);
	const engagements = sumPeriod(
		[history],
		(stat) => stat.engagements,
		days,
		offset,
	);
	return impressions === 0 ? null : engagements / impressions;
}

function buildFigures(
	history: ChannelHistory,
	posts: Post[],
	days: number,
	now: number,
): ChannelFigures {
	const sum = (pick: DayMetric) => ({
		current: sumPeriod([history], pick, days, 0),
		previous: sumPeriod([history], pick, days, 1),
	});
	const growth = sum((stat) => stat.followerGain);
	const impressions = sum((stat) => stat.impressions);
	const postCount = sum((stat) => stat.posts);
	const rate = rateOf(history, days, 0);
	const previousRate = rateOf(history, days, 1);
	const periodPosts = postsInPeriod(posts, history.id, days, now);
	return {
		followers: history.followers,
		netGrowth: growth.current,
		netGrowthChange: changeRatio(growth.current, growth.previous),
		impressions: impressions.current,
		impressionsChange: changeRatio(impressions.current, impressions.previous),
		engagementRate: rate ?? 0,
		engagementRateChange:
			rate === null || previousRate === null
				? null
				: changeRatio(rate, previousRate),
		posts: postCount.current,
		postsChange: changeRatio(postCount.current, postCount.previous),
		averageImpressions:
			periodPosts.length === 0
				? 0
				: Math.round(
						periodPosts.reduce((total, post) => total + post.impressions, 0) /
							periodPosts.length,
					),
	};
}

function historyOf(histories: ChannelHistory[], id: ChannelId): ChannelHistory {
	const history = histories.find((row) => row.id === id);
	if (!history) {
		throw new Error(`No history for channel ${id}`);
	}
	return history;
}

/** The five channel cards, in the channel order, with their figures of the last 30 days. */
export function channelsQueryOptions() {
	return queryOptions({
		queryKey: ["channels", "list"],
		queryFn: async (): Promise<ChannelSummary[]> => {
			const now = Date.now();
			const { channels, posts } = buildSocialData(now);
			return CHANNEL_IDS.map((id) => {
				const history = historyOf(channels, id);
				return {
					profile: channelProfile(id),
					figures: buildFigures(history, posts, CARD_DAYS, now),
					followerPoints: dailyPoints(
						[history],
						(stat) => stat.followers,
						CARD_DAYS,
					),
				};
			});
		},
	});
}

// The id of a channel from the URL, or null for a text that names no channel.
function parseChannelId(value: string): ChannelId | null {
	return CHANNEL_IDS.find((id) => id === value) ?? null;
}

/** The facts of one channel that do not follow the period: its profile and the format ranking. null for an unknown id. */
export function channelQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["channels", "detail", id],
		queryFn: async () => {
			const channelId = parseChannelId(id);
			if (!channelId) {
				return null;
			}
			const now = Date.now();
			const posts = postsInPeriod(
				buildSocialData(now).posts,
				channelId,
				FORMAT_DAYS,
				now,
			);
			const profile = channelProfile(channelId);
			const formats: FormatScore[] = profile.formats
				.map((format) => {
					const rows = posts.filter((post) => post.format === format);
					const impressions = rows.reduce(
						(sum, post) => sum + post.impressions,
						0,
					);
					const engagements = rows.reduce(
						(sum, post) => sum + post.engagements,
						0,
					);
					return {
						format,
						posts: rows.length,
						engagementRate: impressions === 0 ? 0 : engagements / impressions,
					};
				})
				.sort((first, second) => second.engagementRate - first.engagementRate);
			return { profile, formats };
		},
	});
}

/** The figures, the impressions per day, and the top posts of one channel in the period. null for an unknown id. */
export function channelPeriodQueryOptions(id: string, days: number) {
	return queryOptions({
		queryKey: ["channels", "period", id, days],
		queryFn: async () => {
			const channelId = parseChannelId(id);
			if (!channelId) {
				return null;
			}
			const now = Date.now();
			const { channels, posts } = buildSocialData(now);
			const history = historyOf(channels, channelId);
			return {
				figures: buildFigures(history, posts, days, now),
				impressions: dailyPoints([history], (stat) => stat.impressions, days),
				topPosts: postsInPeriod(posts, channelId, days, now)
					.sort((first, second) => second.impressions - first.impressions)
					.slice(0, TOP_POST_COUNT),
			};
		},
	});
}
