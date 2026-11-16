// Reads of the home: the three figures, conversions per day by channel, and spend by channel.
// The loader of the home route prefetches them. OverviewPage and its panels read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a SQL read function (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import {
	CHANNELS,
	type Channel,
	type ChannelPoint,
	changeRatio,
	channelPoints,
	costPerConversion,
	getSampleTables,
	type PeriodDays,
	returnOnSpend,
	totalsBetween,
	totalsByChannel,
} from "~/features/marketing";
import type { TranslationKey } from "~/shared/i18n";

/** The period of the figures and of the spend breakdown, in days. The page header names it once. */
export const KPI_DAYS: PeriodDays = 30;

/** One figure of the home, before translation. The page turns `labelKey` into the label with t(). */
export type OverviewKpi = {
	/** Stable id, also the React key, for example "conversions". */
	id: string;
	labelKey: TranslationKey;
	/** The value of the last KPI_DAYS days. null when the ratio has no divisor (no spend or no conversion). */
	value: number | null;
	/** How the page writes the value: a count, an amount with cents, or a multiple such as "3.2×". */
	display: "count" | "money" | "multiple";
	/** Ratio against the KPI_DAYS days before: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for a cost: a fall is good news. */
	goodWhen: "up" | "down";
	/** One value per day, oldest first. Only the large figure draws it as a spark. */
	series?: number[];
};

/** The figures of the home and the sums that the large figure names under its value. */
export type OverviewKpis = {
	/** The figures, the most important first. The large figure shows the first one. */
	items: OverviewKpi[];
	/** Spend of the last KPI_DAYS days, in whole units of CURRENCY. */
	spend: number;
	/** Revenue that the platforms attribute to the same days. */
	revenue: number;
};

/** The spend and the conversions of one channel in a period. */
export type ChannelSpend = {
	channel: Channel;
	spend: number;
	conversions: number;
};

// Two ratios of two periods: null when either period has no divisor, so no false delta shows.
function ratioChange(
	current: number | null,
	previous: number | null,
): number | null {
	return current === null || previous === null
		? null
		: changeRatio(current, previous);
}

/** Conversions, cost per conversion, and return on ad spend of the last 30 days, against the 30 days before. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async (): Promise<OverviewKpis> => {
			const tables = getSampleTables();
			const rows = tables.channelDays;
			const current = totalsBetween(rows, -KPI_DAYS, -1);
			const previous = totalsBetween(rows, -2 * KPI_DAYS, -KPI_DAYS - 1);
			const conversionsPerDay: number[] = [];
			for (let offset = -KPI_DAYS; offset <= -1; offset++) {
				conversionsPerDay.push(totalsBetween(rows, offset, offset).conversions);
			}
			const cost = costPerConversion(current);
			const roas = returnOnSpend(current);
			return {
				items: [
					{
						id: "conversions",
						labelKey: "metrics.conversions",
						value: current.conversions,
						display: "count",
						change: changeRatio(current.conversions, previous.conversions),
						goodWhen: "up",
						series: conversionsPerDay,
					},
					{
						id: "cost-per-conversion",
						labelKey: "metrics.costPerConversion",
						value: cost,
						display: "money",
						change: ratioChange(cost, costPerConversion(previous)),
						goodWhen: "down",
					},
					{
						id: "return-on-spend",
						labelKey: "metrics.returnOnSpend",
						value: roas,
						display: "multiple",
						change: ratioChange(roas, returnOnSpend(previous)),
						goodWhen: "up",
					},
				],
				spend: current.spend,
				revenue: current.revenue,
			};
		},
	});
}

/** Conversions per day and channel for the last `days` full days, oldest first. Feeds the stacked trend panel. */
export function conversionsByChannelQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "conversions-by-channel", days],
		queryFn: async (): Promise<ChannelPoint[]> => {
			const tables = getSampleTables();
			return channelPoints(
				tables.channelDays,
				tables.dayStart,
				-days,
				-1,
				(row) => row.conversions,
			);
		},
	});
}

/** Spend and conversions per channel for the last `days` full days, the largest spend first. Feeds the breakdown. */
export function spendByChannelQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "spend-by-channel", days],
		queryFn: async (): Promise<ChannelSpend[]> => {
			const tables = getSampleTables();
			const byChannel = totalsByChannel(
				tables.channelDays.filter(
					(row) => row.dayOffset >= -days && row.dayOffset <= -1,
				),
			);
			return CHANNELS.map((channel) => ({
				channel,
				spend: byChannel[channel].spend,
				conversions: byChannel[channel].conversions,
			})).sort((first, second) => second.spend - first.spend);
		},
	});
}
