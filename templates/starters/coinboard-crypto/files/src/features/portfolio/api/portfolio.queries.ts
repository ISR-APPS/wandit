// Reads of the home: the figures of the whole portfolio, and its value per day.
// The /app loader prefetches them. The home tiles read them from the cache.
// Each queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	buildPositionStates,
	changeRatio,
	type DailyPoint,
	dayKey,
	getSampleLedger,
	type PeriodDays,
	PRICE_STEP_MS,
	priceDaysAgo,
	roundCents,
	STEPS_PER_DAY,
	UNIT_DIRECTION,
} from "~/features/ledger";
import { portfolioValueStepsAgo } from "../lib/portfolio-value";

/** Days of the spark of the large figure. The trend tile shows 30 and 90 days, so the spark shows the last week. */
export const SPARK_DAYS = 7;
// One spark point per price step of 6 hours.
const SPARK_STEPS = SPARK_DAYS * STEPS_PER_DAY;

/** The figures of the home. Amounts are in the app currency, with cents. */
export type PortfolioSummary = {
	/** The current value of every position. Equal to the sum of the Holdings rows. */
	value: number;
	/** What the price moves of the last SPARK_DAYS days added. Buys, sells, deposits, and withdrawals of the period do not count. */
	sparkGain: number;
	/** `sparkGain` as a ratio of the value SPARK_DAYS days ago. null when that value is 0. */
	sparkChange: number | null;
	/** The value at each 6-hour step of the last SPARK_DAYS days, oldest first. The last one is `value`. Feeds the spark. */
	sparkValues: number[];
	/** What the held units cost, by the average cost method. */
	costBasis: number;
	/** `value` minus `costBasis`, and the same as a ratio of the cost. */
	profit: number;
	profitRatio: number | null;
	/** What the price moves of the last 24 hours added to the current positions. New buys do not count. */
	dayChange: number;
	dayChangeRatio: number | null;
	/** Count of held assets, and of accounts that hold one. */
	assetCount: number;
	accountCount: number;
};

/** The figures of the whole portfolio. One row, also with no position: then every amount is 0. */
export function portfolioSummaryQueryOptions() {
	return queryOptions({
		queryKey: ["portfolio", "summary"],
		queryFn: async (): Promise<PortfolioSummary> => {
			const ledger = getSampleLedger();
			const states = [
				...buildPositionStates(ledger.transactions, ledger.anchor).values(),
			].filter((state) => state.quantity > 0);
			const value = portfolioValueStepsAgo(ledger, 0);
			const sparkStart = portfolioValueStepsAgo(ledger, SPARK_STEPS);
			// New money is not a gain: the confirmed buys and deposits of the period come off the change, sells and withdrawals go back.
			// A reward stays in the gain, because the position earns it.
			const sparkFrom = ledger.anchor - SPARK_STEPS * PRICE_STEP_MS;
			const netInflow = ledger.transactions.reduce((sum, row) => {
				const time = Date.parse(row.occurredAt);
				if (
					row.status !== "confirmed" ||
					row.type === "reward" ||
					time <= sparkFrom ||
					time > ledger.anchor
				) {
					return sum;
				}
				return sum + UNIT_DIRECTION[row.type] * row.amount;
			}, 0);
			const sparkGain = roundCents(value - sparkStart - netInflow);
			// The same units at the prices of 24 hours ago.
			const valueYesterday = states.reduce(
				(sum, state) =>
					sum + state.quantity * priceDaysAgo(ledger, state.assetId, 1),
				0,
			);
			const costBasis = roundCents(
				states.reduce((sum, state) => sum + roundCents(state.costBasis), 0),
			);
			// The account of an asset is the account of its transactions.
			const accounts = new Set(
				ledger.transactions
					.filter((row) =>
						states.some((state) => state.assetId === row.assetId),
					)
					.map((row) => row.account),
			);
			return {
				value,
				sparkGain,
				sparkChange: sparkStart === 0 ? null : sparkGain / sparkStart,
				sparkValues: Array.from({ length: SPARK_STEPS + 1 }, (_, index) =>
					portfolioValueStepsAgo(ledger, SPARK_STEPS - index),
				),
				costBasis,
				profit: roundCents(value - costBasis),
				profitRatio: changeRatio(value, costBasis),
				dayChange: roundCents(value - valueYesterday),
				dayChangeRatio: changeRatio(value, valueYesterday),
				assetCount: states.length,
				accountCount: accounts.size,
			};
		},
	});
}

/**
 * The portfolio value of each of the last `days` days, today included, oldest first.
 * `previous` is the value of the same day one period earlier, so the two lines have the same length.
 */
export function portfolioValuesQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["portfolio", "values", days],
		queryFn: async (): Promise<DailyPoint[]> => {
			const ledger = getSampleLedger();
			return Array.from({ length: days }, (_, index) => {
				const daysAgo = days - 1 - index;
				return {
					day: dayKey(ledger.anchor, daysAgo),
					current: portfolioValueStepsAgo(ledger, daysAgo * STEPS_PER_DAY),
					previous: portfolioValueStepsAgo(
						ledger,
						(daysAgo + days) * STEPS_PER_DAY,
					),
				};
			});
		},
	});
}
