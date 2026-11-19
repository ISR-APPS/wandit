// Reads of the home: the figures of the overview card, and the value of each account over time.
// The /app loader prefetches them. The overview card and the balance card read them from the cache.
// Each queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	buildPositionStates,
	changeRatio,
	getSampleLedger,
	PRICE_STEP_MS,
	priceDaysAgo,
	roundCents,
	STEPS_PER_DAY,
} from "~/features/ledger";
import {
	type AccountValues,
	accountValuesStepsAgo,
	portfolioValueStepsAgo,
} from "../lib/portfolio-value";

/** The figures of the overview card. Amounts are in the app currency, with cents. */
export type PortfolioSummary = {
	/** The current value of every position. Equal to the sum of the Holdings rows. */
	value: number;
	/** What the price moves of the last 24 hours added to the current positions. New buys do not count. */
	dayChange: number;
	/** `dayChange` as a ratio of the value at the prices of 24 hours ago. null when that value is 0. */
	dayChangeRatio: number | null;
	/** Count of confirmed transactions of all time. */
	transactionCount: number;
	/** Count of accounts that hold an asset now. */
	accountCount: number;
};

/** The figures of the whole portfolio. One row, also with no position: then every figure is 0. */
export function portfolioSummaryQueryOptions() {
	return queryOptions({
		queryKey: ["portfolio", "summary"],
		queryFn: async (): Promise<PortfolioSummary> => {
			const ledger = getSampleLedger();
			const states = [
				...buildPositionStates(ledger.transactions, ledger.anchor).values(),
			].filter((state) => state.quantity > 0);
			const value = portfolioValueStepsAgo(ledger, 0);
			// The same units at the prices of 24 hours ago.
			const valueYesterday = roundCents(
				states.reduce(
					(sum, state) =>
						sum + state.quantity * priceDaysAgo(ledger, state.assetId, 1),
					0,
				),
			);
			const accounts = accountValuesStepsAgo(ledger, 0);
			return {
				value,
				dayChange: roundCents(value - valueYesterday),
				dayChangeRatio: changeRatio(value, valueYesterday),
				transactionCount: ledger.transactions.filter(
					(row) => row.status === "confirmed",
				).length,
				accountCount: Object.values(accounts).filter((amount) => amount > 0)
					.length,
			};
		},
	});
}

/** Days of the balance chart: about 7 months, like the month axis of the card. */
export const BALANCE_DAYS = 210;
// One chart point every 3 days: 71 points draw the swings of the market and stay fast to compute.
const BALANCE_STEP_DAYS = 3;

/** One point of the balance chart: the time and the value of each account then. */
export type BalancePoint = AccountValues & {
	/** Milliseconds since 1970, a midnight. */
	time: number;
};

/** The value of each account every 3 days over BALANCE_DAYS days, oldest first. The last point is today. */
export function accountBalancesQueryOptions() {
	return queryOptions({
		queryKey: ["portfolio", "account-balances"],
		queryFn: async (): Promise<BalancePoint[]> => {
			const ledger = getSampleLedger();
			const pointCount = BALANCE_DAYS / BALANCE_STEP_DAYS;
			return Array.from({ length: pointCount + 1 }, (_, index) => {
				const stepsAgo =
					(pointCount - index) * BALANCE_STEP_DAYS * STEPS_PER_DAY;
				return {
					time: ledger.anchor - stepsAgo * PRICE_STEP_MS,
					...accountValuesStepsAgo(ledger, stepsAgo),
				};
			});
		},
	});
}
