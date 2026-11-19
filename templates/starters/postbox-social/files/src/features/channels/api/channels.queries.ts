// Reads of channels: the rows of the channel table, and the profile page of one channel.
// The list and detail routes prefetch them. Every figure covers the 30 complete days that end yesterday.
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
	type Post,
	type PostFormat,
	startOfDayAgo,
	startOfLocalDay,
	sumPeriod,
	TEAM,
} from "~/features/social";

// The table and the profile page compare the last 30 days with the 30 days before.
const FIGURE_DAYS = 30;

// The format ranking uses 90 days: a weekly channel has too few posts in 30 days.
const FORMAT_DAYS = 90;

// The profile page lists the 3 newest posts as activity and the 6 strongest posts as a table.
const LATEST_COUNT = 3;
const TOP_POST_COUNT = 6;

/** "reconnect": the network refused a post because the login of the account expired. */
export type ChannelStatus = "active" | "reconnect";

/** The figures of one channel for the 30 days that end yesterday. */
export type ChannelFigures = {
	/** Followers at the end of yesterday. */
	followers: number;
	/** Followers gained minus lost in the 30 days. */
	netGrowth: number;
	/** Ratio against the 30 days before. null when that period gained nothing. */
	netGrowthChange: number | null;
	impressions: number;
	/** Engagements over impressions. 0 when the channel had no impressions. */
	engagementRate: number;
	/** Posts published in the 30 days. */
	posts: number;
};

/** One row of the channel table. `id` is the channel id: RecordTable keys and selects rows by it. */
export type ChannelRow = {
	id: ChannelId;
	profile: ChannelProfile;
	figures: ChannelFigures;
	status: ChannelStatus;
};

/** The engagement of one format on one channel in the last 90 days. */
export type FormatScore = {
	format: PostFormat;
	posts: number;
	/** Engagements over impressions of the posts of this format. */
	engagementRate: number;
};

/** The profile page of one channel. */
export type ChannelDetail = ChannelRow & {
	formats: FormatScore[];
	/** Published, scheduled, or failed posts of the current week, Monday first. The weekly goal counts them. */
	postsThisWeek: number;
	/** The newest posts with a slot, published or not, newest first. */
	latest: Post[];
	/** The published posts of the 30 days with the most impressions. */
	topPosts: Post[];
	/** Each team member with the count of posts they wrote for this channel, most first. */
	team: { name: string; posts: number }[];
};

// Published posts of one channel whose publish time is in the last `days` complete days.
function publishedIn(
	posts: Post[],
	channelId: ChannelId,
	days: number,
	now: number,
): Post[] {
	const todayStart = startOfLocalDay(now);
	const start = startOfDayAgo(todayStart, days);
	return posts.filter(
		(post) =>
			post.channelId === channelId &&
			post.status === "published" &&
			post.publishAt !== null &&
			Date.parse(post.publishAt) >= start &&
			Date.parse(post.publishAt) < todayStart,
	);
}

function historyOf(histories: ChannelHistory[], id: ChannelId): ChannelHistory {
	const history = histories.find((row) => row.id === id);
	if (!history) {
		throw new Error(`No history for channel ${id}`);
	}
	return history;
}

function buildRow(history: ChannelHistory, posts: Post[]): ChannelRow {
	const impressions = sumPeriod(
		[history],
		(stat) => stat.impressions,
		FIGURE_DAYS,
		0,
	);
	const engagements = sumPeriod(
		[history],
		(stat) => stat.engagements,
		FIGURE_DAYS,
		0,
	);
	const growth = sumPeriod(
		[history],
		(stat) => stat.followerGain,
		FIGURE_DAYS,
		0,
	);
	const previousGrowth = sumPeriod(
		[history],
		(stat) => stat.followerGain,
		FIGURE_DAYS,
		1,
	);
	// An expired login blocks every post of the account until the team connects it again.
	const needsLogin = posts.some(
		(post) =>
			post.channelId === history.id &&
			post.status === "failed" &&
			post.failureReason === "expiredLogin",
	);
	return {
		id: history.id,
		profile: channelProfile(history.id),
		status: needsLogin ? "reconnect" : "active",
		figures: {
			followers: history.followers,
			netGrowth: growth,
			netGrowthChange: changeRatio(growth, previousGrowth),
			impressions,
			engagementRate: impressions === 0 ? 0 : engagements / impressions,
			posts: sumPeriod([history], (stat) => stat.posts, FIGURE_DAYS, 0),
		},
	};
}

/** The five channel rows, in the channel order. */
export function channelsQueryOptions() {
	return queryOptions({
		queryKey: ["channels", "list"],
		queryFn: async (): Promise<ChannelRow[]> => {
			const { channels, posts } = buildSocialData(Date.now());
			return CHANNEL_IDS.map((id) => buildRow(historyOf(channels, id), posts));
		},
	});
}

// The URL holds any text. Only a known channel id gets a page.
function parseChannelId(value: string): ChannelId | null {
	return CHANNEL_IDS.find((id) => id === value) ?? null;
}

/** The profile page of one channel. null for an unknown id (an old link, or a typo in the URL). */
export function channelDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["channels", "detail", id],
		queryFn: async (): Promise<ChannelDetail | null> => {
			const channelId = parseChannelId(id);
			if (!channelId) {
				return null;
			}
			const now = Date.now();
			const { channels, posts } = buildSocialData(now);
			const row = buildRow(historyOf(channels, channelId), posts);
			const ownPosts = posts.filter((post) => post.channelId === channelId);
			const formatPosts = publishedIn(posts, channelId, FORMAT_DAYS, now);
			const todayStart = startOfLocalDay(now);
			// getDay() is 0 on Sunday. The week starts on Monday.
			const weekStart = startOfDayAgo(
				todayStart,
				(new Date(todayStart).getDay() + 6) % 7,
			);
			const weekEnd = startOfDayAgo(weekStart, -7);
			return {
				...row,
				formats: row.profile.formats
					.map((format) => {
						const rows = formatPosts.filter((post) => post.format === format);
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
					.sort(
						(first, second) => second.engagementRate - first.engagementRate,
					),
				postsThisWeek: ownPosts.filter(
					(post) =>
						post.status !== "draft" &&
						post.publishAt !== null &&
						Date.parse(post.publishAt) >= weekStart &&
						Date.parse(post.publishAt) < weekEnd,
				).length,
				// The posts come newest first, so the first rows with a slot are the newest.
				latest: ownPosts
					.filter(
						(post) =>
							post.publishAt !== null && Date.parse(post.publishAt) <= now,
					)
					.slice(0, LATEST_COUNT),
				topPosts: publishedIn(posts, channelId, FIGURE_DAYS, now)
					.sort((first, second) => second.impressions - first.impressions)
					.slice(0, TOP_POST_COUNT),
				team: TEAM.map((name) => ({
					name,
					posts: ownPosts.filter((post) => post.author === name).length,
				})).sort((first, second) => second.posts - first.posts),
			};
		},
	});
}
