// Reads of the home: the figures of a period, the report of the last 7 days, and the spend of the last 6 months.
// The loader of the home route prefetches them. OverviewPage and its cards read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a SQL read function (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import {
	addTotals,
	CHANNELS,
	type Channel,
	changeRatio,
	clickRate,
	costPerConversion,
	dayKeyOf,
	emptyTotals,
	getSampleTables,
	type MediaTotals,
	type PeriodDays,
	returnOnSpend,
	shiftDays,
	totalsBetween,
	totalsByChannel,
} from "~/features/marketing";
import type { TranslationKey } from "~/shared/i18n";

/** The period of the first load of the home, in days. The loader prefetches it. */
export const OVERVIEW_DEFAULT_DAYS: PeriodDays = 30;

/** One figure of the home, before translation. The page turns `labelKey` into the label with t(). */
export type OverviewFigure = {
	/** Stable id, also the React key and the key of the icon map, for example "conversions". */
	id: string;
	labelKey: TranslationKey;
	/** The value of the period. null when the ratio has no divisor (no impression, no click, or no spend). */
	value: number | null;
	/** How the page writes the value: a count, a ratio as a percent, an amount, or a multiple such as "3.2×". */
	display: "count" | "percent" | "money" | "multiple";
	/** Ratio against the period of the same length before: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for a cost: a fall is good news. "none" for spend: a change is neither good nor bad news. */
	goodWhen: "up" | "down" | "none";
};

/** The ids of the six "Period results" rows. PeriodResultsCard keys its icon map by them. */
export type ResultFigureId =
	| "spend"
	| "clicks"
	| "cost-per-click"
	| "conversion-rate"
	| "cost-per-conversion"
	| "revenue";

/** The sums of all channels for one day. `day` is YYYY-MM-DD in the local time zone. */
export type DayTotals = MediaTotals & { day: string };

/** One campaign of the "Top campaigns" card. */
export type TopCampaign = {
	id: string;
	name: string;
	client: string;
	/** Conversions in the period. */
	conversions: number;
	/** Ratio against the period before. null when the campaign had no conversion then. */
	change: number | null;
};

/** Everything the home shows for one period. */
export type Overview = {
	/** The four figures of the top row: impressions, click rate, conversions, and return on ad spend. */
	kpis: OverviewFigure[];
	/** The six rows of the "Period results" card. */
	results: (OverviewFigure & { id: ResultFigureId })[];
	/** One row per day of the period, oldest first. Feeds the daily area chart and the CSV export. */
	daily: DayTotals[];
	/** Conversions per day, on average over the period, and its change against the period before. */
	averageConversions: { value: number; change: number | null };
	/** Revenue of the period, split between paid media and owned channels, in whole units of CURRENCY. */
	revenue: { paid: number; owned: number; change: number | null };
	/** The six campaigns with the most conversions in the period, the most first. */
	topCampaigns: TopCampaign[];
};

/** One day of the 7-day report. */
export type WeekDay = { day: string; conversions: number };

/** One channel of the 7-day report: its spend and its share of the spend of all channels. */
export type WeekChannel = { channel: Channel; spend: number; share: number };

/** The report of the last 7 full days. */
export type WeekReport = {
	days: WeekDay[];
	/** Conversions of the 7 days. */
	conversions: number;
	/** Ratio against the 7 days before. null when they had no conversion. */
	change: number | null;
	/** The three channels with the most spend, the most first. */
	channels: WeekChannel[];
};

/** Spend of one calendar month, split between paid media and owned channels. `month` is YYYY-MM. */
export type MonthSpend = { month: string; paid: number; owned: number };

/** The spend card of the home: six calendar months, the oldest first. */
export type MonthlySpend = {
	months: MonthSpend[];
	/** Spend and revenue of the six months, in whole units of CURRENCY. */
	totals: MediaTotals;
	/** Return on ad spend of the last full month against the month before it. null when that month had no spend. */
	change: number | null;
};

/**
 * Owned channels: the list and the creator partners of the team. The other channels are paid media.
 * The split shows how much of the result the team buys and how much it owns.
 */
export const OWNED_CHANNELS: readonly Channel[] = ["email", "partners"];

// The card ranks this many campaigns.
const TOP_CAMPAIGN_COUNT = 6;

// The 7-day report lists this many channels.
const WEEK_CHANNEL_COUNT = 3;

// The spend card shows this many calendar months.
const MONTH_COUNT = 6;

// Two ratios of two periods: null when either period has no divisor, so no false delta shows.
function ratioChange(
	current: number | null,
	previous: number | null,
): number | null {
	return current === null || previous === null
		? null
		: changeRatio(current, previous);
}

// Conversions per click, as a ratio. null with no click.
function conversionRate(totals: MediaTotals): number | null {
	return totals.clicks === 0 ? null : totals.conversions / totals.clicks;
}

// Cost per click in money. null with no click.
function costPerClick(totals: MediaTotals): number | null {
	return totals.clicks === 0 ? null : totals.spend / totals.clicks;
}

/** The figures, the daily rows, the revenue split, and the top campaigns of the last `days` full days. */
export function overviewQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "period", days],
		queryFn: async (): Promise<Overview> => {
			const tables = getSampleTables();
			const rows = tables.channelDays;
			const current = totalsBetween(rows, -days, -1);
			const previous = totalsBetween(rows, -2 * days, -days - 1);

			const daily: DayTotals[] = [];
			for (let offset = -days; offset <= -1; offset++) {
				daily.push({
					day: dayKeyOf(shiftDays(tables.dayStart, offset)),
					...totalsBetween(rows, offset, offset),
				});
			}

			const paid = emptyTotals();
			const owned = emptyTotals();
			for (const row of rows) {
				if (row.dayOffset >= -days && row.dayOffset <= -1) {
					addTotals(OWNED_CHANNELS.includes(row.channel) ? owned : paid, row);
				}
			}

			const topCampaigns = tables.campaigns
				.map((campaign) => {
					const campaignRows = rows.filter(
						(row) => row.campaignId === campaign.id,
					);
					const now = totalsBetween(campaignRows, -days, -1).conversions;
					const before = totalsBetween(
						campaignRows,
						-2 * days,
						-days - 1,
					).conversions;
					return {
						id: campaign.id,
						name: campaign.name,
						client: campaign.client,
						conversions: now,
						change: changeRatio(now, before),
					};
				})
				.filter((campaign) => campaign.conversions > 0)
				.sort((first, second) => second.conversions - first.conversions)
				.slice(0, TOP_CAMPAIGN_COUNT);

			return {
				kpis: [
					{
						id: "impressions",
						labelKey: "metrics.impressions",
						value: current.impressions,
						display: "count",
						change: changeRatio(current.impressions, previous.impressions),
						goodWhen: "up",
					},
					{
						id: "click-rate",
						labelKey: "metrics.clickRateLong",
						value: clickRate(current),
						display: "percent",
						change: ratioChange(clickRate(current), clickRate(previous)),
						goodWhen: "up",
					},
					{
						id: "conversions",
						labelKey: "metrics.conversions",
						value: current.conversions,
						display: "count",
						change: changeRatio(current.conversions, previous.conversions),
						goodWhen: "up",
					},
					{
						id: "return-on-spend",
						labelKey: "metrics.returnOnSpend",
						value: returnOnSpend(current),
						display: "multiple",
						change: ratioChange(
							returnOnSpend(current),
							returnOnSpend(previous),
						),
						goodWhen: "up",
					},
				],
				results: [
					{
						id: "spend",
						labelKey: "metrics.spend",
						value: current.spend,
						display: "money",
						change: changeRatio(current.spend, previous.spend),
						goodWhen: "none",
					},
					{
						id: "clicks",
						labelKey: "metrics.clicks",
						value: current.clicks,
						display: "count",
						change: changeRatio(current.clicks, previous.clicks),
						goodWhen: "up",
					},
					{
						id: "cost-per-click",
						labelKey: "metrics.costPerClick",
						value: costPerClick(current),
						display: "money",
						change: ratioChange(costPerClick(current), costPerClick(previous)),
						goodWhen: "down",
					},
					{
						id: "conversion-rate",
						labelKey: "metrics.conversionRate",
						value: conversionRate(current),
						display: "percent",
						change: ratioChange(
							conversionRate(current),
							conversionRate(previous),
						),
						goodWhen: "up",
					},
					{
						id: "cost-per-conversion",
						labelKey: "metrics.costPerConversion",
						value: costPerConversion(current),
						display: "money",
						change: ratioChange(
							costPerConversion(current),
							costPerConversion(previous),
						),
						goodWhen: "down",
					},
					{
						id: "revenue",
						labelKey: "metrics.revenue",
						value: current.revenue,
						display: "money",
						change: changeRatio(current.revenue, previous.revenue),
						goodWhen: "up",
					},
				],
				daily,
				averageConversions: {
					value: current.conversions / days,
					change: changeRatio(current.conversions, previous.conversions),
				},
				revenue: {
					paid: paid.revenue,
					owned: owned.revenue,
					change: changeRatio(current.revenue, previous.revenue),
				},
				topCampaigns,
			};
		},
	});
}

/** Conversions per day and the spend of the top channels in the last 7 full days. Not tied to the period select. */
export function weekReportQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "week"],
		queryFn: async (): Promise<WeekReport> => {
			const tables = getSampleTables();
			const rows = tables.channelDays;
			const days: WeekDay[] = [];
			for (let offset = -7; offset <= -1; offset++) {
				days.push({
					day: dayKeyOf(shiftDays(tables.dayStart, offset)),
					conversions: totalsBetween(rows, offset, offset).conversions,
				});
			}
			const current = totalsBetween(rows, -7, -1);
			const previous = totalsBetween(rows, -14, -8);
			const byChannel = totalsByChannel(
				rows.filter((row) => row.dayOffset >= -7 && row.dayOffset <= -1),
			);
			return {
				days,
				conversions: current.conversions,
				change: changeRatio(current.conversions, previous.conversions),
				channels: CHANNELS.map((channel) => ({
					channel,
					spend: byChannel[channel].spend,
					share:
						current.spend === 0 ? 0 : byChannel[channel].spend / current.spend,
				}))
					.sort((first, second) => second.spend - first.spend)
					.slice(0, WEEK_CHANNEL_COUNT),
			};
		},
	});
}

/** Spend per calendar month, paid against owned, for the current month and the five before it. */
export function monthlySpendQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "monthly-spend"],
		queryFn: async (): Promise<MonthlySpend> => {
			const tables = getSampleTables();
			const today = new Date(tables.dayStart);
			const monthKeys: string[] = [];
			for (let back = MONTH_COUNT - 1; back >= 0; back--) {
				monthKeys.push(
					dayKeyOf(
						new Date(today.getFullYear(), today.getMonth() - back, 1).getTime(),
					).slice(0, 7),
				);
			}
			const months = new Map<string, MonthSpend>(
				monthKeys.map((month) => [month, { month, paid: 0, owned: 0 }]),
			);
			const byMonth = new Map<string, MediaTotals>(
				monthKeys.map((month) => [month, emptyTotals()]),
			);
			const totals = emptyTotals();
			for (const row of tables.channelDays) {
				const month = dayKeyOf(shiftDays(tables.dayStart, row.dayOffset)).slice(
					0,
					7,
				);
				const entry = months.get(month);
				const monthTotals = byMonth.get(month);
				// The oldest rows can fall before the first month of the card: they stay out of it.
				if (!entry || !monthTotals) {
					continue;
				}
				if (OWNED_CHANNELS.includes(row.channel)) {
					entry.owned += row.spend;
				} else {
					entry.paid += row.spend;
				}
				addTotals(monthTotals, row);
				addTotals(totals, row);
			}
			// The current month is not over, so the change compares the two months before it.
			const lastFull = byMonth.get(monthKeys.at(-2) ?? "");
			const beforeLastFull = byMonth.get(monthKeys.at(-3) ?? "");
			return {
				months: [...months.values()],
				totals,
				change:
					lastFull && beforeLastFull
						? ratioChange(
								returnOnSpend(lastFull),
								returnOnSpend(beforeLastFull),
							)
						: null,
			};
		},
	});
}
