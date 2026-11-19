// Read of the home figures: the four KPIs, the new deals by source, and the pipeline by stage, for one period.
// The /app route loader prefetches the default period. DashboardPage reads the other periods after a change.
// The queryFn reads the sample tables. A later turn replaces its body with SQL read functions that return the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type BreakdownSlice,
	calendarDaysFromNow,
	changeRatio,
	DEAL_SOURCES,
	type DealSource,
	getSampleTables,
	isOpenStage,
	OPEN_STAGES,
	type OpenStage,
	type PeriodDays,
	type SampleTables,
} from "~/features/crm";

/** The period of the first load of the home, in days. */
export const DASHBOARD_DEFAULT_DAYS = 30 satisfies PeriodDays;

/** One figure and its change against the period before. `change` is a ratio, null when the earlier value is 0. */
type Figure = { value: number; change: number | null };

/** One row of the pipeline card: an open stage now, or the deals won in the period. */
export type StageTotal = {
	stage: OpenStage | "won";
	count: number;
	/** The sum of the amounts, in whole units of the app currency. */
	amount: number;
};

/** The figures of the home for one period. Amounts are whole units of the app currency. */
export type DashboardSummary = {
	/** The sum of the open deals now, against the open deals at the start of the period. */
	openPipeline: Figure & { count: number };
	/** The sum of the deals won in the period. */
	won: Figure & { count: number };
	/** Won deals out of the won and lost deals of the period, as a ratio. null when no deal closed. */
	winRate: { value: number | null; change: number | null; closed: number };
	/** The won amount divided by the won count. null when no deal was won. */
	averageDeal: { value: number | null; change: number | null };
	/** The deals created in the period, per source, largest first. */
	sources: BreakdownSlice<DealSource>[];
	/** The four open stages, then the won deals of the period. */
	stages: StageTotal[];
};

type DealRow = SampleTables["deals"][number];

function sumAmounts(deals: DealRow[]): number {
	return deals.reduce((sum, deal) => sum + deal.amount, 0);
}

// The period: the last `days` calendar days, today included. "previous" is the `days` days before it.
// The activity charts and the deal lists count the same calendar days.
function periodOf(
	timestamp: string | null,
	days: number,
	now: number,
): "current" | "previous" | null {
	if (timestamp === null) {
		return null;
	}
	const daysAgo = -calendarDaysFromNow(timestamp, now);
	return daysAgo < days ? "current" : daysAgo < 2 * days ? "previous" : null;
}

// Win rate and average deal of the deals closed in one period.
function closedFigures(deals: DealRow[]) {
	const won = deals.filter((deal) => deal.stage === "won");
	const wonAmount = sumAmounts(won);
	return {
		wonCount: won.length,
		wonAmount,
		closed: deals.length,
		winRate: deals.length === 0 ? null : won.length / deals.length,
		averageDeal: won.length === 0 ? null : wonAmount / won.length,
	};
}

// The change of a figure that can be missing. No value on one side gives no change.
function changeOf(current: number | null, previous: number | null) {
	return current === null || previous === null
		? null
		: changeRatio(current, previous);
}

/** The home figures of the last `days` days. The key holds the period, so each period has its own cache entry. */
export function dashboardQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["dashboard", days],
		queryFn: async (): Promise<DashboardSummary> => {
			const { deals } = getSampleTables();
			const now = Date.now();
			const closedIn = (period: "current" | "previous") =>
				deals.filter((deal) => periodOf(deal.closedAt, days, now) === period);
			const current = closedFigures(closedIn("current"));
			const previous = closedFigures(closedIn("previous"));

			const openNow = deals.filter((deal) => isOpenStage(deal.stage));
			// Open at the start of the period: created before it, and not closed before it.
			const openAtStart = deals.filter(
				(deal) =>
					-calendarDaysFromNow(deal.createdAt, now) >= days &&
					(deal.closedAt === null ||
						-calendarDaysFromNow(deal.closedAt, now) < days),
			);
			const created = deals.filter(
				(deal) => periodOf(deal.createdAt, days, now) === "current",
			);

			return {
				openPipeline: {
					value: sumAmounts(openNow),
					count: openNow.length,
					change: changeRatio(sumAmounts(openNow), sumAmounts(openAtStart)),
				},
				won: {
					value: current.wonAmount,
					count: current.wonCount,
					change: changeRatio(current.wonAmount, previous.wonAmount),
				},
				winRate: {
					value: current.winRate,
					change: changeOf(current.winRate, previous.winRate),
					closed: current.closed,
				},
				averageDeal: {
					value: current.averageDeal,
					change: changeOf(current.averageDeal, previous.averageDeal),
				},
				sources: DEAL_SOURCES.map((source) => ({
					label: source,
					value: created.filter((deal) => deal.source === source).length,
				})).sort((first, second) => second.value - first.value),
				stages: [
					...OPEN_STAGES.map((stage) => {
						const ofStage = openNow.filter((deal) => deal.stage === stage);
						return {
							stage,
							count: ofStage.length,
							amount: sumAmounts(ofStage),
						};
					}),
					{
						stage: "won",
						count: current.wonCount,
						amount: current.wonAmount,
					},
				],
			};
		},
	});
}
