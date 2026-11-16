// The key moments of one asset: its year high and low, its best and worst day, and the first units of the user.
// assets.queries.ts builds them for the asset page. KeyMomentsCard draws them as a timeline.
// A SQL read function finds the same rows later, with window functions over the price steps.
import {
	PRICE_STEP_MS,
	STEPS_PER_DAY,
	type TransactionRow,
} from "~/features/ledger";

/** One dated event of an asset. `kind` tells which fields the moment has. */
export type KeyMoment =
	| {
			kind: "yearHigh" | "yearLow";
			/** ISO time of the 6-hour price step. */
			at: string;
			/** The price at that step, in the app currency. */
			price: number;
	  }
	| {
			kind: "bestDay" | "worstDay";
			/** ISO time of the midnight that ends the day. */
			at: string;
			/** The change from one midnight price to the next, as a ratio. */
			change: number;
	  }
	| {
			kind: "firstUnits";
			at: string;
			/** Units of the first confirmed transaction of the user. */
			quantity: number;
	  };

/**
 * `stepPrices` holds one price per 6-hour step, oldest first; the last one is the price at `anchor` (milliseconds since 1970).
 * The high and the low read every step. The best and the worst day read the midnight prices only.
 * `transactions` are the confirmed transactions of the asset, oldest first. The result is newest first.
 */
export function buildKeyMoments(
	stepPrices: number[],
	anchor: number,
	transactions: TransactionRow[],
): KeyMoment[] {
	const lastIndex = stepPrices.length - 1;
	const stepAt = (index: number) =>
		new Date(anchor - (lastIndex - index) * PRICE_STEP_MS).toISOString();
	let highIndex = 0;
	let lowIndex = 0;
	stepPrices.forEach((price, index) => {
		if (price > (stepPrices[highIndex] ?? 0)) {
			highIndex = index;
		}
		if (price < (stepPrices[lowIndex] ?? 0)) {
			lowIndex = index;
		}
	});
	// The step indexes of the midnights, counted back from the last step, which is the current midnight.
	const midnightIndexes = stepPrices
		.map((_, index) => index)
		.filter((index) => (lastIndex - index) % STEPS_PER_DAY === 0);
	let bestIndex = lastIndex;
	let worstIndex = lastIndex;
	let bestChange = Number.NEGATIVE_INFINITY;
	let worstChange = Number.POSITIVE_INFINITY;
	midnightIndexes.forEach((index, position) => {
		const price = stepPrices[index] ?? 0;
		const previousIndex = midnightIndexes[position - 1];
		const previous =
			previousIndex === undefined ? undefined : stepPrices[previousIndex];
		if (previous === undefined || previous === 0) {
			return;
		}
		const change = (price - previous) / previous;
		if (change > bestChange) {
			bestChange = change;
			bestIndex = index;
		}
		if (change < worstChange) {
			worstChange = change;
			worstIndex = index;
		}
	});
	const moments: KeyMoment[] = [
		{
			kind: "yearHigh",
			at: stepAt(highIndex),
			price: stepPrices[highIndex] ?? 0,
		},
		{ kind: "yearLow", at: stepAt(lowIndex), price: stepPrices[lowIndex] ?? 0 },
	];
	// Fewer than 2 midnight prices give no daily change.
	if (midnightIndexes.length > 1) {
		moments.push(
			{ kind: "bestDay", at: stepAt(bestIndex), change: bestChange },
			{ kind: "worstDay", at: stepAt(worstIndex), change: worstChange },
		);
	}
	const first = transactions[0];
	if (first) {
		moments.push({
			kind: "firstUnits",
			at: first.occurredAt,
			quantity: first.quantity,
		});
	}
	return moments.sort((a, b) => b.at.localeCompare(a.at));
}
