// Reads of the home: the four figures, the daily impressions, and the engagements by channel.
// The loader of the home route prefetches them for the first period. The panels read them with useQuery after a change.
// Each queryFn sums the sample history of the social feature. A later turn replaces the body with a SQL read function.
import { queryOptions } from "@tanstack/react-query";
import {
	buildSocialData,
	type ChannelHistory,
	type ChannelId,
	changeRatio,
	type DailyPoint,
	type DayMetric,
	dailyPoints,
	type KpiItem,
	sumPeriod,
} from "~/features/social";
import type { TranslationKey } from "~/shared/i18n";

/** One KPI before translation. The home turns the keys into `label` and `hint` with t(). */
export type OverviewKpi = Omit<KpiItem, "label" | "hint"> & {
	labelKey: TranslationKey;
	hintKey: TranslationKey;
	/** The value of the previous period of the same length, in the unit of `value`. null when it has no value. */
	previous: number | null;
};

/** The trend shows every channel together, or one channel. */
export type ChannelFilter = ChannelId | "all";

/** One line of the ranking: the engagements of one channel in the period. */
export type ChannelEngagement = {
	channelId: ChannelId;
	engagements: number;
	/** Share of the engagements of all channels, from 0 to 1. */
	share: number;
};

// Engagements over impressions. No impressions gives no rate, so no delta shows.
function engagementRate(
	histories: ChannelHistory[],
	days: number,
	offset: 0 | 1,
) {
	const impressions = sumPeriod(
		histories,
		(stat) => stat.impressions,
		days,
		offset,
	);
	const engagements = sumPeriod(
		histories,
		(stat) => stat.engagements,
		days,
		offset,
	);
	return impressions === 0 ? null : engagements / impressions;
}

// The 4 figures of the home, the most important first. The trend beside them shows the impressions,
// so no figure repeats that series.
function buildOverviewKpis(
	histories: ChannelHistory[],
	days: number,
): OverviewKpi[] {
	const total = (pick: DayMetric) => ({
		current: sumPeriod(histories, pick, days, 0),
		previous: sumPeriod(histories, pick, days, 1),
	});
	const engagements = total((stat) => stat.engagements);
	const followers = total((stat) => stat.followerGain);
	const posts = total((stat) => stat.posts);
	const rate = engagementRate(histories, days, 0);
	const previousRate = engagementRate(histories, days, 1);
	return [
		{
			id: "engagements",
			labelKey: "metrics.engagements",
			hintKey: "overview.hints.engagements",
			value: engagements.current,
			previous: engagements.previous,
			change: changeRatio(engagements.current, engagements.previous),
			goodWhen: "up",
		},
		{
			id: "engagement-rate",
			labelKey: "metrics.engagementRate",
			hintKey: "overview.hints.engagementRate",
			value: rate ?? 0,
			previous: previousRate,
			// Two decimals: a change of a tenth of a point must show between the value and the previous value.
			format: {
				style: "percent",
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			},
			change:
				rate === null || previousRate === null
					? null
					: changeRatio(rate, previousRate),
			goodWhen: "up",
		},
		{
			id: "new-followers",
			labelKey: "metrics.newFollowers",
			hintKey: "overview.hints.newFollowers",
			value: followers.current,
			previous: followers.previous,
			change: changeRatio(followers.current, followers.previous),
			goodWhen: "up",
		},
		{
			id: "posts",
			labelKey: "metrics.postsPublished",
			hintKey: "overview.hints.postsPublished",
			value: posts.current,
			previous: posts.previous,
			change: changeRatio(posts.current, posts.previous),
			goodWhen: "up",
		},
	];
}

/** The 4 figures of the period that ends yesterday, each against the period of the same length before it. */
export function overviewKpisQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "kpis", days],
		queryFn: async () =>
			buildOverviewKpis(buildSocialData(Date.now()).channels, days),
	});
}

/** Impressions per day of every channel, or of one channel, with the same days one period earlier. Feeds the trend. */
export function dailyImpressionsQueryOptions(
	days: number,
	channel: ChannelFilter,
) {
	return queryOptions({
		queryKey: ["overview", "impressions", days, channel],
		queryFn: async (): Promise<DailyPoint[]> =>
			dailyPoints(
				buildSocialData(Date.now()).channels.filter(
					(history) => channel === "all" || history.id === channel,
				),
				(stat) => stat.impressions,
				days,
			),
	});
}

/** Engagements of each channel in the period, largest first. There are 5 channels, so the list has no "other" line. */
export function engagementsByChannelQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "by-channel", days],
		queryFn: async (): Promise<ChannelEngagement[]> => {
			const histories = buildSocialData(Date.now()).channels;
			const rows = histories.map((history) => ({
				channelId: history.id,
				engagements: sumPeriod([history], (stat) => stat.engagements, days, 0),
			}));
			const total = rows.reduce((sum, row) => sum + row.engagements, 0);
			return rows
				.map((row) => ({
					...row,
					share: total === 0 ? 0 : row.engagements / total,
				}))
				.sort((first, second) => second.engagements - first.engagements);
		},
	});
}
