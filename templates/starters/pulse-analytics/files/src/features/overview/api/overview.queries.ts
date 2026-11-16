// Reads of the home: the four figures, the daily active people, and the feature adoption.
// The loader of the home route prefetches them. The panels of OverviewPage read them again when the period changes.
// Each queryFn reads the sample tables. A later turn replaces its body with one SQL read function (rpc).
import { queryOptions } from "@tanstack/react-query";
import {
	ACTIVATION_STEP,
	CHANNELS,
	changeRatio,
	FEATURE_AREAS,
	getSampleTables,
	type KpiItem,
	type PeriodDays,
	PRODUCT_AREAS,
	type ProductArea,
	periodIndexOf,
	shareOf,
	sumPeriod,
	toDailyPoints,
} from "~/features/tracking";

/** How many features the adoption panel ranks. */
const RANKED_FEATURES = 6;

/** One feature in the adoption ranking. */
export type FeatureAdoption = {
	area: ProductArea;
	/** The people that used the feature in the period. */
	people: number;
	/** `people` over the active people of the period, from 0 to 1. */
	share: number;
};

// A rate of two counts. No base gives no rate, so no delta shows.
function rate(part: number, total: number): number | null {
	return total === 0 ? null : part / total;
}

/**
 * The four figures of the home for the last `days` complete days, each against the `days` days before:
 * active people, sign-ups, activation rate, and stickiness.
 */
export function overviewKpisQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["overview", "kpis", days],
		queryFn: async (): Promise<KpiItem[]> => {
			const { usage } = getSampleTables();
			const period = periodIndexOf(days);
			const people = usage.uniquePeople[period] ?? { current: 0, previous: 0 };
			const funnel = usage.funnel[period];
			const signUps = CHANNELS.map((_, channel) =>
				sumPeriod(usage.signUps[channel] ?? [], days),
			).reduce(
				(total, channel) => ({
					current: total.current + channel.current,
					previous: total.previous + channel.previous,
				}),
				{ current: 0, previous: 0 },
			);
			// Activation: the share of the new people of the period that completed a first task.
			const activation = rate(
				funnel?.current[ACTIVATION_STEP] ?? 0,
				funnel?.current[0] ?? 0,
			);
			const previousActivation = rate(
				funnel?.previous[ACTIVATION_STEP] ?? 0,
				funnel?.previous[0] ?? 0,
			);
			// Stickiness: the active people of an average day over the active people of the period.
			const personDays = sumPeriod(usage.activePeople, days);
			const stickiness = rate(personDays.current / days, people.current);
			const previousStickiness = rate(
				personDays.previous / days,
				people.previous,
			);
			return [
				{
					id: "active-people",
					labelKey: "overview.kpis.activePeople",
					hintKey: "overview.kpis.activePeopleHint",
					value: people.current,
					change: changeRatio(people.current, people.previous),
					goodWhen: "up",
				},
				{
					id: "sign-ups",
					labelKey: "overview.kpis.signUps",
					hintKey: "overview.kpis.signUpsHint",
					value: signUps.current,
					change: changeRatio(signUps.current, signUps.previous),
					goodWhen: "up",
				},
				{
					id: "activation-rate",
					labelKey: "overview.kpis.activationRate",
					hintKey: "overview.kpis.activationRateHint",
					value: activation ?? 0,
					format: { style: "percent", maximumFractionDigits: 1 },
					change:
						activation === null || previousActivation === null
							? null
							: changeRatio(activation, previousActivation),
					goodWhen: "up",
				},
				{
					id: "stickiness",
					labelKey: "overview.kpis.stickiness",
					hintKey: "overview.kpis.stickinessHint",
					value: stickiness ?? 0,
					format: { style: "percent", maximumFractionDigits: 1 },
					change:
						stickiness === null || previousStickiness === null
							? null
							: changeRatio(stickiness, previousStickiness),
					goodWhen: "up",
				},
			];
		},
	});
}

/** The active people per day for the last `days` complete days, with the same days one period earlier. Feeds the trend panel. */
export function dailyActivePeopleQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["activity", "daily-people", days],
		queryFn: async () => {
			const tables = getSampleTables();
			return toDailyPoints(tables.usage.activePeople, days, tables.todayStart);
		},
	});
}

/** The most used features of the last `days` complete days, by people, the largest first. Feeds the ranked panel. */
export function featureAdoptionQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["features", "adoption", days],
		queryFn: async (): Promise<FeatureAdoption[]> => {
			const { usage } = getSampleTables();
			const period = periodIndexOf(days);
			const activePeople = usage.uniquePeople[period]?.current ?? 0;
			return FEATURE_AREAS.map((area) => {
				const people =
					usage.areaPeople[PRODUCT_AREAS.indexOf(area)]?.[period] ?? 0;
				return { area, people, share: shareOf(people, activePeople) };
			})
				.sort((first, second) => second.people - first.people)
				.slice(0, RANKED_FEATURES);
		},
	});
}
