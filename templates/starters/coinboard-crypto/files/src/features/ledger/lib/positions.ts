// The position math of the ledger: the units held, the cost basis, and the realized profit of each asset.
// The query files of holdings, portfolio, and markets call it with the sample transactions.
// A SQL read function does the same math later, with one row per asset.
import { UNIT_DIRECTION } from "./ledger-codes";
import type { TransactionRow } from "./sample-data";

/** The state of one asset after a list of transactions. */
export type PositionState = {
	assetId: string;
	/** Units held. 0 after the user sold or moved out every unit. */
	quantity: number;
	/** What the held units cost, in CURRENCY (lib/format.ts), by the average cost method. */
	costBasis: number;
	/** The profit of the units already sold: the sale amount minus their average cost. */
	realizedProfit: number;
	/** ISO time of the first confirmed transaction of the asset. */
	firstAt: string;
};

// 8 decimals remove the float rest of a sum of quantities.
function roundUnits(value: number): number {
	return Math.round(value * 1e8) / 1e8;
}

/**
 * Runs the confirmed transactions up to `until` (milliseconds since 1970) in time order.
 * A pending or a failed transaction moves no unit. A deposit and a reward enter at their market value.
 */
export function buildPositionStates(
	transactions: TransactionRow[],
	until: number,
): Map<string, PositionState> {
	const states = new Map<string, PositionState>();
	for (const row of transactions) {
		if (row.status !== "confirmed" || Date.parse(row.occurredAt) > until) {
			continue;
		}
		const state = states.get(row.assetId) ?? {
			assetId: row.assetId,
			quantity: 0,
			costBasis: 0,
			realizedProfit: 0,
			firstAt: row.occurredAt,
		};
		if (UNIT_DIRECTION[row.type] === 1) {
			state.quantity = roundUnits(state.quantity + row.quantity);
			state.costBasis += row.amount;
		} else {
			// The units that leave take their share of the cost with them.
			const averageCost =
				state.quantity > 0 ? state.costBasis / state.quantity : 0;
			const costOut = averageCost * row.quantity;
			state.quantity = roundUnits(state.quantity - row.quantity);
			state.costBasis = state.quantity === 0 ? 0 : state.costBasis - costOut;
			if (row.type === "sell") {
				state.realizedProfit += row.amount - costOut;
			}
		}
		states.set(row.assetId, state);
	}
	return states;
}

/** Rounds an amount in CURRENCY to cents, so a total equals the sum of the lines that the page shows. */
export function roundCents(value: number): number {
	return Math.round(value * 100) / 100;
}
