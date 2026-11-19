// The figures of the 4 KPI cards of the Holdings page: the value, the unrealized profit, the staking rewards, and the fees.
// HoldingsPage calls buildHoldingsFigures with the rows of the position and the transaction queries.
// A SQL read function returns the same sums later.
import type { Transaction } from "~/features/activity";
import { changeRatio, DAY_MS, roundCents } from "~/features/ledger";
import type { Position } from "../api/positions.queries";

/** Days of the reward and fee windows. The badge compares them with the same number of days before. */
export const FIGURE_WINDOW_DAYS = 30;

/** One KPI: the amount, and its change as a ratio. `change` is null when there is no earlier value to compare with. */
export type HoldingsFigure = { amount: number; change: number | null };

/** The 4 KPI figures, in card order. Amounts are in the app currency. */
export type HoldingsFigures = {
	/** The value of every position. The change is the move of the last 24 hours. */
	value: HoldingsFigure;
	/** Value minus cost basis. The change is the profit as a ratio of the cost basis. */
	profit: HoldingsFigure;
	/** Confirmed staking rewards of the last 30 days, at their value on the reward day. */
	rewards: HoldingsFigure;
	/** Fees of the confirmed transactions of the last 30 days. */
	fees: HoldingsFigure;
};

/** Sums the figures. `now` is milliseconds since 1970: the windows end there. */
export function buildHoldingsFigures(
	positions: Position[],
	transactions: Transaction[],
	now: number,
): HoldingsFigures {
	const value = roundCents(positions.reduce((sum, row) => sum + row.value, 0));
	// The value of the same units at the prices of 24 hours ago: price / (1 + change).
	const valueYesterday = positions.reduce(
		(sum, row) => sum + row.value / (1 + row.change24h),
		0,
	);
	const costBasis = roundCents(
		positions.reduce((sum, row) => sum + row.costBasis, 0),
	);
	const windowMs = FIGURE_WINDOW_DAYS * DAY_MS;
	// Index 0 is the last 30 days, index 1 the 30 days before them.
	const rewards = [0, 0];
	const fees = [0, 0];
	for (const row of transactions) {
		const age = now - Date.parse(row.occurredAt);
		const window = age < 0 ? -1 : Math.floor(age / windowMs);
		if (row.status !== "confirmed" || (window !== 0 && window !== 1)) {
			continue;
		}
		fees[window] = (fees[window] ?? 0) + row.fee;
		if (row.type === "reward") {
			rewards[window] = (rewards[window] ?? 0) + row.amount;
		}
	}
	const [rewardsNow = 0, rewardsBefore = 0] = rewards.map(roundCents);
	const [feesNow = 0, feesBefore = 0] = fees.map(roundCents);
	return {
		value: { amount: value, change: changeRatio(value, valueYesterday) },
		profit: {
			amount: roundCents(value - costBasis),
			change: costBasis === 0 ? null : (value - costBasis) / costBasis,
		},
		rewards: {
			amount: rewardsNow,
			change: changeRatio(rewardsNow, rewardsBefore),
		},
		fees: { amount: feesNow, change: changeRatio(feesNow, feesBefore) },
	};
}
