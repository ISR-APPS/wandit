// Reads of the audience page: who the followers are (ages, cities, online hours), the growth of one period,
// and the inbox thread. The audience route prefetches all three for the default period.
// Each queryFn reads the sample data of the social and audience features. A later turn replaces the body with Supabase reads.
import { queryOptions } from "@tanstack/react-query";
import {
	buildSocialData,
	type ChannelHistory,
	type ChannelId,
	changeRatio,
	type DailyPoint,
	dailyPoints,
	MINUTE_MS,
	type PeriodDays,
	sumPeriod,
} from "~/features/social";
import {
	AGE_SHARES,
	CITY_SHARES,
	INBOX_FOLLOWER,
	INBOX_MESSAGES,
	onlineLevels,
} from "../lib/sample-data";

// The bar chart of new followers keeps about 7 to 9 bars: 1 day per bar for 7 days, 5 for 30, 10 for 90.
const BUCKET_DAYS = { 7: 1, 30: 5, 90: 10 } satisfies Record<
	PeriodDays,
	number
>;

// The growth chart plots a mean of 7 days. The net gain of one day moves too much to show a trend.
const MEAN_DAYS = 7;

// The inbox thread sits under a post of the photo feed.
const INBOX_CHANNEL: ChannelId = "photo";

/** One part of the audience: a label and its count of followers. */
export type AudiencePart = {
	/** Stable id, for example "city-0". RecordTable keys rows by it. */
	id: string;
	/** "city" or "age". */
	kind: "city" | "age";
	/** A city or an age range, as text. "other" is the rest of the cities. */
	label: string;
	followers: number;
	/** Share of all followers, from 0 to 1. */
	share: number;
};

/** Everything that does not follow the period. Every count of the parts adds up to `totalFollowers`. */
export type AudienceProfile = {
	totalFollowers: number;
	ages: AudiencePart[];
	/** The five largest cities, then the "other" part. */
	cities: AudiencePart[];
	/** 7 rows (Monday first) of 8 blocks of 3 hours, from 0 to 1. */
	onlineLevels: number[][];
};

/** The growth of the followers in one period that ends yesterday. */
export type AudienceGrowth = {
	/** Net new followers in the period. Can be negative. */
	gain: number;
	/** Ratio against the previous period. null when that period gained nothing. */
	gainChange: number | null;
	/** Net new followers per group of days, oldest first. `start` is the YYYY-MM-DD of the first day. */
	buckets: { start: string; gain: number }[];
	/** Followers at the end of yesterday. */
	followers: number;
	/** Ratio of the followers against the end of the previous period. */
	followersChange: number | null;
	/** Followers at the end of each day of the period. */
	followerPoints: DailyPoint[];
	/** Net new followers per day, with the same day one period earlier. The CSV export holds these values. */
	gainPoints: DailyPoint[];
	/** The mean net gain of the 7 days that end on each day, rounded. The growth chart plots it. */
	gainTrend: DailyPoint[];
};

/** One message of the inbox thread, with its time as an ISO text. */
export type InboxMessage = {
	id: string;
	/** "follower": the message of the follower. "brand": a reply of the social team. */
	from: "follower" | "brand";
	text: string;
	at: string;
};

/** The inbox thread of one follower under one post. */
export type InboxThread = {
	handle: string;
	name: string;
	channelId: ChannelId;
	/** The post that the thread comments on. null when the channel has no published post. */
	postId: string | null;
	messages: InboxMessage[];
};

/** The query key of the inbox. The reply form writes the new message into this cache entry. */
export const INBOX_QUERY_KEY = ["audience", "inbox"] as const;

// Splits `total` by the shares. The last part takes the rest of the rounding, so the parts add up to the total.
function splitByShares(total: number, shares: readonly number[]): number[] {
	const counts = shares.map((share) => Math.round(total * share));
	const roundingRest = total - counts.reduce((sum, count) => sum + count, 0);
	const lastIndex = counts.length - 1;
	counts[lastIndex] = (counts[lastIndex] ?? 0) + roundingRest;
	return counts;
}

/** The followers by age, city, and online hour, at the end of yesterday. */
export function audienceQueryOptions() {
	return queryOptions({
		queryKey: ["audience", "profile"],
		queryFn: async (): Promise<AudienceProfile> => {
			const { channels } = buildSocialData(Date.now());
			const totalFollowers = channels.reduce(
				(sum, channel) => sum + channel.followers,
				0,
			);
			const ageCounts = splitByShares(
				totalFollowers,
				AGE_SHARES.map((row) => row.share),
			);
			const cityShares = CITY_SHARES.map((row) => row.share);
			const otherShare = 1 - cityShares.reduce((sum, share) => sum + share, 0);
			const cityCounts = splitByShares(totalFollowers, [
				...cityShares,
				otherShare,
			]);
			return {
				totalFollowers,
				ages: AGE_SHARES.map((row, index) => ({
					id: `age-${index}`,
					kind: "age",
					label: row.range,
					followers: ageCounts[index] ?? 0,
					share: (ageCounts[index] ?? 0) / totalFollowers,
				})),
				cities: [...CITY_SHARES.map((row) => row.city), "other"].map(
					(label, index) => ({
						id: `city-${index}`,
						kind: "city",
						label,
						followers: cityCounts[index] ?? 0,
						share: (cityCounts[index] ?? 0) / totalFollowers,
					}),
				),
				onlineLevels: onlineLevels(),
			};
		},
	});
}

// The mean gain of the MEAN_DAYS days that end on the day at `index`. Days before the history start do not count.
function meanGainAt(histories: readonly ChannelHistory[], index: number) {
	let total = 0;
	let count = 0;
	for (let day = Math.max(0, index - MEAN_DAYS + 1); day <= index; day += 1) {
		for (const history of histories) {
			total += history.days[day]?.followerGain ?? 0;
		}
		count += 1;
	}
	return count === 0 ? 0 : Math.round(total / count);
}

/** The follower growth of the `days` complete days that end yesterday, against the days before them. */
export function audienceGrowthQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["audience", "growth", days],
		queryFn: async (): Promise<AudienceGrowth> => {
			const histories = buildSocialData(Date.now()).channels;
			const gain = sumPeriod(histories, (stat) => stat.followerGain, days, 0);
			const previousGain = sumPeriod(
				histories,
				(stat) => stat.followerGain,
				days,
				1,
			);
			const followers = histories.reduce((sum, row) => sum + row.followers, 0);
			const gainPoints = dailyPoints(
				histories,
				(stat) => stat.followerGain,
				days,
			);
			const bucketDays = BUCKET_DAYS[days];
			const buckets: AudienceGrowth["buckets"] = [];
			for (let index = 0; index < gainPoints.length; index += bucketDays) {
				const group = gainPoints.slice(index, index + bucketDays);
				buckets.push({
					start: group[0]?.day ?? "",
					gain: group.reduce((sum, point) => sum + point.current, 0),
				});
			}
			return {
				gain,
				gainChange: changeRatio(gain, previousGain),
				buckets,
				followers,
				// The followers at the end of the previous period: today's count minus the gains of this period.
				followersChange: changeRatio(followers, followers - gain),
				followerPoints: dailyPoints(histories, (stat) => stat.followers, days),
				gainPoints,
				gainTrend: gainPoints.map((point, position) => {
					// gainPoints holds the last `days` days of the history, so position 0 is this index.
					const index = (histories[0]?.days.length ?? 0) - days + position;
					return {
						day: point.day,
						current: meanGainAt(histories, index),
						previous: meanGainAt(histories, index - days),
					};
				}),
			};
		},
	});
}

/** The inbox thread of the page. Its times are relative to the render, so the thread always looks recent. */
export function inboxQueryOptions() {
	return queryOptions({
		queryKey: INBOX_QUERY_KEY,
		queryFn: async (): Promise<InboxThread> => {
			const now = Date.now();
			const post = buildSocialData(now).posts.find(
				(row) => row.channelId === INBOX_CHANNEL && row.status === "published",
			);
			return {
				handle: INBOX_FOLLOWER.handle,
				name: INBOX_FOLLOWER.name,
				channelId: INBOX_CHANNEL,
				postId: post?.id ?? null,
				messages: INBOX_MESSAGES.map((message) => ({
					id: message.id,
					from: message.from,
					text: message.text,
					at: new Date(now - message.minutesAgo * MINUTE_MS).toISOString(),
				})),
			};
		},
		// The reply form adds messages to the cache for the session. A refetch would drop them.
		staleTime: Number.POSITIVE_INFINITY,
	});
}
