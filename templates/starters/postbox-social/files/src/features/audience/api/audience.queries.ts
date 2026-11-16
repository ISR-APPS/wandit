// Reads of the audience page: who the followers are (ages, cities, online hours), the daily growth, and the growth by channel.
// The audience route prefetches all three. The two growth cards read the chosen period with useQuery.
// Each queryFn reads the sample data of the social and audience features. A later turn replaces the body with Supabase reads.
import { queryOptions } from "@tanstack/react-query";
import {
	buildSocialData,
	type ChannelId,
	type DailyPoint,
	dailyPoints,
	sumPeriod,
} from "~/features/social";
import { AGE_SHARES, CITY_SHARES, onlineLevels } from "../lib/sample-data";

/** One part of the audience: a label and its count of followers. */
export type AudiencePart = {
	/** A city or an age range, as text. "other" is the rest of the cities. */
	label: string;
	followers: number;
	/** Share of all followers, from 0 to 1. */
	share: number;
};

/** The growth of one channel in the period. */
export type ChannelGain = {
	channelId: ChannelId;
	/** Followers gained minus followers lost. Can be negative. */
	gain: number;
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
					label: row.range,
					followers: ageCounts[index] ?? 0,
					share: (ageCounts[index] ?? 0) / totalFollowers,
				})),
				cities: [...CITY_SHARES.map((row) => row.city), "other"].map(
					(label, index) => ({
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

/** Net new followers per day on all channels, with the same days one period earlier. Feeds the growth card. */
export function followerGrowthQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["audience", "growth", days],
		queryFn: async (): Promise<DailyPoint[]> =>
			dailyPoints(
				buildSocialData(Date.now()).channels,
				(stat) => stat.followerGain,
				days,
			),
	});
}

/** Net new followers of each channel in the period, in the CHANNEL_IDS order. The sum equals the total of the growth card. */
export function followerGainByChannelQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["audience", "gain-by-channel", days],
		queryFn: async (): Promise<ChannelGain[]> =>
			buildSocialData(Date.now()).channels.map((history) => ({
				channelId: history.id,
				gain: sumPeriod([history], (stat) => stat.followerGain, days, 0),
			})),
	});
}
